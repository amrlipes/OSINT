process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const url = 'https://www.google.com/search?q=' + encodeURIComponent('"felipe" site:linkedin.com');
console.log('URL:', url);
const encoded = encodeURIComponent(url);
console.log('Encoded URL:', encoded);
fetch('https://api.codetabs.com/v1/proxy?quest=' + encoded)
.then(r=>r.text()).then(t=>{
    console.log('Length:', t.length);
    if(t.length < 5000) console.log(t);
})
