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

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Funções de Ajuda ------------------

/**
 * Agrupa os itens por categoria e retorna uma lista de objetos de catálogo.
 */
function getCatalogs(items, type) {
    const categories = new Set(items.map(item => item.categoria).filter(Boolean));
    const catalogs = Array.from(categories).map(cat => ({
        type: type,
        id: `catalogo-${type}-${cat}`,
        name: cat.toUpperCase(),
        featured: type === 'movie' ? true : undefined
    }));

    // Adiciona o catálogo principal "Todos"
    catalogs.unshift({
        type: type,
        id: `catalogo-${type}-todos`,
        name: "Cinema Dublado Lançamentos",
        featured: type === 'movie' ? true : undefined
    });

    return catalogs;
}

const movieCatalogs = getCatalogs(filmes, "movie");
const seriesCatalogs = getCatalogs(series, "series");

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.5", // Subi a versão para forçar atualização no Stremio
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: [...movieCatalogs, ...seriesCatalogs]
};

const builder = new addonBuilder(manifest);

// ------------------ Handler de Catálogo ------------------
builder.defineCatalogHandler(async args => {
    const isMovieCatalog = args.type === "movie" && args.id.startsWith("catalogo-movie-");
    const isSeriesCatalog = args.type === "series" && args.id.startsWith("catalogo-series-");

    if (isMovieCatalog || isSeriesCatalog) {
        const data = isMovieCatalog ? filmes : series;
        const prefix = isMovieCatalog ? "catalogo-movie-" : "catalogo-series-";
        const itemType = isMovieCatalog ? "movie" : "series";
        
        const category = args.id.substring(prefix.length);

        let filteredItems = data;

        if (category !== "todos") {
            filteredItems = data.filter(item => item.categoria === category);
        }

        return {
            metas: filteredItems.map(item => ({
                id: item.tmdb ? `tmdb:${item.tmdb}` : item.id,
                type: itemType,
                name: item.name,
                poster: item.poster,
                description: item.description,
                releaseInfo: item.year?.toString()
            }))
        };
    }

    return { metas: [] };
});

// ------------------ Handler de Meta ------------------
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
    // Modificado para encontrar a série mesmo se o ID vier incompleto ou apenas numérico
    const serie = series.find(s => 
        args.id.includes(s.tmdb.toString()) || 
        (s.rating && s.rating.imdb_id && args.id.includes(s.rating.imdb_id))
    );

    if (serie) {
        const videos = [];
        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                // Monta o ID do vídeo no padrão TMDB para manter consistência interna
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
                id: args.id, // Retorna o mesmo ID que foi solicitado para evitar confusão no Stremio
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background,
                logo: serie.logo || null,
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,
                runtime: serie.runtime ? serie.runtime : undefined,
                genres: serie.genres || [],
                cast: [
                    ...(serie.cast || []).map(c => ({ name: c.name })),
                    ...(serie.directors || []).map(d => ({ name: d.name, role: d.role || "Diretor" }))
                ],
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ STREAM HANDLER (CORRIGIDO) ------------------
builder.defineStreamHandler(async args => {
    
    // 1. Tenta achar Filme
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

    // 2. Lógica Inteligente para Séries (IMDb vs TMDB)
    let serieEncontrada = null;
    let seasonReq = null;
    let episodeReq = null;

    // CASO A: Stremio enviou ID do IMDb (Ex: tt34467643:1:1) -> TREMEMBÉ
    if (args.id.startsWith("tt")) {
        const parts = args.id.split(":");
        const imdbId = parts[0]; 
        seasonReq = parts[1];
        episodeReq = parts[2];

        // Busca pela propriedade imdb_id dentro de rating
        serieEncontrada = series.find(s => s.rating && s.rating.imdb_id === imdbId);
    } 
    // CASO B: Stremio enviou seu ID TMDB (Ex: tmdb:279013:1:1) -> OUTRAS SÉRIES
    else if (args.id.startsWith("tmdb:")) {
        const parts = args.id.split(":");
        const tmdbId = parts[1];
        seasonReq = parts[2];
        episodeReq = parts[3];

        serieEncontrada = series.find(s => s.tmdb && s.tmdb.toString() === tmdbId);
    }

    // Se achou a série, busca o episódio
    if (serieEncontrada) {
        // Usa "==" para garantir que string "1" seja igual a número 1
        const temp = serieEncontrada.seasons.find(t => t.season == seasonReq);
        if (temp) {
            const ep = temp.episodes.find(e => e.episode == episodeReq);
            if (ep) {
                return {
                    streams: [{
                        title: `S${seasonReq}E${episodeReq} - Dublado`,
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
