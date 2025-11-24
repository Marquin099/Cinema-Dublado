import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import cors from "cors";
import fs from "fs";

// ========================================================
// 🔥 CARREGAR DADOS DE FILMES E SÉRIES
// ========================================================
const filmes = JSON.parse(fs.readFileSync("./filmes.json"));
const series = JSON.parse(fs.readFileSync("./series.json"));

// ========================================================
// 🔥 METADATA DO ADDON
// ========================================================
const manifest = {
  id: "brplayer-addon",
  version: "1.0.0",
  name: "BR Player Dublado",
  description: "Filmes e Séries dublados PT-BR",
  logo: "https://i.imgur.com/3NUyZJp.png",
  resources: ["catalog", "meta", "stream"],
  catalogs: [
    {
      id: "filmes",
      type: "movie",
      name: "Filmes Dublados"
    },
    {
      id: "series",
      type: "series",
      name: "Séries Dubladas"
    }
  ],
  types: ["movie", "series"],
};

// ========================================================
// 🔥 INICIAR ADDON
// ========================================================
const builder = new addonBuilder(manifest);

// ========================================================
// 🔥 CATÁLOGOS
// ========================================================
builder.defineCatalogHandler(args => {
  if (args.type === "movie") {
    return Promise.resolve({
      metas: filmes.map(f => ({
        id: f.id,
        type: "movie",
        name: f.name,
        poster: f.poster,
        description: f.description,
        year: f.year
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
        year: s.year
      }))
    });
  }

  return Promise.resolve({ metas: [] });
});

// ========================================================
// 🔥 META HANDLER (DETALHES DO FILME / SÉRIE)
// ========================================================
builder.defineMetaHandler(args => {
  const filme = filmes.find(f => f.id === args.id);
  if (filme) {
    return Promise.resolve({
      meta: {
        id: filme.id,
        type: "movie",
        name: filme.name,
        poster: filme.poster,
        description: filme.description,
        year: filme.year,
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

  const serie = series.find(s => s.id === args.id);
  if (serie) {
    return Promise.resolve({
      meta: {
        id: serie.id,
        type: "series",
        name: serie.name,
        poster: serie.poster,
        description: serie.description,
        year: serie.year,
        videos: serie.videos.map(v => ({
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

// ========================================================
// 🔥 STREAM HANDLER (REPRODUÇÃO) — CORRIGIDO COMPLETO
// ========================================================
builder.defineStreamHandler(args => {

  // ⭐ IMPORTANTE: remover prefixo "series/" que o Stremio adiciona
  const cleanId = args.id.replace("series/", "");

  // Filme
  const filme = filmes.find(f => f.id === cleanId);
  if (filme) {
    return Promise.resolve({
      streams: [
        { title: "Dublado PT-BR", url: filme.stream }
      ]
    });
  }

  // Episódios de Séries
  for (const serie of series) {
    const ep = serie.videos.find(v => v.id === cleanId);
    if (ep) {
      return Promise.resolve({
        streams: [
          {
            title: `${ep.title} Dublado`,
            url: ep.stream
          }
        ]
      });
    }
  }

  return Promise.resolve({ streams: [] });
});

// ========================================================
// 🔥 EXPRESS SERVER
// ========================================================
const app = express();
app.use(cors());

const addonInterface = builder.getInterface();
app.get("/:resource/:type/:id.json", (req, res) => addonInterface(req, res));
app.get("/:resource/:type/:id", (req, res) => addonInterface(req, res));
app.get("/:resource/:type", (req, res) => addonInterface(req, res));
app.get("/", (req, res) => res.json(manifest));

const PORT = process.env.PORT || 7777;
app.listen(PORT, () => console.log("Addon ativo na porta " + PORT));
