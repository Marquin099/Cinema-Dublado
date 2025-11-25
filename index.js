const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        // A leitura agora espera um objeto com categorias, não um array
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return {}; // Retorna um objeto vazio em caso de erro
    }
}

const filmesPorCategoria = safeReadJSON("data/filmes.json");
const seriesPorCategoria = safeReadJSON("data/series.json");

// Função auxiliar para obter todos os itens de todas as categorias
function getAllItems(categorizedItems) {
    return Object.values(categorizedItems).flat();
}

const todosFilmes = getAllItems(filmesPorCategoria);
const todasSeries = getAllItems(seriesPorCategoria);

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.4", // Versão atualizada
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR com categorias!",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: []
};

// Adicionar catálogos de filmes
for (const id in filmesPorCategoria) {
    manifest.catalogs.push({
        type: "movie",
        id: `filmes-${id}`,
        name: `Filmes - ${id.charAt(0).toUpperCase() + id.slice(1)}`, // Ex: Filmes - Terror
        extra: [{ name: "search", isRequired: false }]
    });
}

// Adicionar catálogos de séries
for (const id in seriesPorCategoria) {
    manifest.catalogs.push({
        type: "series",
        id: `series-${id}`,
        name: `Séries - ${id.charAt(0).toUpperCase() + id.slice(1)}`, // Ex: Séries - Netflix
        extra: [{ name: "search", isRequired: false }]
    });
}

const builder = new addonBuilder(manifest);

// ------------------ Handler de Catálogo ------------------
builder.defineCatalogHandler(async args => {
    const [typePrefix, categoryId] = args.id.split("-");

    if (typePrefix === "filmes" && filmesPorCategoria[categoryId]) {
        const filmes = filmesPorCategoria[categoryId];
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

    if (typePrefix === "series" && seriesPorCategoria[categoryId]) {
        const series = seriesPorCategoria[categoryId];
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

// ------------------ Handler de Meta ------------------
builder.defineMetaHandler(async args => {

    // FILMES
    const filme = todosFilmes.find(f =>
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
    const serie = todasSeries.find(s =>
        args.id.includes(s.tmdb.toString())
    );

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

                // ⭐ AGORA FUNCIONA A PORRA DA NOTA DA SÉRIE ⭐
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,

                runtime: serie.runtime ? serie.runtime : undefined,
                genres: serie.genres || [],
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ STREAM HANDLER ------------------
builder.defineStreamHandler(async args => {

    // Filme
    const filme = todosFilmes.find(f =>
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

    // Série (episódio)
    const [_, tmdb, season, episode] = args.id.split(":");

    const serie = todasSeries.find(s => s.tmdb.toString() === tmdb);

    if (serie) {
        const temp = serie.seasons.find(t => t.season.toString() === season);
        if (temp) {
            const ep = temp.episodes.find(e => e.episode.toString() === episode);
            if (ep) {
                return {
                    streams: [{
                        title: `S${season}E${episode} - Dublado`,
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
