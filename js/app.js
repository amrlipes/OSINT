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
            // Tentativa primária usando corsproxy.io (mais rápido, evita captcha do allorigins)
            let proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            let response = await fetch(proxyUrl, { signal: controller.signal });
            
            if (response.ok) {
                clearTimeout(id);
                return await response.text();
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
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
            `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        ];
        
        let allLinks = [];
        
        for (const engineUrl of engines) {
            let html = await fetchWithProxy(engineUrl, 8000);
            if (!html) continue;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const foundLinks = doc.querySelectorAll('a');
            
            foundLinks.forEach(a => {
                let href = a.getAttribute('href');
                if (!href) return;
                
                // Limpeza de redirecionamentos (Google, Bing, Yahoo, DDG)
                if (href.includes('RU=')) {
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
                    
                    if (domainFilter && !href.includes(domainFilter)) return;
                    allLinks.push(href);
                }
            });
            
            if (allLinks.length > 15) break; 
        }
        
        return [...new Set(allLinks)].slice(0, 20); // Aumentado para 20 links
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
            // --- CONFIGURAÇÃO DE VARREDURA CORINGA (DEEP SCAN) ---
            
            // 1. PRIORIDADE: Busca Web Global (Estilo Google)
            promises.push(
                webSearch(`"${query}"`).then(links => {
                    if (links && links.length > 0) {
                        let details = {};
                        links.forEach((link, i) => details[`Link ${i+1}`] = link);
                        return {
                            source: "Google Index / Web Global",
                            icon: "🌍",
                            desc: "Varredura completa na internet aberta (Motores de busca integrados).",
                            url: `https://www.google.com/search?q=%22${encodeURIComponent(query)}%22`,
                            details
                        };
                    }
                    return null;
                })
            );

            // 2. BUSCAS ESPECÍFICAS POR CATEGORIA
            if (type === 'name') {
                promises.push(searchWikipedia(query));
                promises.push(searchPlatform(query, "JusBrasil", "jusbrasil.com.br", "⚖️", "Envolvimentos em processos judiciais, diários oficiais e citações jurídicas."));
                promises.push(searchPlatform(query, "Escavador", "escavador.com", "🔍", "Plataforma de busca em diários oficiais e currículos Lattes."));
                promises.push(searchPlatform(query, "LinkedIn", "linkedin.com", "💼", "Perfis profissionais e rede de contatos corporativos."));
                promises.push(searchPlatform(query, "Instagram", "instagram.com", "📸", "Perfis sociais e registros visuais."));
                promises.push(searchPlatform(query, "Facebook", "facebook.com", "👥", "Perfis e menções em redes sociais."));
                promises.push(searchPlatform(query, "Portal da Transparência", "transparencia.gov.br", "🏛️", "Registros de servidores públicos ou auxílios governamentais."));
                promises.push(searchPlatform(query, "Jucesp / Redesim", "gov.br", "🏢", "Participação em quadros societários e abertura de empresas."));
                promises.push(searchPlatform(query, "SlideShare / Scribd", "slideshare.net", "📄", "Documentos, apresentações ou trabalhos acadêmicos publicados."));
                promises.push(searchPlatform(query, "Pinterest", "pinterest.com", "📌", "Painéis e interesses públicos vinculados."));
            } else if (type === 'username') {
                promises.push(searchGithub(query));
                promises.push(searchPlatform(query, "Reddit", "reddit.com", "🤖", "Comentários, posts e interações em comunidades."));
                promises.push(searchPlatform(query, "Twitter / X", "twitter.com", "🐦", "Microblogging e opiniões públicas."));
                promises.push(searchPlatform(query, "Instagram", "instagram.com", "📸", "Identidade visual e perfil social."));
                promises.push(searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Presença em rede de vídeos curtos."));
                promises.push(searchPlatform(query, "Pinterest", "pinterest.com", "📌", "Curadoria de conteúdo e interesses."));
                promises.push(searchPlatform(query, "Medium", "medium.com", "✍️", "Artigos e publicações escritas."));
                promises.push(searchPlatform(query, "Twitch", "twitch.tv", "🎮", "Atividade em streaming e gaming."));
                promises.push(searchPlatform(query, "Linktree", "linktr.ee", "🔗", "Agregador de links e redes sociais."));
            } else if (type === 'email') {
                const usernamePart = query.split('@')[0];
                
                // 1. Identificação de Redes Sociais Diretas (O e-mail citado explicitamente)
                const socialNetworks = [
                    { name: "Facebook", domain: "facebook.com", icon: "👥" },
                    { name: "LinkedIn", domain: "linkedin.com", icon: "💼" },
                    { name: "Twitter / X", domain: "twitter.com", icon: "🐦" },
                    { name: "Instagram", domain: "instagram.com", icon: "📸" },
                    { name: "TikTok", domain: "tiktok.com", icon: "🎵" },
                    { name: "YouTube", domain: "youtube.com", icon: "▶️" },
                    { name: "Reddit", domain: "reddit.com", icon: "🤖" },
                    { name: "Pinterest", domain: "pinterest.com", icon: "📌" },
                    { name: "GitHub", domain: "github.com", icon: "</>" },
                    { name: "Medium", domain: "medium.com", icon: "✍️" }
                ];

                socialNetworks.forEach(net => {
                    promises.push(
                        webSearch(`"${query}" site:${net.domain}`).then(links => {
                            if (links && links.length > 0) {
                                let details = {};
                                links.forEach((link, i) => details[`Perfil / Menção ${i+1}`] = link);
                                return {
                                    source: net.name,
                                    icon: net.icon,
                                    desc: `E-mail detectado publicamente na plataforma ${net.name}.`,
                                    url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" site:${net.domain}`)}`,
                                    details
                                };
                            }
                            return null;
                        })
                    );
                });

                // 2. Busca por Identidade Global
                promises.push(
                    webSearch(`"${query}" site:gravatar.com OR site:foursquare.com`).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Identidade ${i+1}`] = link);
                            return {
                                source: "Identidade Global (Gravatar & Afins)",
                                icon: "🖼️",
                                desc: "Perfil global vinculado a este endereço de e-mail.",
                                url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" site:gravatar.com OR site:foursquare.com`)}`,
                                details
                            };
                        }
                        return null;
                    })
                );

                // 3. Vazamentos de Credenciais em Dumps
                promises.push(searchPlatform(query, "Pastebin / Ghostbin", "pastebin.com", "📋", "Possíveis vazamentos de credenciais em repositórios de texto puro."));

                // 4. Vazamentos de Senhas (Deep Web / Open Web)
                promises.push(
                    webSearch(`"${query}" intext:password OR intext:senha OR intext:leak`).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Registro de Vazamento ${i+1}`] = link);
                            return {
                                source: "Vazamentos de Credenciais (Web Indexada)",
                                icon: "🔓",
                                desc: "Páginas indicando possível exposição de dados sensíveis ou senhas vinculadas ao e-mail.",
                                url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" intext:password OR intext:senha OR intext:leak`)}`,
                                details
                            };
                        }
                        return null;
                    })
                );

                // 5. Documentos e Infraestrutura Corporativa
                promises.push(
                    webSearch(`"${query}" site:trello.com OR site:docs.google.com OR site:scribd.com OR site:slideshare.net`).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Documento Público ${i+1}`] = link);
                            return {
                                source: "Documentos e Boards Corporativos",
                                icon: "📁",
                                desc: "O e-mail foi encontrado exposto em documentos, planilhas ou sistemas de gestão de projetos.",
                                url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" site:trello.com OR site:docs.google.com OR site:scribd.com OR site:slideshare.net`)}`,
                                details
                            };
                        }
                        return null;
                    })
                );

                // 6. Investigação Híbrida do Username (Engenharia Reversa)
                promises.push(
                    webSearch(`"${usernamePart}" (site:instagram.com OR site:twitter.com OR site:tiktok.com OR site:reddit.com OR site:linkedin.com)`).then(links => {
                        // Filtro estrito: garantir que o link contenha o prefixo de usuário
                        const probableProfiles = links.filter(link => link.toLowerCase().includes(usernamePart.toLowerCase()));
                        if (probableProfiles && probableProfiles.length > 0) {
                            let details = {};
                            probableProfiles.forEach((link, i) => details[`Link Filtrado ${i+1}`] = link);
                            return {
                                source: "Associação de Identidade (Username OSINT)",
                                icon: "🕵️",
                                desc: `Varredura ativa nas redes usando o prefixo [${usernamePart}] como ponteiro lógico. Apenas links de alta probabilidade foram retidos.`,
                                url: `https://www.google.com/search?q=${encodeURIComponent(`"${usernamePart}" (site:instagram.com OR site:twitter.com OR site:tiktok.com OR site:reddit.com OR site:linkedin.com)`)}`,
                                details
                            };
                        }
                        return null;
                    })
                );
            }

            // Injeção de Dorks Avançados (Geral para todos os tipos)
            const commonDorks = [
                { dork: `"${query}" filetype:pdf`, name: "Documentos PDF", icon: "📄", desc: "PDFs indexados contendo o alvo." },
                { dork: `"${query}" filetype:xlsx OR filetype:csv`, name: "Planilhas / Bases", icon: "📊", desc: "Arquivos de dados ou listas vazadas." },
                { dork: `"${query}" site:pastebin.com OR site:ghostbin.com`, name: "Code Pastes", icon: "⌨️", desc: "Texto puro em sites de compartilhamento de código." },
                { dork: `"${query}" site:docs.google.com`, name: "Google Drive", icon: "💾", desc: "Arquivos públicos no ecossistema Google." }
            ];

            commonDorks.forEach(d => {
                promises.push(
                    webSearch(d.dork).then(links => {
                        if (links && links.length > 0) {
                            let details = {};
                            links.forEach((link, i) => details[`Registro ${i+1}`] = link);
                            return {
                                source: d.name,
                                icon: d.icon,
                                desc: d.desc,
                                url: `https://www.google.com/search?q=${encodeURIComponent(d.dork)}`,
                                details
                            };
                        }
                        return null;
                    })
                );
            });

            // Adicionar sempre uma busca Web Geral
            promises.push(
                webSearch(`"${query}"`).then(links => {
                    if (links && links.length > 0) {
                        let details = {};
                        links.forEach((link, i) => details[`Pegada ${i+1}`] = link);
                        return {
                            source: "Presença Web Global",
                            icon: "🌐",
                            desc: "Resultados gerais em toda a internet aberta.",
                            url: `https://www.google.com/search?q=%22${encodeURIComponent(query)}%22`,
                            details
                        };
                    }
                    return null;
                })
            );

            // Executar em lotes (batching) para não sobrecarregar o proxy e tomar block
            const batchSize = 3;
            for (let i = 0; i < promises.length; i += batchSize) {
                const batch = promises.slice(i, i + batchSize);
                try {
                    const completed = await Promise.allSettled(batch);
                    completed.forEach(res => {
                        if (res.status === 'fulfilled' && res.value) {
                            results.push(res.value);
                        }
                    });
                } catch (batchErr) {
                    console.error("Batch error:", batchErr);
                }
                
                // Pausa curta entre lotes
                if (i + batchSize < promises.length) {
                    await new Promise(r => setTimeout(r, 600));
                }
            }

            // Remover loader
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
            if(loader) loader.remove();
        }
    }
});
