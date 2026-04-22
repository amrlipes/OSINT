process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    try {
        const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=felipe'));
        const data = await res.json();
        const html = data.contents;
        const links = html.match(/href="([^"]+)"/g) || [];
        console.log('Links found:', links.length);
        console.log(links.slice(0, 10));
    } catch (e) { console.error(e); }
}
test();
