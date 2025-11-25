
Projetos

chat, eu tenho um addon aqui que eu criei no stremio e to adicionando os filmes, porem eu tenho apenas um codigo pra adiconar os filmes, e ta tudo junto eu preciso separar eles por categorias por exemplo o que e terror fica dentro de terro netflix etc por enquanto so essas duas categorias? do que voce precisa do meu index.js e do meu filmes.json. e tambem pra series eu quero fazer isso, atualmente eu tenho apenas series.json tudo junto.
Lite
Olá! Entendi perfeitamente o que você precisa. Você quer organizar seu addon do Stremio, separando tanto os filmes quanto as séries em categorias específicas, começando com "terror" e "netflix".
Para te ajudar com isso, vou precisar analisar a estrutura dos seus arquivos. Por favor, me envie o conteúdo dos seguintes arquivos:
index.js (o arquivo principal do seu addon)
filmes.json (seu arquivo com a lista de filmes)
series.json (seu arquivo com a lista de séries)
Com esses arquivos em mãos, eu poderei:
Entender como seu addon está lendo os dados atualmente.
Sugerir as modificações necessárias no index.js para que ele possa entender e criar as categorias.
Mostrar como você deve reestruturar seus arquivos .json para que cada filme e série fique dentro da categoria correta.
Pode colar o conteúdo dos arquivos aqui na nossa conversa. Fico no aguardo para começarmos
vou mandar separado ok. ta tudo ai. eu quero

pasted_content.txt
Texto · 5.53 KB
pasted_content_2.txt
Texto · 6.36 KB
pasted_content_3.txt
Texto · 6.36 KB
Analisando o index.js, os arquivos JSON atuais são carregados sem categorias específicas. Preciso reestruturar filmes.json e series.json para incluir categorias "terror" e "netflix", e modificar o index.js para suportar essa nova organização.

Estou analisando o index.js e os arquivos JSON para incluir categorias "terror" e "netflix". Os JSONs atuais não possuem categorias específicas, preciso reestruturá-los e atualizar o código.

Estou analisando os arquivos JSON para incluir categorias "terror" e "netflix", criando novas estruturas. O próximo passo é reestruturar os arquivos e ajustar o código.

Lite
As modificações para categorizar seus filmes e séries no addon do Stremio foram concluídas!
Eu reestruturei seus arquivos JSON e atualizei o index.js para que o addon crie catálogos separados para cada categoria que você definir.
O que foi feito:
Reestruturação dos Arquivos JSON:
Os arquivos filmes.json e series.json agora usam um objeto onde as chaves são os nomes das categorias (ex: "terror", "netflix") e os valores são os arrays de filmes/séries dessa categoria.
Importante: Como você não enviou nenhum filme, eu criei exemplos de filmes nas categorias "terror" e "netflix" no filmes.json. Você deve substituir esses exemplos pelos seus filmes reais.
No series.json, eu movi as séries que você enviou para uma categoria "hbo-max" (baseado no campo categoria que estava nos dados) e adicionei exemplos para as categorias "netflix" e "terror".
Atualização do index.js:
O index.js foi modificado para ler a nova estrutura de objetos JSON.
Ele agora cria automaticamente um catálogo no Stremio para cada chave (categoria) que ele encontrar nos seus arquivos JSON. Por exemplo, se você adicionar uma categoria "disney" no filmes.json, um novo catálogo "Filmes - Disney" será criado.
A lógica de meta e stream foi ajustada para buscar em todos os itens, independentemente da categoria.
Seus novos arquivos:
Eu anexei os três arquivos modificados.
index.js: O código principal do seu addon, agora com suporte a categorias.
filmes.json: Exemplo de estrutura de filmes por categoria.
series.json: Exemplo de estrutura de séries por categoria (incluindo as séries que você enviou).
Próximos Passos (O que você precisa fazer):
Substitua os arquivos index.js, filmes.json e series.json (dentro da pasta data/) pelos anexados.
Preencha seus arquivos JSON com seus filmes e séries reais, organizando-os nas categorias desejadas.
Exemplo de como deve ser a estrutura:
JSON
{
  "terror": [
    { /* seu filme/série de terror */ },
    { /* outro filme/série de terror */ }
  ],
  "netflix": [
    { /* seu filme/série da netflix */ }
  ]
}
Reinicie seu addon para que as mudanças entrem em vigor.
Se tiver qualquer dúvida sobre como preencher os arquivos ou precisar de mais categorias, é só me dizer!
index.js
Código · 6.44 KB
filmes.json
Código · 773 B
series.json
Código · 7.86 KB

Ver todos os arquivos nesta tarefa
Tarefa concluída
Como foi este resultado?
Sugestões de acompanhamento
Enviar mensagem para Manus

index.js
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
