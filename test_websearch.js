process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { JSDOM } = require('jsdom');

async function webSearch(query, domainFilter = "") {
    const engines = [
        `https://www.google.com/search?q=${encodeURIComponent(query)}`
    ];
    let allLinks = [];
    for (const engineUrl of engines) {
        let proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(engineUrl)}`;
        let response = await fetch(proxyUrl);
        let html = await response.text();
        console.log("HTML length:", html.length);
        
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        let foundLinks = doc.querySelectorAll('a');
        
        foundLinks.forEach(a => {
            let href = a.getAttribute('href');
            if (!href) return;
            
            if (href.includes('/url?q=')) {
                const match = href.match(/\/url\?q=([^&]+)/);
                if (match) href = decodeURIComponent(match[1]);
            }
            href = href.trim();
            if (href.startsWith('//')) href = 'https:' + href;
            
            if (href.startsWith('http') && 
                !href.includes('google.') && !href.includes('yahoo.') && 
                !href.includes('bing.') && !href.includes('microsoft.') && 
                !href.includes('duckduckgo.') && !href.includes('yandex.')) {
                
                if (domainFilter && !href.includes(domainFilter)) return;
                
                const isHomePage = href.replace(/^https?:\/\/(www\.)?/, '').split('/').filter(p => p !== '').length === 1;
                const isLoginPage = href.includes('/login') || href.includes('/signup') || href.includes('/recover') || href.includes('/auth');
                
                if (domainFilter && (isHomePage || isLoginPage)) {
                    return; 
                }
                
                allLinks.push(href);
            }
        });
        if (allLinks.length >= 5) break; 
    }
    return [...new Set(allLinks)].slice(0, 10);
}

webSearch('"felipe" site:linkedin.com', 'linkedin.com').then(links => {
    console.log("Links:", links);
});
