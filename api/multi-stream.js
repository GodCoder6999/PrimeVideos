/**
 * api/multi-stream.js  —  Vercel Serverless (CommonJS)
 *
 * VidSrc extractor only — extracts the real .m3u8 stream URL directly
 * from vidsrc.xyz/me/in by scraping their embed pages server-side.
 * No iframes, no CORS issues, direct HLS playback in the browser.
 *
 * GET /api/multi-stream?tmdbId=550&type=movie
 * GET /api/multi-stream?tmdbId=1396&type=tv&season=1&episode=1
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 8000;
const TMDB_KEY   = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function nodeGet(rawUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error(`Bad URL: ${rawUrl}`)); }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/json,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         opts.referer || `https://${url.hostname}/`,
        ...opts.headers,
      },
    }, (res) => {
      // Follow redirects
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location && (opts._r||0) < 4) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${url.protocol}//${url.host}${loc}`;
        return nodeGet(loc, { ...opts, _r: (opts._r||0) + 1 }).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ─── Extract m3u8 URLs from any HTML/JS text ──────────────────────────────────
function extractM3u8(text) {
  const patterns = [
    // token-authenticated master playlist (most reliable)
    /["'`](https?:\/\/[^"'`\s]+master\.m3u8[^"'`\s]*)["'`]/i,
    // any m3u8 with query params (likely has auth token)
    /["'`](https?:\/\/[^"'`\s]+\.m3u8\?[^"'`\s]*)["'`]/i,
    // plain m3u8
    /["'`](https?:\/\/[^"'`\s]+\.m3u8)["'`]/i,
    // hls key in JS objects
    /"hls"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/,
    /file\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
    /src\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1] && !m[1].includes('example') && !/audio|subtitle|caption/i.test(m[1])) {
      return m[1];
    }
  }
  return null;
}

// ─── Decode base64-obfuscated script content ──────────────────────────────────
function decodeBase64Scripts(html) {
  const results = [];
  const re = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { results.push(Buffer.from(m[1], 'base64').toString('utf-8')); } catch (_) {}
  }
  return results.join('\n');
}

// ─── VidSrc extractor ─────────────────────────────────────────────────────────
// Tries vidsrc.xyz, vidsrc.me, vidsrc.in in parallel — returns first m3u8 found

async function extractVidSrc(tmdbId, imdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const tid = tmdbId;
  const iid = imdbId;
  const s   = season;
  const e   = episode;

  // Build candidate embed URLs across vidsrc domains
  const candidates = [];

  // vidsrc.xyz (most reliable, fastest)
  if (iid) candidates.push({ domain: 'vidsrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${iid}` });
  candidates.push(  { domain: 'vidsrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tid}` });

  // vidsrc.in
  candidates.push(  { domain: 'vidsrc.in',  url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tid}` });

  // vidsrc.me
  if (iid) candidates.push({ domain: 'vidsrc.me', url: tv ? `https://vidsrc.me/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${iid}` });

  // Race all candidates — return first that gives an m3u8
  return new Promise((resolve) => {
    let found = false;
    let pending = candidates.length;

    const tryOne = async ({ domain, url }) => {
      try {
        const html    = await nodeGet(url, { referer: `https://${domain}/` });
        let   m3u8    = extractM3u8(html);

        // Try decoding obfuscated scripts if direct scan failed
        if (!m3u8) {
          const decoded = decodeBase64Scripts(html);
          if (decoded) m3u8 = extractM3u8(decoded);
        }

        // vidsrc often loads an iframe rcp page — follow it
        if (!m3u8) {
          const rcpMatch = html.match(/src=["'`]((?:https?:)?\/\/[^"'`]*rcp[^"'`]*)["'`]/i)
                        || html.match(/src=["'`]((?:https?:)?\/\/[^"'`]*\/e\/[^"'`]+)["'`]/i);
          if (rcpMatch) {
            let rcpUrl = rcpMatch[1];
            if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;
            try {
              const rcpHtml = await nodeGet(rcpUrl, { referer: url });
              m3u8 = extractM3u8(rcpHtml) || extractM3u8(decodeBase64Scripts(rcpHtml));
            } catch (_) {}
          }
        }

        if (m3u8 && !found) {
          found = true;
          resolve({ url: m3u8, provider: domain, quality: 'Auto' });
        }
      } catch (_) {}

      pending--;
      if (pending <= 0 && !found) resolve(null);
    };

    // Safety timeout
    const safety = setTimeout(() => { if (!found) resolve(null); }, TIMEOUT_MS - 500);

    Promise.all(candidates.map(tryOne)).finally(() => clearTimeout(safety));
  });
}

// ─── Get IMDB ID from TMDB ────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const data = JSON.parse(await nodeGet(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
    ));
    return data.imdb_id || null;
  } catch (_) { return null; }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type, season = '1', episode = '1' } = req.query;
  const mediaType = (type === 'tv') ? 'tv' : 'movie';

  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
  }

  // Fetch IMDB ID and extract stream in parallel
  const [imdbId, stream] = await Promise.all([
    getImdbId(tmdbId, mediaType),
    // Start with tmdb-id based URLs immediately, don't wait for imdbId
    extractVidSrc(tmdbId, null, mediaType, season, episode),
  ]);

  // If tmdb-based extraction failed, retry with imdb id
  let result = stream;
  if (!result && imdbId) {
    result = await extractVidSrc(tmdbId, imdbId, mediaType, season, episode);
  }

  if (!result) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'VidSrc extraction failed' }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success:  true,
    streams:  [{ name: `VidSrc`, url: result.url, quality: result.quality, provider: result.provider }],
  }));
};
