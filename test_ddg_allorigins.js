const fetch = globalThis.fetch || require('node-fetch');

async function fetchWithProxy(url, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        let proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        console.log("Fetching: " + proxyUrl);
        let response = await fetch(proxyUrl, { signal: controller.signal });
        
        if (response.ok) {
            const data = await response.json();
            clearTimeout(id);
            return data.contents;
        }
    } catch (e) {
        console.error("Proxy error:", e);
    } finally {
        clearTimeout(id);
    }
    return null;
}

async function test() {
    let query = '"joao" site:facebook.com';
    let url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    let html = await fetchWithProxy(url, 15000);
    console.log("Length:", html ? html.length : "null");
    if(html && html.length > 0 && html.length < 500) {
        console.log(html);
    }
}
test().catch(console.error);
