process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    const r = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://www.google.com/search?q=felipe+site:linkedin.com'));
    const html = await r.text();
    console.log("HTML size:", html.length);
    const links = html.match(/href="([^"]+)"/g) || [];
    let parsed = [];
    links.forEach(l => {
        let href = l.replace('href="', '').replace('"', '');
        if (href.includes('/url?q=')) {
            const match = href.match(/\/url\?q=([^&]+)/);
            if (match) href = decodeURIComponent(match[1]);
        }
        if (href.startsWith('http') && !href.includes('google.')) {
            parsed.push(href);
        }
    });
    console.log(parsed.slice(0, 10));
}
test();
