// Index.js FINAL — CATEGORIAS AUTOMÁTICAS + LOGOTIPOS DE SÉRIES PRESERVADOS

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Ler JSON ------------------
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

// ------------------ Criar categorias automaticamente ------------------
function gerarCategorias(lista) {
    const set = new Set();
    lista.forEach(i => {
        if (i.category) set.add(i.category.toLowerCase());
    });
    return [...set];
}

const categoriasFilmes = gerarCategorias(filmes);
const categoriasSeries = gerarCategorias(series);

// ------------------ Manifesto ------------------
const manifest = {
    id: "cinema-dublado",
    version: "2.0.0",
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],

    catalogs: [
        { type: "movie", id: "filmes-todos", name: "🎬 Todos os Filmes" },
        { type: "series", id: "series-todas", name: "📺 Todas as Séries" },

        // Filmes por categoria
        ...categoriasFilmes.map(cat => ({
            type: "movie",
            id: `filmes-${cat}`,
            name: `🎬 ${cat.toUpperCase()}`
        })),

        // Séries por categoria
        ...categoriasSeries.map(cat => ({
            type: "series",
            id: `series-${cat}`,
            name: `📺 ${cat.toUpperCase()}`
        }))
    ]
};

const builder = new addonBuilder(manifest);

// ------------------ CATÁLOGO ------------------
builder.defineCatalogHandler(async args => {
    // FILMES
    if (args.id === "filmes-todos") {
        return {
            metas: filmes.map(f => ({
                id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                type: "movie",
                name: f.name,
                poster: f.poster,
                description: f.description,
                releaseInfo: f.year?.toString()
            }))
        };
    }

    if (args.id.startsWith("filmes-")) {
        const categoria = args.id.replace("filmes-", "");
        return {
            metas: filmes
                .filter(f => f.category?.toLowerCase() === categoria)
                .map(f => ({
                    id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                    type: "movie",
                    name: f.name,
                    poster: f.poster,
                    description: f.description,
                    releaseInfo: f.year?.toString()
                }))
        };
    }

    // SÉRIES
    if (args.id === "series-todas") {
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

    if (args.id.startsWith("series-")) {
        const categoria = args.id.replace("series-", "");
        return {
            metas: series
                .filter(s => s.category?.toLowerCase() === categoria)
                .map(s => ({
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

// ------------------ META ------------------
builder.defineMetaHandler(async args => {
    // FILME
    const filme = filmes.find(f =>
        args.id === f.id || args.id === `tmdb:${f.tmdb}`
    );

    if (filme) {
        return {
            meta: {
                id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id,
                type: "movie",
                name: filme.name,
                poster: filme.poster,
                background: filme.background,
                description: filme.description,
                releaseInfo: filme.year?.toString(),
                categories: filme.category ? [filme.category] : [],
                videos: [{
                    id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id,
                    title: "Filme Completo",
                    released: filme.year ? new Date(filme.year, 0, 1) : undefined
                }]
            }
        };
    }

    // SÉRIE
    const serie = series.find(s => args.id.includes(s.tmdb.toString()));

    if (serie) {
        const videos = [];

        serie.seasons.forEach(season => {
            season.episodes.forEach(ep => {
                videos.push({
                    id: `tmdb:${serie.tmdb}:${season.season}:${ep.episode}`,
                    title: ep.title,
                    thumbnail: ep.thumbnail,
                    season: season.season,
                    episode: ep.episode,
                    overview: ep.overview,
                    released: ep.released ? new Date(ep.released) : undefined
                });
            });
        });

        return {
            meta: {
                id: `tmdb:${serie.tmdb}`,
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background,
                logo: serie.logo || null, // LOGO PRESERVADO!!!
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                categories: serie.category ? [serie.category] : [],
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ STREAM ------------------
builder.defineStreamHandler(async args => {
    // Filme
    const filme = filmes.find(f =>
        args.id === f.id || args.id === `tmdb:${f.tmdb}`
    );

    if (filme) {
        return {
            streams: [{
                title: "Filme Dublado",
                url: filme.stream
            }]
        };
    }

    // Série episódio
    const [_, tmdb, season, episode] = args.id.split(":");

    const serie = series.find(s => s.tmdb.toString() === tmdb);
    if (!serie) return { streams: [] };

    const temp = serie.seasons.find(t => t.season.toString() === season);
    if (!temp) return { streams: [] };

    const ep = temp.episodes.find(e => e.episode.toString() === episode);
    if (!ep) return { streams: [] };

    return {
        streams: [{
            title: `S${season}E${episode} - Dublado`,
            url: ep.stream
        }]
    };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
console.log("Addon Cinema Dublado rodando na porta 7000.");
