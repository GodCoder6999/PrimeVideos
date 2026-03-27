// api/multi-stream.js
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// Ultimate Fallback Chain: Direct -> CorsProxy -> AllOrigins -> CodeTabs
const PROXIES = [
    (url) => url, 
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchSafely(targetUrl, isJson = true) {
    let lastError = '';
    for (const proxyGen of PROXIES) {
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0' },
                signal: AbortSignal.timeout(9000)
            });
            if (res.ok) {
                const data = await res.text();
                return isJson ? JSON.parse(data) : data;
            }
            lastError = `HTTP ${res.status}`;
        } catch (e) {
            lastError = e.message;
        }
    }
    throw new Error(lastError);
}

// ─── LANGUAGE DETECTION ENGINE ───
function parseLanguage(title, sourceName) {
    if (!title) return sourceName.includes('MoviesMod') ? 'Dual Audio' : 'English';
    const t = title.toLowerCase();
    
    if (/\b(dual audio|dual)\b/.test(t)) return 'Dual Audio';
    if (/\b(multi audio|multi)\b/.test(t)) return 'Multi Audio';

    const langs = [];
    if (/\b(hindi|hin)\b/.test(t)) langs.push('Hindi');
    if (/\b(tamil|tam)\b/.test(t)) langs.push('Tamil');
    if (/\b(telugu|tel)\b/.test(t)) langs.push('Telugu');
    if (/\b(malayalam|mal)\b/.test(t)) langs.push('Malayalam');
    if (/\b(bengali|ben)\b/.test(t)) langs.push('Bengali');
    if (/\b(kannada|kan)\b/.test(t)) langs.push('Kannada');
    if (/\b(english|eng)\b/.test(t)) langs.push('English');
    
    if (langs.length > 0) return langs.join(', ');
    
    // Smart Fallbacks
    if (sourceName.includes('MoviesMod') || t.includes('mplay')) return 'Dual Audio';
    return 'English';
}

function parseQuality(title) {
    if (!title) return 'Auto';
    const t = title.toLowerCase();
    if (t.includes('2160') || t.includes('4k')) return '4K';
    if (t.includes('1080')) return '1080p';
    if (t.includes('720')) return '720p';
    if (t.includes('480')) return '480p';
    return 'Auto';
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
    const logs = [];
    const streams = [];
    const subtitles = [];

    // 1. Fetch IMDB ID
    try {
        const tmdbData = await fetchSafely(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        imdbId = tmdbData.imdb_id;
    } catch (e) {
        logs.push(`TMDB: ${e.message}`);
    }

    const promises = [];

    // 2. Embed.su (Mainly English / Auto)
    promises.push((async () => {
        try {
            const url = type === 'tv' ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` : `https://embed.su/embed/movie/${tmdbId}`;
            const html = await fetchSafely(url, false);
            const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
            if (hashMatch) {
                const apiData = await fetchSafely(`https://embed.su/api/e/${hashMatch[1]}`);
                if (apiData.source) streams.push({ url: px(apiData.source), quality: 'Auto - English', source: 'EmbedSU', type: 'hls' });
                if (apiData.sources) apiData.sources.forEach(s => {
                    if (s.file) streams.push({ url: px(s.file), quality: `${s.label || 'Auto'} - English`, source: 'EmbedSU', type: s.file.includes('.mp4') ? 'mp4' : 'hls' });
                });
                if (apiData.subtitles) apiData.subtitles.forEach(sub => {
                    if (sub.file) subtitles.push({ url: px(sub.file), lang: sub.label || 'Unknown' });
                });
            }
        } catch (e) {
            logs.push(`EmbedSU: ${e.message}`);
        }
    })());

    // 3. Stremio Addons (Where the Multi-Audio & Regional Dubs live)
    if (imdbId) {
        const stremioEndpoints = [
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

        stremioEndpoints.forEach(endpoint => {
            promises.push((async () => {
                try {
                    const data = await fetchSafely(endpoint.url);
                    if (data && data.streams) {
                        data.streams.forEach(s => {
                            if (s.url && !s.url.includes('magnet')) {
                                const rawTitle = s.name || s.title || s.description || '';
                                const baseQuality = parseQuality(rawTitle);
                                const language = parseLanguage(rawTitle, endpoint.name);
                                
                                streams.push({
                                    url: px(s.url),
                                    quality: `${baseQuality} - ${language}`, // Connects quality to language!
                                    source: endpoint.name,
                                    type: s.url.includes('.m3u8') ? 'hls' : 'mp4'
                                });
                            }
                        });
                    }
                } catch (e) {
                    logs.push(`${endpoint.name}: ${e.message}`);
                }
            })());
        });
    }

    await Promise.all(promises);

    // 4. Sort Output (Highest Quality + Best Audio first)
    const rank = { '4K': 5, '1080p': 4, '720p': 3, 'Auto': 2, '480p': 1 };
    streams.sort((a, b) => {
        const qA = a.quality.split(' - ')[0];
        const qB = b.quality.split(' - ')[0];
        return (rank[qB] || 0) - (rank[qA] || 0);
    });

    if (streams.length > 0) {
        return res.json({
            success: true,
            count: streams.length,
            streams: streams,
            subtitles: subtitles,
            audioTracks: [] // MP4 files don't need multiplex tracks, they are separate streams now!
        });
    }

    return res.json({
        success: false,
        error: `Debug Logs: [ ${logs.join(' | ')} ]`
    });
};
