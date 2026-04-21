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

async function searchPlatform(query, platformName, domain, icon, desc) {
    // Usando DuckDuckGo Dorks (site:)
    const links = await duckduckgoSearch(`"${query}" site:${domain}`);
    if (links && links.length > 0) {
        let details = {};
        links.forEach((link, i) => details[`Registro ${i+1}`] = link);
        return {
            source: platformName,
            icon: icon,
            desc: desc,
            url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+site%3A${domain}`,
            details
        };
    }
    return null;
}

// Routes
app.get('/api/osint/username', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Nenhum alvo fornecido" });
    
    const results = [];
    
    const searches = [
        githubSearch(query).then(ghData => {
            if (ghData) {
                return {
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
                };
            }
            return null;
        }),
        searchPlatform(query, "Instagram", "instagram.com", "📸", "Perfis na rede social."),
        searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Perfis na rede de vídeos curtos."),
        searchPlatform(query, "Twitter/X", "twitter.com", "🐦", "Menções ou perfil na rede social."),
        duckduckgoSearch(`"${query}"`).then(dorkLinks => {
            if (dorkLinks && dorkLinks.length > 0) {
                let details = {};
                dorkLinks.forEach((link, i) => details[`Link ${i+1}`] = link);
                return {
                    source: "Pegadas na Web (Geral)",
                    icon: "🌐",
                    desc: `Encontramos sites gerais citando este username.`,
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22`,
                    details
                };
            }
            return null;
        })
    ];
    
    const completed = await Promise.allSettled(searches);
    completed.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
        }
    });
    
    res.json({ target: query, type: "username", results });
});

app.get('/api/osint/name', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Vazio" });
    
    const results = [];
    
    const searches = [
        wikipediaSearch(query).then(data => {
            if (data && data.length > 0) {
                let details = {};
                data.forEach(item => details[`Artigo: ${item.title}`] = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`);
                return {
                    source: "Arquivos Enciclopédicos (Wikipedia)",
                    icon: "🏛",
                    desc: "Localizamos menções em registros históricos ou públicos.",
                    url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
                    details
                };
            }
            return null;
        }),
        searchPlatform(query, "JusBrasil", "jusbrasil.com.br", "⚖️", "Envolvimentos em processos judiciais e diários oficiais."),
        searchPlatform(query, "Jucesp (Empresas SP)", "jucesponline.sp.gov.br", "🏢", "Participação em quadros societários no estado de SP."),
        searchPlatform(query, "Instagram", "instagram.com", "📸", "Possíveis perfis na rede social."),
        searchPlatform(query, "TikTok", "tiktok.com", "🎵", "Possíveis perfis na rede de vídeos curtos."),
        searchPlatform(query, "LinkedIn", "br.linkedin.com", "💼", "Perfis profissionais indexados."),
        searchPlatform(query, "Google Docs", "docs.google.com", "📝", "Documentos públicos ou planilhas indexadas."),
        duckduckgoSearch(`"${query}" filetype:pdf`).then(links => {
            if (links && links.length > 0) {
                let details = {};
                links.forEach((link, i) => details[`Doc ${i+1}`] = link);
                return {
                    source: "Registros em PDF (Geral)",
                    icon: "📄",
                    desc: "PDFs públicos contendo o nome exato.",
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
                    details
                };
            }
            return null;
        })
    ];

    const completed = await Promise.allSettled(searches);
    completed.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
        }
    });
    
    res.json({ target: query, type: "name", results });
});

app.get('/api/osint/email', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Vazio" });
    
    const results = [];
    
    const searches = [
        duckduckgoSearch(`"${query}"`).then(dorkLinks => {
            if (dorkLinks && dorkLinks.length > 0) {
                let details = {};
                dorkLinks.forEach((link, i) => details[`Página ${i+1}`] = link);
                return {
                    source: "Índice Web Aberto",
                    icon: "🌐",
                    desc: `Este e-mail está vazado em texto claro nas páginas abaixo.`,
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22`,
                    details
                };
            }
            return null;
        }),
        duckduckgoSearch(`"${query}" filetype:pdf`).then(pdfLinks => {
            if (pdfLinks && pdfLinks.length > 0) {
                let details = {};
                pdfLinks.forEach((link, i) => details[`Documento ${i+1}`] = link);
                return {
                    source: "Documentos Oficiais (PDF)",
                    icon: "📄",
                    desc: "Encontramos PDFs públicos contendo o endereço de e-mail.",
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(query)}%22+filetype%3Apdf`,
                    details
                };
            }
            return null;
        }),
        searchPlatform(query, "GitHub", "github.com", "</>", "Commits ou perfis contendo este email."),
        searchPlatform(query, "Google Docs", "docs.google.com", "📝", "Planilhas ou documentos vazados contendo este email.")
    ];
    
    const completed = await Promise.allSettled(searches);
    completed.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
        }
    });

    if (results.length === 0) {
        results.push({
            source: "Varredura Concluída",
            icon: "🛡️",
            desc: "Não encontramos dados em texto claro, PDFs ou plataformas em nossa rede.",
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
    
    const searches = [
        duckduckgoSearch(`"${cleanPhone}" OR "${query}"`).then(dorkLinks => {
            if (dorkLinks && dorkLinks.length > 0) {
                let details = {};
                dorkLinks.forEach((link, i) => details[`Registro ${i+1}`] = link);
                return {
                    source: "Registros Telefônicos (Web)",
                    icon: "☎",
                    desc: "Encontramos páginas na web contendo este número.",
                    url: `https://duckduckgo.com/?q=%22${encodeURIComponent(cleanPhone)}%22`,
                    details
                };
            }
            return null;
        }),
        searchPlatform(query, "Instagram", "instagram.com", "📸", "Vazamentos em bios do Instagram."),
        searchPlatform(query, "JusBrasil", "jusbrasil.com.br", "⚖️", "Possível presença em processos no JusBrasil.")
    ];

    const completed = await Promise.allSettled(searches);
    completed.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
        }
    });

    if (results.length === 0) {
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

app.listen(PORT, '127.0.0.1', () => {
    console.log("=".repeat(50));
    console.log(" NEXUS OSINT ENGINE INICIADA (Node.js)");
    console.log(` SERVIDOR RODANDO EM: http://127.0.0.1:${PORT}`);
    console.log("=".repeat(50));
});
