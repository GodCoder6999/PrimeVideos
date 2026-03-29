// api/get-stream.js
// Tries multiple reliable stream sources in parallel.
// Returns the first working .m3u8 or direct video URL found.
// Sources are chosen because they work without JS execution in a serverless env.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
function get(rawUrl, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': `${parsed.protocol}//${parsed.hostname}`,
        'Referer': `${parsed.protocol}//${parsed.hostname}/`,
        ...headers,
      },
    }, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
        return get(loc, headers, timeoutMs).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf-8'), status: res.statusCode, headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── Extract m3u8 URLs from HTML/JS ────────────────────────────────────────────
function extractM3u8(text) {
  const patterns = [
    /https?:\/\/[^\s"'\\<>]+\.m3u8[^\s"'\\<>]*/g,
    /"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
    /'file'\s*:\s*'(https?:\/\/[^']+\.m3u8[^']*)'/g,
    /src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/g,
    /hls\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/g,
    /"url"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const u = (m[1] || m[0]).replace(/\\/g, '').trim();
      if (u.includes('.m3u8') && u.startsWith('http') && !u.includes('example')) {
        found.add(u);
      }
    }
  }
  const all = [...found];
  // Prefer non-audio/subtitle playlists
  return all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

// ── TMDB helpers ─────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const r = await get(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
    return JSON.parse(r.body).imdb_id || null;
  } catch (_) { return null; }
}

async function getTmdbDetails(tmdbId, mediaType) {
  try {
    const r = await get(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
    return JSON.parse(r.body);
  } catch (_) { return null; }
}

// ── Source extractors ─────────────────────────────────────────────────────────

// 1. vidfast.pro — reliable, returns m3u8 directly from their API
async function tryVidfast(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const bases = ['https://vidfast.pro', 'https://vidfast.cc'];
    for (const base of bases) {
      try {
        const path = mediaType === 'tv'
          ? `${base}/tv/${tmdbId}/${season}/${episode}`
          : `${base}/movie/${tmdbId}`;

        const r = await get(path, { Referer: base + '/' });
        if (r.status !== 200) continue;
        const m3u8 = extractM3u8(r.body);
        if (m3u8) return { m3u8, name: 'vidfast' };

        // Try their JSON API endpoint
        const apiPath = mediaType === 'tv'
          ? `${base}/api/stream?id=${tmdbId}&s=${season}&e=${episode}&type=tv`
          : `${base}/api/stream?id=${tmdbId}&type=movie`;
        const apiR = await get(apiPath, { Referer: base + '/' });
        const json = JSON.parse(apiR.body);
        const url  = json?.url || json?.stream || json?.hls;
        if (url && url.includes('.m3u8')) return { m3u8: url, name: 'vidfast' };
      } catch (_) { continue; }
    }
  } catch (_) {}
  return null;
}

// 2. 2embed.cc — very reliable, pure server-side, returns m3u8
async function try2Embed(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const baseId = imdbId || tmdbId;
    const url = mediaType === 'tv'
      ? `https://www.2embed.cc/embedtv/${baseId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${baseId}`;

    const r = await get(url, { Referer: 'https://www.2embed.cc/' });
    if (r.status !== 200) return null;

    // Try direct extraction
    const direct = extractM3u8(r.body);
    if (direct) return { m3u8: direct, name: '2embed' };

    // Look for iframe src pointing to a sub-player
    const iframeSrc = r.body.match(/iframe[^>]+src=["']([^"']+)["']/i)?.[1];
    if (iframeSrc) {
      const subUrl = iframeSrc.startsWith('http') ? iframeSrc : 'https://www.2embed.cc' + iframeSrc;
      const subR = await get(subUrl, { Referer: 'https://www.2embed.cc/' });
      const sub  = extractM3u8(subR.body);
      if (sub) return { m3u8: sub, name: '2embed' };
    }
  } catch (_) {}
  return null;
}

