// api/multi-stream.js
// Optimized for Indian language streams — Hindi, Tamil, Telugu, Bengali
// Primary source: Nuvio (MoviesMod). Secondary: Superflix, JaMovies, EpicStream.

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// ── Fetch with proxy fallback ─────────────────────────────────────────────
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

// ── Language detection ────────────────────────────────────────────────────
// MoviesMod stream names come in many formats. Examples seen in the wild:
//   "🎬 MoviesMod\n💿 1080p\n🌐 Hindi"
//   "[MoviesMod] Hindi 1080p"
//   "1080p | Hindi + English"
//   "Dual Audio [Hindi + English] 1080p"
//   "Tamil 720p HDRip"
//   "Multi Audio 4K"
//   "1080p"  ← no language info at all (MoviesMod default = Hindi)
//
// Strategy:
//   1. Flatten all text fields into one lowercase string
//   2. Check multi/dual first (most specific)
//   3. Collect every individual language found
//   4. If 0 found AND source is MoviesMod → default to Hindi (their specialty)
//   5. If 0 found AND other source → default to English

function detectLanguage(streamObj, sourceName) {
    const fields = [
        streamObj.name        || '',
        streamObj.title       || '',
        streamObj.description || '',
        streamObj.behaviorHints?.filename   || '',
        streamObj.behaviorHints?.bingeGroup || '',
    ];
    const raw = fields.join(' ').toLowerCase();

    // Multi / Dual first (most specific)
    if (/\b(?:multi[\s\-]?audio|multi[\s\-]?lang(?:uage)?|multilingual)\b/.test(raw)) {
        return 'Multi Audio';
    }
    if (/\b(?:dual[\s\-]?audio|dual[\s\-]?lang(?:uage)?)\b/.test(raw)) {
        return 'Dual Audio';
    }

    // Individual language patterns
    const LANG_PATTERNS = [
        ['Hindi',     /\b(?:hindi|hin)\b/],
        ['Tamil',     /\b(?:tamil|tam)\b/],
        ['Telugu',    /\b(?:telugu|tel)\b/],
        ['Bengali',   /\b(?:bengali|bangla|ben)\b/],
        ['Malayalam', /\b(?:malayalam|mal)\b/],
        ['Kannada',   /\b(?:kannada|kan)\b/],
        ['Marathi',   /\b(?:marathi|mar)\b/],
        ['Punjabi',   /\b(?:punjabi|pun)\b/],
        ['English',   /\b(?:english|eng)\b/],
    ];

    const found = LANG_PATTERNS
        .filter(([, re]) => re.test(raw))
        .map(([lang]) => lang);

    if (found.length >= 3)  return 'Multi Audio';
    if (found.length === 2) return `${found[0]} + ${found[1]}`;
    if (found.length === 1) return found[0];

    // No keyword found — source heuristic
    // MoviesMod almost exclusively provides Hindi / Dual Audio content
    const src = sourceName.toLowerCase();
    if (src.includes('moviesmod') || src.includes('nuvio')) return 'Hindi';
    return 'English';
}

function detectQuality(streamObj) {
    const fields = [
        streamObj.name        || '',
        streamObj.title       || '',
        streamObj.description || '',
        streamObj.behaviorHints?.filename || '',
    ];
    const raw = fields.join(' ').toLowerCase();

    if (/\b(?:2160p?|4k|uhd)\b/.test(raw))  return '4K';
    if (/\b1080p?\b/.test(raw))              return '1080p';
    if (/\b720p?\b/.test(raw))               return '720p';
    if (/\b480p?\b/.test(raw))               return '480p';
    return 'Auto';
}

// ── Stremio addon endpoints ───────────────────────────────────────────────
function buildEndpoints(imdbId, season, episode) {
    const s = season || 1;
    const e = episode || 1;
    return [
        {
            name:     'Nuvio (MoviesMod)',
            movieUrl: `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`,
            tvUrl:    `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'Superflix',
            movieUrl: `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`,
            tvUrl:    `https://stremio-addon.superflix.to/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'JaMovies',
            movieUrl: `https://jamovies.baby/stream/movie/${imdbId}.json`,
            tvUrl:    `https://jamovies.baby/stream/series/${imdbId}:${s}:${e}.json`,
        },
        {
            name:     'EpicStream',
            movieUrl: `https://epics.top/stream/movie/${imdbId}.json`,
            tvUrl:    `https://epics.top/stream/series/${imdbId}:${s}:${e}.json`,
        },
    ];
}

// ── Priority tables ───────────────────────────────────────────────────────
const QUALITY_RANK = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, 'Auto': 1 };

// Indian languages first, then combos, then English last
const LANGUAGE_PRIORITY = [
    'Multi Audio', 'Dual Audio',
    'Hindi', 'Tamil', 'Telugu', 'Bengali',
    'Malayalam', 'Kannada', 'Marathi', 'Punjabi',
    'Hindi + English', 'Tamil + English', 'Telugu + English', 'Bengali + English',
    'English',
];

const SOURCE_PRIORITY = {
    'Nuvio (MoviesMod)': 1,
    'Superflix':         2,
    'JaMovies':          3,
    'EpicStream':        4,
};

// ── Main handler ──────────────────────────────────────────────────────────
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

    // 1. Resolve IMDB ID
    let imdbId = null;
    try {
        const tmdbData = await fetchSafely(
            `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
        );
        imdbId = tmdbData.imdb_id;
    } catch (e) {
        return res.json({ success: false, error: 'Failed to fetch IMDB ID: ' + e.message });
    }
    if (!imdbId) return res.json({ success: false, error: 'No IMDB ID found for this title.' });

    // 2. Scrape all endpoints in parallel
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
                    url:      px(s.url),
                    quality:  detectQuality(s),
                    language: detectLanguage(s, ep.name),
                    source:   ep.name,
                    type:     s.url.includes('.m3u8') ? 'hls' : 'mp4',
                    rawName:  (s.name || s.title || '').replace(/\n/g, ' ').trim().slice(0, 80),
                });
            }
        } catch (_) { /* endpoint unavailable — skip silently */ }
    }));

    // 3. De-duplicate: best stream per (language × quality)
    // Best = HLS over MP4, then lower source priority number wins
    const buckets = new Map();

    for (const s of rawStreams) {
        const key = `${s.language}|${s.quality}`;
        const ex  = buckets.get(key);
        if (!ex) { buckets.set(key, s); continue; }

        const newHls = s.type === 'hls';
        const exHls  = ex.type === 'hls';
        const newPri = SOURCE_PRIORITY[s.source]  || 99;
        const exPri  = SOURCE_PRIORITY[ex.source] || 99;

        if ((newHls && !exHls) || (newHls === exHls && newPri < exPri)) {
            buckets.set(key, s);
        }
    }

    const deduped = Array.from(buckets.values());

    // 4. Sort: language priority first, then quality descending
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
