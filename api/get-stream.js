// api/get-stream.js — Vercel serverless, CommonJS
// ALL extractors fire in PARALLEL — returns the first m3u8 found.
// Typical time: 1-3s instead of 5-15s sequential.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── fetch helper ─────────────────────────────────────────────────────────────
function fetchText(url, extraHeaders = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...extraHeaders },
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

// ── m3u8 extractor ────────────────────────────────────────────────────────────
function extractM3u8(text) {
  const patterns = [
    /https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g,
    /file:\s*["']([^"']+\.m3u8[^"']*)/g,
    /src:\s*["']([^"']+\.m3u8[^"']*)/g,
    /"hls"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
    /["'](https?:\/\/[^"']+\/(?:index|master|playlist|hls)[^"']*\.m3u8[^"']*)/g,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const u = (m[1] || m[0]).trim().replace(/\\/g, '');
      if (u.includes('.m3u8') && !u.includes('example') && u.startsWith('http')) found.add(u);
    }
  }
  const all = [...found];
  return all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

// ── TMDB → IMDB ID ────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const data = await fetchText(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
    return JSON.parse(data).imdb_id || null;
  } catch (_) { return null; }
}

// ── SOURCES ───────────────────────────────────────────────────────────────────
async function tryVidsrcXyz(domain, tmdbId, imdbId, mediaType, season, episode) {
  try {
    const url = imdbId
      ? (mediaType === 'tv' ? `https://${domain}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}` : `https://${domain}/embed/movie?imdb=${imdbId}`)
      : (mediaType === 'tv' ? `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` : `https://${domain}/embed/movie?tmdb=${tmdbId}`);
    const html = await fetchText(url, { Referer: `https://${domain}/` });
    const direct = extractM3u8(html);
    if (direct) return { m3u8: direct, name: domain };
    // try atob decode
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = scriptRe.exec(html)) !== null) {
      const atobRe = /atob\(["']([^"']+)["']\)/g;
      let am;
      while ((am = atobRe.exec(sm[1])) !== null) {
        try {
          const decoded = Buffer.from(am[1], 'base64').toString('utf-8');
          const m3u8 = extractM3u8(decoded);
          if (m3u8) return { m3u8, name: domain };
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null;
}

async function tryEmbedSu(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://embed.su/' });
    const direct = extractM3u8(html);
    if (direct) return { m3u8: direct, name: 'embed.su' };
    const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (hashMatch) {
      const config = await fetchText(`https://embed.su/api/e/${hashMatch[1]}`, { Referer: url });
      const parsed = JSON.parse(config);
      const sources = parsed?.sources || parsed?.stream || [];
      for (const s of (Array.isArray(sources) ? sources : [])) {
        if (s.file?.includes('.m3u8')) return { m3u8: s.file, name: 'embed.su' };
        if (s.url?.includes('.m3u8'))  return { m3u8: s.url,  name: 'embed.su' };
      }
      const m3u8 = extractM3u8(JSON.stringify(parsed));
      if (m3u8) return { m3u8, name: 'embed.su' };
    }
  } catch (_) {}
  return null;
}

async function tryMoviesApi(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://moviesapi.club/' });
    const m3u8 = extractM3u8(html);
    if (m3u8) return { m3u8, name: 'moviesapi' };
  } catch (_) {}
  return null;
}

async function tryAutoEmbed(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://autoembed.cc/' });
    const m3u8 = extractM3u8(html);
    if (m3u8) return { m3u8, name: 'autoembed' };
  } catch (_) {}
  return null;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

  const { tmdbId, mediaType = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'Missing tmdbId' })); }

  const s = Number(season)  || 1;
  const e = Number(episode) || 1;

  // Get IMDB ID in parallel with first extraction attempts
  const imdbPromise = getImdbId(tmdbId, mediaType);

  // Fire all no-imdb-needed extractors immediately
  const noImdbExtractors = [
    tryEmbedSu(tmdbId, mediaType, s, e),
    tryMoviesApi(tmdbId, mediaType, s, e),
    tryAutoEmbed(tmdbId, mediaType, s, e),
    // vidsrc with tmdb id (works even without imdb id)
    tryVidsrcXyz('vidsrc.in',  tmdbId, null, mediaType, s, e),
    tryVidsrcXyz('vidsrc.xyz', tmdbId, null, mediaType, s, e),
  ];

  // Also queue imdb-dependent ones once we have the id
  const imdbExtractors = imdbPromise.then(imdbId => {
    if (!imdbId) return [];
    return [
      tryVidsrcXyz('vidsrc.xyz', tmdbId, imdbId, mediaType, s, e),
      tryVidsrcXyz('vidsrc.in',  tmdbId, imdbId, mediaType, s, e),
      tryVidsrcXyz('vidsrc.me',  tmdbId, imdbId, mediaType, s, e),
    ];
  });

  // Race: return the FIRST extractor that returns a result
  const winner = await new Promise((resolve) => {
    let pending = 0;
    const results = [];

    const tryResolve = (result) => {
      if (result?.m3u8) { resolve(result); return; }
      pending--;
      if (pending <= 0) resolve(null);
    };

    const addExtractors = (list) => {
      pending += list.length;
      list.forEach(p => Promise.resolve(p).then(tryResolve).catch(() => { pending--; if (pending <= 0) resolve(null); }));
    };

    addExtractors(noImdbExtractors);
    imdbExtractors.then(list => {
      if (list.length) addExtractors(list);
    });

    // Safety timeout: resolve null after 15s regardless
    setTimeout(() => resolve(null), 15000);
  });

  const imdbId = await imdbPromise;

  res.setHeader('Content-Type', 'application/json');
  if (winner?.m3u8) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success:   true,
      provider:  winner.name,
      streamUrl: winner.m3u8,
      imdbId,
      proxyUrl:  `/api/proxy?url=${encodeURIComponent(winner.m3u8)}`,
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ success: false, imdbId, error: 'No stream found' }));
};
