const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ------------------ Carregar arquivos JSON ------------------
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

// ------------------ Manifesto ------------------
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

// ------------------ Função para decodificar 2x ------------------
function decodeURL(url) {
    try {
        return decodeURIComponent(decodeURIComponent(url));
    } catch (e) {
        return url;
    }
}

// ------------------ Catálogo ------------------
builder.defineCatalogHandler(async args => {
    if (args.type === "movie") {
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

    if (args.type === "series") {
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

// ------------------ Meta ------------------
builder.defineMetaHandler(async args => {
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
                description: filme.description,
                releaseInfo: filme.year?.toString(),
                videos: [{
                    id: filme.id,
                    title: filme.name
                }]
            }
        };
    }

    const serie = series.find(s => `tmdb:${s.tmdb}` === args.id);

    if (serie) {
        let videos = [];

        serie.seasons.forEach(temp => {
            temp.episodes.forEach(ep => {
                videos.push({
                    id: `tmdb:${serie.tmdb}:${temp.season}:${ep.episode}`,
                    title: ep.title,
                    season: temp.season,
                    episode: ep.episode,
                    thumbnail: ep.thumbnail
                });
            });
        });

        return {
            meta: {
                id: `tmdb:${serie.tmdb}`,
                type: "series",
                name: serie.name,
                poster: serie.poster,
                description: serie.description,
                releaseInfo: serie.year?.toString(),
                videos
            }
        };
    }

    return { meta: {} };
});

// ------------------ Stream ------------------
builder.defineStreamHandler(async args => {
    const id = args.id;

    const filme = filmes.find(f =>
        f.id === id || (f.tmdb && `tmdb:${f.tmdb}` === id)
    );

    if (filme) {
        return {
            streams: [{ title: "Dublado", url: filme.stream }]
        };
    }

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

        try {
            const m3uOriginal = await axios.get(ep.stream);
            const linhas = m3uOriginal.data.split("\n");

            const m3uDecodificado = linhas
                .map(linha => {
                    if (linha.startsWith("http")) {
                        return decodeURL(linha);
                    }
                    return linha;
                })
                .join("\n");

            const m3uPath = `/m3u/${tmdb}-${season}-${episode}.m3u8`;
            fs.writeFileSync(path.join(__dirname, m3uPath), m3uDecodificado);

            return {
                streams: [
                    {
                        title: "Dublado (HD)",
                        url: `${process.env.RENDER_EXTERNAL_URL || ""}${m3uPath}`
                    }
                ]
            };
        } catch (err) {
            console.error("Erro ao processar M3U8:", err);
            return { streams: [] };
        }
    }

    return { streams: [] };
});

// ------------------ Servidor ------------------
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });

console.log("Cinema Dublado Addon iniciado.");
