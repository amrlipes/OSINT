process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'; 
fetch('https://lite.duckduckgo.com/lite/?q=facebook').then(r=>r.text()).then(t=>{
    const matches = t.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi);
    console.log(matches.slice(0, 10)) 
});
