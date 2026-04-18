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
        const resultTags = doc.querySelectorAll('a.result__url');
        
        resultTags.forEach(a => {
            let href = a.getAttribute('href');
            if (href && href.startsWith('//')) href = 'https:' + href;
            if (href && !href.startsWith('/') && !href.includes('duckduckgo.com')) {
                links.push(href.trim());
            }
        });
        return [...new Set(links)].slice(0, 5); // Return up to 5 unique links
    }

    async function executeSearchSequence(query, type) {
        logToTerminal(`[API] Iniciando Rastreio Web via Rede Proxy para: ${type.toUpperCase()}...`, 'system');
        
        // Dashboard Header
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
            <div id="results-loader" style="text-align: center; color: var(--accent-primary); margin-top: 20px;">
                <div class="dot blinking" style="display: inline-block;"></div> Bypass de CORS Ativado. Minerando dados da Web...
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        let results = [];

        try {
            if (type === 'username') {
                // 1. GitHub API Direta
                try {
                    const ghRes = await fetch(`https://api.github.com/users/${query}`);
                    if (ghRes.ok) {
                        const data = await ghRes.json();
                        results.push({
                            source: "GitHub",
                            icon: "</>",
                            desc: "Perfil de desenvolvedor encontrado nativamente.",
                            url: data.html_url,
                            details: {
                                "Nome Real": data.name || "Não informado",
                                "Empresa": data.company || "Não informado",
                                "Localização": data.location || "Não informado",
                                "Repositórios": data.public_repos
                            }
                        });
                    }
                } catch (e) {}

                // 2. Scraping Dork
                logToTerminal(`[INFO] Coletando pegadas digitais usando índice web...`, 'warning');
                const dorks = await duckduckgoSearch(`"${query}"`);
                if (dorks.length > 0) {
                    let dorkDetails = {};
                    dorks.forEach((link, i) => dorkDetails[`Menção ${i+1}`] = link);
                    results.push({
                        source: "Pegadas na Web (Dork)",
                        icon: "🔍",
                        desc: `Encontramos ${dorks.length} sites citando este username.`,
                        url: `https://duckduckgo.com/?q=%22${query}%22`,
                        details: dorkDetails
                    });
                }

            } else if (type === 'email') {
                // Scraping de Email e PDFs
                logToTerminal(`[INFO] Minerando texto claro e documentos vinculados ao E-mail...`, 'warning');
                
                const dorks = await duckduckgoSearch(`"${query}"`);
                if (dorks.length > 0) {
                    let dorkDetails = {};
                    dorks.forEach((link, i) => dorkDetails[`Fonte ${i+1}`] = link);
                    results.push({
                        source: "Vazamentos / Índices Abertos",
                        icon: "🔓",
                        desc: `E-mail listado publicamente em ${dorks.length} páginas.`,
                        url: `https://duckduckgo.com/?q=%22${query}%22`,
                        details: dorkDetails
                    });
                }

                const pdfs = await duckduckgoSearch(`"${query}" filetype:pdf`);
                if (pdfs.length > 0) {
                    let pdfDetails = {};
                    pdfs.forEach((link, i) => pdfDetails[`Documento ${i+1}`] = link);
                    results.push({
                        source: "Documentos Públicos (PDF)",
                        icon: "📄",
                        desc: `Foram encontrados PDFs oficiais contendo este e-mail.`,
                        url: `https://duckduckgo.com/?q=%22${query}%22+filetype%3Apdf`,
                        details: pdfDetails
                    });
                }

            } else if (type === 'name' || type === 'phone') {
                // Busca geral de menções e documentos
                logToTerminal(`[INFO] Vasculhando registros para o alvo...`, 'warning');
                const dorks = await duckduckgoSearch(`"${query}"`);
                if (dorks.length > 0) {
                    let dorkDetails = {};
                    dorks.forEach((link, i) => dorkDetails[`Registro ${i+1}`] = link);
                    results.push({
                        source: "Registros e Mídia",
                        icon: "📰",
                        desc: "Foram encontrados registros indexados compatíveis.",
                        url: `https://duckduckgo.com/?q=%22${query}%22`,
                        details: dorkDetails
                    });
                }
            }

            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();

            if (results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado na rede primária.`, 'warning');
                dashboard.innerHTML += `<div style="text-align:center; color:var(--text-muted); margin-top:30px;">Nenhum dado claro encontrado em fontes primárias.</div>`;
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
            logToTerminal(`[ERRO FATAL] Falha durante o roteamento do Proxy.`, 'error');
            console.error(error);
            const loader = document.getElementById('results-loader');
            if(loader) loader.innerHTML = 'Falha na conexão com a rede de proxy aberta.';
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
