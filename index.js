const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON (com tratamento de erro) ------------------
function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`Aviso: Arquivo JSON não encontrado: ${file}`);
            return [];
        }
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("ERRO FATAL ao ler JSON:", file, err.message);
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
        name: type === 'movie' ? "Cinema Dublado Lançamentos" : "Séries Dubladas Lançamentos",
        featured: type === 'movie' ? true : undefined
    });

    return catalogs;
}

const movieCatalogs = getCatalogs(filmes, "movie");
const seriesCatalogs = getCatalogs(series, "series");

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.8", // Versão atualizada para forçar o Stremio a reconhecer as mudanças
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR com correção para players embed.",
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
            })),
            cacheMaxAge: 3600
        };
    }

    return { metas: [] };
});

// ------------------ Handler de Meta ------------------
builder.defineMetaHandler(async args => {

    const isMovie = args.type === 'movie';
    const data = isMovie ? filmes : series;
    
    const requestedId = args.id.startsWith('tmdb:') ? args.id.substring(5) : args.id;

    const item = data.find(i =>
        i.id === requestedId || 
        (i.tmdb && i.tmdb.toString() === requestedId) || 
        (i.rating && i.rating.imdb_id === requestedId)
    );

    if (item) {
        let meta = {
            id: isMovie ? item.id : args.id, 
            type: args.type,
            name: item.name,
            poster: item.poster,
            background: item.background || item.poster,
            description: item.description,
            releaseInfo: item.year?.toString(),
            runtime: item.runtime || undefined,
            genres: item.genres || [],
            cast: (item.cast || []).map(c => ({ name: c.name || c })),
            imdbRating: item.rating?.imdb ? parseFloat(item.rating.imdb) : undefined,
        };

        if (isMovie) {
             meta.videos = [{
                id: item.id,
                title: "Filme Completo",
                released: item.year ? new Date(item.year, 0, 1) : undefined
            }];
        } else {
            const videos = [];
            item.seasons.forEach(temp => {
                temp.episodes.forEach(ep => {
                    videos.push({
                        id: `tmdb:${item.tmdb}:${temp.season}:${ep.episode}`, 
                        title: ep.title,
                        thumbnail: ep.thumbnail,
                        season: temp.season,
                        episode: ep.episode,
                        overview: ep.overview,
                        released: ep.released ? new Date(ep.released) : undefined
                    });
                });
            });
            meta.videos = videos;
        }

        return {
            meta: meta,
            cacheMaxAge: 3600
        };
    }

    return { meta: {} };
});

// ------------------ STREAM HANDLER CORRIGIDO (Adiciona prefixo 'external:' para embeds) ------------------
builder.defineStreamHandler(async args => {

    // Função que aplica o prefixo 'external:' se não for um link de arquivo de mídia direto.
    const prefixEmbed = (url) => {
        if (!url) return url;
        // Verifica se a URL não termina em uma extensão de streaming comum e se não contém o prefixo 'external:'
        if (!url.match(/\.(m3u8|mp4|avi|webm|mkv|vtt|srt|txt)$/i) && !url.startsWith('external:')) {
            return `external:${url}`;
        }
        return url;
    };
    
    // 1. Tenta achar Filme
    const filme = filmes.find(f =>
        args.id === f.id || args.id === `tmdb:${f.tmdb}`
    );

    if (filme) {
        return {
            streams: [{
                title: "Filme Dublado",
                url: prefixEmbed(filme.stream), // << CORREÇÃO EMBED AQUI
            }]
        };
    }

    // 2. Lógica Inteligente para Séries (IMDb vs TMDB)
    let serieEncontrada = null;
    let seasonReq = null;
    let episodeReq = null;

    // Lógica para extrair temporada e episódio do ID (tt:ID:S:E ou tmdb:ID:S:E)
    if (args.id.includes(':')) {
        const parts = args.id.split(":");
        if (parts.length >= 3) {
            seasonReq = parts[parts.length - 2];
            episodeReq = parts[parts.length - 1];

            const baseId = parts.slice(0, parts.length - 2).join(':');

            if (baseId.startsWith("tt")) {
                const imdbId = baseId.substring(2);
                serieEncontrada = series.find(s => s.rating && s.rating.imdb_id === imdbId);
            } else if (baseId.startsWith("tmdb")) {
                const tmdbId = parts[1];
                serieEncontrada = series.find(s => s.tmdb && s.tmdb.toString() === tmdbId);
            }
        }
    }

    // Se achou a série, busca o episódio
    if (serieEncontrada) {
        const temp = serieEncontrada.seasons.find(t => t.season == seasonReq);
        if (temp) {
            const ep = temp.episodes.find(e => e.episode == episodeReq);
            if (ep) {
                return {
                    streams: [{
                        title: `S${seasonReq}E${episodeReq} - Dublado`,
                        url: prefixEmbed(ep.stream), // << CORREÇÃO EMBED AQUI
                    }]
                };
            }
        }
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });

console.log("Addon Cinema Dublado (v1.0.8) rodando na porta 7000. Compatibilidade com Embed ativada.");
