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

// Inserindo o logotipo personalizado para a série "I Love LA"
series.forEach(s => {
    if (s.name.toLowerCase() === "i love la") {
        s.poster = "https://beam-images.warnermediacdn.com/BEAM_LWM_DELIVERABLES/cd7ce855-0cfa-414e-8762-ed65ae036e04/97188ec6-a60d-11f0-abb1-0afffd029469?host=wbd-images.prod-vod.h264.io&partner=beamcom&w=4320";
    }
});

function gerarCategorias(lista) {
    const categorias = new Set();
    lista.forEach(item => {
        if (item.categoria) categorias.add(item.categoria.toLowerCase());
    });
    return [...categorias];
}

const categoriasFilmes = gerarCategorias(filmes);
const categoriasSeries = gerarCategorias(series);

const manifest = {
    id: "cinema-dublado",
    version: "1.1.0",
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: [
        { type: "movie", id: "todos-filmes", name: "📺 Todos os Filmes" },
        { type: "series", id: "todas-series", name: "📺 Todas as Séries" },
        ...categoriasFilmes.map(cat => ({ type: "movie", id: `filmes-${cat}`, name: `🎬 ${cat.toUpperCase()}` })),
        ...categoriasSeries.map(cat => ({ type: "series", id: `series-${cat}`, name: `📺 ${cat.toUpperCase()}` }))
    ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async args => {
    if (args.id === "todos-filmes") {
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

    if (args.id === "todas-series") {
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

    if (args.id.startsWith("filmes-")) {
        const categoria = args.id.replace("filmes-", "").toLowerCase();
        return {
            metas: filmes.filter(f => f.categoria?.toLowerCase() === categoria).map(f => ({
                id: f.tmdb ? `tmdb:${f.tmdb}` : f.id,
                type: "movie",
                name: f.name,
                poster: f.poster,
                description: f.description,
                releaseInfo: f.year?.toString()
            }))
        };
    }

    if (args.id.startsWith("series-")) {
        const categoria = args.id.replace("series-", "").toLowerCase();
        return {
            metas: series.filter(s => s.categoria?.toLowerCase() === categoria).map(s => ({
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
                videos: [{ id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id, title: "Filme Completo" }]
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
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                videos
            }
        };
    }

    return { meta: {} };
});

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
console.log("Addon Cinema Dublado rodando na porta 7000.");
