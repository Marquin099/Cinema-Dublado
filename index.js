// index.js
const express = require("express");
const { addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

const manifest = {
  id: "cinema-br-dublado",
  version: "1.0.0",
  name: "Cinema BR Dublado",
  description: "Addon focado 100% em filmes dublados PT-BR",
  logo: "https://i.imgur.com/1wHZcFQ.png",
  resources: ["catalog", "stream"],
  types: ["movie"],
  catalogs: [
    { type: "movie", id: "catalogo-dublado", name: "Cinema Brasil Dublado" }
  ]
};

const builder = new addonBuilder(manifest);

// Lê o arquivo data/filmes.json para montar catálogo/streams
function carregarFilmes() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", "filmes.json"), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao ler data/filmes.json:", err);
    return [];
  }
}

const filmes = carregarFilmes();

// Catálogo
builder.defineCatalogHandler(args => {
  const metas = filmes.map(f => ({
    id: f.id,
    type: "movie",
    name: f.name,
    poster: f.poster,
    description: f.description,
    releaseInfo: f.year ? `${f.year}` : undefined
  }));
  return Promise.resolve({ metas });
});

// Stream
builder.defineStreamHandler(args => {
  const f = filmes.find(x => x.id === args.id);
  if (!f) return Promise.resolve({ streams: [] });

  const streams = [
    {
      title: "Dublado PT-BR",
      url: f.stream,
      infoHash: f.hash || undefined
    }
  ];
  return Promise.resolve({ streams });
});

// Express server
const app = express();
app.use("/", builder.getInterface());

// Rota simples para ver que está no ar
app.get("/ping", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Addon rodando na porta ${PORT}`);
});
