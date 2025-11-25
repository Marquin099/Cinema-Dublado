const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

// Carrega os dados
const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.3",
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

// ------------------ Handler de Catálogo ------------------
builder.defineCatalogHandler(async args => {
    if (args.type === "movie" && args.id === "catalogo-filmes") {
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

    if (args.type === "series" && args.id === "catalogo-series") {
        return {
            metas: series.map(s => ({
                id: s.id, // ← NÃO usa mais tmdb:
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

// ------------------ Handler de Meta (Detalhes) ------------------
builder.defineMetaHandler(async args => {

    // ------- FILMES -------
    const filme = filmes.find(f => f.id === args.id);
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
                runtime: filme.runtime ? parseInt(filme.runtime) : undefined,
                imdbRating: filme.rating ? parseFloat(filme.rating) : undefined,
                videos: [{ id: filme.id }]
            }
        };
    }

    // ------- SÉRIES -------
    const serie = series.find(s => s.id === args.id);

    if (serie) {
        const videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    id: `${serie.id}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    thumbnail: ep.thumbnail,
                    season: temp.season,
                    episode: ep.episode,
                    overview: ep.overview
                });
            });
        });

        return {
            meta: {
                id: serie.id,
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background,
                logo: serie.logo || null,
                description: serie.description,
                releaseInfo: serie.year?.toString(),

                // -------- CORRIGIDO --------
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,
                runtime: serie.runtime ? parseInt(serie.runtime) : undefined,
                genres: serie.genres || [],
                cast: serie.cast?.map(actor => ({ name: actor })) || [],

                links: serie.rating?.imdb_id
                    ? [
                        {
                            name: "IMDb",
                            category: "imdb",
                            url: `https://www.imdb.com/title/${serie.rating.imdb_id}`
                        }
                    ]
                    : [],

                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ Handler de Stream ------------------
builder.defineStreamHandler(async args => {

    // Filme
    const filme = filmes.find(f => f.id === args.id);
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

    // Episódios de série
    const match = args.id.match(/^(.+):(\d+):(\d+)$/);

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
            streams: [
                {
                    title: `Dublado S${season}E${episode}`,
                    url: ep.stream
                }
            ]
        };
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log(`🎬 Cinema Dublado Addon iniciado na porta ${process.env.PORT || 3000}.`);
