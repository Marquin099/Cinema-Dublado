const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Manifesto ------------------
const manifest = {
  id: "cinema-dublado",
  version: "1.0.0",
  name: "Cinema Dublado",
  description: "Addon focado em filmes e séries dublados PT-BR",
  logo: "https://imgur.com/a/pBgbupn",

  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],

  catalogs: [
    {
      type: "movie",
      id: "catalogo-filmes",
      name: "Cinema Dublado"
    },
    {
      type: "series",
      id: "catalogo-series",
      name: "Cinema Dublado"
    }
  ]
};

// ------------------ Função de Alias para IDs ------------------
function normalizarId(id) {

  // Alias para série "I Love LA"
  if (id.startsWith("tt33362589")) {
    return id.replace("tt33362589", "i-love-la");
  }

  return id;
}

// ------------------ Carregar filmes ------------------
function carregarFilmes() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", "filmes.json"), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar filmes.json:", err);
    return [];
  }
}

// ------------------ Carregar séries ------------------
function carregarSeries() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", "series.json"), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar series.json:", err);
    return [];
  }
}

const filmes = carregarFilmes();
const series = carregarSeries();

// ------------------ Builder ------------------
const builder = new addonBuilder(manifest);

// ------------------ Catálogo ------------------
builder.defineCatalogHandler(args => {

  if (args.type === "movie") {
    return Promise.resolve({
      metas: filmes.map(f => ({
        id: f.id,
        type: "movie",
        name: f.name,
        poster: f.poster,
        description: f.description,
        releaseInfo: f.year?.toString()
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
        releaseInfo: s.year?.toString()
      }))
    });
  }
});

// ------------------ META HANDLER ------------------
builder.defineMetaHandler(args => {

  const id = normalizarId(args.id);

  // Filme
  const filme = filmes.find(f => f.id === id);
  if (filme) {
    return Promise.resolve({
      meta: {
        id: filme.id,
        type: "movie",
        name: filme.name,
        poster: filme.poster,
        description: filme.description,
        releaseInfo: filme.year?.toString(),
        streams: []
      }
    });
  }

  // Série
  const serie = series.find(s => s.id === id);
  if (serie) {
    return Promise.resolve({
      meta: {
        id: serie.id,
        type: "series",
        name: serie.name,
        poster: serie.poster,
        description: serie.description,
        releaseInfo: serie.year?.toString(),

        seasons: serie.seasons.map(temp => ({
          season: temp.season,
          episodes: temp.episodes.map(ep => ({
            id: `${serie.id}:${temp.season}:${ep.episode}`,
            episode: ep.episode,
            season: temp.season,
            title: ep.title,
            thumbnail: ep.thumbnail
          }))
        }))
      }
    });
  }

  return Promise.resolve({ meta: {} });
});

// ------------------ STREAM HANDLER ------------------
builder.defineStreamHandler(args => {

  const id = normalizarId(args.id);

  // Filme
  const filme = filmes.find(f => f.id === id);
  if (filme) {
    return Promise.resolve({
      streams: [
        { title: "Dublado PT-BR", url: filme.stream }
      ]
    });
  }

  // Série / Episódio
  for (const serie of series) {
    if (!serie.seasons) continue;

    for (const temporada of serie.seasons) {
      for (const ep of temporada.episodes) {

        const epId = `${serie.id}:${temporada.season}:${ep.episode}`;

        if (epId === id) {
          return Promise.resolve({
            streams: [
              { title: `T${temporada.season}E${ep.episode} Dublado`, url: ep.stream }
            ]
          });
        }
      }
    }
  }

  return Promise.resolve({ streams: [] });
});

// ------------------ Servidor HTTP ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Addon Cinema Dublado rodando...");
