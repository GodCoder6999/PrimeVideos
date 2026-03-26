/**
 * api/multi-stream.js
 * 6 parallel scrapers — NuvioStreams uses ALL providers (no MoviessMod filter).
 * Returns up to 10 streams from multiple sources, all proxied.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function get(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 12000;
  return new Promise((resolve) => {
    let url;
    try { url = new URL(rawUrl); } catch (_) { return resolve(null); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  Object.assign({
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, extraHeaders),
    }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = url.protocol + '//' + url.host + loc;
        return get(loc, extraHeaders, timeoutMs).then(resolve);
      }
      if (res.statusCode >= 400) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function getImdbId(tmdbId, mediaType) {
  const raw = await get(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
    {}, 6000
  );
  try { return JSON.parse(raw || '{}').imdb_id || null; } catch (_) { return null; }
}

function extractAllM3u8(text) {
  if (!text) return [];
  const found = new Set();
  const pats = [
    /https?:\/\/[^\s"'\\<>{}]+?\.m3u8[^\s"'\\<>{}]*/g,
    /["'`](https?:\/\/[^"'`\s]+?\.m3u8[^"'`\s]*)/g,
    /(?:file|src|url|source)\s*:\s*["']([^"']+?\.m3u8[^"']*)/g,
  ];
  for (const p of pats) { let m; while ((m = p.exec(text)) !== null) {
    const u = (m[1]||m[0]).replace(/\\/g,'').replace(/["'`]/g,'').trim();
    if (u.startsWith('http') && u.includes('.m3u8')) found.add(u);
  }}
  // atob decoding
  const ab = /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g;
  let m;
  while ((m = ab.exec(text)) !== null) {
    try { extractAllM3u8(Buffer.from(m[1],'base64').toString()).forEach(u=>found.add(u)); } catch(_){}
  }
  return [...found].filter(u => !/audio[-_]only|caption|subtitle|\.vtt/i.test(u));
}

function bestM3u8(urls) {
  if (!urls||!urls.length) return null;
  return urls.find(u=>/1080/i.test(u)) || urls.find(u=>/720/i.test(u)) || urls[0];
}

function qualityFromStr(s) {
  if (!s) return 'Auto';
  s = s.toLowerCase();
  if (s.includes('2160')||s.includes('4k')) return '4K';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  if (s.includes('360'))  return '360p';
  return 'Auto';
}

function px(url, origin) {
  return `${origin}/api/proxy?url=${encodeURIComponent(url)}`;
}

// ── SCRAPERS ──────────────────────────────────────────────────────────────────

async function scrapeVidSrcXyz(tmdbId, imdbId, mediaType, season, episode) {
  const base = 'https://vidsrc.xyz';
  const tv = mediaType === 'tv';
  const candidates = [
    tv ? `${base}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
       : `${base}/embed/movie?tmdb=${tmdbId}`,
    ...(imdbId ? [tv
      ? `${base}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `${base}/embed/movie?imdb=${imdbId}`] : []),
  ];
  for (const u of candidates) {
    const html = await get(u, { Referer: `${base}/` }, 10000);
    const m = bestM3u8(extractAllM3u8(html||''));
    if (m) return { url:m, quality:qualityFromStr(m), source:'VidSrc.xyz', type:'hls' };
  }
  return null;
}

async function scrapeVidSrcIn(tmdbId, imdbId, mediaType, season, episode) {
  const base = 'https://vidsrc.in';
  const tv = mediaType === 'tv';
  const candidates = [
    tv ? `${base}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
       : `${base}/embed/movie?tmdb=${tmdbId}`,
    ...(imdbId ? [tv
      ? `${base}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `${base}/embed/movie?imdb=${imdbId}`] : []),
  ];
  for (const u of candidates) {
    const html = await get(u, { Referer: `${base}/` }, 10000);
    const m = bestM3u8(extractAllM3u8(html||''));
    if (m) return { url:m, quality:qualityFromStr(m), source:'VidSrc.in', type:'hls' };
  }
  return null;
}

async function scrapeEmbedSu(tmdbId, mediaType, season, episode) {
  const base = 'https://embed.su';
  const tv = mediaType === 'tv';
  const embedUrl = tv
    ? `${base}/embed/tv/${tmdbId}/${season}/${episode}`
    : `${base}/embed/movie/${tmdbId}`;
  const html = await get(embedUrl, { Referer: `${base}/` }, 10000);
  if (!html) return null;
  let m = bestM3u8(extractAllM3u8(html));
  if (!m) {
    const hm = html.match(/\/api\/e\/([a-zA-Z0-9_-]+)/);
    if (hm) {
      const cfg = await get(`${base}/api/e/${hm[1]}`, { Referer: embedUrl }, 8000);
      if (cfg) {
        try {
          const d = JSON.parse(cfg);
          const srcs = d.sources||d.stream||d.streams||[];
          for (const s of (Array.isArray(srcs)?srcs:[])) {
            const l = s.file||s.url||s.src;
            if (l&&l.includes('.m3u8')) { m=l; break; }
          }
          if (!m) m = bestM3u8(extractAllM3u8(JSON.stringify(d)));
        } catch(_) { m = bestM3u8(extractAllM3u8(cfg)); }
      }
    }
  }
  if (m) return { url:m, quality:qualityFromStr(m), source:'Embed.su', type:'hls' };
  return null;
}

