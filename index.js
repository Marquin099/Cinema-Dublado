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
    // Os recursos que o addon suporta
    resources: ["catalog", "meta", "stream"],
    // Os tipos de conteúdo que o addon oferece
    types: ["movie", "series"],
    // Catálogos que aparecerão no Stremio
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
                // Corrigido: o ID de séries no catálogo deve usar o prefixo "tmdb:" para compatibilidade com o Stremio
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
                // Adiciona um vídeo dummy para carregar a seção de stream
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
                    episode: ep.episode
                });
            });
        });

        // Este LOGO OFICIAL é um exemplo. No código original, ele estava fora do objeto 'serie'.
        const logoOficial = serie.logo || "https://placeholder-logo-url.png"; 

        return {
            meta: {
                // Corrigido: O ID da série deve ser uma string com o prefixo 'tmdb:'
                id: `tmdb:${serie.tmdb}`, 
                type: "series",
                name: serie.name,

                poster: serie.poster,
                background: serie.background,
                logo: logoOficial,

                description: serie.description,
                releaseInfo: serie.year?.toString(),

                // CAMPOS QUE ATIVAM O LAYOUT PREMIUM (Usados aqui como valores de exemplo do seu código original)
                genres: serie.genres || ["Gênero Desconhecido"],
                cast: serie.cast || [],
                // É melhor usar os dados do JSON da série se existirem
                // director: ["Sam Levinson"], // Removido para usar os dados do JSON
                // writer: ["Rachel Sennott"], // Removido para usar os dados do JSON

                // Lista de episódios
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ Handler de Stream ------------------
builder.defineStreamHandler(async args => {
    const id = args.id;

    // Stream de Filme (ID do filme ou tmdb:ID)
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

    // Stream de Episódio de Série (ID no formato tmdb:{ID_SERIE}:{TEMPORADA}:{EPISODIO})
    // Regex para extrair TMDB ID, Temporada e Episódio
    const match = id.match(/^tmdb:(\d+):(\d+):(\d+)$/);

    if (match) {
        // Extrai os valores do regex match
        const tmdb = Number(match[1]);
        const season = Number(match[2]);
        const episode = Number(match[3]);

        // Busca a série
        const serie = series.find(s => s.tmdb === tmdb);
        if (!serie) return { streams: [] };

        // Busca a temporada
        const temp = serie.seasons.find(t => t.season === season);
        if (!temp) return { streams: [] };

        // Busca o episódio
        const ep = temp.episodes.find(e => e.episode === episode);
        if (!ep) return { streams: [] };

        return {
            streams: [
                {
                    title: `Dublado S${season}E${episode}`, // Título mais descritivo
                    url: ep.stream
                }
            ]
        };
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
// Inicia o servidor HTTP para hospedar o addon
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log(`🎬 Cinema Dublado Addon iniciado na porta ${process.env.PORT || 3000}.`);
