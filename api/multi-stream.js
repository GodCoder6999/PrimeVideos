// api/multi-stream.js
const https = require('https');
const http = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// Native HTTPS wrapper — highly reliable on Vercel (bypasses Node 18 fetch failures)
function fetchUrl(targetUrl, extraHeaders = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(targetUrl); } catch (e) { return reject(e); }
        
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*',
                ...extraHeaders
            }
        };

        const req = lib.request(options, (res) => {
            // Handle redirects
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                let loc = res.headers.location;
                if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
                return fetchUrl(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
            }
            // Reject bad status codes
            if (res.statusCode < 200 || res.statusCode >= 400) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

module.exports = async function handler(req, res) {
    // CORS configuration
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

    // ─── STEP 1: Fetch IMDB ID ───
    try {
        const imdbRes = await fetchUrl(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        imdbId = JSON.parse(imdbRes).imdb_id;
    } catch (e) {
        logs.push(`TMDB: ${e.message}`);
    }

    // ─── STEP 2: Scrape Embed.su ───
    try {
        const esuUrl = type === 'tv' ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` : `https://embed.su/embed/movie/${tmdbId}`;
        const esuHtml = await fetchUrl(esuUrl);
        
        const hashMatch = esuHtml.match(/\/api\/e\/([a-zA-Z0-9]+)/);
        if (hashMatch) {
            const apiDataRaw = await fetchUrl(`https://embed.su/api/e/${hashMatch[1]}`, { 'Referer': esuUrl });
            const apiData = JSON.parse(apiDataRaw);
            
            if (apiData.source) streams.push({ url: px(apiData.source), quality: 'Auto', source: 'EmbedSU', type: 'hls' });
            if (apiData.sources) apiData.sources.forEach(s => {
                if (s.file) streams.push({ url: px(s.file), quality: s.label || 'Auto', source: 'EmbedSU', type: s.file.includes('.mp4') ? 'mp4' : 'hls' });
            });
            if (apiData.subtitles) apiData.subtitles.forEach(sub => {
                if (sub.file) subtitles.push({ url: px(sub.file), lang: sub.label || 'Unknown' });
            });
        } else {
            logs.push('EmbedSU: Hash not found');
        }
    } catch (e) {
        logs.push(`EmbedSU: ${e.message}`);
    }

    // ─── STEP 3: Scrape Superflix ───
    if (imdbId) {
        try {
            const sfUrl = type === 'tv' 
                ? `https://stremio-addon.superflix.to/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`;
            
            const sfData = JSON.parse(await fetchUrl(sfUrl));
            if (sfData.streams) {
                sfData.streams.forEach(s => {
                    if (s.url && !s.url.includes('magnet')) {
                        let quality = 'Auto';
                        if (s.name && s.name.includes('1080')) quality = '1080p';
                        if (s.name && s.name.includes('720')) quality = '720p';
                        streams.push({ url: px(s.url), quality, source: 'Superflix', type: s.url.includes('.m3u8') ? 'hls' : 'mp4' });
                    }
                });
            }
        } catch (e) {
            logs.push(`Superflix: ${e.message}`);
        }
    }

    // ─── STEP 4: Scrape JaMovies ───
    if (imdbId) {
        try {
            const jmUrl = type === 'tv' 
                ? `https://jamovies.baby/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://jamovies.baby/stream/movie/${imdbId}.json`;
            
            const jmData = JSON.parse(await fetchUrl(jmUrl));
            if (jmData.streams) {
                jmData.streams.forEach(s => {
                    if (s.url && !s.url.includes('magnet')) {
                        streams.push({ url: px(s.url), quality: s.description || 'Auto', source: 'JaMovies', type: s.url.includes('.m3u8') ? 'hls' : 'mp4' });
                    }
                });
            }
        } catch (e) {
            logs.push(`JaMovies: ${e.message}`);
        }
    }

    // ─── STEP 5: Return Payload ───
    if (streams.length > 0) {
        return res.json({
            success: true,
            count: streams.length,
            streams: streams,
            subtitles: subtitles,
            audioTracks: []
        });
    }

    // Output debug logs if all fail
    return res.json({
        success: false,
        error: `Debug Logs: [ ${logs.join(' | ')} ]`
    });
};
