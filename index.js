const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

// ------------------ Carregar arquivos JSON ------------------
function safeReadJSON(file) {
    try {
        const filePath = path.join(__dirname, file);
        // O retorno padrão deve ser um array vazio para que o .map não quebre
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error("Erro ao ler JSON:", file, err.message);
        return [];
    }
}

const filmes = safeReadJSON("data/filmes.json");
const series = safeReadJSON("data/series.json");

// ------------------ Extrair Categorias Únicas ------------------
// O usuário quer categorizar por "terror" e "netflix", mas o código deve ser dinâmico.
// Vamos extrair todas as categorias únicas presentes nos itens.
// O .filter(c => c) garante que apenas categorias válidas (não undefined, null ou string vazia) sejam consideradas.
const categoriasFilmes = [...new Set(filmes.map(f => f.categoria).filter(c => c))];
const categoriasSeries = [...new Set(series.map(s => s.categoria).filter(c => c))];

// ------------------ Manifesto do Addon ------------------
const manifest = {
    id: "cinema-dublado",
    version: "1.0.5", // Versão atualizada
    name: "Cinema Dublado",
    description: "Filmes e séries dublados PT-BR com categorias!",
    logo: "https://i.imgur.com/0eM1y5b.jpeg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: []
};

// Adicionar catálogo "Todos os Filmes"
// Adicionamos este catálogo incondicionalmente
manifest.catalogs.push({ type: "movie", id: "catalogo-filmes-todos", name: "Filmes - Todos" });

// Adicionar catálogos de filmes por categoria
categoriasFilmes.forEach(cat => {
    manifest.catalogs.push({
        type: "movie",
        id: `filmes-${cat}`,
        name: `Filmes - ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
        extra: [{ name: "search", isRequired: false }]
    });
});

// Adicionar catálogo "Todas as Séries"
manifest.catalogs.push({ type: "series", id: "catalogo-series-todas", name: "Séries - Todas" });

// Adicionar catálogos de séries por categoria
categoriasSeries.forEach(cat => {
    manifest.catalogs.push({
        type: "series",
        id: `series-${cat}`,
        name: `Séries - ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
        extra: [{ name: "search", isRequired: false }]
    });
});

const builder = new addonBuilder(manifest);

// ------------------ Handler de Catálogo ------------------
builder.defineCatalogHandler(async args => {
    let items = [];

    if (args.type === "movie") {
        if (args.id === "catalogo-filmes-todos") {
            items = filmes;
        } else if (args.id.startsWith("filmes-")) {
            const categoryId = args.id.replace("filmes-", "");
            items = filmes.filter(f => f.categoria === categoryId);
        }
    } else if (args.type === "series") {
        if (args.id === "catalogo-series-todas") {
            items = series;
        } else if (args.id.startsWith("series-")) {
            const categoryId = args.id.replace("series-", "");
            items = series.filter(s => s.categoria === categoryId);
        }
    }

    return {
        metas: items.map(item => ({
            // Usar item.type para garantir que o ID seja formatado corretamente
            id: item.type === "movie" ? (item.tmdb ? `tmdb:${item.tmdb}` : item.id) : `tmdb:${item.tmdb}`,
            type: item.type,
            name: item.name,
            poster: item.poster,
            description: item.description,
            releaseInfo: item.year?.toString()
        }))
    };
});

// ------------------ Handler de Meta ------------------
// Os Handlers de Meta e Stream não precisam de alteração, pois já buscam em todos os arrays.
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
    const serie = series.find(s =>
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

    // Série (episódio)
    const [_, tmdb, season, episode] = args.id.split(":");

    const serie = series.find(s => s.tmdb.toString() === tmdb);

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
