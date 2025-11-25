const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar JSON ------------------
function safeReadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
    } catch (err) {
        console.error("Erro lendo JSON:", file, err.message);
        return [];
    }
}

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Criar categorias automaticamente ------------------

// FILMES
const categoriasFilmes = new Set();
filmes.forEach(f => {
    if (f.categoria) categoriasFilmes.add(f.categoria.toLowerCase());
});
categoriasFilmes.add("sem categoria");

const listaCategoriasFilmes = [...categoriasFilmes];

// SÉRIES
const categoriasSeries = new Set();
series.forEach(s => {
    if (s.categoria) categoriasSeries.add(s.categoria.toLowerCase());
});
categoriasSeries.add("sem categoria");

const listaCategoriasSeries = [...categoriasSeries];

// ------------------ Manifesto dinâmico ------------------
const catalogs = [];

// CATÁLOGOS DE FILMES
listaCategoriasFilmes.forEach(cat => {
    catalogs.push({
        type: "movie",
        id: `filmes-${cat.replace(/ /g, "-")}`,
        name: `Cinema Dublado — ${cat}`
            .replace(/\b\w/g, l => l.toUpperCase())
    });
});

// CATÁLOGOS DE SÉRIES (agora separados corretamente)
listaCategoriasSeries.forEach(cat => {
    catalogs.push({
        type: "series",
        id: `series-${cat.replace(/ /g, "-")}`,
        name: `Cinema Dublado — ${cat}`
            .replace(/\b\w/g, l => l.toUpperCase())
    });
});

const manifest = {
    id: "cinema-dublado",
    version: "1.2.0",
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR organizados por categorias",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs
};

const builder = new addonBuilder(manifest);

// ------------------ CATÁLOGO ------------------
builder.defineCatalogHandler(async args => {

    // FILMES
    if (args.type === "movie") {
        const categoria = args.id.replace("filmes-", "").replace(/-/g, " ");

        const metas = filmes
            .filter(f => {
                const cat = f.categoria ? f.categoria.toLowerCase() : "sem categoria";
                return cat === categoria;
            })
            .map(f => ({
                id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                type: "movie",
                name: f.name,
                poster: f.poster,
                description: f.description,
                releaseInfo: f.year?.toString()
            }));

        return { metas };
    }

    // SÉRIES
    if (args.type === "series") {
        const categoria = args.id.replace("series-", "").replace(/-/g, " ");

        const metas = series
            .filter(s => {
                const cat = s.categoria ? s.categoria.toLowerCase() : "sem categoria";
                return cat === categoria;
            })
            .map(s => ({
                id: `tmdb:${s.tmdb}`,
                type: "series",
                name: s.name,
                poster: s.poster,
                description: s.description,
                releaseInfo: s.year?.toString()
            }));

        return { metas };
    }

    return { metas: [] };
});

// ------------------ META ------------------
builder.defineMetaHandler(async args => {

    // FILMES
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
                videos: [{
                    id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id,
                    title: "Filme Completo",
                    released: filme.year ? new Date(filme.year, 0, 1) : undefined
                }]
            }
        };
    }

    // SÉRIES
    const serie = series.find(s => args.id.includes(s.tmdb));

    if (serie) {
        const videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    thumbnail: ep.thumbnail,
                    season: temp.season,
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
                logo: serie.logo || null,
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,
                runtime: serie.runtime || undefined,
                genres: serie.genres || [],
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ STREAM ------------------
builder.defineStreamHandler(async args => {

    // FILMES
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

    // SÉRIES
    const [_, tmdb, season, episode] = args.id.split(":");
    const serie = series.find(s => s.tmdb.toString() === tmdb);

    if (serie) {
        const temp = serie.seasons.find(t => t.season.toString() === season);
        if (temp) {
            const ep = temp.episodes.find(e => e.episode.toString() === episode);
            if (ep) {
                return {
                    streams: [{
                        title: `S${season}E${episode} — Dublado`,
                        url: ep.stream
                    }]
                };
            }
        }
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
console.log("Addon Cinema Dublado rodando na porta 7000.");
