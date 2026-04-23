process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function test() {
    const url = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://lite.duckduckgo.com/lite/');
    const r = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'q=felipe+site:linkedin.com'
    });
    const html = await r.text();
    console.log("lite ddg length via codetabs:", html.length);
    const links = html.match(/href="([^"]+)"/g) || [];
    console.log(links.filter(l => l.includes('linkedin')).slice(0, 5));
}
test().catch(console.error);
