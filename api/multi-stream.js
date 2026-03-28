// api/multi-stream.js

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

const PROXIES = [
    (url) => url,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchSafely(targetUrl) {
    let lastError = '';
    for (const proxyGen of PROXIES) {
        try {
            const res = await fetch(proxyGen(targetUrl), {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(9000),
            });
            if (res.ok) return JSON.parse(await res.text());
            lastError = `HTTP ${res.status}`;
        } catch (e) {
            lastError = e.message;
        }
    }
    throw new Error(lastError);
}

function detectLanguage(streamObj, sourceName) {
    const fields = [
        streamObj.name || '',
        streamObj.title || '',
        streamObj.description || '',
        streamObj.behaviorHints?.filename || '',
        streamObj.behaviorHints?.bingeGroup || '',
    ];
    const raw = fields.join(' ').toLowerCase();

    if (/\b(?:multi[\s\-]?audio|multi[\s\-]?lang(?:uage)?|multilingual)\b/.test(raw)) return 'Multi Audio';
    if (/\b(?:dual[\s\-]?audio|dual[\s\-]?lang(?:uage)?)\b/.test(raw)) return 'Dual Audio';

    const LANG_PATTERNS = [
        ['English', /\b(?:english|eng)\b/],
        ['Hindi', /\b(?:hindi|hin)\b/],
        ['Tamil', /\b(?:tamil|tam)\b/],
        ['Telugu', /\b(?:telugu|tel)\b/],
        ['Bengali', /\b(?:bengali|bangla|ben)\b/],
        ['Malayalam', /\b(?:malayalam|mal)\b/],
        ['Kannada', /\b(?:kannada|kan)\b/],
        ['Marathi', /\b(?:marathi|mar)\b/],
        ['Punjabi', /\b(?:punjabi|pun)\b/],
    ];

    const found = LANG_PATTERNS.filter(([, re]) => re.test(raw)).map(([lang]) => lang);

    if (found.length >= 3) return 'Multi Audio';
    if (found.length === 2) return `${found[0]} + ${found[1]}`;
    if (found.length === 1) return found[0];

    const src = sourceName.toLowerCase();
    if (src.includes('superflix') || src.includes('epic') || src.includes('jamovies')) return 'English';
    if (src.includes('moviesmod') || src.includes('nuvio')) return 'Hindi'; 
    return 'English';
}

function detectQuality(streamObj) {
    const fields = [
        streamObj.name || '',
        streamObj.title || '',
        streamObj.description || '',
        streamObj.behaviorHints?.filename || '',
    ];
    const raw = fields.join(' ').toLowerCase();

    if (/\b(?:2160p?|4k|uhd)\b/.test(raw)) return '4K';
    if (/\b1080p?\b/.test(raw)) return '1080p';
    if (/\b720p?\b/.test(raw)) return '720p';
    if (/\b480p?\b/.test(raw)) return '480p';
    return 'Auto';
}

function buildEndpoints(imdbId, season, episode) {
    const s = season || 1;
    const e = episode || 1;
    return [
        { name: 'Nuvio (MoviesMod)', movieUrl: `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`, tvUrl: `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'Superflix', movieUrl: `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`, tvUrl: `https://stremio-addon.superflix.to/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'JaMovies', movieUrl: `https://jamovies.baby/stream/movie/${imdbId}.json`, tvUrl: `https://jamovies.baby/stream/series/${imdbId}:${s}:${e}.json` },
        { name: 'EpicStream', movieUrl: `https://epics.top/stream/movie/${imdbId}.json`, tvUrl: `https://epics.top/stream/series/${imdbId}:${s}:${e}.json` },
    ];
}

const QUALITY_RANK = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, 'Auto': 1 };

// Prioritize English at the very top
const LANGUAGE_PRIORITY = [
    'English',
    'Multi Audio', 'Dual Audio',
    'English + Hindi', 'Hindi + English',
    'Hindi', 'Tamil', 'Telugu', 'Bengali',
    'Malayalam', 'Kannada', 'Marathi', 'Punjabi'
];

const SOURCE_PRIORITY = { 'Superflix': 1, 'JaMovies': 2, 'EpicStream': 3, 'Nuvio (MoviesMod)': 4 };

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId required' });

    const proto  = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host   = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${proto}://${host}`;
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    let imdbId = null;
    try {
        const tmdbData = await fetchSafely(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        imdbId = tmdbData.imdb_id;
    } catch (e) {
        return res.json({ success: false, error: 'Failed to fetch IMDB ID: ' + e.message });
    }
    if (!imdbId) return res.json({ success: false, error: 'No IMDB ID found for this title.' });

    const endpoints = buildEndpoints(imdbId, season, episode);
    const rawStreams = [];

    await Promise.all(endpoints.map(async (ep) => {
        const url = type === 'tv' ? ep.tvUrl : ep.movieUrl;
        try {
            const data = await fetchSafely(url);
            if (!data?.streams) return;

            for (const s of data.streams) {
                if (!s.url || s.url.startsWith('magnet:')) continue;
                rawStreams.push({
                    url: px(s.url),
                    quality: detectQuality(s),
                    language: detectLanguage(s, ep.name),
                    source: ep.name,
                    type: s.url.includes('.m3u8') ? 'hls' : 'mp4',
                    rawName: (s.name || s.title || '').replace(/\n/g, ' ').trim().slice(0, 80),
                });
            }
        } catch (_) {}
    }));

    const buckets = new Map();
    for (const s of rawStreams) {
        const key = `${s.language}|${s.quality}`;
        const ex = buckets.get(key);
        if (!ex) { buckets.set(key, s); continue; }

        const newHls = s.type === 'hls';
        const exHls = ex.type === 'hls';
        const newPri = SOURCE_PRIORITY[s.source] || 99;
        const exPri = SOURCE_PRIORITY[ex.source] || 99;

        if ((newHls && !exHls) || (newHls === exHls && newPri < exPri)) {
            buckets.set(key, s);
        }
    }

    const deduped = Array.from(buckets.values());

    deduped.sort((a, b) => {
        const la = LANGUAGE_PRIORITY.indexOf(a.language);
        const lb = LANGUAGE_PRIORITY.indexOf(b.language);
        const langDiff = (la === -1 ? 999 : la) - (lb === -1 ? 999 : lb);
        if (langDiff !== 0) return langDiff;
        return (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0);
    });

    if (deduped.length > 0) {
        return res.json({ success: true, count: deduped.length, imdbId, streams: deduped, subtitles: [], audioTracks: [] });
    }

    return res.json({ success: false, imdbId, error: 'No playable streams found from any source.' });
};
