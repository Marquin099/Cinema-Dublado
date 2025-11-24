
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar dados (pasta data) ------------------
function safeReadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, p), "utf8"));
  } catch (err) {
    console.error("Erro ao ler JSON:", p, err.message);
    return [];
  }
}

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

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
    { type: "movie", id: "catalogo-filmes", name: "Cinema Dublado" },
    { type: "series", id: "catalogo-series", name: "Cinema Dublado" }
  ]
};

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

  return Promise.resolve({ metas: [] });
});

// ------------------ Meta handler ------------------
builder.defineMetaHandler(args => {
  // Primeiro tenta filme
  const filme = filmes.find(f => f.id === args.id || (f.tmdb && `tmdb:${f.tmdb}` === args.id));
  if (filme) {
    return Promise.resolve({
      meta: {
        id: filme.id,
        type: "movie",
        name: filme.name,
        poster: filme.poster,
        description: filme.description,
        releaseInfo: filme.year?.toString(),
        videos: [
          {
            id: filme.id,
            title: filme.name,
            stream: filme.stream
          }
        ]
      }
    });
  }

  // Série
  const serie = series.find(s => s.id === args.id || (s.tmdb && `tmdb:${s.tmdb}` === args.id));
  if (serie) {
    // se o JSON estiver em "seasons" (antigo) converte para videos
    let videos = [];
    if (Array.isArray(serie.videos)) {
      videos = serie.videos;
    } else if (Array.isArray(serie.seasons)) {
      serie.seasons.forEach(se => {
        if (Array.isArray(se.episodes)) {
          se.episodes.forEach(ep => {
            videos.push({
              id: ep.id || `${serie.id}:${se.season}:${ep.episode}`,
              title: ep.title || (`Episódio ${ep.episode}`),
              season: se.season,
              episode: ep.episode,
              thumbnail: ep.thumbnail,
              stream: ep.stream
            });
          });
        }
      });
    }

    // Normaliza vídeos: garante id e stream
    videos = videos.map(v => ({
      id: v.id,
      title: v.title || (`Episódio ${v.episode || "?"}`),
      season: v.season,
      episode: v.episode,
      thumbnail: v.thumbnail,
      stream: v.stream
    }));

    return Promise.resolve({
      meta: {
        id: serie.id,
        type: "series",
        name: serie.name,
        poster: serie.poster,
        description: serie.description,
        releaseInfo: serie.year?.toString(),
        videos: videos.map(v => ({
          id: v.id,
          title: v.title,
          season: v.season,
          episode: v.episode,
          thumbnail: v.thumbnail
        }))
      }
    });
  }

  return Promise.resolve({ meta: {} });
});

// ------------------ Stream handler ------------------
builder.defineStreamHandler(args => {
  // args.id pode vir com prefixo "series/". Remover.
  const rawId = (args.id || "").toString();
  const cleanId = rawId.replace(/^series\//, "");

  // 1) Tenta filme diretamente (suporta tmdb:NNN também)
  const filme = filmes.find(f => f.id === cleanId || (f.tmdb && `tmdb:${f.tmdb}` === cleanId));
  if (filme && filme.stream) {
    return Promise.resolve({
      streams: [
        { title: "Dublado PT-BR", url: filme.stream }
      ]
    });
  }

  // 2) Tenta encontrar episódio por várias combinações de id possíveis
  for (const serie of series) {
    // construí lista de possíveis bases para essa série
    const possibleBases = new Set();
    if (serie.id) possibleBases.add(serie.id);
    if (serie.tmdb) possibleBases.add(`tmdb:${serie.tmdb}`);
    // também aceita o próprio nome (sem espaços) - fallback
    if (serie.name) possibleBases.add(serie.name.replace(/\s+/g, "-").toLowerCase());

    // juntar vídeos do formato antigo e novo
    let videos = [];
    if (Array.isArray(serie.videos)) videos = serie.videos;
    if (Array.isArray(serie.seasons)) {
      serie.seasons.forEach(se => {
        if (Array.isArray(se.episodes)) {
          se.episodes.forEach(ep => {
            videos.push(Object.assign({}, ep, { season: se.season, id: ep.id || `${serie.id}:${se.season}:${ep.episode}` }));
          });
        }
      });
    }

    for (const v of videos) {
      const vidId = v.id;
      // gera alternativas
      const alts = new Set();
      if (vidId) alts.add(vidId);
      // base:id style
      for (const base of possibleBases) {
        if (v.season !== undefined && v.episode !== undefined) {
          alts.add(`${base}:${v.season}:${v.episode}`);
          // se base já tem prefix tmdb: e serie.tmdb existe, adiciona também sem prefixo (fallback)
          if (base.startsWith("tmdb:")) {
            alts.add(`${base}:${v.season}:${v.episode}`);
          }
        }
      }
      // comparar com cleanId
      if (alts.has(cleanId)) {
        if (v.stream) {
          return Promise.resolve({
            streams: [
              { title: `${serie.name} - T${v.season}E${v.episode} (Dublado)`, url: v.stream }
            ]
          });
        } else {
          // se não tem stream definido no v, tentamos procurar em serie-level
          // (alguns users guardam stream no objeto da temporada/serie)
          // continuar procurando
        }
      }
    }
  }

  // Se nada encontrado, retorna vazio (Stremio fecha player quando não há stream)
  return Promise.resolve({ streams: [] });
});

// ------------------ Iniciar servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
console.log("Addon Cinema Dublado rodando...");