// 3. vidsrc.me — server-side scraping of their embed
async function tryVidsrcMe(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const id = imdbId || tmdbId;
    const url = mediaType === 'tv'
      ? `https://vidsrc.me/embed/tv?imdb=${id}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?imdb=${id}`;

    const r = await get(url, { Referer: 'https://vidsrc.me/' });
    if (r.status !== 200) return null;
    const m3u8 = extractM3u8(r.body);
    if (m3u8) return { m3u8, name: 'vidsrc.me' };

    // Check for encoded sources in script tags
    const scripts = [...r.body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const [, script] of scripts) {
      const atobMatches = [...script.matchAll(/atob\(['"]([A-Za-z0-9+/=]+)['"]\)/g)];
      for (const [, encoded] of atobMatches) {
        try {
          const decoded = Buffer.from(encoded, 'base64').toString();
          const found = extractM3u8(decoded);
          if (found) return { m3u8: found, name: 'vidsrc.me' };
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null;
}

// 4. superembed.stream — reliable embed with direct m3u8
async function trySuperEmbed(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const id = tmdbId;
    const url = mediaType === 'tv'
      ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
      : `https://multiembed.mov/?video_id=${id}&tmdb=1`;

    const r = await get(url, { Referer: 'https://multiembed.mov/' });
    if (r.status !== 200) return null;
    const m3u8 = extractM3u8(r.body);
    if (m3u8) return { m3u8, name: 'multiembed' };
  } catch (_) {}
  return null;
}

// 5. autoembed.cc — tmdb-native, often works without imdb id
async function tryAutoEmbed(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`;

    const r = await get(url, { Referer: 'https://autoembed.cc/' });
    if (r.status !== 200) return null;
    const m3u8 = extractM3u8(r.body);
    if (m3u8) return { m3u8, name: 'autoembed' };
  } catch (_) {}
  return null;
}

// 6. embed.su — checks config endpoint for sources array
async function tryEmbedSu(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`;

    const r = await get(url, { Referer: 'https://embed.su/' });
    if (r.status !== 200) return null;

    const direct = extractM3u8(r.body);
    if (direct) return { m3u8: direct, name: 'embed.su' };

    const hashMatch = r.body.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (hashMatch) {
      const configR = await get(`https://embed.su/api/e/${hashMatch[1]}`, { Referer: url });
      const parsed  = JSON.parse(configR.body);
      const sources = parsed?.sources || parsed?.stream || [];
      for (const s of (Array.isArray(sources) ? sources : [])) {
        if (s.file?.includes('.m3u8')) return { m3u8: s.file, name: 'embed.su' };
        if (s.url?.includes('.m3u8'))  return { m3u8: s.url,  name: 'embed.su' };
      }
      const fromJson = extractM3u8(JSON.stringify(parsed));
      if (fromJson) return { m3u8: fromJson, name: 'embed.su' };
    }
  } catch (_) {}
  return null;
}

// 7. moviesapi.club
async function tryMoviesApi(tmdbId, imdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;
    const r = await get(url, { Referer: 'https://moviesapi.club/' });
    if (r.status !== 200) return null;
    const m3u8 = extractM3u8(r.body);
    if (m3u8) return { m3u8, name: 'moviesapi' };
  } catch (_) {}
  return null;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, mediaType = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'Missing tmdbId' }));
  }

  const s = Number(season)  || 1;
  const e = Number(episode) || 1;

  // Fetch IMDB ID in parallel — some extractors need it, some don't
  const imdbPromise = getImdbId(tmdbId, mediaType);

  // Fire all extractors that don't need IMDB ID immediately
  const noImdbExtractors = [
    tryVidfast(tmdbId, null, mediaType, s, e),
    tryAutoEmbed(tmdbId, null, mediaType, s, e),
    trySuperEmbed(tmdbId, null, mediaType, s, e),
    tryEmbedSu(tmdbId, null, mediaType, s, e),
    tryMoviesApi(tmdbId, null, mediaType, s, e),
  ];

  // Queue IMDB-dependent extractors once we have the ID
  const imdbExtractors = imdbPromise.then(imdbId => {
    if (!imdbId) return [];
    return [
      try2Embed(tmdbId, imdbId, mediaType, s, e),
      tryVidsrcMe(tmdbId, imdbId, mediaType, s, e),
      tryVidfast(tmdbId, imdbId, mediaType, s, e),
      tryAutoEmbed(tmdbId, imdbId, mediaType, s, e),
    ];
  });

  // Race: return the FIRST extractor that succeeds
  const winner = await new Promise((resolve) => {
    let pending   = 0;
    let resolved  = false;

    const tryResolve = (result) => {
      if (resolved) return;
      if (result?.m3u8) {
        resolved = true;
        resolve(result);
        return;
      }
      pending--;
      if (pending <= 0 && !resolved) resolve(null);
    };

    const addExtractors = (list) => {
      pending += list.length;
      if (list.length === 0 && pending <= 0 && !resolved) resolve(null);
      list.forEach(p =>
        Promise.resolve(p)
          .then(tryResolve)
          .catch(() => { pending--; if (pending <= 0 && !resolved) resolve(null); })
      );
    };

    addExtractors(noImdbExtractors);
    imdbExtractors.then(list => {
      if (list.length) addExtractors(list);
      else if (pending <= 0 && !resolved) resolve(null);
    });

    // Safety timeout after 12s
    setTimeout(() => { if (!resolved) resolve(null); }, 12000);
  });

  const imdbId = await imdbPromise.catch(() => null);

  if (winner?.m3u8) {
    return res.end(JSON.stringify({
      success:   true,
      provider:  winner.name,
      streamUrl: winner.m3u8,
      imdbId,
    }));
  }

  // No extractor found a stream — tell the frontend to use multi-stream fallback
  return res.end(JSON.stringify({
    success: false,
    imdbId,
    error:   'No stream found via server-side extraction',
  }));
};
