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

    async function fetchWithProxy(url, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            // Tentativa primária usando codetabs (mais estável para Google)
            let proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
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
            `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
            `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        ];
        
        let allLinks = [];
        
        for (const engineUrl of engines) {
            let html = await fetchWithProxy(engineUrl, 12000); // Timeout aumentado
            if (!html) continue;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Para garantir resultados EXATOS, vamos buscar apenas as tags <a> que realmente representam 
            // os resultados de busca, ignorando links soltos de navegação, rodapé e propagandas.
            let foundLinks = [];
            if (engineUrl.includes('google')) {
                foundLinks = doc.querySelectorAll('a');
            } else if (engineUrl.includes('duckduckgo')) {
                foundLinks = doc.querySelectorAll('a.result__url, a.result__snippet');
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
                    
                    if (domainFilter && !href.includes(domainFilter)) return;
                    
                    // --- FILTRO DE EXATIDÃO (OSINT PROFISSIONAL) ---
                    // Ignorar páginas iniciais (ex: linkedin.com/) ou páginas de login/recuperação
                    // que os motores de busca retornam quando não encontram o perfil exato.
                    const isHomePage = href.replace(/^https?:\/\/(www\.)?/, '').split('/').filter(p => p !== '').length === 1;
                    const isLoginPage = href.includes('/login') || href.includes('/signup') || href.includes('/recover') || href.includes('/auth');
                    
                    if (domainFilter && (isHomePage || isLoginPage)) {
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
            details["Status"] = "Extração automatizada bloqueada pelo buscador. Acesse a busca originária no botão abaixo.";
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
                        details["Status"] = "Resultados amplos devem ser visualizados manualmente devido à restrição do proxy.";
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
                    tasks.push(() =>
                        webSearch(`${query} site:${net.domain}`).then(links => {
                            let details = {};
                            if (links && links.length > 0) {
                                links.forEach((link, i) => details[`Perfil / Menção ${i+1}`] = link);
                            } else {
                                details["Status"] = "Acesso bloqueado via script. Acesse diretamente.";
                            }
                            return {
                                source: net.name,
                                icon: net.icon,
                                desc: `E-mail detectado publicamente na plataforma ${net.name}.`,
                                url: `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${net.domain}`)}`,
                                details
                            };
                        })
                    );
                });

                // 2. Busca por Identidade Global
                tasks.push(() =>
                    webSearch(`${query} site:gravatar.com OR site:foursquare.com`).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Identidade ${i+1}`] = link);
                        } else {
                            details["Status"] = "Verificação manual recomendada.";
                        }
                        return {
                            source: "Identidade Global (Gravatar & Afins)",
                            icon: "🖼️",
                            desc: "Perfil global vinculado a este endereço de e-mail.",
                            url: `https://www.google.com/search?q=${encodeURIComponent(`${query} site:gravatar.com OR site:foursquare.com`)}`,
                            details
                        };
                    })
                );

                // 3. Vazamentos de Credenciais em Dumps
                tasks.push(() => searchPlatform(query, "Pastebin / Ghostbin", "pastebin.com", "📋", "Possíveis vazamentos de credenciais em repositórios de texto puro."));

                // 4. Vazamentos de Senhas (Deep Web / Open Web)
                tasks.push(() =>
                    webSearch(`${query} intext:password OR intext:senha OR intext:leak`).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Registro de Vazamento ${i+1}`] = link);
                        } else {
                            details["Status"] = "Dados de vazamento requerem verificação manual via Google Dorks.";
                        }
                        return {
                            source: "Vazamentos de Credenciais (Web Indexada)",
                            icon: "🔓",
                            desc: "Páginas indicando possível exposição de dados sensíveis ou senhas vinculadas ao e-mail.",
                            url: `https://www.google.com/search?q=${encodeURIComponent(`${query} intext:password OR intext:senha OR intext:leak`)}`,
                            details
                        };
                    })
                );

                // 5. Documentos e Infraestrutura Corporativa
                tasks.push(() =>
                    webSearch(`${query} site:trello.com OR site:docs.google.com OR site:scribd.com OR site:slideshare.net`).then(links => {
                        let details = {};
                        if (links && links.length > 0) {
                            links.forEach((link, i) => details[`Documento Público ${i+1}`] = link);
                        } else {
                            details["Status"] = "Busca bloqueada. Consulte diretamente via navegador.";
                        }
                        return {
                            source: "Documentos e Boards Corporativos",
                            icon: "📁",
                            desc: "O e-mail foi encontrado exposto em documentos, planilhas ou sistemas de gestão de projetos.",
                            url: `https://www.google.com/search?q=${encodeURIComponent(`${query} site:trello.com OR site:docs.google.com OR site:scribd.com OR site:slideshare.net`)}`,
                            details
                        };
                    })
                );

                // 6. Investigação Híbrida do Username (Engenharia Reversa)
                tasks.push(() =>
                    webSearch(`${usernamePart} (site:instagram.com OR site:twitter.com OR site:tiktok.com OR site:reddit.com OR site:linkedin.com)`).then(links => {
                        let details = {};
                        const probableProfiles = links ? links.filter(link => link.toLowerCase().includes(usernamePart.toLowerCase())) : [];
                        if (probableProfiles && probableProfiles.length > 0) {
                            probableProfiles.forEach((link, i) => details[`Link Filtrado ${i+1}`] = link);
                        } else {
                            details["Status"] = "Requer análise manual clicando na busca originária.";
                        }
                        return {
                            source: "Associação de Identidade (Username OSINT)",
                            icon: "🕵️",
                            desc: `Varredura ativa nas redes usando o prefixo [${usernamePart}] como ponteiro lógico.`,
                            url: `https://www.google.com/search?q=${encodeURIComponent(`${usernamePart} (site:instagram.com OR site:twitter.com OR site:tiktok.com OR site:reddit.com OR site:linkedin.com)`)}`,
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

            // Executar em lotes (batching) para não sobrecarregar o proxy e tomar block
            const batchSize = 2; // Reduzido para 2 para evitar 429 Too Many Requests
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batchTasks = tasks.slice(i, i + batchSize);
                try {
                    const batchPromises = batchTasks.map(t => t());
                    const completed = await Promise.allSettled(batchPromises);
                    completed.forEach(res => {
                        if (res.status === 'fulfilled' && res.value) {
                            results.push(res.value);
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
