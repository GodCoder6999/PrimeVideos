// api/multi-stream.js
const https = require('https');
const http = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Promisified native fetch to bypass Axios WAF blocks
function fetchText(url, extraHeaders = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(url); } catch(e) { return reject(e); }
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: { 'User-Agent': UA, 'Accept': '*/*', ...extraHeaders },
        };
        const req = lib.request(options, (res) => {
            if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
                let loc = res.headers.location;
                if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
                return fetchText(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
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

// Fetch IMDB ID since some providers require it
async function getImdbId(tmdbId, mediaType) {
    try {
        const data = await fetchText(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        return JSON.parse(data).imdb_id || null;
    } catch (_) { return null; }
}

// Extractor 1: Embed.su (Very reliable, multi-quality + subs)
async function extractEmbedSu(tmdbId, mediaType, season, episode) {
    const url = mediaType === 'tv' ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` : `https://embed.su/embed/movie/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://embed.su/' });
    
    const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (!hashMatch) throw new Error('Embed.su hash not found');
    
    const configJson = await fetchText(`https://embed.su/api/e/${hashMatch[1]}`, { Referer: url });
    const data = JSON.parse(configJson);
    
    const streams = [];
    const subtitles = [];
    
    if (data.source) streams.push({ url: data.source, quality: 'Auto', type: 'hls' });
    if (data.sources) data.sources.forEach(s => {
        if (s.file) streams.push({ url: s.file, quality: s.label || 'Auto', type: s.file.includes('.mp4') ? 'mp4' : 'hls' });
    });
    
    if (data.subtitles) data.subtitles.forEach(sub => {
        if (sub.file) subtitles.push({ url: sub.file, lang: sub.label || 'Unknown' });
    });
    
    if (streams.length > 0) return { source: 'EmbedSU', streams, subtitles };
    throw new Error('EmbedSU no streams');
}

// Extractor 2: VidSrc (xyz / in) via base64 brute force
async function extractVidsrc(domain, tmdbId, imdbId, mediaType, season, episode) {
    const url = imdbId
      ? (mediaType === 'tv' ? `https://${domain}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}` : `https://${domain}/embed/movie?imdb=${imdbId}`)
      : (mediaType === 'tv' ? `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` : `https://${domain}/embed/movie?tmdb=${tmdbId}`);
    const html = await fetchText(url, { Referer: `https://${domain}/` });
    
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = scriptRe.exec(html)) !== null) {
      const atobRe = /atob\(["']([^"']+)["']\)/g;
      let am;
      while ((am = atobRe.exec(sm[1])) !== null) {
        try {
          const decoded = Buffer.from(am[1], 'base64').toString('utf-8');
          const m3u8Match = decoded.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
          if (m3u8Match) {
              return {
                  source: `VidSrc (${domain})`,
                  streams: [{ url: m3u8Match[0], quality: 'Auto', type: 'hls' }],
                  subtitles: []
              };
          }
        } catch (_) {}
      }
    }
    throw new Error(`Vidsrc (${domain}) extraction failed`);
}

// Extractor 3: HTTP Stremio Addons (Superflix / JaMovies)
async function extractStremioAddon(addonUrl, imdbId, mediaType, season, episode) {
    if (!imdbId) throw new Error('IMDB ID required for Stremio addon');
    const path = mediaType === 'tv' 
        ? `${addonUrl}/stream/series/${imdbId}:${season}:${episode}.json`
        : `${addonUrl}/stream/movie/${imdbId}.json`;
    
    const json = JSON.parse(await fetchText(path));
    const streams = [];
    if (json.streams) {
        json.streams.forEach(s => {
            if (s.url && (s.url.includes('.m3u8') || s.url.includes('.mp4') || s.url.includes('stream'))) {
                let q = 'Auto';
                const name = (s.name || s.title || '').toLowerCase();
                if (name.includes('1080')) q = '1080p';
                else if (name.includes('720')) q = '720p';
                else if (name.includes('4k') || name.includes('2160')) q = '4K';
                streams.push({ url: s.url, quality: q, type: s.url.includes('.m3u8') ? 'hls' : 'mp4' });
            }
        });
    }
    if (streams.length > 0) return { source: new URL(addonUrl).hostname, streams, subtitles: [] };
    throw new Error(`No streams in addon ${addonUrl}`);
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

    try {
        const imdbId = await getImdbId(tmdbId, type);

        // Run all extractors concurrently
        const promises = [
            extractEmbedSu(tmdbId, type, season, episode),
            extractVidsrc('vidsrc.xyz', tmdbId, imdbId, type, season, episode),
            extractVidsrc('vidsrc.in', tmdbId, imdbId, type, season, episode),
            extractStremioAddon('https://stremio-addon.superflix.to', imdbId, type, season, episode),
            extractStremioAddon('https://jamovies.baby', imdbId, type, season, episode)
        ];

        // Promise.any instantly resolves as soon as the FIRST successful stream is found
        const result = await Promise.any(promises);

        // Format streams natively through your proxy to avoid CORS
        const formattedStreams = result.streams.map(s => ({
            ...s,
            url: px(s.url)
        }));
        
        const formattedSubtitles = (result.subtitles || []).map(s => ({
            ...s,
            url: px(s.url)
        }));

        return res.json({
            success: true,
            count: formattedStreams.length,
            streams: formattedStreams,
            subtitles: formattedSubtitles,
            audioTracks: [] 
        });

    } catch (error) {
        console.error('[Master Extractor Error]', error.message);
        return res.status(500).json({ success: false, error: 'All stream providers failed or timed out.' });
    }
};
