// api/multi-stream.js
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// Helper to add a timeout to native fetch so Vercel never hangs
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
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
    
    // Proxy wrapper
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    let imdbId = null;
    const logs = [];
    const streams = [];
    const subtitles = [];

    // ─── STEP 1: Fetch IMDB ID (Required for Stremio Addons) ───
    try {
        const imdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        const imdbData = await imdbRes.json();
        imdbId = imdbData.imdb_id;
    } catch (e) {
        logs.push(`TMDB Error: ${e.message}`);
    }

    // ─── STEP 2: Scrape Embed.su ───
    try {
        const esuUrl = type === 'tv' ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` : `https://embed.su/embed/movie/${tmdbId}`;
        const esuRes = await fetchWithTimeout(esuUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
        
        if (!esuRes.ok) throw new Error(`HTTP ${esuRes.status}`);
        const esuHtml = await esuRes.text();
        
        const hashMatch = esuHtml.match(/\/api\/e\/([a-zA-Z0-9]+)/);
        if (hashMatch) {
            const apiRes = await fetchWithTimeout(`https://embed.su/api/e/${hashMatch[1]}`, {
                headers: { 'Referer': esuUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const apiData = await apiRes.json();
            
            if (apiData.source) streams.push({ url: px(apiData.source), quality: 'Auto', source: 'EmbedSU', type: 'hls' });
            if (apiData.sources) apiData.sources.forEach(s => {
                if (s.file) streams.push({ url: px(s.file), quality: s.label || 'Auto', source: 'EmbedSU', type: s.file.includes('.mp4') ? 'mp4' : 'hls' });
            });
            if (apiData.subtitles) apiData.subtitles.forEach(sub => {
                if (sub.file) subtitles.push({ url: px(sub.file), lang: sub.label || 'Unknown' });
            });
        } else {
            logs.push('EmbedSU: Hash bypassed or missing');
        }
    } catch (e) {
        logs.push(`EmbedSU: ${e.message}`);
    }

    // ─── STEP 3: Scrape Superflix (Stremio HTTP Addon) ───
    if (imdbId) {
        try {
            const sfUrl = type === 'tv' 
                ? `https://stremio-addon.superflix.to/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`;
            const sfRes = await fetchWithTimeout(sfUrl);
            if (!sfRes.ok) throw new Error(`HTTP ${sfRes.status}`);
            const sfData = await sfRes.json();
            
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
    } else {
        logs.push('Superflix: Skipped (No IMDB ID)');
    }

    // ─── STEP 4: Scrape JaMovies (Stremio HTTP Addon) ───
    if (imdbId) {
        try {
            const jmUrl = type === 'tv' 
                ? `https://jamovies.baby/stream/series/${imdbId}:${season}:${episode}.json` 
                : `https://jamovies.baby/stream/movie/${imdbId}.json`;
            const jmRes = await fetchWithTimeout(jmUrl);
            if (!jmRes.ok) throw new Error(`HTTP ${jmRes.status}`);
            const jmData = await jmRes.json();
            
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
            audioTracks: [] // MP4/Stremio audio defaults to browser muxer
        });
    }

    // If ALL streams failed, output exactly why so it renders on the UI
    return res.json({
        success: false,
        error: `Debug Logs: [ ${logs.join(' | ')} ]`
    });
};
