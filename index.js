const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

function safeReadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

const manifest = {
    id: "cinema-dublado",
    version: "1.0.0",
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: [
        { type: "movie", id: "catalogo-filmes", name: "Cinema Dublado" },
        { type: "series", id: "catalogo-series", name: "Cinema Dublado" }
    ]
};

const builder = new addonBuilder(manifest);

// ====================== CATÁLOGO ======================

builder.defineCatalogHandler(async args => {
    if (args.type === "movie") {
        return {
            metas: filmes.map(f => ({
                id: f.id,
                type: "movie",
                name: f.name,
                poster: f.poster,
                background: f.background || null,
                description: f.description,
                releaseInfo: f.year?.toString()
            }))
        };
    }

    if (args.type === "series") {
        return {
            metas: series.map(s => ({
                id: s.id,
                type: "series",
                name: s.name,
                poster: s.poster,
                background: s.background || null,
                description: s.description,
                releaseInfo: s.year?.toString()
            }))
        };
    }

    return { metas: [] };
});

// ====================== META ======================

builder.defineMetaHandler(async args => {

    const filme = filmes.find(f =>
        f.id === args.id || (f.tmdb && `tmdb:${f.tmdb}` === args.id)
    );

    if (filme) {

        const runtime = filme.runtime ? `${filme.runtime} min` : null;

        return {
            meta: {
                id: filme.id,
                type: "movie",
                name: filme.name,
                poster: filme.poster,
                background: filme.background || null,
                description: filme.description,
                releaseInfo: filme.year?.toString(),
                genres: filme.genres || [],

                cast: filme.cast || [],

                imdbRating: filme.rating?.imdb ? Number(filme.rating.imdb) : null,
                imdb_id: filme.rating?.imdb_id || null,

                runtime: runtime,

                videos: [{ id: filme.id, runtime }]
            }
        };
    }

    const serie = series.find(s => s.id === args.id);
    if (serie) {

        const defaultRuntime = 30;
        const videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {

                const rt = ep.runtime || serie.runtime || defaultRuntime;
                const runtimeString = `${rt} min`;

                videos.push({
                    id: `${serie.id}:${temp.season}:${ep.episode}`, // ← vírgula aqui!
                    title: ep.title,
                    season: temp.season,
                    episode: ep.episode,
                    thumbnail: ep.thumbnail || null,
                    runtime: runtimeString
                });
            });
        });

        return {
            meta: {
                id: serie.id,
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background || null,
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                genres: serie.genres || [],

                cast: serie.cast || [],

                imdbRating: serie.rating?.imdb ? Number(serie.rating.imdb) : null,
                imdb_id: serie.rating?.imdb_id || null,

                runtime: `${serie.runtime || defaultRuntime} min`,

                videos
            }
        };
    }

    return { meta: {} };
});

// ====================== STREAM ======================

builder.defineStreamHandler(async args => {
    const id = args.id;

    const filme = filmes.find(f =>
        f.id === id || (f.tmdb && `tmdb:${f.tmdb}` === id)
    );

    if (filme) {
        return { streams: [{ title: "Dublado", url: filme.stream }] };
    }

    const match = id.match(/^(.+):(\d+):(\d+)$/);
    if (match) {
        const serieId = match[1];
        const season = Number(match[2]);
        const episode = Number(match[3]);

        const serie = series.find(s => s.id === serieId);
        if (!serie) return { streams: [] };

        const temp = serie.seasons.find(t => t.season === season);
        if (!temp) return { streams: [] };

        const ep = temp.episodes.find(e => e.episode === episode);
        if (!ep) return { streams: [] };

        return {
            streams: [{ title: "Dublado (HD)", url: ep.stream }]
        };
    }

    return { streams: [] };
});

// ====================== START ======================

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Cinema Dublado Addon iniciado.");
