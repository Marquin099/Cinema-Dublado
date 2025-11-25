import { addonBuilder, serveHTTP } from "stremio-addon-sdk";
import fetch from "node-fetch";
import fs from "fs";

// Carregar JSON manualmente (Render + Node compatível)
const movies = JSON.parse(fs.readFileSync("./movies.json", "utf8"));
const series = JSON.parse(fs.readFileSync("./series.json", "utf8"));

const manifest = {
    id: "community.superflix",
    version: "1.0.0",
    catalogs: [],
    resources: ["stream", "meta"],
    types: ["movie", "series"],
    name: "Superflix Addon",
    description: "Addon que usa TMDB + Superflix API",
    idPrefixes: ["tmdb"]
};

const builder = new addonBuilder(manifest);

// ============================================================
// 📌 META HANDLER (FILMES + SÉRIES)
// ============================================================
builder.defineMetaHandler(async (args) => {
    console.log("META:", args.id);

    const tmdbKey = process.env.TMDB_KEY;
    const tmdbToken = process.env.TMDB_TOKEN;

    // ------------------------------------------------------------
    // 🎬 FILMES
    // ------------------------------------------------------------
    const movie = movies.find(m => args.id.includes(m.tmdb?.toString()));

    if (movie) {
        return {
            meta: {
                id: `tmdb:${movie.tmdb}`,
                type: "movie",
                name: movie.title,
                poster: movie.poster,
                background: movie.background,
                logo: movie.logo || null,
                description: movie.description,
                releaseInfo: movie.year?.toString(),
                runtime: movie.runtime,
                genres: movie.genres || [],
                imdbRating: movie.rating?.imdb ? parseFloat(movie.rating.imdb) : undefined,
                cast: movie.cast || []
            }
        };
    }

    // ------------------------------------------------------------
    // 📺 SÉRIES
    // ------------------------------------------------------------
    const serie = series.find(s => args.id.includes(s.tmdb?.toString()));

    if (serie) {

        let tmdbData = null;

        try {
            tmdbData = await fetch(
                `https://api.themoviedb.org/3/tv/${serie.tmdb}?api_key=${tmdbKey}&language=pt-BR&append_to_response=credits`,
                {
                    headers: {
                        Authorization: `Bearer ${tmdbToken}`
                    }
                }
            ).then(r => r.json());
        } catch (err) {
            console.error("Erro TMDB série:", err);
        }

        const castFix = [];

        if (tmdbData?.credits?.cast) {
            tmdbData.credits.cast.slice(0, 20).forEach(actor => {
                castFix.push({
                    name: actor.name,
                    character: actor.character,
                    photo: actor.profile_path
                        ? `https://image.tmdb.org/t/p/w300${actor.profile_path}`
                        : null
                });
            });
        }

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
                runtime: serie.runtime,
                genres: serie.genres || [],
                imdbRating: serie.rating?.imdb ? parseFloat(serie.rating.imdb) : undefined,

                cast: castFix.length ? castFix : serie.cast || [],

                videos
            }
        };
    }

    return { meta: null };
});

// ============================================================
// 📌 STREAM HANDLER — Superflix API
// ============================================================
builder.defineStreamHandler(async (args) => {
    console.log("STREAM:", args.id);

    const parts = args.id.split(":");

    if (parts.length === 2) {
        const tmdb = parts[1];
        return {
            streams: [{
                title: "Superflix",
                url: `https://superflixapi.asia/movie/${tmdb}`
            }]
        };
    }

    if (parts.length === 4) {
        const tmdb = parts[1];
        const season = parts[2];
        const episode = parts[3];

        return {
            streams: [{
                title: "Superflix",
                url: `https://superflixapi.asia/serie/${tmdb}/${season}/${episode}`
            }]
        };
    }

    return { streams: [] };
});

// ============================================================

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7777 });
console.log("Addon rodando!");
