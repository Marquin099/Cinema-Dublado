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
