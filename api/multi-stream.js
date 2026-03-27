// api/multi-stream.js
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// Public proxies to bypass Vercel DNS blocks
const PROXIES = [
    (url) => url, 
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchSafely(targetUrl) {
    let lastError = '';
    for (const proxyGen of PROXIES) {
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(9000)
            });
            if (res.ok) return JSON.parse(await res.text());
            lastError = `HTTP ${res.status}`;
        } catch (e) {
            lastError = e.message;
        }
    }
    throw new Error(lastError);
}

// Language Detection Engine
function parseDetails(title, sourceName) {
    const t = (title || '').toLowerCase();
    
    // Quality
    let quality = 'Auto';
    if (t.includes('2160') || t.includes('4k')) quality = '4K';
    else if (t.includes('1080')) quality = '1080p';
    else if (t.includes('720')) quality = '720p';
    else if (t.includes('480')) quality = '480p';

    // Language
    let language = 'English'; // Default
    if (/\b(hindi|hin)\b/.test(t)) language = 'Hindi';
    else if (/\b(tamil|tam)\b/.test(t)) language = 'Tamil';
    else if (/\b(telugu|tel)\b/.test(t)) language = 'Telugu';
    else if (/\b(bengali|ben)\b/.test(t)) language = 'Bengali';
    else if (/\b(dual audio|dual)\b/.test(t) || sourceName.includes('MoviesMod')) language = 'Dual Audio';
    else if (/\b(multi audio|multi)\b/.test(t)) language = 'Multi Audio';

    return { quality, language };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId required' });

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${proto}://${host}`;
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    let imdbId = null;
    const streams = [];

    // 1. Fetch IMDB ID (Required for Stremio)
    try {
        const tmdbData = await fetchSafely(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        imdbId = tmdbData.imdb_id;
    } catch (e) {
        return res.json({ success: false, error: 'Failed to fetch IMDB ID from TMDB' });
    }

    if (!imdbId) return res.json({ success: false, error: 'No IMDB ID found for this title.' });

    // 2. Scrape Stremio Multi-Audio Addons concurrently
    const endpoints = [
        { name: 'Nuvio (MoviesMod)', url: type === 'tv' ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json` : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json` },
        { name: 'Superflix', url: type === 'tv' ? `https://stremio-addon.superflix.to/stream/series/${imdbId}:${season}:${episode}.json` : `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json` },
        { name: 'JaMovies', url: type === 'tv' ? `https://jamovies.baby/stream/series/${imdbId}:${season}:${episode}.json` : `https://jamovies.baby/stream/movie/${imdbId}.json` }
    ];

    await Promise.all(endpoints.map(async (ep) => {
        try {
            const data = await fetchSafely(ep.url);
            if (data && data.streams) {
                data.streams.forEach(s => {
                    if (s.url && !s.url.includes('magnet')) {
                        const { quality, language } = parseDetails(s.name || s.title || s.description, ep.name);
                        streams.push({
                            url: px(s.url),
                            quality,
                            language, // NEW: Explicit language field sent to frontend
                            source: ep.name,
                            type: s.url.includes('.m3u8') ? 'hls' : 'mp4'
                        });
                    }
                });
            }
        } catch (e) { /* Ignore failed scrapers */ }
    }));

    // 3. Sort by Quality
    const rank = { '4K': 5, '1080p': 4, '720p': 3, 'Auto': 2, '480p': 1 };
    streams.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

    if (streams.length > 0) {
        return res.json({ success: true, count: streams.length, streams, subtitles: [], audioTracks: [] });
    }

    return res.json({ success: false, error: 'No playable streams found.' });
};
