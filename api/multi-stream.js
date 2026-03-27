// api/multi-stream.js
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// We use public proxies to completely bypass Vercel's DNS firewall and Cloudflare's SSL blocks.
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// Helper that safely routes the fetch through the proxies
async function fetchJsonSafely(targetUrl) {
    let lastError = '';
    for (const proxyGen of PROXIES) {
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (res.ok) {
                const data = await res.text();
                return JSON.parse(data); // Parse text to JSON manually to catch bad responses
            }
            lastError = `HTTP ${res.status}`;
        } catch (e) {
            lastError = e.message;
        }
    }
    throw new Error(lastError);
}

module.exports = async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId required' });

    // Build your local proxy url
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${proto}://${host}`;
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    let imdbId = null;
    const logs = [];
    const streams = [];

    // 1. Fetch IMDB ID (TMDB is rarely blocked, but we'll try/catch it safely)
    try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        const tmdbData = await tmdbRes.json();
        imdbId = tmdbData.imdb_id;
    } catch (e) {
        logs.push(`TMDB Error: ${e.message}`);
    }

    if (!imdbId) {
        return res.json({ success: false, error: `Debug Logs: [ No IMDB ID found | ${logs.join(' | ')} ]` });
    }

    // 2. Define our target streaming JSON Addons
    const endpoints = [
        {
            name: 'Nuvio (MoviesMod)',
            url: type === 'tv' 
                ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`
        },
        {
            name: 'Superflix',
            url: type === 'tv' 
                ? `https://stremio-addon.superflix.to/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`
        },
        {
            name: 'JaMovies',
            url: type === 'tv' 
                ? `https://jamovies.baby/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://jamovies.baby/stream/movie/${imdbId}.json`
        }
    ];

    // 3. Try each endpoint concurrently using the WAF-Bypass proxy
    await Promise.all(endpoints.map(async (endpoint) => {
        try {
            const data = await fetchJsonSafely(endpoint.url);
            if (data && data.streams) {
                data.streams.forEach(s => {
                    // Filter out torrents, we only want direct http mp4/m3u8 files
                    if (s.url && !s.url.includes('magnet')) {
                        let quality = 'Auto';
                        const nameStr = (s.name || s.title || s.description || '').toLowerCase();
                        
                        // Parse quality
                        if (nameStr.includes('2160') || nameStr.includes('4k')) quality = '4K';
                        else if (nameStr.includes('1080')) quality = '1080p';
                        else if (nameStr.includes('720')) quality = '720p';
                        else if (nameStr.includes('480')) quality = '480p';

                        streams.push({
                            url: px(s.url),
                            quality: quality,
                            source: endpoint.name,
                            type: s.url.includes('.m3u8') ? 'hls' : 'mp4'
                        });
                    }
                });
            } else {
                logs.push(`${endpoint.name}: No streams returned`);
            }
        } catch (e) {
            logs.push(`${endpoint.name}: ${e.message}`);
        }
    }));

    // 4. Sort streams by quality (Highest first)
    const rank = { '4K': 5, '1080p': 4, '720p': 3, 'Auto': 2, '480p': 1 };
    streams.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

    // 5. Return success if any stream survived
    if (streams.length > 0) {
        return res.json({
            success: true,
            count: streams.length,
            streams: streams,
            subtitles: [], // These APIs embed subtitles inside the MKV/MP4 files natively
            audioTracks: []
        });
    }

    // Return the specific proxy errors if they still fail
    return res.json({
        success: false,
        error: `Debug Logs: [ ${logs.join(' | ')} ]`
    });
};
