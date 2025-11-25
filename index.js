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
                description: s.description,
                releaseInfo: s.year?.toString()
            }))
        };
    }

    return { metas: [] };
});

// ------------------ Meta ------------------
builder.defineMetaHandler(async args => {
    // FILME
    const filme = filmes.find(f =>
        f.id === args.id || (f.tmdb && `tmdb:${f.tmdb}` === args.id)
    );

    if (filme) {
        return {
            meta: {
                id: filme.id,
                type: "movie",
                name: filme.name,
                poster: filme.poster,
                background: filme.background,
                description: filme.description,
                releaseInfo: filme.year?.toString(),
                videos: [{ id: filme.id }]
            }
        };
    }

    // SÉRIE
    const serie = series.find(s => `tmdb:${s.tmdb}` === args.id);
    if (serie) {

        // Construir episódios para o Stremio
        const videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    thumbnail: ep.thumbnail,
                    season: temp.season,
                    episode: ep.episode
                });
            });
        });

        // LOGO QUE VOCÊ ESCOLHEU
        const logoOficial =
            "https://beam-images.warnermediacdn.com/BEAM_LWM_DELIVERABLES/cd7ce855-0cfa-414e-8762-ed65ae036e04/97188ec6-a60d-11f0-abb1-0afffd029469?host=wbd-images.prod-vod.h264.io&partner=beamcom&w=4320";

        return {
            meta: {
                id: `tmdb:${serie.tmdb}`,
                type: "series",
                name: serie.name,

                poster: serie.poster,
                background: serie.background,
                logo: logoOficial,

                // Descrição principal
                description: serie.description,

                // Ano
                releaseInfo: serie.year?.toString(),

                // -------------------------------
                // CAMPOS QUE ATIVAM O LAYOUT PREMIUM
                // -------------------------------
                genres: ["Comédia", "Drama", "Sátira Social"],
                cast: [
                    "Rachel Sennott",
                    "Josh Hutcherson",
                    "Miles Teller",
                    "Sophie Thatcher"
                ],
                director: ["Sam Levinson"],
                writer: ["Rachel Sennott"],

                // Episódios
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

    // Episódio de série
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
