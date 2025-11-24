const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Manifesto ------------------
const manifest = {
  id: "cinema-br-dublado",
  version: "1.0.0",
  name: "Cinema BR Dublado",
  description: "Addon 100% focado em conteúdo dublado PT-BR",
  logo: "https://i.imgur.com/1wHZcFQ.png",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "catalogo-filmes",
      name: "Filmes Dublados"
    },
    {
      type: "series",
      id: "catalogo-series",
      name: "Séries Dubladas"
    }
  ]
};

// ------------------ Carregar JSON ------------------
function carregarBanco() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data", "filmes.json"), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar filmes.json:", err);
    return [];
  }
}

const banco = carregarBanco();

// ------------------ Builder ------------------
const builder = new addonBuilder(manifest);

// ---------- Catálogo ----------
builder.defineCatalogHandler(args => {
  const tipo = args.type;

  // Filtrar por tipo solicitado
  const itens = banco.filter(item =>
    tipo === "movie" ? !item.seasons : item.seasons
  );

  return Promise.resolve({
    metas: itens.map(i => ({
      id: i.id,
      type: i.seasons ? "series" : "movie",
      name: i.name,
      poster: i.poster,
      description: i.description,
      releaseInfo: i.year?.toString()
    }))
  });
});

// ---------- Meta (detalhes de séries) ----------
builder.defineMetaHandler(args => {
  const item = banco.find(i => i.id === args.id);
  if (!item) return Promise.resolve({ meta: {} });

  if (!item.seasons) {
    // Filme
    return Promise.resolve({
      meta: {
        id: item.id,
        type: "movie",
        name: item.name,
        poster: item.poster,
        description: item.description,
        releaseInfo: item.year?.toString(),
      }
    });
  }

  // Série → incluir temporadas e episódios
  return Promise.resolve({
    meta: {
      id: item.id,
      type: "series",
      name: item.name,
      poster: item.poster,
      description: item.description,
      releaseInfo: item.year?.toString(),

      videos: item.seasons.flatMap(season =>
        season.episodes.map(ep => ({
          id: `${item.id}:s${season.season}e${ep.episode}`,
          title: ep.title,
          season: season.season,
          episode: ep.episode,
          thumbnail: ep.thumbnail || item.poster
        }))
      )
    }
  });
});

// ---------- Stream handler (episódios + filmes) ----------
builder.defineStreamHandler(args => {
  const id = args.id;

  // Verifica se é episódio: form: tt123456:s1e2
  if (id.includes(":s")) {
    const [serieId, episodioId] = id.split(":s");
    const temporada = parseInt(episodioId.split("e")[0]);
    const episodio = parseInt(episodioId.split("e")[1]);

    const serie = banco.find(s => s.id === serieId);
    if (!serie) return Promise.resolve({ streams: [] });

    const temp = serie.seasons.find(s => s.season === temporada);
    if (!temp) return Promise.resolve({ streams: [] });

    const ep = temp.episodes.find(e => e.episode === episodio);
    if (!ep) return Promise.resolve({ streams: [] });

    return Promise.resolve({
      streams: [
        {
          title: "Dublado PT-BR",
          url: ep.stream
        }
      ]
    });
  }

  // Filme normal
  const filme = banco.find(f => f.id === id);
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

// ------------------ Servidor HTTP ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
console.log("Addon Cinema BR Dublado rodando...");
