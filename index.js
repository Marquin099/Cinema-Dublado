const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Manifesto ------------------
const manifest = {
  id: "cinema-br-dublado",
  version: "1.0.0",
  name: "Cinema BR Dublado",
  description: "Addon 100% focado em filmes dublados PT-BR",
  logo: "https://i.imgur.com/1wHZcFQ.png",
  resources: ["catalog", "stream"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "catalogo-dublado",
      name: "Cinema Brasil Dublado"
    }
  ]
};

// ------------------ Carregar lista de filmes ------------------
function carregarFilmes() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", "filmes.json"), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar filmes.json:", err);
    return [];
  }
}

const filmes = carregarFilmes();

// ------------------ Builder ------------------
const builder = new addonBuilder(manifest);

// Catálogo
builder.defineCatalogHandler(args => {
  return Promise.resolve({
    metas: filmes.map(f => ({
      id: f.id,
      type: "movie",
      name: f.name,
      poster: f.poster,
      description: f.description,
      releaseInfo: f.year ? `${f.year}` : undefined
    }))
  });
});

// Stream
builder.defineStreamHandler(args => {
  const filme = filmes.find(f => f.id === args.id);
  if (!filme) return Promise.resolve({ streams: [] });

  return Promise.resolve({
    streams: [
      {
        title: "Dublado PT-BR",
        url: filme.stream
      }
    ]
  });
});

// ------------------ Servidor HTTP nativo (SEM EXPRESS) ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Addon Cinema BR Dublado rodando...");
