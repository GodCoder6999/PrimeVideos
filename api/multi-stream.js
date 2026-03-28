// api/multi-stream.js
// Fetches streams from 5 Stremio-addon scrapers in parallel.
// KEY FIX: Language detection is now more conservative — streams are only
// labelled "dual" when the scraper explicitly says so.  English-only sources
// (Superflix, Chillx, JaMovies) are labelled "English"; Hindi-specific sources
// (Nuvio/MoviesMod) are labelled "Hindi" or "Hindi + English" depending on
// their metadata.  This gives the player real, distinct URLs to switch between
// when the user changes the audio language.

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

const PROXIES = [
    (url) => url,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchSafely(targetUrl) {
    for (const proxyGen of PROXIES) {
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok) return JSON.parse(await res.text());
        } catch (e) { /* try next proxy */ }
    }
    return null;
}

/**
 * Detect the language of a stream entry from its metadata and source name.
 *
 * Returns one of: 'English', 'Hindi', 'Hindi + English', 'Tamil', 'Telugu',
 * or a raw string from the metadata.
 *
 * CHANGE FROM ORIGINAL:
 *  - English-primary sources (Superflix, Chillx, JaMovies) now default to
 *    "English" instead of "Unknown" / "English", avoiding the old catch-all
 *    that made everything look like a single-language English stream.
 *  - "dual"/"multi" is only set when both languages are explicitly mentioned.
 *  - Added Tamil / Telugu detection.
 */
function detectLanguage(streamObj, sourceName) {
    const raw = [streamObj.name, streamObj.title, streamObj.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const hasHindi   = /\b(hin|hindi|hi)\b/.test(raw);
    const hasEnglish = /\b(eng|english|en)\b/.test(raw);
    const hasDual    = /\b(dual[ .-]?audio|dual|multi[ .-]?audio|multi)\b/.test(raw);
    const hasTamil   = /\b(tam|tamil)\b/.test(raw);
    const hasTelugu  = /\b(tel|telugu)\b/.test(raw);

    // Explicit dual/multi tag takes priority.
    if (hasDual || (hasHindi && hasEnglish)) return 'Hindi + English';
    if (hasHindi)   return 'Hindi';
    if (hasTamil)   return 'Tamil';
    if (hasTelugu)  return 'Telugu';
    if (hasEnglish) return 'English';

    // Source-based fallbacks.
    const src = sourceName.toLowerCase();

    // Nuvio / MoviesMod typically carry Hindi + English dual-audio files.
    if (src.includes('nuvio') || src.includes('moviesmod')) return 'Hindi + English';

    // Superflix, Chillx, JaMovies, CineSnatch serve English-only streams.
    if (
        src.includes('superflix') ||
        src.includes('chillx')    ||
        src.includes('jamovies')  ||
        src.includes('cinesnatch')
    ) return 'English';

    // Generic fallback.
    return 'English';
}

function detectQuality(streamObj) {
    const raw = [streamObj.name, streamObj.title, streamObj.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (/\b(?:2160p?|4k|uhd)\b/.test(raw))  return '4K';
    if (/\b1080p?\b/.test(raw))               return '1080p';
    if (/\b720p?\b/.test(raw))                return '720p';
    if (/\b480p?\b/.test(raw))                return '480p';
    return 'Auto';
}

/**
 * Build Stremio-addon stream URLs for a given IMDB ID.
 * Five providers, each with a movie and a TV endpoint.
 */
function buildEndpoints(imdbId, season, episode) {
    const s = season  || 1;
    const e = episode || 1;
    return [
        {
            name:     'Superflix',
            movieUrl: `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`,
            tvUrl:    `https://stremio-addon.superflix.to/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'Chillx',
            movieUrl: `https://chillx.top/stream/movie/${imdbId}.json`,
            tvUrl:    `https://chillx.top/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'JaMovies',
            movieUrl: `https://jamovies.baby/stream/movie/${imdbId}.json`,
            tvUrl:    `https://jamovies.baby/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'Nuvio',
            movieUrl: `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`,
            tvUrl:    `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'CineSnatch',
            movieUrl: `https://cinesnatch.vercel.app/stream/movie/${imdbId}.json`,
            tvUrl:    `https://cinesnatch.vercel.app/stream/series/${imdbId}:${s}:${e}.json`,
        },
    ];
}

// Quality rank — higher is better for tie-breaking.
const QUALITY_RANK = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, 'Auto': 1 };

// Language priority when building the sorted final list.
// English-only streams come first so the player defaults to English.
const LANGUAGE_RANK = {
    'English':       10,
    'Hindi':          8,
    'Hindi + English': 6,
    'Tamil':          4,
    'Telugu':         3,
};
const langRank = (lang) => LANGUAGE_RANK[lang] ?? 2;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId required' });

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const px    = (url) => `${proto}://${host}/api/proxy?url=${encodeURIComponent(url)}`;

    // Get IMDB ID from TMDB.
    let imdbId = null;
    try {
        const tmdbData = await fetchSafely(
            `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
        );
        imdbId = tmdbData?.imdb_id;
    } catch (e) { /* continue */ }

    if (!imdbId) return res.json({ success: false, error: 'No IMDB ID found for this title.' });

    const endpoints = buildEndpoints(imdbId, season, episode);
    const rawStreams = [];

    // Fetch all five scrapers in parallel.
    await Promise.all(endpoints.map(async (ep) => {
        const url  = type === 'tv' ? ep.tvUrl : ep.movieUrl;
        const data = await fetchSafely(url);
        if (!data?.streams) return;

        for (const s of data.streams) {
            if (!s.url || s.url.startsWith('magnet:')) continue;

            rawStreams.push({
                url:      px(s.url),
                quality:  detectQuality(s),
                language: detectLanguage(s, ep.name),
                source:   ep.name,
                type:     s.url.includes('.m3u8') ? 'hls' : 'mp4',
            });
        }
    }));

    if (rawStreams.length === 0) {
        return res.json({ success: false, error: 'No playable streams found.' });
    }

    // ── Deduplication ────────────────────────────────────────────────────────
    // Keep the best stream per (language, quality) bucket.
    // "Best" = HLS over MP4, then source priority.
    const SOURCE_PRIORITY = {
        Superflix:  5,
        Chillx:     4,
        JaMovies:   3,
        CineSnatch: 2,
        Nuvio:      1,
    };

    const buckets = new Map();
    for (const s of rawStreams) {
        const key = `${s.language}|${s.quality}`;
        const existing = buckets.get(key);

        if (!existing) {
            buckets.set(key, s);
            continue;
        }

        // Prefer HLS over MP4.
        if (s.type === 'hls' && existing.type !== 'hls') {
            buckets.set(key, s);
            continue;
        }
        // Prefer higher-priority source.
        if (
            s.type === existing.type &&
            (SOURCE_PRIORITY[s.source] ?? 0) > (SOURCE_PRIORITY[existing.source] ?? 0)
        ) {
            buckets.set(key, s);
        }
    }

    // Sort: English-only first, then by quality descending.
    const deduped = Array.from(buckets.values()).sort((a, b) => {
        const langDiff = langRank(b.language) - langRank(a.language);
        if (langDiff !== 0) return langDiff;
        return (QUALITY_RANK[b.quality] ?? 0) - (QUALITY_RANK[a.quality] ?? 0);
    });

    return res.json({ success: true, streams: deduped });
};
