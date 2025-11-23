# Cinema BR Dublado

Addon Stremio simples para filmes dublados PT-BR.

## Como funciona
- catálogo: `/catalog/movie/catalogo-dublado.json`
- stream: `/stream/movie/{id}.json`
- manifest: `/manifest.json` (gerado pelo addon)

## Deploy
1. Conectar este repositório ao Render (Web Service).
2. Build: `npm install`
3. Start command: `npm start`

## Adicionar filmes
Edite `data/filmes.json` com objetos:
{
  "id": "umjolo-entre-dois-amores-2025",
  "name": "Umjolo: Entre Dois Amores (2025)",
  "poster": "https://i.imgur.com/dyKdIrT.jpeg",
  "description": "Filme dublado PT-BR",
  "year": 2025,
  "stream": "http://batx7.lat:80/movie/689077610/846738191/7096087.mp4"
}
