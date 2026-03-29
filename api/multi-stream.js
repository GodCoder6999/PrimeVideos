const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

const PROXIES = [
    (url) => url,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

async function fetchSafely(targetUrl) {
    for (const proxyGen of PROXIES) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) return JSON.parse(await res.text());
        } catch (e) {
            clearTimeout(timeoutId);
        }
    }
    return null;
}

// Highly accurate language parsing
function detectLanguage(streamObj, sourceName) {
    const raw = [streamObj.name, streamObj.title, streamObj.description].join(' ').toLowerCase();

    const hasHindi = /\b(hin|hindi|hi)\b/.test(raw);
    const hasEnglish = /\b(eng|english|en)\b/.test(raw);
    const hasDual = /\b(dual audio|dual|multi audio|multi)\b/.test(raw);

    if (hasDual || (hasHindi && hasEnglish)) return 'Hindi + English';
    if (hasHindi) return 'Hindi';
    if (hasEnglish) return 'English';

    // Safe fallbacks based on scraper type
    const src = sourceName.toLowerCase();
    if (src.includes('nuvio') || src.includes('moviesmod')) return 'Hindi + English'; 
    return 'English'; // Superflix, Chillx, JaMovies default to English
}

function detectQuality(streamObj) {
    const raw = [streamObj.name, streamObj.title, streamObj.description].join(' ').toLowerCase();
    if (/\b(?:2160p?|4k|uhd)\b/.test(raw)) return '4K';
    if (/\b1080p?\b/.test(raw)) return '1080p';
    if (/\b720p?\b/.test(raw)) return '720p';
    if (/\b480p?\b/.test(raw)) return '480p';
    return 'Auto';
}

// 5 Massive Scraping Endpoints to guarantee all movies (including Hallmark) are found
function buildEndpoints(imdbId, season, episode) {
    const s = season || 1;
    const e = episode || 1;
    return [
        { name: 'Superflix', movieUrl: `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`, tvUrl: `https://stremio-addon.superflix.to/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'Chillx', movieUrl: `https://chillx.top/stream/movie/${imdbId}.json`, tvUrl: `https://chillx.top/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'JaMovies', movieUrl: `https://jamovies.baby/stream/movie/${imdbId}.json`, tvUrl: `https://jamovies.baby/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'Nuvio', movieUrl: `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`, tvUrl: `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'CineSnatch', movieUrl: `https://cinesnatch.vercel.app/stream/movie/${imdbId}.json`, tvUrl: `https://cinesnatch.vercel.app/stream/series/${imdbId}:${s}:${e}.json` }
    ];
}

const QUALITY_RANK = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, 'Auto': 1 };

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
    if (!tmdbId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
    }

    const proto  = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host   = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const px = (url) => `${proto}://${host}/api/proxy?url=${encodeURIComponent(url)}`;

    let imdbId = null;
    try {
        const tmdbData = await fetchSafely(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        imdbId = tmdbData?.imdb_id;
    } catch (e) {}
    if (!imdbId) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: false, error: 'No IMDB ID found for this title.' }));
    }

    const endpoints = buildEndpoints(imdbId, season, episode);
    const rawStreams = [];

    // Fetch from all 5 scrapers simultaneously
    await Promise.all(endpoints.map(async (ep) => {
        const url = type === 'tv' ? ep.tvUrl : ep.movieUrl;
        const data = await fetchSafely(url);
        if (!data?.streams) return;

        for (const s of data.streams) {
            if (!s.url || s.url.startsWith('magnet:')) continue;
            rawStreams.push({
                url: px(s.url),
                quality: detectQuality(s),
                language: detectLanguage(s, ep.name),
                source: ep.name,
                type: s.url.includes('.m3u8') ? 'hls' : 'mp4'
            });
        }
    }));

    // Deduplicate and rank streams
    const buckets = new Map();
    for (const s of rawStreams) {
        const key = `${s.language}|${s.quality}`;
        if (!buckets.has(key) || (s.type === 'hls' && buckets.get(key).type !== 'hls')) {
            buckets.set(key, s);
        }
    }

    const deduped = Array.from(buckets.values()).sort((a, b) => {
        if (a.language === 'English' && b.language !== 'English') return -1;
        if (b.language === 'English' && a.language !== 'English') return 1;
        return (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0);
    });

    if (deduped.length > 0) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, streams: deduped }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No playable streams found.' }));
};
