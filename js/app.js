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
        logToTerminal(`[API] Compilando painel de fontes para o tipo: ${type.toUpperCase()}...`, 'system');
        
        // Dashboard Header
        const headerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title">Painel de Inteligência OSINT</div>
                <div class="target-info">ALVO: ${query}</div>
            </div>
        `;
        dashboard.innerHTML = headerHTML;

        await sleep(800);

        // Define sources based on type
        let categories = [];

        if (type === 'username') {
            categories = [
                {
                    title: 'Redes Sociais & Perfis',
                    icon: '🌐',
                    sources: [
                        { name: 'Instagram', desc: 'Verificar perfil público via Web', icon: 'IG', url: `https://www.instagram.com/${query}/` },
                        { name: 'X (Twitter)', desc: 'Análise de perfil, tweets e conexões', icon: 'X', url: `https://twitter.com/${query}` },
                        { name: 'GitHub', desc: 'Repositórios públicos e código', icon: '</>', url: `https://github.com/${query}` },
                        { name: 'TikTok', desc: 'Presença e conteúdo em vídeos curtos', icon: 'TK', url: `https://www.tiktok.com/@${query}` },
                    ]
                },
                {
                    title: 'Buscadores & Agregadores',
                    icon: '🔍',
                    sources: [
                        { name: 'Namechk', desc: 'Verificar disponibilidade em centenas de sites', icon: 'NC', url: `https://namechk.com/?q=${query}` },
                        { name: 'Google Dork', desc: 'Correspondência exata em todos os índices', icon: 'G', url: `https://www.google.com/search?q="${query}"` }
                    ]
                }
            ];
        } else if (type === 'email') {
            categories = [
                {
                    title: 'Vazamentos & Brechas',
                    icon: '🔓',
                    sources: [
                        { name: 'Have I Been Pwned', desc: 'Checar presença em vazamentos públicos de dados', icon: 'HP', url: `https://haveibeenpwned.com/account/${query}` },
                        { name: 'DeHashed', desc: 'Busca reversa profunda de credenciais (Requer login)', icon: 'DH', url: `https://www.dehashed.com/search?query=${query}` }
                    ]
                },
                {
                    title: 'Busca Reversa',
                    icon: '🔄',
                    sources: [
                        { name: 'Epios', desc: 'Verificar serviços associados à conta Google/Skype', icon: 'EP', url: `https://epios.com/` },
                        { name: 'Google Dork', desc: 'Menções diretas ao e-mail em fóruns ou sites', icon: 'G', url: `https://www.google.com/search?q="${query}"` }
                    ]
                }
            ];
        } else if (type === 'phone') {
            categories = [
                {
                    title: 'Identificadores de Chamadas',
                    icon: '📱',
                    sources: [
                        { name: 'Truecaller', desc: 'Verificar identificação global de chamador', icon: 'TC', url: `https://www.truecaller.com/search/global/${query.replace(/\D/g,'')}` },
                        { name: 'Sync.ME', desc: 'Busca de contatos e redes sociais vinculadas', icon: 'SM', url: `https://sync.me/search/?number=${query.replace(/\D/g,'')}` }
                    ]
                },
                {
                    title: 'Aplicativos de Mensagens',
                    icon: '💬',
                    sources: [
                        { name: 'WhatsApp API', desc: 'Verificar foto de perfil iniciando conversa', icon: 'WA', url: `https://wa.me/${query.replace(/\D/g,'')}` },
                        { name: 'Telegram', desc: 'Buscar número no Telegram Web', icon: 'TG', url: `https://t.me/+${query.replace(/\D/g,'')}` }
                    ]
                }
            ];
        } else if (type === 'name') {
            categories = [
                {
                    title: 'Registros Públicos & Jurídicos',
                    icon: '🏛',
                    sources: [
                        { name: 'Portal da Transparência', desc: 'Buscador de entes e servidores federais', icon: 'PT', url: `https://portaldatransparencia.gov.br/busca?termo=${query}` },
                        { name: 'Jusbrasil', desc: 'Verificar citações em processos e diários oficiais', icon: 'JB', url: `https://www.jusbrasil.com.br/consulta-processual/busca?q=${query}` }
                    ]
                },
                {
                    title: 'Busca Geral & Notícias',
                    icon: '🌐',
                    sources: [
                        { name: 'Google News', desc: 'Menções jornalísticas sobre a pessoa', icon: 'GN', url: `https://news.google.com/search?q="${query}"` },
                        { name: 'LinkedIn', desc: 'Perfis profissionais com este nome', icon: 'IN', url: `https://www.linkedin.com/search/results/people/?keywords=${query}` }
                    ]
                }
            ];
        }

        // Render categories dynamically
        categories.forEach((cat, idx) => {
            setTimeout(() => {
                logToTerminal(`[INFO] Injetando módulo de coleta: ${cat.title}...`, 'warning');
                
                let sourcesHTML = '';
                cat.sources.forEach(source => {
                    sourcesHTML += `
                        <div class="source-card">
                            <div class="source-header">
                                <div class="source-icon">${source.icon}</div>
                                <span>${source.name}</span>
                            </div>
                            <div class="source-desc">${source.desc}</div>
                            <a href="${source.url}" target="_blank" class="source-btn">Acessar Fonte ➔</a>
                        </div>
                    `;
                });

                const section = document.createElement('div');
                section.className = 'category-section';
                section.innerHTML = `
                    <div class="category-title"><span style="font-size: 1.5rem">${cat.icon}</span> ${cat.title}</div>
                    <div class="sources-grid">
                        ${sourcesHTML}
                    </div>
                `;
                dashboard.appendChild(section);
                
                // Scroll to bottom of dashboard automatically
                dashboard.scrollTop = dashboard.scrollHeight;
                
            }, idx * 600); // Stagger the rendering for visual loading effect
        });
        
        const totalDelay = categories.length * 600 + 500;
        setTimeout(() => {
            logToTerminal(`[SUCESSO] Painel de Inteligência concluído. Fontes prontas para redirecionamento.`, 'success');
        }, totalDelay);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
