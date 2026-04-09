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
        const query = inputField.value.trim();
        if(!query) return;

        logToTerminal(`Initiating target acquisition for: <span class="highlight">${query}</span>`, 'info');
        inputField.value = '';
        
        if(canvasOverlay) {
            canvasOverlay.style.display = 'none';
        }

        // Clear canvas for a new root search
        clearCanvas();

        // Simulate a search flow (Phase 1 mock)
        simulateSearchSequence(query);
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

    async function simulateSearchSequence(query) {
        logToTerminal('[API] Querying internal memory (Supabase cache)...', 'system');
        await sleep(800);
        
        logToTerminal('Cache miss. Calling Vercel Serverless hooks...', 'warning');
        await sleep(1000);

        // Root Node
        logToTerminal(`[SUCCESS] Root identity established for ${query}`, 'success');
        const rootNode = createNode({
            title: 'ROOT TARGET',
            icon: '🎯',
            data: {
                Identifier: query,
                Status: 'Acquired',
                Risk: 'Unknown'
            },
            x: canvas.clientWidth / 2,
            y: canvas.clientHeight / 2
        });

        await sleep(1200);

        // Simulate finding GitHub
        logToTerminal(`[INFO] Searching GitHub API wrapper...`, 'info');
        await sleep(1500);
        logToTerminal(`[SUCCESS] GitHub profile identified.`, 'success');
        
        // Generate GitHub node
        const ghNode = createNode({
            title: 'GITHUB',
            icon: '</>',
            data: {
                Username: (query.replace('@', '')).toLowerCase(),
                Repos: Math.floor(Math.random() * 50) + 5,
                Email: `contact@${query.replace('@','')}.com`
            },
            x: canvas.clientWidth / 2 - 250,
            y: canvas.clientHeight / 2 - 150
        });

        drawConnection(rootNode, ghNode);
        
        await sleep(1000);

        // Simulate finding Instagram
        logToTerminal(`[INFO] Scraping Instagram public endpoint...`, 'info');
        await sleep(1800);
        logToTerminal(`[WARNING] Account is private, partial data retrieved.`, 'warning');
        
        const igNode = createNode({
            title: 'INSTAGRAM',
            icon: 'IG',
            data: {
                Handle: `@${query.replace('@','')}`,
                Followers: '1.2k',
                Bio: 'Link in bio 🔗'
            },
            x: canvas.clientWidth / 2 + 250,
            y: canvas.clientHeight / 2 - 50
        });

        drawConnection(rootNode, igNode);
    }

    function createNode(info) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node';
        nodeEl.style.left = `${info.x}px`;
        nodeEl.style.top = `${info.y}px`;

        let detailsHTML = '';
        for (const [key, value] of Object.entries(info.data)) {
            detailsHTML += `<div class="node-detail"><strong>${key}:</strong> ${value}</div>`;
        }

        nodeEl.innerHTML = `
            <div class="node-header">
                <div class="node-icon">${info.icon}</div>
                <div class="node-title">${info.title}</div>
            </div>
            <div class="node-body">
                ${detailsHTML}
            </div>
        `;

        canvas.appendChild(nodeEl);
        
        const nodeObj = { id: Date.now(), element: nodeEl, x: info.x, y: info.y, info: info };
        nodes.push(nodeObj);

        // Make node draggable
        makeDraggable(nodeObj);

        // Node click simulation for expanding
        nodeEl.addEventListener('click', async (e) => {
            // Stop drag event misinterpretation
            if(nodeEl.dataset.dragging === "true") return;

            // Only mock expand if it wasn't expanded
            if(!nodeObj.expanded) {
                logToTerminal(`[ACTION] Accessing deep nodes from: ${info.title}`, 'highlight');
                nodeEl.style.borderColor = '#ff0055';
                
                await sleep(1000);
            
                logToTerminal(`[SUCCESS] Extracted auxiliary data from ${info.title}.`, 'success');
                const childNode = createNode({
                    title: 'LINKEDIN',
                    icon: 'IN',
                    data: {
                        Company: 'Tech Corp',
                        Role: 'Software Engineer',
                        Location: 'Global'
                    },
                    x: info.x + (Math.random() > 0.5 ? 200 : -200),
                    y: info.y + 150
                });
                drawConnection(nodeObj, childNode);
                nodeObj.expanded = true;
                nodeEl.style.borderColor = 'var(--border-glow)';
            }
        });

        return nodeObj;
    }

    // Function to draw lines between nodes
    function drawConnection(nodeA, nodeB) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-line');
        // Nodes positions are center based because of translate(-50%, -50%)
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
