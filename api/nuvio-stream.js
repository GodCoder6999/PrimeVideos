// api/nuvio-stream.js — Vercel Serverless, CommonJS
// Calls NuvioStreams public API (+ SoaperTV, VidZee, MP4Hydra) server-side.
// No CORS issues. Returns first working direct stream URL.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── fetch helper ──────────────────────────────────────────────────────────────
function get(rawUrl, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'application/json, */*', 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
        return get(loc, headers, timeoutMs).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── TMDB → IMDB ──────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const data = JSON.parse(await get(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
    ));
    return data.imdb_id || null;
  } catch (_) { return null; }
}

// ── NuvioStreams Public API ───────────────────────────────────────────────────
// Stremio addon protocol: /stream/movie/{imdb}.json  or  /stream/series/{imdb}:{s}:{e}.json
async function fetchNuvioStreams(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

    const raw  = await get(path, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 12000);
    const data = JSON.parse(raw);
    const streams = (data.streams || []).filter(s =>
      s.url &&
      (s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv'))
    );
    return streams.map(s => ({
      url:      s.url,
      quality:  parseQuality(s.name || s.title || ''),
      provider: parseProvider(s.name || ''),
      type:     s.url.includes('.m3u8') ? 'hls' : 'mp4',
    }));
  } catch (e) {
    console.warn('[nuvio] fetchNuvioStreams error:', e.message);
    return [];
  }
}

// ── SoaperTV API ─────────────────────────────────────────────────────────────
async function fetchSoaperTV(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://soapertv.cc/api/source/${imdbId}?s=${season}&e=${episode}`
      : `https://soapertv.cc/api/source/${imdbId}`;
    const raw  = await get(path, { 'Referer': 'https://soapertv.cc/' }, 8000);
    const data = JSON.parse(raw);
    const files = data.data || [];
    return files
      .filter(f => f.file && f.file.startsWith('http'))
      .map(f => ({
        url:      f.file,
        quality:  f.label || 'Auto',
        provider: 'SoaperTV',
        type:     f.file.includes('.m3u8') ? 'hls' : 'mp4',
      }));
  } catch (_) { return []; }
}

// ── VidZee API ────────────────────────────────────────────────────────────────
async function fetchVidZee(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://vidzee.wtf/api/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `https://vidzee.wtf/api/movie?imdb=${imdbId}`;
    const raw  = await get(path, { 'Referer': 'https://vidzee.wtf/' }, 8000);
    const data = JSON.parse(raw);
    const streams = data.streams || data.sources || [];
    return streams
      .filter(s => (s.url || s.file || '').startsWith('http'))
      .map(s => ({
        url:      s.url || s.file,
        quality:  s.quality || s.label || 'Auto',
        provider: 'VidZee',
        type:     (s.url || s.file || '').includes('.m3u8') ? 'hls' : 'mp4',
      }));
  } catch (_) { return []; }
}

// ── MP4Hydra API ──────────────────────────────────────────────────────────────
async function fetchMP4Hydra(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://mp4hydra.org/tv/${imdbId}/${season}/${episode}`
      : `https://mp4hydra.org/movie/${imdbId}`;
    const raw  = await get(path, { 'Referer': 'https://mp4hydra.org/' }, 8000);
    const data = JSON.parse(raw);
    const streams = data.sources || data.streams || [];
    return streams
      .filter(s => (s.url || s.src || '').startsWith('http'))
      .map(s => ({
        url:      s.url || s.src,
        quality:  s.quality || s.label || 'Auto',
        provider: 'MP4Hydra',
        type:     (s.url || s.src || '').includes('.m3u8') ? 'hls' : 'mp4',
      }));
  } catch (_) { return []; }
}

// ── Vixsrc API ────────────────────────────────────────────────────────────────
async function fetchVixsrc(tmdbId, mediaType, season, episode) {
  try {
    const path = mediaType === 'tv'
      ? `https://vixsrc.to/api/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
      : `https://vixsrc.to/api/movie?tmdb=${tmdbId}`;
    const raw  = await get(path, { 'Referer': 'https://vixsrc.to/' }, 8000);
    const data = JSON.parse(raw);
    const streams = data.sources || data.streams || [];
    return streams
      .filter(s => (s.url || s.file || '').startsWith('http'))
      .map(s => ({
        url:      s.url || s.file,
        quality:  s.quality || s.label || 'Auto',
        provider: 'Vixsrc',
        type:     (s.url || s.file || '').includes('.m3u8') ? 'hls' : 'mp4',
      }));
  } catch (_) { return []; }
}

