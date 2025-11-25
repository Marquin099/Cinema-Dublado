const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        // Altere para console.warn ou remova em produção se o arquivo é opcional
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

// Carrega os dados
// CERTIFIQUE-SE de que o caminho 'data/filmes.json' e 'data/series.json' existe!
const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.2", // Atualizei a versão para atualizar cache
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
                id: f.id, // Para filmes, uso o ID interno (ou tmdb se definido)
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
                // CORREÇÃO: Uso de template literal correto para IDs de série
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

// ------------------ Handler de Meta (Detalhes) ------------------
builder.defineMetaHandler(async args => {
    // Filmes
    const filme = filmes.find(f =>
        // O ID do meta pode vir como 'tmdb:XXXX' ou o ID interno do JSON
        f.id === args.id || (f.tmdb && `tmdb:${f.tmdb}` === args.id)
    );

    if (filme) {
        return {
            meta: {
                // Se o filme tiver tmdb, é melhor usar tmdb:ID como Stremio espera
                id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id,
                type: "movie",
                name: filme.name,
                poster: filme.poster,
                background: filme.background,
                description: filme.description,
                releaseInfo: filme.year?.toString(),
                // Simplificação do array de vídeos para filmes
                videos: [{ 
                    id: filme.tmdb ? `tmdb:${filme.tmdb}` : filme.id, // ID do stream será o mesmo do meta
                    title: "Filme Completo",
                    released: filme.year ? new Date(filme.year, 0, 1) : undefined
                }]
            }
        };
    }

    // Séries
    // CORREÇÃO: Uso de template literal correto para buscar a série
    const serie = series.find(s => s.tmdb && `tmdb:${s.tmdb}` === args.id);
    if (serie) {
        const videos = [];
        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    // CORREÇÃO: Uso de template literal correto para ID de episódio
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
                // CORREÇÃO: Uso de template literal correto para ID de série
                id: `tmdb:${serie.tmdb}`,
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background,
                logo: serie.logo || null,
                description: serie.description,
                releaseInfo: serie.year ? serie.year.toString() : "",
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,
                runtime: serie.runtime ? parseInt(serie.runtime) : undefined,
                genres: serie.genres || [],
                cast: serie.cast?.map(actor => actor) || [], // Mapeando apenas os nomes
                director: serie.director?.map(d => d) || [],
                writer: serie.writer?.map(w => w) || [],
                links: [
                    { 
                        name: "IMDb", 
                        category: "imdb", 
                        // CORREÇÃO: Uso de template literal correto para URL
                        url: `https://www.imdb.com/title/${serie.rating?.imdb_id}` 
                    }
                ],
                videos: videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ Handler de Stream ------------------
builder.defineStreamHandler(async args => {
    const id = args.id;

    // Stream de Filme
    // Filmes podem vir como o ID interno (f.id) ou tmdb:ID
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

    // Stream de Episódio de Série
    // O ID do stream de episódio é formatado como tmdb:TMDB_ID:SEASON_NUM:EP_NUM
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
                    // CORREÇÃO: Uso de template literal correto para o título do stream
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

// CORREÇÃO: Uso de template literal correto para o console.log
console.log(`🎬 Cinema Dublado Addon iniciado na porta ${process.env.PORT || 3000}.`);
