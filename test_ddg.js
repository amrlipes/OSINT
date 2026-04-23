process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=felipe+site:linkedin.com');
    const r = await fetch(url);
    const j = await r.json();
    const html = j.contents;
    console.log("HTML length:", html.length);
    const links = html.match(/href="([^"]+)"/g) || [];
    let found = [];
    links.forEach(l => {
        let href = l.replace('href="', '').replace('"', '');
        if (href.includes('linkedin.com')) found.push(href);
    });
    console.log(found.slice(0, 10));
}
test();
