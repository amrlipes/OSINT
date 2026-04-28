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

    function clearDashboard() {
        dashboard.innerHTML = '';
    }

    // --- OSINT ENGINE (100% Frontend via CORS Proxy) ---

    async function fetchWithProxy(url, timeout = 12000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            // Tentativa primária usando codetabs (mais estável para Google)
            let proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            let response = await fetch(proxyUrl, { signal: controller.signal });
            
            if (response.ok) {
                const text = await response.text();
                // Codetabs retorna 200 OK com {"Error": ...} quando falha
                if (text && !text.includes('"Error":') && text.length > 200) {
                    clearTimeout(id);
                    return text;
                }
            }

            // Fallback para allorigins se falhar
            proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            response = await fetch(proxyUrl, { signal: controller.signal });
            
            if (response.ok) {
                const data = await response.json();
                clearTimeout(id);
                return data.contents;
            }
            
        } catch (e) {
            console.error("Proxy error:", e);
        } finally {
            clearTimeout(id);
        }
        return null;
    }

    async function webSearch(query, domainFilter = "") {
        // Diversos motores para simular a abrangência do Google e evitar bloqueios
        const engines = [
            `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
            `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
            `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        ];
        
        let allLinks = [];
        
        for (const engineUrl of engines) {
            let html = await fetchWithProxy(engineUrl, 15000); // Timeout aumentado
            if (!html || html.length < 200) continue;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Para garantir resultados EXATOS, vamos buscar apenas as tags <a> que realmente representam 
            // os resultados de busca, ignorando links soltos de navegação, rodapé e propagandas.
            let foundLinks = [];
            if (engineUrl.includes('google')) {
                foundLinks = doc.querySelectorAll('a');
            } else if (engineUrl.includes('duckduckgo')) {
                foundLinks = doc.querySelectorAll('a.result__url, a.result__snippet, a.result-url, a.result-snippet, a.result-link');
            } else if (engineUrl.includes('yahoo')) {
                foundLinks = doc.querySelectorAll('.compTitle a, .algo a, h3.title a');
            } else if (engineUrl.includes('bing')) {
                foundLinks = doc.querySelectorAll('li.b_algo h2 a, .b_algo a');
            } else {
                foundLinks = doc.querySelectorAll('a');
            }
            
            foundLinks.forEach(a => {
                let href = a.getAttribute('href');
                if (!href) return;
                
                // Limpeza de redirecionamentos (Google, Bing, Yahoo, DDG)
                if (href.includes('/url?q=')) {
                    const match = href.match(/\/url\?q=([^&]+)/);
                    if (match) href = decodeURIComponent(match[1]);
                } else if (href.includes('RU=')) {
                    const match = href.match(/RU=([^/&]+)/);
                    if (match) href = decodeURIComponent(match[1]);
                } else if (href.includes('u=a1')) {
                    const match = href.match(/u=([^&]+)/);
                    if (match) {
                        try { href = atob(match[1].replace(/-/g, '+').replace(/_/g, '/')); } catch(e) {}
                    }
                } else if (href.includes('uddg=')) {
                    const match = href.match(/uddg=([^&]+)/);
                    if (match) href = decodeURIComponent(match[1]);
                }
                
                href = href.trim();
                if (href.startsWith('//')) href = 'https:' + href;
                
                // Filtrar apenas links externos reais
                if (href.startsWith('http') && 
                    !href.includes('google.') && !href.includes('yahoo.') && 
                    !href.includes('bing.') && !href.includes('microsoft.') && 
                    !href.includes('duckduckgo.') && !href.includes('yandex.')) {
                    
                    if (domainFilter) {
                        // Trata casos onde o domínio inclui "OR site:" para buscas múltiplas
                        const domains = domainFilter.split(/ OR site:| OR /).map(d => d.replace('site:', '').trim()).filter(d => d);
                        const match = domains.some(d => href.includes(d));
                        if (!match) return;
                    }
                    
                    // --- FILTRO DE EXATIDÃO (OSINT PROFISSIONAL) ---
                    // Ignorar páginas iniciais (ex: linkedin.com/) ou páginas de login/recuperação
                    // que os motores de busca retornam quando não encontram o perfil exato.
                    const isHomePage = href.replace(/^https?:\/\/(www\.)?/, '').split('/').filter(p => p !== '').length === 1;
                    const isLoginPage = href.includes('/login') || href.includes('/signup') || href.includes('/recover') || href.includes('/auth');
                    const isHelpPage = href.includes('/help') || href.includes('/support');
                    
                    if (domainFilter && (isHomePage || isLoginPage || isHelpPage)) {
                        return; // Ignora o link, não é um resultado exato de um usuário/documento
                    }
                    
                    allLinks.push(href);
                }
            });
            
            // Se já encontrou links de altíssima qualidade nesta engine, não precisa poluir com as outras
            if (allLinks.length >= 5) break; 
        }
        
        return [...new Set(allLinks)].slice(0, 10);
    }

    async function searchPlatform(query, platformName, domain, icon, desc) {
        // Removido as aspas em volta da query para evitar erro 400 no proxy
        const links = await webSearch(`${query} site:${domain}`, domain);
        let details = {};
        
        if (links && links.length > 0) {
            links.forEach((link, i) => details[`Registro ${i+1}`] = link);
        } else {
            details["Status"] = "Nenhuma ocorrência exata e direta localizada. Explore via busca manual.";
        }

        return {
            source: platformName,
            icon: icon,
            desc: desc,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}+site%3A${domain}`,
            details
        };
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
        let tasks = [];

        try {
            // --- CONFIGURAÇÃO DE VARREDURA CORINGA (DEEP SCAN) ---
            
            // 1. PRIORIDADE: Busca Web Global (Estilo Google)
            tasks.push(() =>
                webSearch(`${query}`).then(links => {
                    let details = {};
                    if (links && links.length > 0) {
                        links.forEach((link, i) => details[`Link ${i+1}`] = link);
                    } else {
                        details["Status"] = "Nenhuma menção explícita foi isolada. É altamente recomendável checar a busca originária.";
                    }
                    return {
                        source: "Google Index / Web Global",
                        icon: "🌍",
                        desc: "Varredura completa na internet aberta (Motores de busca integrados).",
                        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                        details
                    };
                })
            );

            // 2. BUSCAS ESPECÍFICAS POR CATEGORIA
            if (type === 'name') {
                tasks.push(() => searchWikipedia(query));
                tasks.push(() => searchPlatform(query, "JusBrasil", "jusbrasil.com.br", "⚖️", "Envolvimentos em processos judiciais, diários oficiais e citações jurídicas."));
                tasks.push(() => searchPlatform(query, "Escavador", "escavador.com", "🔍", "Plataforma de busca em diários oficiais e currículos Lattes."));
                tasks.push(() => searchPlatform(query, "LinkedIn", "linkedin.com", "💼", "Perfis profissionais e rede de contatos corporativos."));
                tasks.push(() => searchPlatform(query, "Instagram", "instagram.com", "📸", "Perfis sociais e registros visuais."));
                tasks.push(() => searchPlatform(query, "Facebook", "facebook.com", "👥", "Perfis e menções em redes sociais."));
                tasks.push(() => searchPlatform(query, "Portal da Transparência", "transparencia.gov.br", "🏛️", "Registros de servidores públicos ou auxílios governamentais."));
                tasks.push(() => searchPlatform(query, "Jucesp / Redesim", "gov.br", "🏢", "Participação em quadros societários e abertura de empresas."));
                tasks.push(() => searchPlatform(query, "SlideShare / Scribd", "slideshare.net", "📄", "Documentos, apresentações ou trabalhos acadêmicos publicados."));
                tasks.push(() => searchPlatform(query, "Pinterest", "pinterest.com", "📌", "Painéis e interesses públicos vinculados."));
            } else if (type === 'username') {
                tasks.push(() => searchGithub(query));
                tasks.push(() => searchPlatform(query, "Reddit", "reddit.com", "🤖", "Comentários, posts e interações em comunidades."));
                tasks.push(() => searchPlatform(query, "Twitter / X", "twitter.com", "🐦", "Microblogging e opiniões públicas."));
                tasks.push(() => searchPlatform(query, "Instagram", "instagram.com", "📸", "Identidade visual e perfil social."));
                tasks.push(() => searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Presença em rede de vídeos curtos."));
                tasks.push(() => searchPlatform(query, "Pinterest", "pinterest.com", "📌", "Curadoria de conteúdo e interesses."));
                tasks.push(() => searchPlatform(query, "Medium", "medium.com", "✍️", "Artigos e publicações escritas."));
                tasks.push(() => searchPlatform(query, "Twitch", "twitch.tv", "🎮", "Atividade em streaming e gaming."));
                tasks.push(() => searchPlatform(query, "Linktree", "linktr.ee", "🔗", "Agregador de links e redes sociais."));
            } else if (type === 'email') {
                const usernamePart = query.split('@')[0];
                const domainPart = query.split('@')[1] || '';

                // 1. ENUMERAÇÃO DE CONTAS E VAZAMENTOS (LEAKS) - INSTANTÂNEO
                tasks.push(async () => {
                    return {
                        source: "Vazamentos e Enumeração de Redes Sociais",
                        icon: "🔓",
                        desc: "Ferramentas globais para verificar se o e-mail está logado, registrado ou vazado em bancos de dados.",
                        url: `https://epieos.com/?q=${encodeURIComponent(query)}`,
                        details: {
                            "Epieos (Redes Sociais e Google)": `https://epieos.com/?q=${encodeURIComponent(query)}`,
                            "Have I Been Pwned (Vazamentos)": `https://haveibeenpwned.com/account/${encodeURIComponent(query)}`,
                            "IntelX (Deep Web Leaks)": `https://intelx.io/?s=${encodeURIComponent(query)}`,
                            "DeHashed (Senhas em Texto Plano)": `https://dehashed.com/search?query=${encodeURIComponent(query)}`
                        }
                    };
                });

                // 2. BUSCA GLOBAL EM REDES SOCIAIS (Tudo em 1 Requisição = Eficiência Máxima)
                const socialDomains = "site:facebook.com OR site:instagram.com OR site:linkedin.com OR site:twitter.com OR site:tiktok.com OR site:youtube.com";
                tasks.push(() =>
                    webSearch(`"${query}" (${socialDomains})`).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Perfil Localizado ${i+1}`] = link);
                        } else {
                            details["Status"] = "Nenhuma menção pública do e-mail exato nas maiores redes sociais. Contas podem ser privadas ou usar outro e-mail.";
                        }
                        return {
                            source: "Presença em Redes Sociais (Web Global)",
                            icon: "👥",
                            desc: "Busca unificada do e-mail exato no Facebook, Instagram, LinkedIn, Twitter, TikTok e YouTube.",
                            url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" (${socialDomains})`)}`,
                            details
                        };
                    })
                );

                // 3. VAZAMENTOS DE TEXTO E DOCUMENTOS PÚBLICOS (Combinado)
                const docDork = `"${query}" (intext:password OR intext:senha OR ext:pdf OR ext:csv OR ext:txt OR site:pastebin.com)`;
                tasks.push(() =>
                    webSearch(docDork).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Documento/Leak ${i+1}`] = link);
                        } else {
                            details["Status"] = "Nenhum documento ou log de vazamento em texto plano localizado recentemente.";
                        }
                        return {
                            source: "Arquivos, Planilhas e Textos Vazados",
                            icon: "📄",
                            desc: "Varredura em pastas públicas, PDFs, CSVs e sites de Pastebin contendo o e-mail exato.",
                            url: `https://www.google.com/search?q=${encodeURIComponent(docDork)}`,
                            details
                        };
                    })
                );

                // 4. HUBS DE DESENVOLVEDORES (GitHub, GitLab, Gravatar)
                tasks.push(() => searchPlatform(`"${query}"`, "Repositórios e Avatares", "github.com OR site:gitlab.com OR site:gravatar.com", "</>", "Verificação do e-mail em códigos-fonte, commits e serviços de avatar global."));

                // 5. ENGENHARIA REVERSA DO USERNAME (Todas as redes em 1 requisição)
                const usernameDork = `"${usernamePart}" (${socialDomains} OR site:pinterest.com OR site:reddit.com)`;
                tasks.push(() =>
                    webSearch(usernameDork).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Descoberta ${i+1}`] = link);
                        } else {
                            details["Status"] = "Nenhum perfil relevante localizado usando apenas o prefixo do e-mail.";
                        }
                        return {
                            source: "Engenharia Reversa (Busca por Username)",
                            icon: "🕵️",
                            desc: `O sistema deduziu o username [${usernamePart}]. Varredura em bloco nas redes para descobrir perfis associados.`,
                            url: `https://www.google.com/search?q=${encodeURIComponent(usernameDork)}`,
                            details
                        };
                    })
                );
            }

            // Injeção de Dorks Avançados (Geral para todos os tipos)
            const commonDorks = [
                { dork: `${query} filetype:pdf`, name: "Documentos PDF", icon: "📄", desc: "PDFs indexados contendo o alvo." },
                { dork: `${query} filetype:xlsx OR filetype:csv`, name: "Planilhas / Bases", icon: "📊", desc: "Arquivos de dados ou listas vazadas." },
                { dork: `${query} site:pastebin.com OR site:ghostbin.com`, name: "Code Pastes", icon: "⌨️", desc: "Texto puro em sites de compartilhamento de código." },
                { dork: `${query} site:docs.google.com`, name: "Google Drive", icon: "💾", desc: "Arquivos públicos no ecossistema Google." }
            ];

            commonDorks.forEach(d => {
                tasks.push(() =>
                    webSearch(d.dork).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Registro ${i+1}`] = link);
                        } else {
                            details["Status"] = "Execute o Dork manualmente clicando abaixo.";
                        }
                        return {
                            source: d.name,
                            icon: d.icon,
                            desc: d.desc,
                            url: `https://www.google.com/search?q=${encodeURIComponent(d.dork)}`,
                            details
                        };
                    })
                );
            });

            // Adicionar sempre uma busca Web Geral
            tasks.push(() =>
                webSearch(`${query}`).then(links => {
                    let details = {};
                    if (links && links.length > 0) {
                        links.forEach((link, i) => details[`Pegada ${i+1}`] = link);
                    } else {
                        details["Status"] = "Presença global necessita varredura manual.";
                    }
                    return {
                        source: "Presença Web Global",
                        icon: "🌐",
                        desc: "Resultados gerais em toda a internet aberta.",
                        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                        details
                    };
                })
            );

            // Função auxiliar para renderizar um resultado individual na tela
            function renderResult(result) {
                const loader = document.getElementById('results-loader');
                if (loader && !loader.dataset.hidden) {
                    loader.style.display = 'none';
                    loader.dataset.hidden = 'true';
                }

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
                section.style.opacity = '0';
                section.style.animation = 'fadeIn 0.5s forwards';
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
            }

            // Executar em lotes (batching) e renderizar dinamicamente
            const batchSize = 2; // Reduzido para 2 para evitar 429 Too Many Requests
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batchTasks = tasks.slice(i, i + batchSize);
                
                // Atualiza o loader
                const loader = document.getElementById('results-loader');
                if (loader && !loader.dataset.hidden) {
                    loader.innerHTML = `<div class="dot blinking" style="display: inline-block;"></div> Processando ${Math.min(i + batchSize, tasks.length)} de ${tasks.length} alvos...`;
                }

                try {
                    const batchPromises = batchTasks.map(t => t());
                    const completed = await Promise.allSettled(batchPromises);
                    completed.forEach((res, idx) => {
                        if (res.status === 'fulfilled' && res.value) {
                            results.push(res.value);
                            // Pequeno delay visual para não jogar tudo junto na tela instantaneamente
                            setTimeout(() => renderResult(res.value), idx * 200);
                        }
                    });
                } catch (batchErr) {
                    console.error("Batch error:", batchErr);
                }
                
                // Pausa maior entre lotes
                if (i + batchSize < tasks.length) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            // Finalização
            const loaderFinal = document.getElementById('results-loader');
            if (loaderFinal && !loaderFinal.dataset.hidden) loaderFinal.remove();

            if (results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado nas bases.`, 'warning');
                dashboard.innerHTML += `<div style="text-align:center; color:var(--text-muted); margin-top:30px; font-size: 1.1rem; border: 1px dashed var(--accent-primary); padding: 20px;">Nenhum dado claro encontrado nas bases conectadas.</div>`;
            } else {
                logToTerminal(`[SUCESSO] Coleta OSINT finalizada no navegador.`, 'success');
            }

        } catch (error) {
            logToTerminal(`[ERRO] Ocorreu uma falha no processamento via proxy.`, 'error');
            console.error(error);
            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();
        }
    }
});