async function scrapeMoviesApi(tmdbId, mediaType, season, episode) {
  const base = 'https://moviesapi.club';
  const tv = mediaType === 'tv';
  const url = tv
    ? `${base}/tv/${tmdbId}-${season}-${episode}`
    : `${base}/movie/${tmdbId}`;
  const html = await get(url, { Referer: `${base}/` }, 10000);
  const m = bestM3u8(extractAllM3u8(html||''));
  if (m) return { url:m, quality:qualityFromStr(m), source:'MoviesAPI', type:'hls' };
  return null;
}

// ── NUVIO: ALL PROVIDERS, NO FILTER ──────────────────────────────────────────
async function scrapeNuvio(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];

  const url = mediaType === 'tv'
    ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
    : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

  const raw = await get(url, { Referer: 'https://nuviostreams.hayd.uk/' }, 15000);
  if (!raw) return [];

  let data;
  try { data = JSON.parse(raw); } catch(_) { return []; }

  // Accept ALL streams with a direct HTTP URL — no provider filter whatsoever
  const streams = (data.streams || []).filter(s =>
    s.url &&
    s.url.startsWith('http') &&
    !s.infoHash &&
    !s.ytId
  );

  if (!streams.length) return [];

  // Score for sorting
  const score = s => {
    const t = ((s.name||'')+(s.title||'')+s.url).toLowerCase();
    if (t.includes('1080'))                      return 5;
    if (t.includes('720'))                       return 4;
    if (t.includes('480'))                       return 3;
    if (t.includes('4k')||t.includes('2160'))    return 1;
    return 2;
  };
  streams.sort((a,b) => score(b)-score(a));

  // Return up to 6 best Nuvio streams (multiple providers = multiple fallbacks)
  return streams.slice(0,6).map(s => {
    const meta = (s.name||'')+(s.title||'')+s.url;
    const srcName = (s.name||'Nuvio').split('\n')[0].trim().slice(0,25);
    return {
      url:     s.url,
      quality: qualityFromStr(meta),
      source:  srcName,
      type:    s.url.includes('.m3u8') ? 'hls' : s.url.includes('.mp4') ? 'mp4' : 'binary',
    };
  });
}

async function scrapeAutoEmbed(tmdbId, mediaType, season, episode) {
  const base = 'https://autoembed.cc';
  const tv = mediaType === 'tv';
  const url = tv
    ? `${base}/tv/tmdb/${tmdbId}-${season}-${episode}`
    : `${base}/movie/tmdb/${tmdbId}`;
  const html = await get(url, { Referer: `${base}/` }, 10000);
  const m = bestM3u8(extractAllM3u8(html||''));
  if (m) return { url:m, quality:qualityFromStr(m), source:'AutoEmbed', type:'hls' };
  return null;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type, season='1', episode='1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  if (!tmdbId) { res.statusCode=400; return res.end(JSON.stringify({success:false,error:'tmdbId required'})); }

  const proto  = (req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host   = req.headers['x-forwarded-host']||req.headers.host||'localhost:3000';
  const origin = `${proto}://${host}`;

  // Phase 1 — all TMDB-ID scrapers + IMDb lookup in parallel
  const [imdbId, r1, r2, r3, r4, r5] = await Promise.all([
    getImdbId(tmdbId, mediaType),
    scrapeVidSrcXyz(tmdbId, null, mediaType, season, episode),
    scrapeVidSrcIn(tmdbId, null, mediaType, season, episode),
    scrapeEmbedSu(tmdbId, mediaType, season, episode),
    scrapeMoviesApi(tmdbId, mediaType, season, episode),
    scrapeAutoEmbed(tmdbId, mediaType, season, episode),
  ]);

  // Phase 2 — IMDb-dependent scrapers
  const [nuvio, r6, r7] = await Promise.all([
    scrapeNuvio(imdbId, mediaType, season, episode),
    imdbId ? scrapeVidSrcXyz(tmdbId, imdbId, mediaType, season, episode) : null,
    imdbId ? scrapeVidSrcIn(tmdbId, imdbId, mediaType, season, episode)  : null,
  ]);

  // Merge, flatten, dedupe
  const all = [r4, r3, r1, r2, r6, r7, r5, ...(Array.isArray(nuvio)?nuvio:[])].filter(Boolean);
  const seen = new Set();
  const unique = all.filter(r => {
    if (!r||!r.url||seen.has(r.url)) return false;
    seen.add(r.url); return true;
  });

  if (!unique.length) {
    return res.end(JSON.stringify({ success:false, imdbId:imdbId||null, error:'No streams found.' }));
  }

  // Sort 1080p first
  const qr = {'1080p':5,'720p':4,'480p':3,'Auto':2,'4K':1};
  unique.sort((a,b)=>(qr[b.quality]||0)-(qr[a.quality]||0));

  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId||null,
    count:   unique.length,
    streams: unique.map(r=>({
      url:     px(r.url, origin),
      quality: r.quality,
      source:  r.source,
      type:    r.type||'hls',
    })),
  }));
};
