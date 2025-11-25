const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
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

// ------------------ Manifesto ------------------
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

// ------------------ Catálogo ------------------
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
                id: `tmdb:${s.tmdb}`,
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

// ------------------ Meta ------------------
builder.defineMetaHandler(async args => {

    // ------------------ FILME ------------------
    const filme = filmes.find(f =>
        f.id === args.id || (f.tmdb && `tmdb:${f.tmdb}` === args.id)
    );

    if (filme) {
        // runtime padrão (minutos)
        const runtime = filme.runtime || 0;

        return {
            meta: {
                id: filme.id,
                type: "movie",
                name: filme.name,

                poster: filme.poster,
                background: filme.background || null,
                logo: filme.logo || null,

                description: filme.description,
                releaseInfo: filme.year?.toString(),

                genres: filme.genres || [],
                // cast como array de objetos
                cast: (filme.cast || []).map(actor => ({ name: actor })),

                // campos que o Stremio realmente usa para rating
                imdbRating: filme.rating?.imdb ? Number(filme.rating.imdb) : null,
                imdb_id: filme.rating?.imdb_id || null,

                // runtime (em minutos) — o Stremio formata como "X min"
                runtime: runtime,

                // vídeos (movie)
                videos: [{ id: filme.id, runtime }]
            }
        };
    }

    // ------------------ SÉRIE ------------------
    const serie = series.find(s => `tmdb:${s.tmdb}` === args.id);
    if (serie) {
        const videos = [];
        const runtime = serie.runtime || 30; // padrão 30 min por episódio

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    season: temp.season,
                    episode: ep.episode,
                    thumbnail: ep.thumbnail || null,
                    // runtime por episódio (ajuda UI a mostrar "30 min")
                    runtime: ep.runtime || runtime
                });
            });
        });

        return {
            meta: {
                id: `tmdb:${serie.tmdb}`,
                type: "series",
                name: serie.name,

                poster: serie.poster,
                background: serie.background || null,
                logo: serie.logo || null,

                description: serie.description,
                releaseInfo: serie.year?.toString(),

                genres: serie.genres || [],
                // cast corretamente formatado
                cast: (serie.cast || []).map(actor => ({ name: actor })),

                // nota imdb (numérica) e id
                imdbRating: serie.rating?.imdb ? Number(serie.rating.imdb) : null,
                imdb_id: serie.rating?.imdb_id || null,

                // runtime no meta também (minutos) — Stremio mostrará "30 min"
                runtime: runtime,

                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ Stream ------------------
builder.defineStreamHandler(async args => {
    const id = args.id;

    // Filme
    const filme = filmes.find(f =>
        f.id === id || (f.tmdb && `tmdb:${f.tmdb}` === id)
    );

    if (filme) {
        return {
            streams: [
                {
                    title: "Dublado",
                    url: filme.stream
                }
            ]
        };
    }

    // Série (tmdb:ID:season:episode)
    const match = id.match(/^tmdb:(\d+):(\d+):(\d+)$/);
    if (match) {
        const tmdb = Number(match[1]);
        const season = Number(match[2]);
        const episode = Number(match[3]);

        const serie = series.find(s => s.tmdb === tmdb);
        if (!serie) return { streams: [] };

        const temp = serie.seasons.find(t => t.season === season);
        if (!temp) return { streams: [] };

        const ep = temp.episodes.find(e => e.episode === episode);
        if (!ep) return { streams: [] };

        return {
            streams: [
                {
                    title: "Dublado (HD)",
                    url: ep.stream
                }
            ]
        };
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Cinema Dublado Addon iniciado.");
