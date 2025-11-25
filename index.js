const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
function safeReadJSON(file) {
    try {
        // Usa path.join para garantir compatibilidade com diferentes SOs
        const filePath = path.join(__dirname, file);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

// Assumindo que os arquivos 'filmes.json' e 'series.json' existem no diretório 'data'
const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Manifesto do Addon ------------------
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

// ------------------ Handler de Catálogo ------------------
builder.defineCatalogHandler(async args => {
    // Catálogo de Filmes
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

    // Catálogo de Séries
    if (args.type === "series" && args.id === "catalogo-series") {
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

// ------------------ Handler de Meta (Detalhes) ------------------
builder.defineMetaHandler(async args => {
    // Trata Filmes (Pode usar ID interno ou ID do TMDB)
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

    // Trata Séries (Usa ID do TMDB)
    const serie = series.find(s => `tmdb:${s.tmdb}` === args.id);
    if (serie) {
        // Construir episódios (videos) para o Stremio
        const videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    // ID do episódio no formato Stremio: tmdb:{ID_SERIE}:{TEMPORADA}:{EPISODIO}
                    id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    thumbnail: ep.thumbnail,
                    season: temp.season,
                    episode: ep.episode,
                    overview: ep.overview // Adicionado para aparecer a descrição do episódio
                });
            });
        });

        const logoOficial = serie.logo || null;

        return {
            meta: {
                id: `tmdb:${serie.tmdb}`, 
                type: "series",
                name: serie.name,
                poster: serie.poster,
                background: serie.background,
                logo: logoOficial,
                description: serie.description,
                
                // --- ALTERAÇÕES APLICADAS AQUI ---
                // Adiciona o tracinho "2025-" para indicar série contínua
                releaseInfo: serie.year ? `${serie.year}-` : "", 
                
                // Mapeia a nota do IMDB corretamente para aparecer o quadrado amarelo
                imdbRating: serie.rating?.imdb,
                
                // Mapeia o tempo de duração (Lembre de adicionar "runtime" no JSON)
                runtime: serie.runtime,
                
                // Gêneros e Elenco
                genres: serie.genres || [],
                cast: serie.cast || [],
                
                // Lista de episódios
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
