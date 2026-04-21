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
        logToTerminal(`[API] Solicitando processamento de alta performance ao servidor Node.js...`, 'system');
        
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
            <div id="results-loader" style="text-align: center; color: var(--accent-primary); margin-top: 20px;">
                <div class="dot blinking" style="display: inline-block;"></div> Acessando bancos de dados via motor assíncrono (Node)...
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        try {
            // Call the Node.js backend
            const response = await fetch(`http://127.0.0.1:3000/api/osint/${type}?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error("Erro no servidor da API");
            }

            const data = await response.json();
            const results = data.results || [];

            const loader = document.getElementById('results-loader');
            if(loader) loader.remove();

            if (results.length === 0) {
                logToTerminal(`[INFO] Nenhum rastro direto encontrado.`, 'warning');
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
                    
                }, idx * 400); // Faster render timing for efficiency
            });
            
            const totalDelay = results.length * 400 + 500;
            setTimeout(() => {
                logToTerminal(`[SUCESSO] Coleta OSINT finalizada rapidamente no backend.`, 'success');
            }, totalDelay);
            
        } catch (error) {
            logToTerminal(`[ERRO FATAL] Falha de comunicação com o servidor Node.js. Certifique-se de iniciar o servidor na porta 3000.`, 'error');
            console.error(error);
            const loader = document.getElementById('results-loader');
            if(loader) loader.innerHTML = 'Falha na conexão com a rede de dados do servidor backend.';
        }
    }
});
