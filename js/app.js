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

    async function fetchWithProxy(url) {
        try {
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

    async function duckduckgoSearch(query) {
        const html = await fetchWithProxy(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        if (!html) return [];
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = [];
        const resultTags = doc.querySelectorAll('.result__snippet, .result__url');
        
        resultTags.forEach(a => {
            let href = a.getAttribute('href');
            if (href && href.startsWith('//')) href = 'https:' + href;
            if (href && !href.startsWith('/') && !href.includes('duckduckgo.com')) {
                links.push(href.trim());
            }
        });
        return [...new Set(links)].slice(0, 5);
    }

    async function executeSearchSequence(query, type) {
        logToTerminal(`[API] Iniciando Rastreio Multicamadas para: ${type.toUpperCase()}...`, 'system');
        
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
            <div id="results-loader" style="text-align: center; color: var(--accent-primary); margin-top: 20px;">
                <div class="dot blinking" style="display: inline-block;"></div> Acessando bancos de dados públicos e web proxy...
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        let results = [];

        try {
            if (type === 'username' || type === 'name') {
                logToTerminal(`[INFO] Consultando bases de dados do GitHub...`, 'warning');
                try {
                    const ghRes = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`);
                    if (ghRes.ok) {
                        const ghData = await ghRes.json();
                        if (ghData.items && ghData.items.length > 0) {
                            let ghDetails = {};
                            ghData.items.forEach((item, i) => {
                                ghDetails[`Perfil ${i+1} (${item.login})`] = item.html_url;
                            });
                            results.push({
                                source: "Repositórios de Código (GitHub)",
                                icon: "</>",
                                desc: `Foram localizadas ${ghData.total_count} contas correspondentes na plataforma.`,
                                url: `https://github.com/search?q=${encodeURIComponent(query)}&type=users`,
                                details: ghDetails
                            });
                        }
                    }
                } catch(e) {}

                logToTerminal(`[INFO] Analisando Enciclopédia Pública...`, 'warning');
                try {
                    const wikiRes = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
                    if (wikiRes.ok) {
                        const wikiData = await wikiRes.json();
                        if (wikiData.query && wikiData.query.search && wikiData.query.search.length > 0) {
                            let wikiDetails = {};
                            wikiData.query.search.slice(0, 5).forEach((item, i) => {
                                wikiDetails[`Artigo: ${item.title}`] = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
                            });
                            results.push({
                                source: "Arquivos Enciclopédicos (Wikipedia)",
                                icon: "🏛",
                                desc: `Localizadas ${wikiData.query.searchinfo.totalhits} menções em registros históricos ou públicos.`,
                                url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
                                details: wikiDetails
                            });
                        }
                    }
                } catch(e) {}
            }

            logToTerminal(`[INFO] Minerando pegadas digitais na internet profunda...`, 'warning');
            let dorkQuery = type === 'email' ? `"${query}"` : `"${query}"`;
            const dorks = await duckduckgoSearch(dorkQuery);
            if (dorks.length > 0) {
                let dorkDetails = {};
                dorks.forEach((link, i) => dorkDetails[`Fonte de Dados ${i+1}`] = link);
                results.push({
                    source: "Índice Web Aberto",
                    icon: "🌐",
                    desc: `Encontramos menções exatas ao alvo na rede primária.`,
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22`,
                    details: dorkDetails
                });
            }

            if (type === 'email' || type === 'name') {
                const pdfs = await duckduckgoSearch(`"${query}" filetype:pdf`);
                if (pdfs.length > 0) {
                    let pdfDetails = {};
                    pdfs.forEach((link, i) => pdfDetails[`Documento ${i+1}`] = link);
                    results.push({
                        source: "Documentos e Arquivos (PDF)",
                        icon: "📄",
                        desc: `Identificados registros em formato PDF contendo as credenciais.`,
                        url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
                        details: pdfDetails
                    });
                }
            }

            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();

            if (results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado na rede primária.`, 'warning');
                dashboard.innerHTML += `<div style="text-align:center; color:var(--text-muted); margin-top:30px; font-size: 1.1rem; border: 1px dashed var(--accent-primary); padding: 20px;">Nenhum dado claro encontrado nas bases conectadas. <br><br> <span style="font-size:0.9rem; color:#fff;">Tente buscar nomes com aspas (ex: "Felipe Amaro") ou utilize e-mails alternativos.</span></div>`;
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
                    
                }, idx * 800);
            });
            
            const totalDelay = results.length * 800 + 500;
            setTimeout(() => {
                logToTerminal(`[SUCESSO] Coleta OSINT finalizada 100% no navegador.`, 'success');
            }, totalDelay);
            
        } catch (error) {
            logToTerminal(`[ERRO FATAL] Falha de comunicação.`, 'error');
            console.error(error);
            const loader = document.getElementById('results-loader');
            if(loader) loader.innerHTML = 'Falha na conexão com a rede de dados.';
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
