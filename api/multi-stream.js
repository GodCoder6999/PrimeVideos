// api/multi-stream.js
// Primary source: moviesapi.club — returns HLS streams with multiple audio tracks (Hindi, English, etc.)
// Fallback sources: vidsrc.xyz, vixsrc.to, mediafusion

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 10000;
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL')); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  Object.assign({
        'User-Agent': UA,
        'Accept':     'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, extraHeaders),
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = url.protocol + '//' + url.host + loc;
        return nodeGet(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function safe(p) { return p.catch(() => null); }

function getImdbId(tmdbId, mediaType) {
  return nodeGet(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
    {}, 5000
  ).then(raw => JSON.parse(raw).imdb_id || null).catch(() => null);
}

// ── Extract m3u8 URLs from HTML ───────────────────────────────────────────────
function extractM3u8(html) {
  const patterns = [
    /https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g,
    /file:\s*["']([^"']+\.m3u8[^"']*)/g,
    /src:\s*["']([^"']+\.m3u8[^"']*)/g,
    /"hls"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
    /["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(html)) !== null) {
      const u = (m[1] || m[0]).trim().replace(/\\/g, '');
      if (u.includes('.m3u8') && u.startsWith('http') && !u.includes('example'))
        found.add(u);
    }
  }
  // Prefer non-audio/subtitle streams
  const all = [...found];
  return all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

// ════════════════════════════════════════════════════════════
// SOURCE 1: moviesapi.club  ← PRIMARY — has multi-audio HLS
// Returns an m3u8 that contains Hindi + English audio tracks
// ════════════════════════════════════════════════════════════
async function fetchMoviesApi(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;

    const html = await nodeGet(url, { 'Referer': 'https://moviesapi.club/' }, 10000);

    // moviesapi.club embeds a JWPlayer/HLS stream — extract m3u8 from page
    let m3u8 = extractM3u8(html);

    // If not in HTML directly, look for API/config endpoint
    if (!m3u8) {
      const apiMatch = html.match(/(?:sources|file|hls)\s*[:=]\s*["']?(https?:\/\/[^"'\s,]+)/i);
      if (apiMatch) m3u8 = apiMatch[1];
    }

    // Also try scraping the JSON config embedded in script tags
    if (!m3u8) {
      const jsonMatch = html.match(/(?:setup|player\.load)\s*\(\s*(\{[\s\S]+?\})\s*\)/);
      if (jsonMatch) {
        try {
          const cfg = JSON.parse(jsonMatch[1].replace(/'/g, '"'));
          const src = cfg.file || (Array.isArray(cfg.sources) && cfg.sources[0]?.file);
          if (src && src.includes('.m3u8')) m3u8 = src;
        } catch (_) {}
      }
    }

    if (m3u8) {
      return [{ url: m3u8, quality: 'Auto', provider: 'MoviesAPI' }];
    }
    return [];
  } catch (_) { return []; }
}

// ════════════════════════════════════════════════════════════
// SOURCE 2: vidsrc.xyz — fallback, scrapes embed for m3u8
// ════════════════════════════════════════════════════════════
async function fetchVidSrc(tmdbId, imdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const urls = [];
  if (imdbId) urls.push(tv ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}` : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`);
  urls.push(tv ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`);

  for (const url of urls) {
    try {
      const html = await nodeGet(url, { 'Referer': 'https://vidsrc.xyz/' }, 8000);
      const m3u8 = extractM3u8(html);
      if (m3u8) return [{ url: m3u8, quality: 'Auto', provider: 'VidSrc' }];
      // try atob decode
      const atobRe = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
      let am;
      while ((am = atobRe.exec(html)) !== null) {
        try {
          const decoded = Buffer.from(am[1], 'base64').toString('utf-8');
          const u = extractM3u8(decoded);
          if (u) return [{ url: u, quality: 'Auto', provider: 'VidSrc' }];
        } catch (_) {}
      }
    } catch (_) {}
  }
  return [];
}

// ════════════════════════════════════════════════════════════
// SOURCE 3: vixsrc.to — fallback direct API
// ════════════════════════════════════════════════════════════
async function fetchVixSrc(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://vixsrc.to/api/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
      : `https://vixsrc.to/api/movie?tmdb=${tmdbId}`;
    const raw  = await nodeGet(url, { 'Referer': 'https://vixsrc.to/' }, 8000);
    const data = JSON.parse(raw);
    const arr  = data.streams || data.sources || [];
    return arr
      .filter(s => (s.url || s.file || '').startsWith('http'))
      .map(s => ({ url: s.url || s.file, quality: 'Auto', provider: 'VixSrc' }));
  } catch (_) { return []; }
}

// ════════════════════════════════════════════════════════════
// SOURCE 4: MediaFusion (Stremio) — fallback, good multi-audio
// ════════════════════════════════════════════════════════════
async function fetchMediaFusion(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const url = mediaType === 'tv'
      ? `https://mediafusion.elfhosted.com/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://mediafusion.elfhosted.com/stream/movie/${imdbId}.json`;
    const raw  = await nodeGet(url, {}, 12000);
    const data = JSON.parse(raw);
    return (data.streams || [])
      .filter(s => s.url && s.url.startsWith('http') && (s.url.includes('.m3u8') || s.url.includes('.mp4')))
      .map(s => ({ url: s.url, quality: 'Auto', provider: 'MediaFusion' }));
  } catch (_) { return []; }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type, season = '1', episode = '1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
  }

  const imdbId = await safe(getImdbId(tmdbId, mediaType));

  // Fire all in parallel — moviesapi.club first in the results array so player picks it first
  const [moviesApi, vidSrc, vixSrc, mediaFusion] = await Promise.all([
    safe(fetchMoviesApi(tmdbId, mediaType, season, episode)) .then(r => r || []),
    safe(fetchVidSrc(tmdbId, imdbId, mediaType, season, episode)).then(r => r || []),
    safe(fetchVixSrc(tmdbId, mediaType, season, episode))        .then(r => r || []),
    safe(fetchMediaFusion(imdbId, mediaType, season, episode))   .then(r => r || []),
  ]);

  // moviesapi.club streams come FIRST so the player uses them as primary
  const all = [...moviesApi, ...vidSrc, ...vixSrc, ...mediaFusion];

  // Deduplicate by URL
  const seen = new Set();
  const unique = all.filter(s => {
    if (!s?.url || seen.has(s.url)) return false;
    seen.add(s.url); return true;
  });

  if (unique.length === 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found' }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId || null,
    streams: unique.slice(0, 6).map(s => ({
      url:      s.url,
      quality:  s.quality || 'Auto',
      lang:     'Multi', // moviesapi.club streams contain multiple audio tracks inside the HLS manifest
      provider: s.provider,
    })),
  }));
};
