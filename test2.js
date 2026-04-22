process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    try {
        const res = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=felipe'));
        const html = await res.text();
        const links = html.match(/href="([^"]+)"/g) || [];
        console.log('Links found:', links.length);
    } catch (e) { console.error(e); }
}
test();
