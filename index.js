const { addonBuilder } = require("stremio-addon-sdk");
const http = require("http");
const PORT = process.env.PORT || 7000;

// 🔹 Carrega database local
const series = require("./series.json");

// 🔹 Logo oficial do addon
const logoOficial = "https://raw.githubusercontent.com/SEU-REPO/logo.png";

// --------------------------------------------------------------------
// MANIFESTO
// --------------------------------------------------------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.0",
    name: "Cinema Brasil DUBLADO",
    description: "Filmes e Séries dubladas em PT-BR",
    logo: logoOficial,
    background: logoOficial,
    types: ["movie", "series"],
    catalogs: [
        { 
            type: "series",
            id: "series",
            name: "Séries Dubladas"
        }
    ],
    resources: ["catalog", "meta", "stream"]
};

const builder = new addonBuilder(manifest);

// --------------------------------------------------------------------
// CATÁLOGO
// --------------------------------------------------------------------
builder.defineCatalogHandler(args => {
    if (args.type !== "series") {
        return { metas: [] };
    }

    const lista = series.map(s => ({
        id: `tmdb:${s.tmdb}`,
        type: "series",
        name: s.name,
        poster: s.poster,
        background: s.background,
        logo: s.logo || logoOficial,
        description: s.description,
        releaseInfo: s.year?.toString() || "",
        genres: s.genres || []
    }));

    return { metas: lista };
});

// --------------------------------------------------------------------
// META
// --------------------------------------------------------------------
builder.defineMetaHandler(args => {
    const id = args.id.replace("tmdb:", "");
    const serie = series.find(s => s.tmdb === id);

    if (!serie) {
        return { meta: {} };
    }

    // Episódios
    const videos = [];

    for (const temp of serie.seasons) {
        for (const ep of temp.episodes) {
            videos.push({
                id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                title: `T${temp.season} • E${ep.episode} - ${ep.name}`,
                season: temp.season,
                episode: ep.episode,
                released: ep.released,
                thumbnail: ep.thumbnail,
                overview: ep.overview
            });
        }
    }

    return {
        meta: {
            id: `tmdb:${serie.tmdb}`,
            type: "series",
            name: serie.name,

            poster: serie.poster,
            background: serie.background,
            logo: serie.logo || logoOficial,

            description: serie.description,
            releaseInfo: serie.year?.toString(),

            // 🔥 METADADOS COMPLETOS
            genres: serie.genres || [],
            cast: serie.cast || [],
            director: serie.director || [],
            writer: serie.writer || [],
            imdbRating: serie.rating?.imdb ? Number(serie.rating.imdb) : null,
            imdb_id: serie.rating?.imdb_id || null,

            // 🔥 Tempo médio dos episódios
            runtime: serie.runtime || 49,

            videos
        }
    };
});

// --------------------------------------------------------------------
// STREAM
// --------------------------------------------------------------------
builder.defineStreamHandler(args => {
    const partes = args.id.split(":");
    if (partes.length < 4) return { streams: [] };

    const tmdb = partes[1];
    const season = partes[2];
    const episode = partes[3];

    const serie = series.find(s => s.tmdb === tmdb);
    if (!serie) return { streams: [] };

    const temporada = serie.seasons.find(t => t.season == season);
    if (!temporada) return { streams: [] };

    const ep = temporada.episodes.find(e => e.episode == episode);
    if (!ep) return { streams: [] };

    return {
        streams: [
            {
                title: "Assistir DUBLADO",
                url: ep.url
            }
        ]
    };
});

// --------------------------------------------------------------------
// SERVIDOR HTTP
// --------------------------------------------------------------------
const server = http.createServer((req, res) => {
    builder.getInterface().serveHTTP(req, res);
});

server.listen(PORT, () => {
    console.log("Addon Cinema Dublado rodando na porta " + PORT);
});
