// index.js com múltiplos catálogos automáticos por categoria

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// Função para extrair categorias únicas
function getCategorias(lista) {
    const set = new Set();
    lista.forEach(item => {
        if (item.category) set.add(item.category);
    });
    return [...set];
}

const categoriasFilmes = getCategorias(filmes);
const categoriasSeries = getCategorias(series);

// Construção dinâmica dos catálogos
const catalogs = [
    { type: "movie", id: "catalogo-filmes", name: "Filmes" },
    { type: "series", id: "catalogo-series", name: "Séries" },
];

categoriasFilmes.forEach(cat => {
    catalogs.push({ type: "movie", id: `cat-filmes-${cat.toLowerCase()}`, name: `Filmes • ${cat}` });
});

categoriasSeries.forEach(cat => {
    catalogs.push({ type: "series", id: `cat-series-${cat.toLowerCase()}`, name: `Séries • ${cat}` });
});

const manifest = {
    id: "cinema-dublado",
    version: "1.1.0",
    name: "Cinema Dublado",
    description: "Filmes e Séries Dublados PT-BR • Com Categorias",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs
};

const builder = new addonBuilder(manifest);

// ------------------ CATÁLOGOS ------------------
builder.defineCatalogHandler(async args => {

    if (args.type === "movie") {
        if (args.id === "catalogo-filmes") {
            return { metas: filmes.map(f => ({
                id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                type: "movie",
                name: f.name,
                poster: f.poster,
                description: f.description,
                releaseInfo: f.year?.toString(),
            })) };
        }

        const cat = categoriasFilmes.find(c => args.id === `cat-filmes-${c.toLowerCase()}`);
        if (cat) {
            return {
                metas: filmes
                    .filter(f => f.category === cat)
                    .map(f => ({
                        id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                        type: "movie",
                        name: f.name,
                        poster: f.poster,
                        description: f.description,
                        releaseInfo: f.year?.toString(),
                    }))
            };
        }
    }

    if (args.type === "series") {
        if (args.id === "catalogo-series") {
            return { metas: series.map(s => ({
                id: `tmdb:${s.tmdb}`,
                type: "series",
                name: s.name,
                poster: s.poster,
                description: s.description,
                releaseInfo: s.year?.toString(),
            })) };
        }

        const cat = categoriasSeries.find(c => args.id === `cat-series-${c.toLowerCase()}`);
        if (cat) {
            return {
                metas: series
                    .filter(s => s.category === cat)
                    .map(s => ({
                        id: `tmdb:${s.tmdb}`,
                        type: "series",
                        name: s.name,
                        poster: s.poster,
                        description: s.description,
                        releaseInfo: s.year?.toString(),
                    }))
            };
        }
    }

    return { metas: [] };
});

// ------------------ META ------------------
builder.defineMetaHandler(async args => {

    const filme = filmes.find(f => args.id === f.id || args.id === `tmdb:${f.tmdb}`);
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
                imdbRating: filme.rating?.imdb ? parseFloat(filme.rating.imdb) : undefined,
                categories: filme.category ? [filme.category] : [],
                videos: [{
                    id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id,
                    title: "Filme Completo",
                    released: filme.year ? new Date(filme.year, 0, 1) : undefined
                }]
            }
        };
    }

    const serie = series.find(s => args.id.includes(s.tmdb.toString()));
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
                categories: serie.category ? [serie.category] : [],
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ STREAM ------------------
builder.defineStreamHandler(async args => {

    const filme = filmes.find(f => args.id === f.id || args.id === `tmdb:${f.tmdb}`);
    if (filme) {
        return { streams: [{ title: "Filme Dublado", url: filme.stream }] };
    }

    const [_, tmdb, season, episode] = args.id.split(":");

    const serie = series.find(s => s.tmdb.toString() === tmdb);
    if (serie) {
        const temp = serie.seasons.find(t => t.season.toString() === season);
        if (temp) {
            const ep = temp.episodes.find(e => e.episode.toString() === episode);
            if (ep) {
                return { streams: [{ title: `S${season}E${episode} - Dublado`, url: ep.stream }] };
            }
        }
    }

    return { streams: [] };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
console.log("Addon Cinema Dublado rodando com categorias automáticas!");
