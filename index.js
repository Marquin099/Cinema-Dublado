const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");

// ------------------------------------------------------
// CARREGAMENTO DE ARQUIVOS (SEU FORMATO ANTIGO)
// ------------------------------------------------------
const filmes = JSON.parse(fs.readFileSync("./data/filmes.json"));
const series = JSON.parse(fs.readFileSync("./data/series.json"));

// ------------------------------------------------------
// MANIFESTO
// ------------------------------------------------------
const manifest = {
  id: "cinema-dublado",
  version: "1.0.0",
  name: "Cinema Dublado",
  description: "Addon focado em filmes e séries dublados PT-BR",
  logo: "https://imgur.com/a/pBgbupn",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "catalogo-filmes", name: "Cinema Dublado" },
    { type: "series", id: "catalogo-series", name: "Cinema Dublado" }
  ]
};

// ------------------------------------------------------
// BUILDER
// ------------------------------------------------------
const builder = new addonBuilder(manifest);

// ------------------------------------------------------
// CATÁLOGO
// ------------------------------------------------------
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

// ------------------------------------------------------
// META - AGORA USANDO videos[] CORRETAMENTE
// ------------------------------------------------------
builder.defineMetaHandler(args => {

  // Filme
  const filme = filmes.find(f => f.id === args.id);
  if (filme) {
    return Promise.resolve({
      meta: {
        id: filme.id,
        type: "movie",
        name: filme.name,
        poster: filme.poster,
        description: filme.description,
        releaseInfo: filme.year?.toString()
      }
    });
  }

  // Série
  const serie = series.find(s => s.id === args.id);
  if (serie) {
    return Promise.resolve({
      meta: {
        id: serie.id,
        type: "series",
        name: serie.name,
        poster: serie.poster,
        description: serie.description,
        releaseInfo: serie.year?.toString(),

        videos: serie.videos.map(ep => ({
          id: ep.id,
          title: ep.title,
          season: ep.season,
          episode: ep.episode,
          thumbnail: ep.thumbnail
        }))
      }
    });
  }

  return Promise.resolve({ meta: {} });
});

// ------------------------------------------------------
// STREAM - AGORA COMPATÍVEL COM videos[]
// ------------------------------------------------------
builder.defineStreamHandler(args => {

  // Filme
  const filme = filmes.find(f => f.id === args.id);
  if (filme) {
    return Promise.resolve({
      streams: [
        { title: "Dublado PT-BR", url: filme.stream }
      ]
    });
  }

  // Série Episódio
  for (const serie of series) {
    for (const ep of serie.videos) {
      if (ep.id === args.id) {
        return Promise.resolve({
          streams: [
            {
              title: `${serie.name} - T${ep.season}E${ep.episode}`,
              url: ep.stream
            }
          ]
        });
      }
    }
  }

  return Promise.resolve({ streams: [] });
});

// ------------------------------------------------------
// SERVIDOR
// ------------------------------------------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Addon Cinema Dublado rodando...");
