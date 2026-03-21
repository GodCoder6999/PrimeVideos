// api/get-stream.js — Vercel serverless, CommonJS
// Replaces the Express /api/get-stream route from backend/server.js
// Tries multiple embed sources in order, returns first m3u8 found.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Connection': 'keep-alive',
};

// ── Simple fetch helper (no axios dependency) ────────────────────────────────
function fetchText(url, extraHeaders = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { ...HEADERS, ...extraHeaders },
    };

    const req = lib.request(options, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        fetchText(res.headers.location, extraHeaders, timeoutMs).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── Utility: pull all m3u8 URLs out of arbitrary HTML/JS ────────────────────
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
  return all.find((u) => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

// ── TMDB → IMDB ID ────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const data = await fetchText(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
    );
    return JSON.parse(data).imdb_id || null;
  } catch (_) {
    return null;
  }
}

// ── SOURCE: moviesapi.club ───────────────────────────────────────────────────
async function tryMoviesApi(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://moviesapi.club/' });
    return extractM3u8(html);
  } catch (_) { return null; }
}

// ── SOURCE: autoembed.cc ─────────────────────────────────────────────────────
async function tryAutoEmbed(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://autoembed.cc/' });
    return extractM3u8(html);
  } catch (_) { return null; }
}

// ── SOURCE: embed.su ─────────────────────────────────────────────────────────
async function tryEmbedSu(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`;
    const html = await fetchText(url, { Referer: 'https://embed.su/' });
    const direct = extractM3u8(html);
    if (direct) return direct;

    const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (hashMatch) {
      const config = await fetchText(
        `https://embed.su/api/e/${hashMatch[1]}`,
        { Referer: url }
      );
      const parsed = JSON.parse(config);
      const sources = parsed?.sources || parsed?.stream || [];
      if (Array.isArray(sources)) {
        for (const s of sources) {
          if (s.file?.includes('.m3u8')) return s.file;
          if (s.url?.includes('.m3u8'))  return s.url;
        }
      }
      return extractM3u8(JSON.stringify(parsed));
    }
  } catch (_) { return null; }
  return null;
}

// ── SOURCE: vidsrc.xyz / vidsrc.in / vidsrc.pm ───────────────────────────────
async function tryVidsrcXyz(domain, tmdbId, imdbId, mediaType, season, episode) {
  try {
    const url = imdbId
      ? (mediaType === 'tv'
        ? `https://${domain}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
        : `https://${domain}/embed/movie?imdb=${imdbId}`)
      : (mediaType === 'tv'
        ? `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://${domain}/embed/movie?tmdb=${tmdbId}`);

    const html = await fetchText(url, { Referer: `https://${domain}/` });
    const direct = extractM3u8(html);
    if (direct) return direct;

    // Look for encoded streams in inline scripts
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = scriptRe.exec(html)) !== null) {
      const script = sm[1];
      const atobRe = /atob\(["']([^"']+)["']\)/g;
      let am;
      while ((am = atobRe.exec(script)) !== null) {
        try {
          const decoded = Buffer.from(am[1], 'base64').toString('utf-8');
          const m3u8 = extractM3u8(decoded);
          if (m3u8) return m3u8;
        } catch (_) { /* */ }
      }
    }
  } catch (_) { return null; }
  return null;
}

// ── SOURCE: vidsrc.me ────────────────────────────────────────────────────────
async function tryVidsrcMe(imdbId, mediaType, season, episode) {
  if (!imdbId) return null;
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?imdb=${imdbId}`;

    const html = await fetchText(embedUrl, { Referer: 'https://vidsrc.me/' });
    const direct = extractM3u8(html);
    if (direct) return direct;

    // Find rcp iframe
    const rcpMatch = html.match(/src=["']((?:https?:)?\/\/[^"']*rcp[^"']*)["']/);
    if (rcpMatch) {
      const rcpUrl = rcpMatch[1].startsWith('//') ? `https:${rcpMatch[1]}` : rcpMatch[1];
      const rcpHtml = await fetchText(rcpUrl, { Referer: embedUrl });
      return extractM3u8(rcpHtml);
    }
  } catch (_) { return null; }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

  const { tmdbId, mediaType = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'Missing tmdbId' }));
  }

  const s = Number(season)  || 1;
  const e = Number(episode) || 1;

  console.log(`[get-stream] tmdbId=${tmdbId} type=${mediaType} S${s}E${e}`);

  const imdbId = await getImdbId(tmdbId, mediaType);
  console.log(`[get-stream] imdbId=${imdbId || 'n/a'}`);

  const extractors = [
    { name: 'vidsrc.xyz', fn: () => tryVidsrcXyz('vidsrc.xyz', tmdbId, imdbId, mediaType, s, e) },
    { name: 'vidsrc.in',  fn: () => tryVidsrcXyz('vidsrc.in',  tmdbId, imdbId, mediaType, s, e) },
    { name: 'vidsrc.pm',  fn: () => tryVidsrcXyz('vidsrc.pm',  tmdbId, imdbId, mediaType, s, e) },
    { name: 'vidsrc.me',  fn: () => tryVidsrcMe(imdbId, mediaType, s, e) },
    { name: 'embed.su',   fn: () => tryEmbedSu(tmdbId, mediaType, s, e) },
    { name: 'moviesapi',  fn: () => tryMoviesApi(tmdbId, mediaType, s, e) },
    { name: 'autoembed',  fn: () => tryAutoEmbed(tmdbId, mediaType, s, e) },
  ];

  for (const ext of extractors) {
    try {
      console.log(`[get-stream] → trying ${ext.name}`);
      const m3u8 = await ext.fn();
      if (m3u8) {
        console.log(`[get-stream] ✓ ${ext.name}: ${m3u8.slice(0, 80)}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success:   true,
          provider:  ext.name,
          streamUrl: m3u8,
          imdbId,
          proxyUrl:  `/api/proxy?url=${encodeURIComponent(m3u8)}`,
        }));
      }
    } catch (err) {
      console.warn(`[get-stream] ✗ ${ext.name}: ${err.message}`);
    }
  }

  // All extractors failed — return imdbId so frontend can build its own embeds
  console.log('[get-stream] all extractors failed');
  res.statusCode = 200; // 200 so client can read the body
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({
    success: false,
    imdbId,
    error:   'Could not extract direct stream from any source',
  }));
};
