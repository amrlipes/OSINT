const fetch = globalThis.fetch || require('node-fetch');

async function fetchWithProxy(url, timeout = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        let proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        console.log("Trying codetabs:", proxyUrl);
        let response = await fetch(proxyUrl, { signal: controller.signal });
        
        if (response.ok) {
            const text = await response.text();
            if (text && !text.includes('"Error":') && text.length > 200) {
                clearTimeout(id);
                console.log("Codetabs SUCCESS, length:", text.length);
                return text;
            } else {
                console.log("Codetabs returned error or short text:", text);
            }
        } else {
            console.log("Codetabs HTTP error:", response.status);
        }

        console.log("Falling back to allorigins...");
        proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl, { signal: controller.signal });
        
        if (response.ok) {
            const data = await response.json();
            clearTimeout(id);
            console.log("Allorigins SUCCESS, length:", data.contents ? data.contents.length : 0);
            return data.contents;
        } else {
            console.log("Allorigins HTTP error:", response.status);
        }
        
    } catch (e) {
        console.error("Proxy error:", e.message);
    } finally {
        clearTimeout(id);
    }
    return null;
}

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'; 
    let query = '"email" site:facebook.com';
    const engines = [
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
        `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    ];

    for (let engine of engines) {
        console.log("\nTesting engine:", engine);
        let html = await fetchWithProxy(engine);
        if (html) {
            // Simulated parsing
            const matches = html.match(/<a[^>]+href="([^"]+)"/g);
            console.log("Found links:", matches ? matches.length : 0);
            if (matches && matches.length > 0) {
                const someLinks = matches.slice(0, 5).map(m => m.match(/href="([^"]+)"/)[1]);
                console.log("Sample links:", someLinks);
            }
        }
    }
}
test();
