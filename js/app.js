document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-btn');
    const inputField = document.getElementById('target-input');
    const terminal = document.getElementById('terminal-content');
    const canvas = document.getElementById('node-canvas');
    const canvasOverlay = document.querySelector('.canvas-overlay');
    
    // Create an SVG element for lines
    const svgLines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLines.id = 'canvas-lines';
    canvas.appendChild(svgLines);

    let nodes = [];
    let connections = [];

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

    // Handle Search click
    searchBtn.addEventListener('click', () => {
        let query = inputField.value.trim();
        if(!query) return;

        // Clean query to avoid spaces/ats breaking URLs
        query = query.replace('@', '').trim();

        logToTerminal(`Initiating target acquisition for: <span class="highlight">${query}</span>`, 'info');
        inputField.value = '';
        
        if(canvasOverlay) {
            canvasOverlay.style.display = 'none';
        }

        // Clear canvas for a new root search
        clearCanvas();

        // Start search sequence using legitimate public endpoints
        executeSearchSequence(query);
    });

    inputField.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') searchBtn.click();
    });

    function clearCanvas() {
        nodes.forEach(n => n.element.remove());
        svgLines.innerHTML = '';
        nodes = [];
        connections = [];
    }

    async function executeSearchSequence(query) {
        logToTerminal('[API] Executing live OSINT data retrieval sequences...', 'system');
        await sleep(800);

        // Root Node
        logToTerminal(`[SUCCESS] Root identity established for ${query}`, 'success');
        const rootNode = createNode({
            title: 'ROOT TARGET',
            icon: '🎯',
            data: {
                Identifier: query,
                Type: 'Username / Handle'
            },
            x: canvas.clientWidth / 2,
            y: canvas.clientHeight / 2,
            hideActions: true
        });

        await sleep(1000);

        // --- 1. GitHub API (Legitimate Public API) ---
        logToTerminal(`[INFO] Fetching real data from GitHub Public API...`, 'warning');
        try {
            const ghResponse = await fetch(`https://api.github.com/users/${query}`);
            if (ghResponse.ok) {
                const ghData = await ghResponse.json();
                logToTerminal(`[SUCCESS] GitHub profile identified and validated!`, 'success');
                
                const ghNode = createNode({
                    title: 'GITHUB',
                    icon: '</>',
                    avatar: ghData.avatar_url,
                    url: ghData.html_url,
                    btnText: 'Acess Repository',
                    data: {
                        Name: ghData.name || 'Not provided',
                        Company: ghData.company || 'Not provided',
                        Location: ghData.location || 'Unknown',
                        Public_Repos: ghData.public_repos,
                        Followers: ghData.followers
                    },
                    x: canvas.clientWidth / 2 - 300,
                    y: canvas.clientHeight / 2 - 150
                });
                drawConnection(rootNode, ghNode);
            } else if (ghResponse.status === 404) {
                logToTerminal(`[ERROR] No GitHub account matches this handle.`, 'error');
            } else {
                logToTerminal(`[ERROR] GitHub API returned status ${ghResponse.status}`, 'error');
            }
        } catch (e) {
            logToTerminal(`[ERROR] Failed to reach GitHub API.`, 'error');
        }

        await sleep(500);

        // --- 2. Instagram (External Redirect) ---
        // Since scraping from frontend violates CORS and generating fakes is prohibited,
        // we provide a verification node that safely redirects.
        logToTerminal(`[INFO] Creating Instagram verification Node (Cross-Origin Policy)...`, 'warning');
        const igNode = createNode({
            title: 'INSTAGRAM',
            icon: 'IG',
            url: `https://www.instagram.com/${query}/`,
            btnText: 'Verify Instagram Profile',
            data: {
                Status: 'Awaiting User Verification',
                Notice: 'Cannot fetch live data without Auth'
            },
            x: canvas.clientWidth / 2 + 250,
            y: canvas.clientHeight / 2 - 150
        });
        drawConnection(rootNode, igNode);

        await sleep(500);

        // --- 3. Twitter / X (External Redirect) ---
        logToTerminal(`[INFO] Creating X (Twitter) verification Node...`, 'warning');
        const xNode = createNode({
            title: 'X (TWITTER)',
            icon: 'X',
            url: `https://twitter.com/${query}`,
            btnText: 'Verify X Profile',
            data: {
                Status: 'Awaiting User Verification'
            },
            x: canvas.clientWidth / 2 + 250,
            y: canvas.clientHeight / 2 + 100
        });
        drawConnection(rootNode, xNode);

        // --- 4. Google Dorking (External Redirect) ---
        logToTerminal(`[INFO] Generating Google Dorking advanced search...`, 'system');
        const dorkNode = createNode({
            title: 'WEB INDEX (DORK)',
            icon: '🔍',
            url: `https://www.google.com/search?q="${query}"+OR+inurl:${query}`,
            btnText: 'Execute Google Dork',
            data: {
                Technique: 'Exact Match & InUrl Search'
            },
            x: canvas.clientWidth / 2 - 300,
            y: canvas.clientHeight / 2 + 150
        });
        drawConnection(rootNode, dorkNode);
        
        logToTerminal(`[SYS] Sequence Complete. Awaiting manual validation.`, 'system');
    }

    function createNode(info) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node';
        nodeEl.style.left = `${info.x}px`;
        nodeEl.style.top = `${info.y}px`;

        let detailsHTML = '';
        if(info.data) {
            for (const [key, value] of Object.entries(info.data)) {
                detailsHTML += `<div class="node-detail"><strong>${key}:</strong> ${value}</div>`;
            }
        }

        let headerHTML = `
            <div class="node-icon">${info.icon}</div>
            <div class="node-header-info">
                <div class="node-title">${info.title}</div>
            </div>
        `;
        
        if(info.avatar) {
            headerHTML = `<img src="${info.avatar}" class="node-avatar" alt="avatar">` + headerHTML;
        }

        let actionHTML = '';
        if(!info.hideActions && info.url) {
            let bText = info.btnText || 'Open Link';
            actionHTML = `
            <div class="node-actions">
                <a href="${info.url}" target="_blank" class="node-btn">${bText}</a>
            </div>`;
        }

        nodeEl.innerHTML = `
            <div class="node-header">
                ${headerHTML}
            </div>
            <div class="node-body">
                ${detailsHTML}
            </div>
            ${actionHTML}
        `;

        canvas.appendChild(nodeEl);
        
        const nodeObj = { id: Date.now(), element: nodeEl, x: info.x, y: info.y, info: info };
        nodes.push(nodeObj);

        // Make node draggable
        makeDraggable(nodeObj);

        return nodeObj;
    }

    // Function to draw lines between nodes
    function drawConnection(nodeA, nodeB) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-line');
        line.setAttribute('x1', nodeA.x);
        line.setAttribute('y1', nodeA.y);
        line.setAttribute('x2', nodeB.x);
        line.setAttribute('y2', nodeB.y);
        
        svgLines.appendChild(line);
        connections.push({ line, nodeA, nodeB });
    }

    // Handle dragging of nodes on the canvas
    function makeDraggable(nodeObj) {
        let isDragging = false;
        let startX, startY;

        nodeObj.element.addEventListener('mousedown', (e) => {
            // Prevent dragging from propagating if we clicked the button
            if (e.target.tagName.toLowerCase() === 'a' || e.target.classList.contains('node-btn')) {
                return;
            }

            isDragging = true;
            nodeObj.element.dataset.dragging = "false";
            startX = e.clientX - nodeObj.x;
            startY = e.clientY - nodeObj.y;
            nodeObj.element.style.zIndex = 100;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            nodeObj.element.dataset.dragging = "true";
            nodeObj.x = e.clientX - startX;
            nodeObj.y = e.clientY - startY;
            nodeObj.element.style.left = `${nodeObj.x}px`;
            nodeObj.element.style.top = `${nodeObj.y}px`;
            
            updateConnections();
        });

        document.addEventListener('mouseup', () => {
            if(isDragging) {
                isDragging = false;
                nodeObj.element.style.zIndex = 10;
                // reset dragging flag if moved very little to allow clicks
                setTimeout(() => { nodeObj.element.dataset.dragging = "false"; }, 50);
            }
        });
    }

    function updateConnections() {
        connections.forEach(conn => {
            conn.line.setAttribute('x1', conn.nodeA.x);
            conn.line.setAttribute('y1', conn.nodeA.y);
            conn.line.setAttribute('x2', conn.nodeB.x);
            conn.line.setAttribute('y2', conn.nodeB.y);
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
