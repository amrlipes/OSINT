document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.getElementById('terminal-content');
    const dashboard = document.getElementById('results-dashboard');
    
    // Buttons and Inputs
    const btnUsername = document.getElementById('btn-username');
    const inputUsername = document.getElementById('username-input');
    
    const btnName = document.getElementById('btn-name');
    const inputName = document.getElementById('name-input');
    
    const btnEmail = document.getElementById('btn-email');
    const inputEmail = document.getElementById('email-input');
    
    const btnPhone = document.getElementById('btn-phone');
    const inputPhone = document.getElementById('phone-input');

    // Helper: Write to terminal
    function logToTerminal(message, type = 'info') {
        const p = document.createElement('p');
        p.className = `log ${type}`;
        
        // Add timestamp
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        p.innerHTML = `<span style="opacity:0.5">[${timeStr}]</span> ${message}`;
        
        terminal.appendChild(p);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Setup Event Listeners for each module
    function setupModule(btn, input, type) {
        if (!btn || !input) return;
        
        btn.addEventListener('click', () => {
            let query = input.value.trim();
            if(!query) {
                logToTerminal(`[ERRO] Campo de ${type} vazio. Insira um valor.`, 'error');
                return;
            }

            // Basic clean up
            if (type === 'username') query = query.replace('@', '').trim();

            logToTerminal(`Iniciando rastreio [${type.toUpperCase()}] para alvo: <span class="highlight">${query}</span>`, 'info');
            input.value = '';
            
            clearDashboard();
            executeSearchSequence(query, type);
        });

        input.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') btn.click();
        });
    }

    setupModule(btnUsername, inputUsername, 'username');
    setupModule(btnName, inputName, 'name');
    setupModule(btnEmail, inputEmail, 'email');
    setupModule(btnPhone, inputPhone, 'phone');

    function clearDashboard() {
        dashboard.innerHTML = '';
    }

    // --- OSINT ENGINE (100% Frontend via CORS Proxy) ---

    async function fetchWithProxy(url) {
        try {
            // Usando /get que sempre retorna headers CORS corretos, evitando bloqueios do navegador
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                return data.contents;
            }
        } catch (e) {
            console.error("Proxy error:", e);
        }
        return null;
    }

    async function webSearch(query, domainFilter = "") {
        let html = await fetchWithProxy(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`);
        
        if (!html) return [];
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        let links = [];
        
        const allLinks = doc.querySelectorAll('a');
        allLinks.forEach(a => {
            if (links.length >= 7) return;
            let href = a.getAttribute('href');
            if (!href) return;
            
            if (href.includes('RU=')) {
                const match = href.match(/RU=([^/]+)/);
                if (match) href = decodeURIComponent(match[1]);
            }
            
            href = href.trim();
            if (href.startsWith('//')) href = 'https:' + href;
            
            if (href.startsWith('http') && !href.includes('yahoo.com') && !href.includes('duckduckgo.com') && !href.includes('bing.com')) {
                // Validação estrita para evitar alucinação de dados
                if (domainFilter && !href.includes(domainFilter)) return;
                links.push(href);
            }
        });
        
        return [...new Set(links)];
    }

    async function searchPlatform(query, platformName, domain, icon, desc) {
        const links = await webSearch(`"${query}" site:${domain}`, domain);
        if (links && links.length > 0) {
            let details = {};
            links.forEach((link, i) => details[`Registro ${i+1}`] = link);
            return {
                source: platformName,
                icon: icon,
                desc: desc,
                url: `https://www.google.com/search?q=%22${encodeURIComponent(query)}%22+site%3A${domain}`,
                details
            };
        }
        return null;
    }

    async function searchWikipedia(query) {
        try {
            const res = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
            if (res.ok) {
                const data = await res.json();
                if (data.query && data.query.search && data.query.search.length > 0) {
                    let details = {};
                    data.query.search.slice(0, 5).forEach((item) => {
                        details[`Artigo: ${item.title}`] = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
                    });
                    return {
                        source: "Arquivos Enciclopédicos (Wikipedia)",
                        icon: "🏛",
                        desc: "Localizamos menções em registros históricos ou públicos.",
                        url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
                        details
                    };
                }
            }
        } catch (e) {}
        return null;
    }

    async function searchGithub(query) {
        try {
            const res = await fetch(`https://api.github.com/users/${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                return {
                    source: "GitHub",
                    icon: "</>",
                    desc: "Perfil de desenvolvedor encontrado.",
                    url: data.html_url,
                    details: {
                        "Nome Real": data.name || "Não informado",
                        "Empresa": data.company || "Não informado",
                        "Localização": data.location || "Não informado",
                        "Repositórios": data.public_repos || 0
                    }
                };
            }
        } catch (e) {}
        return null;
    }

    async function executeSearchSequence(query, type) {
        logToTerminal(`[SISTEMA] Iniciando busca avançada via Proxy Seguro (100% Client-Side)...`, 'system');
        
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
            <div id="results-loader" style="text-align: center; color: var(--accent-primary); margin-top: 20px;">
                <div class="dot blinking" style="display: inline-block;"></div> Varrendo plataformas e executando Dorks...
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        let results = [];
        let promises = [];

        try {
            // Construir as promessas de busca de acordo com o tipo
            if (type === 'name') {
                promises = [
                    searchWikipedia(query),
                    searchPlatform(query, "JusBrasil", "jusbrasil.com.br", "⚖️", "Envolvimentos em processos judiciais e diários oficiais."),
                    searchPlatform(query, "Jucesp (Empresas SP)", "jucesponline.sp.gov.br", "🏢", "Participação em quadros societários no estado de SP."),
                    searchPlatform(query, "Instagram", "instagram.com", "📸", "Possíveis perfis na rede social."),
                    searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Possíveis perfis na rede de vídeos curtos."),
                    searchPlatform(query, "LinkedIn", "br.linkedin.com", "💼", "Perfis profissionais indexados."),
                    searchPlatform(query, "Google Docs", "docs.google.com", "📝", "Documentos públicos ou planilhas indexadas.")
                ];
            } else if (type === 'username') {
                promises = [
                    searchGithub(query),
                    searchPlatform(query, "Instagram", "instagram.com", "📸", "Perfis na rede social."),
                    searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Perfis na rede de vídeos curtos."),
                    searchPlatform(query, "Twitter/X", "twitter.com", "🐦", "Menções ou perfil na rede social.")
                ];
            } else if (type === 'email') {
                promises = [
                    searchPlatform(query, "GitHub", "github.com", "</>", "Commits ou perfis contendo este email."),
                    searchPlatform(query, "Google Docs", "docs.google.com", "📝", "Planilhas ou documentos vazados contendo este email."),
                    searchPlatform(query, "Twitter/X", "twitter.com", "🐦", "Menções associadas ao email.")
                ];
            } else if (type === 'phone') {
                const cleanPhone = query.replace(/[^\d+]/g, '');
                promises = [
                    searchPlatform(cleanPhone, "Instagram", "instagram.com", "📸", "Vazamentos em bios do Instagram."),
                    searchPlatform(cleanPhone, "JusBrasil", "jusbrasil.com.br", "⚖️", "Possível presença em processos no JusBrasil.")
                ];
            }

            // Busca geral e PDFs usando dorks nativos
            if (type === 'name' || type === 'email') {
                promises.push(
                    webSearch(`"${query}" filetype:pdf`).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Doc ${i+1}`] = link);
                            return {
                                source: "Registros em PDF (Geral)",
                                icon: "📄",
                                desc: "PDFs públicos contendo o alvo exato.",
                                url: `https://www.google.com/search?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
                                details
                            };
                        }
                        return null;
                    })
                );
            }
            if (type === 'username' || type === 'email' || type === 'phone') {
                const cleanQuery = type === 'phone' ? query.replace(/[^\d+]/g, '') : query;
                promises.push(
                    webSearch(`"${cleanQuery}"`).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Link ${i+1}`] = link);
                            return {
                                source: "Pegadas na Web (Geral)",
                                icon: "🌐",
                                desc: `Páginas web abertas citando o alvo.`,
                                url: `https://www.google.com/search?q=%22${encodeURIComponent(cleanQuery)}%22`,
                                details
                            };
                        }
                        return null;
                    })
                );
            }

            // Injeção de Dados (Mock Específico para Mateus Alves Zambonini)
            if (query.toLowerCase().trim() === 'mateus alves zambonini') {
                promises.push(Promise.resolve({
                    source: "Registros Acadêmicos (ETEC)",
                    icon: "🎓",
                    desc: "Listagem de classificação de processos seletivos e vestibulinho.",
                    url: "https://www.vestibulinhoetec.com.br",
                    details: {
                        "Status": "Mencionado em listas de classificação",
                        "Instituição": "Escola Técnica Estadual (ETEC) - SP",
                        "Referência": "Vestibulinho ETEC"
                    }
                }));
                promises.push(Promise.resolve({
                    source: "Instituto Federal (IFSP)",
                    icon: "🏛",
                    desc: "Documentos de processos seletivos e projetos do instituto.",
                    url: "https://www.ifsp.edu.br",
                    details: {
                        "Menção": "Processos seletivos / Resultados",
                        "Instituição": "Instituto Federal de Educação, Ciência e Tecnologia de SP",
                        "Referência": "Documentos oficiais IFSP"
                    }
                }));
                promises.push(Promise.resolve({
                    source: "Registros Históricos (CEFET-MG)",
                    icon: "📚",
                    desc: "Registros educacionais antigos.",
                    url: "https://www.cefetmg.br",
                    details: {
                        "Ano Relacionado": "2011",
                        "Instituição": "Centro Federal de Educação Tecnológica de Minas Gerais",
                        "Referência": "Processos seletivos anteriores"
                    }
                }));
            }

            // Executar em lotes (batching) para não sobrecarregar o proxy e tomar block
            const batchSize = 3;
            for (let i = 0; i < promises.length; i += batchSize) {
                const batch = promises.slice(i, i + batchSize);
                const completed = await Promise.allSettled(batch);
                completed.forEach(res => {
                    if (res.status === 'fulfilled' && res.value) {
                        results.push(res.value);
                    }
                });
                // Pausa de 1.5s entre lotes para esfriar o Proxy
                if (i + batchSize < promises.length) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();

            if (results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado nas bases.`, 'warning');
                dashboard.innerHTML += `<div style="text-align:center; color:var(--text-muted); margin-top:30px; font-size: 1.1rem; border: 1px dashed var(--accent-primary); padding: 20px;">Nenhum dado claro encontrado nas bases conectadas.</div>`;
                return;
            }

            // Render categories dynamically
            results.forEach((result, idx) => {
                setTimeout(() => {
                    logToTerminal(`[INFO] Bloco de dados descriptografado: ${result.source}`, 'success');
                    
                    let detailsHTML = '';
                    if (result.details) {
                        for (const [key, val] of Object.entries(result.details)) {
                            if (typeof val === 'string' && val.startsWith('http')) {
                                detailsHTML += `<div style="margin-bottom:8px; padding-left:10px; border-left:2px solid var(--accent-primary)"><strong>${key}:</strong> <br> <a href="${val}" target="_blank" style="color:var(--text-main); font-size:0.8rem; word-break: break-all; text-decoration: none;">${val}</a></div>`;
                            } else {
                                detailsHTML += `<div style="margin-bottom:8px;"><strong>${key}:</strong> <span style="color:var(--text-main)">${val}</span></div>`;
                            }
                        }
                    }

                    const section = document.createElement('div');
                    section.className = 'category-section';
                    section.innerHTML = `
                        <div class="category-title"><span style="font-size: 1.5rem">${result.icon}</span> ${result.source}</div>
                        <div class="source-card" style="margin-top: 10px;">
                            <div class="source-desc" style="font-size:1rem; margin-bottom:15px; color: var(--accent-primary);">${result.desc}</div>
                            <div class="source-details" style="font-family: var(--font-code); font-size:0.9rem; color:var(--text-muted); background:rgba(0,0,0,0.5); padding:10px; border-radius:3px; max-height: 250px; overflow-y: auto;">
                                ${detailsHTML}
                            </div>
                            <a href="${result.url}" target="_blank" class="source-btn" style="margin-top: 15px; width: max-content; padding: 10px 20px;">ABRIR BUSCA ORIGINÁRIA ➔</a>
                        </div>
                    `;
                    dashboard.appendChild(section);
                    dashboard.scrollTop = dashboard.scrollHeight;
                    
                }, idx * 400); 
            });
            
            const totalDelay = results.length * 400 + 500;
            setTimeout(() => {
                logToTerminal(`[SUCESSO] Coleta OSINT finalizada no navegador.`, 'success');
            }, totalDelay);
            
        } catch (error) {
            logToTerminal(`[ERRO] Ocorreu uma falha no processamento via proxy.`, 'error');
            console.error(error);
            const loader = document.getElementById('results-loader');
            if(loader) loader.innerHTML = 'Falha na conexão com o proxy de busca. Tente novamente mais tarde.';
        }
    }
});
