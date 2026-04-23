process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    console.log("Fetching google...");
    const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.google.com/search?q=felipe+site:linkedin.com');
    const r = await fetch(url);
    const d = await r.json();
    const html = d.contents;
    console.log("HTML length:", html ? html.length : 0);
    
    // Mimic DOMParser parsing in NodeJS
    const links = html.match(/href="([^"]+)"/g) || [];
    let allLinks = [];
    links.forEach(l => {
        let href = l.replace('href="', '').replace('"', '');
        if (href.includes('/url?q=')) {
            const match = href.match(/\/url\?q=([^&]+)/);
            if (match) href = decodeURIComponent(match[1]);
        }
        if (href.startsWith('http') && !href.includes('google.')) {
            allLinks.push(href);
        }
    });
    console.log("Found links:", allLinks);
}
test().catch(console.error);
