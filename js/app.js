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

    async function executeSearchSequence(query, type) {
        logToTerminal(`[API] Solicitando varredura real no Backend para: ${type.toUpperCase()}...`, 'system');
        
        // Dashboard Header
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
            <div id="results-loader" style="text-align: center; color: var(--accent-primary); margin-top: 20px;">
                <div class="dot blinking" style="display: inline-block;"></div> Processando varredura na web... Isso pode demorar alguns segundos.
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        try {
            if (!['username', 'email', 'name'].includes(type)) {
                logToTerminal(`[AVISO] Busca em massa para '${type}' ainda não implementada no backend.`, 'warning');
                document.getElementById('results-loader').innerHTML = 'Busca indisponível para este tipo.';
                return;
            }

            const response = await fetch(`http://127.0.0.1:5000/api/osint/${type}?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();

            if (data.error) {
                logToTerminal(`[ERRO] Backend: ${data.error}`, 'error');
                return;
            }

            if (!data.results || data.results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado em fontes abertas primárias.`, 'warning');
                return;
            }

            // Render categories dynamically from Backend results
            data.results.forEach((result, idx) => {
                setTimeout(() => {
                    logToTerminal(`[INFO] Novo bloco de dados extraído: ${result.source}`, 'success');
                    
                    let detailsHTML = '';
                    if (result.details) {
                        for (const [key, val] of Object.entries(result.details)) {
                            // Se for link, formata para ser clicável
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
                            <a href="${result.url}" target="_blank" class="source-btn" style="margin-top: 15px; width: max-content; padding: 10px 20px;">ABRIR FONTE ORIGINÁRIA ➔</a>
                        </div>
                    `;
                    dashboard.appendChild(section);
                    dashboard.scrollTop = dashboard.scrollHeight;
                    
                }, idx * 800); // Stagger the rendering for visual loading effect
            });
            
            const totalDelay = data.results.length * 800 + 500;
            setTimeout(() => {
                logToTerminal(`[SUCESSO] Coleta OSINT finalizada no alvo.`, 'success');
            }, totalDelay);
            
        } catch (error) {
            logToTerminal(`[ERRO FATAL] Falha de conexão com o Python. O servidor Flask está rodando?`, 'error');
            const loader = document.getElementById('results-loader');
            if(loader) loader.innerHTML = 'Falha na conexão com o servidor Inteligência (Backend).';
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
