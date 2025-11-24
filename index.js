const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Manifesto ------------------
const manifest = {
  id: "cinema-dublado",
  version: "1.0.0",
  name: "Cinema Dublado",
  description: "Addon 100% focado em conteúdo dublado PT-BR",
  logo: "https://i.imgur.com/1wHZcFQ.png",
  resources: ["catalog", "stream"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "catalogo-filmes", name: "Filmes Dublados" },
    { type: "series", id: "catalogo-series", name: "Séries Dubladas" }
  ]
};

// ------------------ Carregar arquivos JSON ------------------
function carregarArquivo(nome) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", nome), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erro ao carregar ${nome}:`, err);
    return [];
  }
}

const filmes = carregarArquivo("filmes.json");
const series = carregarArquivo("series.json");

// ------------------ Builder ------------------
const builder = new addonBuilder(manifest);

// Catálogo
builder.defineCatalogHandler(args => {
  if (args.type === "movie") {
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
  }

  if (args.type === "series") {
    return Promise.resolve({
      metas: series.map(s => ({
        id: s.id,
        type: "series",
        name: s.name,
        poster: s.poster,
        description: s.description,
        releaseInfo: s.year ? `${s.year}` : undefined
      }))
    });
  }

  return Promise.resolve({ metas: [] });
});

// Stream Handler
builder.defineStreamHandler(args => {
  // Filme
  const filme = filmes.find(f => f.id === args.id);
  if (filme) {
    return Promise.resolve({
      streams: [{ title: "Dublado PT-BR", url: filme.stream }]
    });
  }

  // Série (id = ttxxxx:1:3 → imdb:season:episode)
  const partes = args.id.split(":");
  const imdb = partes[0];
  const season = parseInt(partes[1]);
  const episode = parseInt(partes[2]);

  const serie = series.find(s => s.id === imdb);
  if (!serie) return Promise.resolve({ streams: [] });

  const temporada = serie.seasons.find(t => t.season === season);
  if (!temporada) return Promise.resolve({ streams: [] });

  const ep = temporada.episodes.find(e => e.episode === episode);
  if (!ep) return Promise.resolve({ streams: [] });

  return Promise.resolve({
    streams: [{ title: `Episódio ${episode} Dublado`, url: ep.stream }]
  });
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("🍿 Addon Cinema Dublado rodando...");