// ── VidSrc extractor (re-used from multi-stream) ──────────────────────────────
async function fetchVidSrc(tmdbId, imdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const candidates = [];
  if (imdbId) {
    candidates.push(tv
      ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`
    );
  }
  candidates.push(tv
    ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
    : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
  );

  const m3u8Re = /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g;

  for (const url of candidates) {
    try {
      const html = await get(url, { 'Referer': 'https://vidsrc.xyz/' }, 8000);
      let match;
      while ((match = m3u8Re.exec(html)) !== null) {
        const u = match[1];
        if (!u.includes('audio') && !u.includes('subtitle') && !u.includes('example')) {
          return [{ url: u, quality: 'Auto', provider: 'VidSrc', type: 'hls' }];
        }
      }
      // try base64 scripts
      const atobRe = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
      let am;
      while ((am = atobRe.exec(html)) !== null) {
        try {
          const decoded = Buffer.from(am[1], 'base64').toString('utf-8');
          const dm = /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/.exec(decoded);
          if (dm) return [{ url: dm[1], quality: 'Auto', provider: 'VidSrc', type: 'hls' }];
        } catch (_) {}
      }
    } catch (_) {}
  }
  return [];
}

// ── Quality / Provider parsers ────────────────────────────────────────────────
function parseQuality(str) {
  const s = str.toLowerCase();
  if (s.includes('2160') || s.includes('4k'))  return '4K';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  return 'Auto';
}
function parseProvider(str) {
  const m = str.match(/^([^|•\[]+)/);
  return m ? m[1].trim() : 'NuvioStreams';
}

// ── Quality sorter — prefer 1080p > 720p > 4K > 480p > Auto ─────────────────
function sortStreams(streams) {
  const rank = { '1080p': 5, '720p': 4, '4K': 3, '480p': 2, 'Auto': 1 };
  return [...streams].sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
  }

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const s = season;
  const e = episode;

  // Get IMDB ID first (many APIs need it)
  const imdbId = await getImdbId(tmdbId, mediaType);

  // Fire ALL providers in parallel — race for first result
  const allPromises = [
    fetchNuvioStreams(imdbId, mediaType, s, e),
    fetchSoaperTV(imdbId, mediaType, s, e),
    fetchVidZee(imdbId, mediaType, s, e),
    fetchMP4Hydra(imdbId, mediaType, s, e),
    fetchVixsrc(tmdbId, mediaType, s, e),
    fetchVidSrc(tmdbId, imdbId, mediaType, s, e),
  ];

  // Race: return as soon as any provider responds with streams
  const winner = await new Promise((resolve) => {
    let done = false;
    let pending = allPromises.length;
    let allStreams = [];

    allPromises.forEach(p =>
      p.then(streams => {
        pending--;
        if (streams.length > 0) {
          allStreams.push(...streams);
          // Resolve quickly when we have 1080p or have waited for half the providers
          const has1080 = allStreams.some(s => s.quality === '1080p');
          const hasManyProviders = allStreams.length >= 3;
          if (!done && (has1080 || hasManyProviders || pending === 0)) {
            done = true;
            resolve(sortStreams(allStreams));
          }
        } else if (pending === 0 && !done) {
          done = true;
          resolve(sortStreams(allStreams));
        }
      }).catch(() => {
        pending--;
        if (pending === 0 && !done) { done = true; resolve(sortStreams(allStreams)); }
      })
    );

    // Hard timeout at 11s
    setTimeout(() => { if (!done) { done = true; resolve(sortStreams(allStreams)); } }, 11000);
  });

  if (winner.length > 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      imdbId,
      // Send top 4 streams so client can try fallbacks
      streams: winner.slice(0, 4),
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ success: false, imdbId, error: 'No streams found' }));
};
