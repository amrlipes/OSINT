const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Helpers
async function duckduckgoSearch(query) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            },
            timeout: 8000
        });
        const $ = cheerio.load(response.data);
        const links = [];
        
        $('.result__url').each((i, element) => {
            if (links.length >= 5) return false;
            let href = $(element).attr('href');
            if (href) {
                if (href.startsWith('//')) href = 'https:' + href;
                if (!href.startsWith('/')) links.push(href.trim());
            }
        });
        
        return links;
    } catch (e) {
        console.error('DuckDuckGo Error:', e.message);
        return [];
    }
}

async function githubSearch(query) {
    try {
        const url = `https://api.github.com/users/${encodeURIComponent(query)}`;
        const response = await axios.get(url, { timeout: 5000 });
        return response.data;
    } catch (e) {
        return null;
    }
}

async function wikipediaSearch(query) {
    try {
        const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data && response.data.query && response.data.query.search) {
            return response.data.query.search.slice(0, 5);
        }
    } catch (e) {
        return null;
    }
    return [];
}

// Routes
app.get('/api/osint/username', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Nenhum alvo fornecido" });
    
    const results = [];
    
    // Perform all searches concurrently for maximum efficiency
    const [ghData, dorkLinks] = await Promise.all([
        githubSearch(query),
        duckduckgoSearch(`"${query}"`)
    ]);
    
    if (ghData) {
        results.push({
            source: "GitHub",
            icon: "</>",
            desc: "Perfil de desenvolvedor encontrado.",
            url: ghData.html_url,
            details: {
                "Nome Real": ghData.name || "Não informado",
                "Empresa": ghData.company || "Não informado",
                "Localização": ghData.location || "Não informado",
                "Repositórios": ghData.public_repos || 0
            }
        });
    }
    
    if (dorkLinks && dorkLinks.length > 0) {
        let details = {};
        dorkLinks.forEach((link, i) => details[`Link ${i+1}`] = link);
        results.push({
            source: "Pegadas na Web (Dork)",
            icon: "🔍",
            desc: `Encontramos ${dorkLinks.length} sites citando este username publicamente.`,
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22`,
            details
        });
    }
    
    res.json({ target: query, type: "username", results });
});

app.get('/api/osint/name', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Vazio" });
    
    const results = [];
    
    const [wikiData, pdfLinks, newsLinks] = await Promise.all([
        wikipediaSearch(query),
        duckduckgoSearch(`"${query}" filetype:pdf`),
        duckduckgoSearch(`"${query}" site:globo.com OR site:uol.com.br`)
    ]);

    if (wikiData && wikiData.length > 0) {
        let details = {};
        wikiData.forEach(item => {
            details[`Artigo: ${item.title}`] = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
        });
        results.push({
            source: "Arquivos Enciclopédicos (Wikipedia)",
            icon: "🏛",
            desc: `Localizamos menções em registros históricos ou públicos.`,
            url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
            details
        });
    }
    
    if (pdfLinks && pdfLinks.length > 0) {
        let details = {};
        pdfLinks.forEach((link, i) => details[`Doc ${i+1}`] = link);
        results.push({
            source: "Registros em PDF (Editais/Processos)",
            icon: "📄",
            desc: "PDFs públicos contendo o nome exato.",
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
            details
        });
    }
    
    if (newsLinks && newsLinks.length > 0) {
        let details = {};
        newsLinks.forEach((link, i) => details[`Notícia ${i+1}`] = link);
        results.push({
            source: "Mídia / Portais de Notícias",
            icon: "📰",
            desc: "Menções em portais brasileiros.",
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+site%3Aglobo.com`,
            details
        });
    }
    
    res.json({ target: query, type: "name", results });
});

app.get('/api/osint/email', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Vazio" });
    
    const results = [];
    
    const [dorkLinks, pdfLinks] = await Promise.all([
        duckduckgoSearch(`"${query}"`),
        duckduckgoSearch(`"${query}" filetype:pdf`)
    ]);
    
    if (dorkLinks && dorkLinks.length > 0) {
        let details = {};
        dorkLinks.forEach((link, i) => details[`Página ${i+1}`] = link);
        results.push({
            source: "Índice Web Aberto",
            icon: "🌐",
            desc: `Este e-mail está vazado em texto claro em ${dorkLinks.length} páginas.`,
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22`,
            details
        });
    }
    
    if (pdfLinks && pdfLinks.length > 0) {
        let details = {};
        pdfLinks.forEach((link, i) => details[`Documento ${i+1}`] = link);
        results.push({
            source: "Documentos Oficiais (PDF)",
            icon: "📄",
            desc: "Encontramos PDFs públicos contendo o endereço de e-mail.",
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
            details
        });
    }
    
    if (results.length === 0) {
        results.push({
            source: "Varredura Concluída",
            icon: "🛡️",
            desc: "Não encontramos dados em texto claro ou PDFs públicos em nossa rede principal.",
            url: "#",
            details: {}
        });
    }
    
    res.json({ target: query, type: "email", results });
});

app.get('/api/osint/phone', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Vazio" });
    
    const results = [];
    const cleanPhone = query.replace(/[^\d+]/g, ''); // keeping + and numbers
    
    const dorkLinks = await duckduckgoSearch(`"${cleanPhone}" OR "${query}"`);
    
    if (dorkLinks && dorkLinks.length > 0) {
        let details = {};
        dorkLinks.forEach((link, i) => details[`Registro ${i+1}`] = link);
        results.push({
            source: "Registros Telefônicos (Web)",
            icon: "☎",
            desc: "Encontramos páginas contendo este número.",
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(cleanPhone)}%22`,
            details
        });
    } else {
        results.push({
            source: "Segurança de Número",
            icon: "🛡️",
            desc: "Não encontramos vazamentos públicos do número de telefone.",
            url: "#",
            details: {}
        });
    }
    
    res.json({ target: query, type: "phone", results });
});

app.listen(PORT, () => {
    console.log("=".repeat(50));
    console.log(" NEXUS OSINT ENGINE INICIADA (Node.js)");
    console.log(` SERVIDOR RODANDO EM: http://localhost:${PORT}`);
    console.log("=".repeat(50));
});
