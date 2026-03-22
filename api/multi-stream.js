/**
 * api/multi-stream.js — Vercel Serverless (CommonJS)
 *
 * Fires VidSrc + VidZee + MP4Hydra + SoaperTV in parallel.
 * Returns the FIRST stream that responds — typically 1-3 seconds.
 * All extraction happens server-side so no CORS issues in the browser.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 9000;
const TMDB_KEY   = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── HTTP helper with redirect following ─────────────────────────────────────
function nodeGet(rawUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL')); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
    }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${url.protocol}//${url.host}${loc}`;
        return nodeGet(loc, extraHeaders).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function safe(p) { return p.catch(() => null); }

// ─── Extract m3u8 from HTML/JS ────────────────────────────────────────────────
function extractM3u8(text) {
  const pats = [
    /["'`](https?:\/\/[^"'`\s]+master\.m3u8[^"'`\s]*)["'`]/i,
    /["'`](https?:\/\/[^"'`\s]+\.m3u8\?[^"'`\s]*)["'`]/i,
    /["'`](https?:\/\/[^"'`\s]+\.m3u8)["'`]/i,
    /"hls"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/,
    /file\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
    /src\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m?.[1] && !/audio|subtitle|caption/i.test(m[1])) return m[1];
  }
  return null;
}

function decodeAtob(html) {
  const out = [];
  const re  = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(Buffer.from(m[1], 'base64').toString()); } catch (_) {}
  }
  return out.join('\n');
}

// ─── PROVIDER 1: VidSrc (xyz / in / me) ──────────────────────────────────────
async function getVidSrcStream(tmdbId, imdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const tid = tmdbId, iid = imdbId, s = season, e = episode;

  const urls = [
    iid ? (tv ? `https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${iid}`) : null,
    tv  ? `https://vidsrc.xyz/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tid}`,
    tv  ? `https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}`  : `https://vidsrc.in/embed/movie?tmdb=${tid}`,
    iid ? (tv ? `https://vidsrc.me/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${iid}`) : null,
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const domain = new URL(url).hostname;
      const html   = await nodeGet(url, { Referer: `https://${domain}/` });
      let m3u8 = extractM3u8(html) || extractM3u8(decodeAtob(html));

      // Follow rcp iframe if needed
      if (!m3u8) {
        const rcpM = html.match(/src=["'`]((?:https?:)?\/\/[^"'`]*(?:rcp|\/e\/)[^"'`]+)["'`]/i);
        if (rcpM) {
          let rcpUrl = rcpM[1];
          if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;
          try {
            const rcp = await nodeGet(rcpUrl, { Referer: url });
            m3u8 = extractM3u8(rcp) || extractM3u8(decodeAtob(rcp));
          } catch (_) {}
        }
      }

      if (m3u8) return { url: m3u8, provider: 'VidSrc', quality: 'Auto' };
    } catch (_) {}
  }
  return null;
}

// ─── PROVIDER 2: VidZee (3 CDN servers) ──────────────────────────────────────
async function getVidZeeStream(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const results = await Promise.allSettled([3, 4, 5].map(sr => {
    const url = tv
      ? `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}&ss=${season}&ep=${episode}`
      : `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}`;
    return nodeGet(url).then(t => JSON.parse(t));
  }));

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const d = r.value;
    const pick = (obj) => {
      if (obj?.url) return { url: obj.url, provider: 'VidZee', quality: obj.quality || 'Auto' };
      if (Array.isArray(obj?.sources) && obj.sources[0]?.url) return { url: obj.sources[0].url, provider: 'VidZee', quality: obj.sources[0].quality || 'Auto' };
      return null;
    };
    const s = pick(d) || pick(d?.data);
    if (s) return s;
  }
  return null;
}

// ─── PROVIDER 3: MP4Hydra ────────────────────────────────────────────────────
async function getMP4HydraStream(tmdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const url = tv
    ? `https://mp4hydra.org/tv/${tmdbId}/${season}/${episode}`
    : `https://mp4hydra.org/movie/${tmdbId}`;
  const data = JSON.parse(await nodeGet(url));
  const list = data?.streams || (data?.url ? [data] : []);
  const s    = list.find(s => s?.url);
  return s ? { url: s.url, provider: 'MP4Hydra', quality: s.quality || 'Auto' } : null;
}

// ─── PROVIDER 4: SoaperTV ────────────────────────────────────────────────────
async function getSoaperTVStream(tmdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const url = tv
    ? `https://soapertv.cc/api/episode/sources/${tmdbId}/${season}/${episode}`
    : `https://soapertv.cc/api/movie/sources/${tmdbId}`;
  const data = JSON.parse(await nodeGet(url, { 'Referer': 'https://soapertv.cc/', 'X-Requested-With': 'XMLHttpRequest' }));
  const list = data?.sources || data?.streams || (data?.url ? [data] : []);
  const s    = list.find(s => s?.url && (s.url.includes('.m3u8') || s.url.includes('.mp4')));
  return s ? { url: s.url, provider: 'SoaperTV', quality: s.quality || s.label || 'Auto' } : null;
}

// ─── TMDB → IMDB ID ──────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const d = JSON.parse(await nodeGet(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`));
    return d.imdb_id || null;
  } catch (_) { return null; }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type, season = '1', episode = '1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'tmdbId required' })); }

  // Get IMDB ID while running providers — don't block on it
  const imdbPromise = safe(getImdbId(tmdbId, mediaType));

  // Race all 4 providers — return FIRST that gives a valid stream URL
  const winner = await new Promise((resolve) => {
    let done    = false;
    let pending = 4;
    const safety = setTimeout(() => resolve(null), TIMEOUT_MS);

    const win = (result) => {
      if (done) return;
      if (result?.url) {
        done = true;
        clearTimeout(safety);
        resolve(result);
        return;
      }
      if (--pending <= 0) { clearTimeout(safety); resolve(null); }
    };

    // VidSrc — needs imdb id for best results, so wait for it then fire
    imdbPromise.then(iid => {
      safe(getVidSrcStream(tmdbId, iid, mediaType, season, episode)).then(win);
    });

    // VidZee, MP4Hydra, SoaperTV — don't need imdb id, fire immediately
    safe(getVidZeeStream(tmdbId, mediaType, season, episode)).then(win);
    safe(getMP4HydraStream(tmdbId, mediaType, season, episode)).then(win);
    safe(getSoaperTVStream(tmdbId, mediaType, season, episode)).then(win);
  });

  if (!winner) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found from any provider' }));
  }

  // Quality sort label
  const qualityRank = { '1080p': 0, '4K': 1, '2160p': 1, '720p': 2, 'Auto': 3 };

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    streams: [{
      name:     `${winner.provider} ${winner.quality}`.trim(),
      url:      winner.url,
      quality:  winner.quality,
      provider: winner.provider,
    }],
  }));
};
