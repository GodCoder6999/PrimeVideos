/**
 * api/multi-stream.js  —  Vercel Serverless Function (CommonJS)
 * Uses Node built-in https — no external dependencies, no fetch polyfill needed.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 9000;

function nodeGet(rawUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch(e) { return reject(new Error(`Bad URL: ${rawUrl}`)); }

    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':          'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...opts.headers,
      },
    };

    const req = lib.request(options, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location && (opts._r||0) < 3) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${url.protocol}//${url.host}${loc}`;
        return nodeGet(loc, { ...opts, _r: (opts._r||0) + 1 }).then(resolve).catch(reject);
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

function withTimeout(p, ms = TIMEOUT_MS) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
}

async function getVidZeeStreams(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const results = await Promise.allSettled([3,4,5].map(sr => {
    const url = tv
      ? `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}&ss=${season}&ep=${episode}`
      : `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}`;
    return nodeGet(url).then(t => JSON.parse(t));
  }));
  const streams = [];
  const pick = (obj) => {
    if (obj?.url) streams.push({ name: `VidZee ${obj.quality||'Auto'}`, url: obj.url, quality: obj.quality||'Auto', provider: 'VidZee' });
    if (Array.isArray(obj?.sources)) obj.sources.forEach(s => s?.url && streams.push({ name: `VidZee ${s.quality||'Auto'}`, url: s.url, quality: s.quality||'Auto', provider: 'VidZee' }));
  };
  results.forEach(r => { if (r.status==='fulfilled') { pick(r.value); if(r.value?.data) pick(r.value.data); } });
  return streams;
}

async function getMP4HydraStreams(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const url = tv ? `https://mp4hydra.org/tv/${tmdbId}/${season}/${episode}` : `https://mp4hydra.org/movie/${tmdbId}`;
  const data = JSON.parse(await nodeGet(url));
  const streams = [];
  const list = data?.streams || (data?.url ? [data] : []);
  list.forEach(s => s?.url && streams.push({ name: `MP4Hydra ${s.quality||'Auto'}`, url: s.url, quality: s.quality||'Auto', provider: 'MP4Hydra' }));
  return streams;
}

async function getVixsrcStreams(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const url = tv ? `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}` : `https://vixsrc.to/movie/${tmdbId}`;
  const html = await nodeGet(url, { headers: { Referer: 'https://vixsrc.to/' } });
  for (const pat of [/["']([^"']*master\.m3u8[^"']*token[^"']*)["']/i, /["']([^"']*\.m3u8\?[^"']*)["']/i, /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i]) {
    const m = html.match(pat);
    if (m) { const u = m[1].startsWith('http') ? m[1] : `https://vixsrc.to${m[1]}`; return [{ name: 'Vixsrc Auto', url: u, quality: 'Auto', provider: 'Vixsrc' }]; }
  }
  const j = html.match(/"url"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/);
  if (j) return [{ name: 'Vixsrc Auto', url: j[1], quality: 'Auto', provider: 'Vixsrc' }];
  return [];
}

async function getSoaperTVStreams(tmdbId, mediaType, season, episode) {
  const tv = mediaType === 'tv';
  const url = tv ? `https://soapertv.cc/api/episode/sources/${tmdbId}/${season}/${episode}` : `https://soapertv.cc/api/movie/sources/${tmdbId}`;
  const data = JSON.parse(await nodeGet(url, { headers: { Referer: 'https://soapertv.cc/', 'X-Requested-With': 'XMLHttpRequest' } }));
  const streams = [];
  const list = data?.sources || data?.streams || (data?.url ? [data] : []);
  list.forEach(s => { if (s?.url && (s.url.includes('.m3u8') || s.url.includes('.mp4'))) streams.push({ name: `SoaperTV ${s.quality||s.label||'Auto'}`, url: s.url, quality: s.quality||s.label||'Auto', provider: 'SoaperTV' }); });
  return streams;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type, season = '1', episode = '1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'tmdbId required' })); }

  const [vidzee, mp4hydra, vixsrc, soapertv] = await Promise.allSettled([
    withTimeout(getVidZeeStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getMP4HydraStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getVixsrcStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getSoaperTVStreams(tmdbId, mediaType, season, episode)),
  ]);

  const all = [
    ...(vidzee.status==='fulfilled'   ? vidzee.value   : []),
    ...(mp4hydra.status==='fulfilled' ? mp4hydra.value : []),
    ...(vixsrc.status==='fulfilled'   ? vixsrc.value   : []),
    ...(soapertv.status==='fulfilled' ? soapertv.value : []),
  ].filter(s => s?.url?.startsWith('http'));

  const seen = new Set();
  const unique = all.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
  const order = { '1080p':0, '4K':1, '2160p':1, '720p':2, 'Auto':3 };
  unique.sort((a,b) => (order[a.quality]??9) - (order[b.quality]??9));

  if (!unique.length) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: false,
      error: 'No streams found',
      providerErrors: { vidzee: vidzee.reason?.message, mp4hydra: mp4hydra.reason?.message, vixsrc: vixsrc.reason?.message, soapertv: soapertv.reason?.message }
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ success: true, streams: unique }));
};
