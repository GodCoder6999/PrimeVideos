/**
 * api/multi-stream.js — Vercel Serverless (CommonJS)
 *
 * 5 providers race in parallel — first valid stream URL wins.
 * Providers: NuvioStreams → VidSrc → VidZee → MP4Hydra → SoaperTV
 *
 * Key design decisions:
 * - IMDB ID fetch fires immediately and in parallel with tmdb-id providers
 * - No provider blocks any other — true parallel race
 * - Per-request timeout on every HTTP call
 * - Returns the raw URL so PrimePlayer can proxy it through /api/proxy
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── HTTP helper — timeout per call ────────────────────────────────────────────
function nodeGet(rawUrl, extraHeaders = {}, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL: ' + rawUrl)); }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept':          'text/html,application/json,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
    }, (res) => {
      // Follow redirects
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${url.protocol}//${url.host}${loc}`;
        return nodeGet(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
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

// Wrap a promise so it never rejects — returns null on failure
const safe = p => p.catch(() => null);

// ── Extract m3u8 from HTML/JS text ────────────────────────────────────────────
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
  const re = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(Buffer.from(m[1], 'base64').toString()); } catch (_) {}
  }
  return out.join('\n');
}

function parseQuality(str) {
  const s = (str || '').toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return '4K';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  return 'Auto';
}

// ── TMDB → IMDB ID ────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const d = JSON.parse(await nodeGet(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
      {}, 6000
    ));
    return d.imdb_id || null;
  } catch (_) { return null; }
}

// ── PROVIDER 1: NuvioStreams (Stremio addon — best quality) ───────────────────
async function getNuvioStream(imdbId, mediaType, season, episode) {
  if (!imdbId) return null;
  try {
    const path = mediaType === 'tv'
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

    const raw  = await nodeGet(path, { Referer: 'https://nuviostreams.hayd.uk/' }, 10000);
    const data = JSON.parse(raw);

    const streams = (data.streams || []).filter(s =>
      s.url && (s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv'))
    );
    if (!streams.length) return null;

    // Sort by quality preference: 1080p first
    const rank = str => { const s = parseQuality(str); return s === '1080p' ? 5 : s === '4K' ? 4 : s === '720p' ? 3 : s === '480p' ? 2 : 1; };
    streams.sort((a, b) => rank(b.name) - rank(a.name));

    const best = streams[0];
    return { url: best.url, provider: 'NuvioStreams', quality: parseQuality(best.name || '') };
  } catch (_) { return null; }
}

// ── PROVIDER 2: VidSrc (xyz / in / me) — HLS extraction ──────────────────────
async function getVidSrcStream(tmdbId, imdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';

  // Build candidate embed URLs — prefer imdb id (more reliable), fall back to tmdb
  const candidates = [
    imdbId
      ? (tv ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
             : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`)
      : null,
    tv  ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
    tv  ? `https://vidsrc.in/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://vidsrc.in/embed/movie?tmdb=${tmdbId}`,
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const domain = new URL(url).hostname;
      const html = await nodeGet(url, { Referer: `https://${domain}/` }, 8000);
      let m3u8 = extractM3u8(html) || extractM3u8(decodeAtob(html));

      // Follow rcp sub-iframe if needed
      if (!m3u8) {
        const rcpM = html.match(/src=["'`]((?:https?:)?\/\/[^"'`]*(?:rcp|\/e\/)[^"'`]+)["'`]/i);
        if (rcpM) {
          let rcpUrl = rcpM[1];
          if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;
          try {
            const rcp = await nodeGet(rcpUrl, { Referer: url }, 7000);
            m3u8 = extractM3u8(rcp) || extractM3u8(decodeAtob(rcp));
          } catch (_) {}
        }
      }

      if (m3u8) return { url: m3u8, provider: 'VidSrc', quality: 'Auto' };
    } catch (_) {}
  }
  return null;
}

// ── PROVIDER 3: VidZee ────────────────────────────────────────────────────────
async function getVidZeeStream(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';

  const results = await Promise.allSettled([3, 4, 5].map(sr => {
    const url = tv
      ? `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}&ss=${season}&ep=${episode}`
      : `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}`;
    return nodeGet(url, {}, 7000).then(t => JSON.parse(t));
  }));

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    try {
      const d = r.value;
      const pick = obj => {
        if (obj?.url && typeof obj.url === 'string' && obj.url.startsWith('http'))
          return { url: obj.url, provider: 'VidZee', quality: parseQuality(obj.quality || '') };
        if (Array.isArray(obj?.sources)) {
          const s = obj.sources.find(s => s?.url?.startsWith('http'));
          if (s) return { url: s.url, provider: 'VidZee', quality: parseQuality(s.quality || '') };
        }
        return null;
      };
      const s = pick(d) || pick(d?.data);
      if (s) return s;
    } catch (_) {}
  }
  return null;
}

// ── PROVIDER 4: MP4Hydra ──────────────────────────────────────────────────────
async function getMP4HydraStream(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const url = tv
    ? `https://mp4hydra.org/tv/${tmdbId}/${season}/${episode}`
    : `https://mp4hydra.org/movie/${tmdbId}`;
  try {
    const data = JSON.parse(await nodeGet(url, {}, 7000));
    const list = data?.streams || data?.sources || (data?.url ? [data] : []);
    const s = list.find(s => s?.url && typeof s.url === 'string' && s.url.startsWith('http'));
    if (s) return { url: s.url, provider: 'MP4Hydra', quality: parseQuality(s.quality || '') };
  } catch (_) {}
  return null;
}

// ── PROVIDER 5: SoaperTV ──────────────────────────────────────────────────────
async function getSoaperTVStream(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const url = tv
    ? `https://soapertv.cc/api/episode/sources/${tmdbId}/${season}/${episode}`
    : `https://soapertv.cc/api/movie/sources/${tmdbId}`;
  try {
    const data = JSON.parse(await nodeGet(url, {
      Referer: 'https://soapertv.cc/',
      'X-Requested-With': 'XMLHttpRequest',
    }, 7000));
    const list = data?.sources || data?.streams || (data?.url ? [data] : []);
    const s = list.find(s => s?.url && (s.url.includes('.m3u8') || s.url.includes('.mp4')));
    if (s) return { url: s.url, provider: 'SoaperTV', quality: parseQuality(s.quality || s.label || '') };
  } catch (_) {}
  return null;
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

  // ── Critical: IMDB fetch runs in parallel with TMDB-id providers ──────────
  // VidZee / MP4Hydra / SoaperTV don't need IMDB ID — fire immediately.
  // NuvioStreams + VidSrc need IMDB ID — fire as soon as imdbPromise resolves.
  // Net result: zero blocking. All 5 providers are in flight simultaneously.
  const imdbPromise = safe(getImdbId(tmdbId, mediaType));

  const winner = await new Promise((resolve) => {
    let done    = false;
    let pending = 5;
    const safety = setTimeout(() => { if (!done) resolve(null); }, 11000);

    const win = result => {
      if (done) return;
      if (result?.url && typeof result.url === 'string' && result.url.startsWith('http')) {
        done = true;
        clearTimeout(safety);
        resolve(result);
        return;
      }
      if (--pending <= 0) { clearTimeout(safety); resolve(null); }
    };

    // Providers that use TMDB ID — fire right now
    safe(getVidZeeStream(tmdbId, mediaType, season, episode)).then(win);
    safe(getMP4HydraStream(tmdbId, mediaType, season, episode)).then(win);
    safe(getSoaperTVStream(tmdbId, mediaType, season, episode)).then(win);

    // Providers that need IMDB ID — fire as soon as we have it (usually ~500ms)
    imdbPromise.then(imdbId => {
      safe(getNuvioStream(imdbId, mediaType, season, episode)).then(win);
      safe(getVidSrcStream(tmdbId, imdbId, mediaType, season, episode)).then(win);
    }).catch(() => {
      // IMDB lookup failed — fire with null imdbId so pending count stays correct
      safe(getNuvioStream(null, mediaType, season, episode)).then(win);
      safe(getVidSrcStream(tmdbId, null, mediaType, season, episode)).then(win);
    });
  });

  if (!winner) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found from any provider' }));
  }

  const imdbId = await imdbPromise;

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success:  true,
    imdbId:   imdbId || null,
    streams:  [{
      name:     `${winner.provider} ${winner.quality}`.trim(),
      url:      winner.url,
      quality:  winner.quality,
      provider: winner.provider,
    }],
  }));
};
