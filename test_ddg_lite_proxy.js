process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'; 
const url = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://lite.duckduckgo.com/lite/?q=facebook');
fetch(url).then(r=>r.text()).then(t=>{
    console.log(t.length, t.includes('facebook')) 
}).catch(console.error);
