from flask import Flask, request, jsonify, send_from_directory
import requests
from bs4 import BeautifulSoup
import time
import os

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

@app.route('/')
def index():
    return app.send_static_file('index.html')

def duckduckgo_search(query):
    # Fazemos um scraping simples no DuckDuckGo versão HTML (que funciona sem Javascript)
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    url = f"https://html.duckduckgo.com/html/?q={query}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        results = []
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # Extrair os links dos resultados
            for a in soup.find_all('a', class_='result__url', limit=5):
                link = a.get('href')
                if link and link.startswith('//'):
                    link = 'https:' + link
                if link and not link.startswith('/'):
                    results.append(link.strip())
        return results
    except Exception as e:
        return []

@app.route('/api/osint/username')
def osint_username():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Nenhum alvo fornecido"}), 400
        
    results = []
    
    # 1. API do GitHub
    try:
        gh_url = f"https://api.github.com/users/{query}"
        gh_r = requests.get(gh_url, timeout=5)
        if gh_r.status_code == 200:
            data = gh_r.json()
            results.append({
                "source": "GitHub",
                "icon": "</>",
                "desc": "Perfil de desenvolvedor encontrado.",
                "url": data.get("html_url"),
                "details": {
                    "Nome Real": data.get("name", "Não informado"),
                    "Empresa": data.get("company", "Não informado"),
                    "Localização": data.get("location", "Não informado"),
                    "Repositórios": data.get("public_repos", 0)
                }
            })
    except:
        pass
        
    # 2. Busca na Web por Rastros (Google Dork via DuckDuckGo)
    dork_results = duckduckgo_search(f'"{query}"')
    if dork_results:
        details_dict = {}
        for i, link in enumerate(dork_results):
            details_dict[f"Link {i+1}"] = link
            
        results.append({
            "source": "Pegadas na Web (Dork)",
            "icon": "🔍",
            "desc": f"Encontramos {len(dork_results)} sites citando este username publicamente.",
            "url": f"https://duckduckgo.com/?q=%22{query}%22",
            "details": details_dict
        })
        
    return jsonify({"target": query, "type": "username", "results": results})

@app.route('/api/osint/email')
def osint_email():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Nenhum alvo fornecido"}), 400
        
    results = []
    
    # 1. Busca Geral do E-mail em Texto Claro
    dork_results = duckduckgo_search(f'"{query}"')
    if dork_results:
        details_dict = {}
        for i, link in enumerate(dork_results):
            details_dict[f"Página {i+1}"] = link
            
        results.append({
            "source": "Índice Web Aberto",
            "icon": "🌐",
            "desc": f"Este e-mail está vazado em texto claro em {len(dork_results)} páginas.",
            "url": f"https://duckduckgo.com/?q=%22{query}%22",
            "details": details_dict
        })
        
    # 2. Busca Focada em Arquivos PDF
    pdf_results = duckduckgo_search(f'"{query}" filetype:pdf')
    if pdf_results:
        pdf_dict = {}
        for i, link in enumerate(pdf_results):
            pdf_dict[f"Documento {i+1}"] = link
            
        results.append({
            "source": "Documentos Oficiais (PDF)",
            "icon": "📄",
            "desc": f"Encontramos PDFs públicos contendo o endereço de e-mail.",
            "url": f"https://duckduckgo.com/?q=%22{query}%22+filetype%3Apdf",
            "details": pdf_dict
        })
        
    if not results:
        results.append({
            "source": "Varredura Concluída",
            "icon": "🛡️",
            "desc": "Não encontramos dados em texto claro ou PDFs públicos em nossa rede principal.",
            "url": "#",
            "details": {}
        })
        
    return jsonify({"target": query, "type": "email", "results": results})

@app.route('/api/osint/name')
def osint_name():
    query = request.args.get('q')
    if not query: return jsonify({"error": "Vazio"}), 400
    
    results = []
    
    pdf_results = duckduckgo_search(f'"{query}" filetype:pdf')
    if pdf_results:
        pdf_dict = {}
        for i, link in enumerate(pdf_results):
            pdf_dict[f"Doc {i+1}"] = link
            
        results.append({
            "source": "Registros em PDF (Editais/Processos)",
            "icon": "🏛",
            "desc": f"PDFs contendo o nome exato.",
            "url": f"https://duckduckgo.com/?q=%22{query}%22+filetype%3Apdf",
            "details": pdf_dict
        })
        
    news_results = duckduckgo_search(f'"{query}" site:globo.com OR site:uol.com.br')
    if news_results:
        news_dict = {}
        for i, link in enumerate(news_results):
            news_dict[f"Notícia {i+1}"] = link
            
        results.append({
            "source": "Mídia / Portais de Notícias",
            "icon": "📰",
            "desc": "Menções em portais brasileiros.",
            "url": f"https://duckduckgo.com/?q=%22{query}%22+site%3Aglobo.com",
            "details": news_dict
        })

    return jsonify({"target": query, "type": "name", "results": results})

if __name__ == '__main__':
    print("="*50)
    print(" NEXUS OSINT ENGINE INICIADA")
    print(" SERVIDOR RODANDO EM: http://127.0.0.1:5000")
    print("="*50)
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)
