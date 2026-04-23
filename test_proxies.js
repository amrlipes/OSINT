process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function testProxies(url) {
    console.log("Testing:", url);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

    try {
        console.log("Trying codetabs...");
        let proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        let response = await fetch(proxyUrl, { signal: controller.signal });
        if (response.ok) {
            console.log("codetabs OK!");
            const txt = await response.text();
            console.log("Length:", txt.length);
            return txt;
        }
        console.log("codetabs failed, status:", response.status);
    } catch (e) {
        console.log("codetabs error:", e.message);
    }

    try {
        console.log("Trying thingproxy...");
        const proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
        const response = await fetch(proxyUrl, { signal: controller.signal });
        if (response.ok) {
            console.log("thingproxy OK!");
            const txt = await response.text();
            console.log("Length:", txt.length);
            return txt;
        }
        console.log("thingproxy failed, status:", response.status);
    } catch (e) {
        console.log("thingproxy error:", e.message);
    }
    clearTimeout(id);
}
testProxies('https://html.duckduckgo.com/html/?q=felipe').then(()=>process.exit(0));
