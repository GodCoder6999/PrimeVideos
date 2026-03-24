// api/multi-stream.js
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── HTTP GET helper ───────────────────────────────────────────────────────────
function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 9000;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'application/json, text/plain, */*',
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

function safe(p) { return p.catch(() => []); }

// ── IMDB ID ───────────────────────────────────────────────────────────────────
function getImdbId(tmdbId, mediaType) {
  return nodeGet(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
    {}, 5000
  ).then(raw => JSON.parse(raw).imdb_id || null).catch(() => null);
}

// ── Quality normaliser ────────────────────────────────────────────────────────
function qualityLabel(raw) {
  if (!raw) return 'Auto';
  const s = String(raw).toLowerCase();
  if (s.includes('2160') || s.includes('4k') || s.includes('uhd')) return '2160p';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  if (s.includes('360'))  return '360p';
  return 'Auto';
}

// ── Language detection ────────────────────────────────────────────────────────
// Reads all language hints from a stream name/title/description/label string.
// Returns a comma-separated list like "Hindi, English", "Multi", or "Unknown".
function detectLanguage(raw) {
  if (!raw) return 'Unknown';
  const s = String(raw).toLowerCase();

  // Multi-audio explicit keywords (highest priority)
  if (s.includes('multi audio') || s.includes('multi-audio') || s.includes('multiaudio')) return 'Multi';
  if (s.includes('dual audio')  || s.includes('dual-audio')  || s.includes('dualaudio'))  return 'Dual';

  const langs = [];
  if (s.includes('hindi')      || s.match(/\bhin\b/))   langs.push('Hindi');
  if (s.includes('english')    || s.match(/\beng\b/))   langs.push('English');
  if (s.includes('tamil')      || s.match(/\btam\b/))   langs.push('Tamil');
  if (s.includes('telugu')     || s.match(/\btel\b/))   langs.push('Telugu');
  if (s.includes('malayalam')  || s.match(/\bmal\b/))   langs.push('Malayalam');
  if (s.includes('kannada')    || s.match(/\bkan\b/))   langs.push('Kannada');
  if (s.includes('bengali')    || s.match(/\bben\b/))   langs.push('Bengali');
  if (s.includes('marathi')    || s.match(/\bmar\b/))   langs.push('Marathi');
  if (s.includes('punjabi')    || s.match(/\bpun\b/))   langs.push('Punjabi');
  if (s.includes('gujarati')   || s.match(/\bguj\b/))   langs.push('Gujarati');
  if (s.includes('japanese')   || s.match(/\bjpn\b/))   langs.push('Japanese');
  if (s.includes('korean')     || s.match(/\bkor\b/))   langs.push('Korean');
  if (s.includes('chinese')    || s.match(/\bchi\b/))   langs.push('Chinese');
  if (s.includes('french')     || s.match(/\bfre\b/))   langs.push('French');
  if (s.includes('german')     || s.match(/\bger\b/))   langs.push('German');
  if (s.includes('spanish')    || s.match(/\bspa\b/))   langs.push('Spanish');
  if (s.includes('italian')    || s.match(/\bita\b/))   langs.push('Italian');
  if (s.includes('portuguese') || s.match(/\bpor\b/))   langs.push('Portuguese');
  if (s.includes('russian')    || s.match(/\brus\b/))   langs.push('Russian');
  if (s.includes('arabic')     || s.match(/\bara\b/))   langs.push('Arabic');

  if (langs.length >= 3) return 'Multi';
  if (langs.length === 2) return langs.join(', ');
  if (langs.length === 1) return langs[0];
  return 'Unknown';
}

// ── Stremio addon stream parser ───────────────────────────────────────────────
// Stremio addons return separate stream objects for each audio/quality variant.
// We keep ALL of them — they are distinguished by lang/quality, not just URL.
function parseStremioStreams(data, defaultProvider) {
  const arr = data.streams || [];
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => {
    if (s.infoHash || s.ytId || s.externalUrl) return false; // skip torrents
    const link = s.url || s.file || s.link;
    return link && typeof link === 'string' && link.startsWith('http');
  }).map(s => {
    const link = s.url || s.file || s.link;
    // Combine all text fields — quality + language are embedded in name/title/description
    const meta = [s.name, s.title, s.description].filter(Boolean).join(' ');
    return {
      url:      link,
      quality:  qualityLabel(meta),
      lang:     detectLanguage(meta),
      provider: defaultProvider,
    };
  });
}

// ── Generic direct-API stream parser ─────────────────────────────────────────
function parseDirectStreams(data, defaultProvider) {
  const arr = data.streams || data.sources || data.data || (data.url ? [data] : []);
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => {
    if (s.infoHash || s.ytId) return false;
    const link = s.url || s.file || s.link || s.src;
    return link && typeof link === 'string' && link.startsWith('http');
  }).map(s => {
    const link = s.url || s.file || s.link || s.src;
    const meta = [s.quality, s.label, s.name, s.title, s.lang, s.language, s.description].filter(Boolean).join(' ');
    return {
      url:      link,
      quality:  qualityLabel(meta),
      lang:     detectLanguage(meta),
      provider: defaultProvider,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCHERS
// ═══════════════════════════════════════════════════════════════════════════

// 1. MediaFusion (Stremio) — aggregates dozens of sources incl. multi-audio
function fetchMediaFusion(imdbId, type, s, e) {
  if (!imdbId) return Promise.resolve([]);
  const url = type === 'tv'
    ? `https://mediafusion.elfhosted.com/stream/series/${imdbId}:${s}:${e}.json`
    : `https://mediafusion.elfhosted.com/stream/movie/${imdbId}.json`;
  return nodeGet(url, {}, 12000)
    .then(raw => parseStremioStreams(JSON.parse(raw), 'MediaFusion'))
    .catch(() => []);
}

// 2. NuvioStreams (Stremio) — multi-audio HLS streams
function fetchNuvio(imdbId, type, s, e) {
  if (!imdbId) return Promise.resolve([]);
  const url = type === 'tv'
    ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json`
    : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;
  return nodeGet(url, {}, 12000)
    .then(raw => parseStremioStreams(JSON.parse(raw), 'NuvioStreams'))
    .catch(() => []);
}

// 3. VidSrc.xyz embed scraper
function fetchVidSrc(tmdbId, imdbId, type, s, e) {
  const tv = type === 'tv';
  const candidates = [];
  if (imdbId) {
    candidates.push(tv
      ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}`
      : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`
    );
  }
  candidates.push(tv
    ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}`
    : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
  );
  const m3u8Re = /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g;
  return Promise.all(candidates.map(url =>
    nodeGet(url, { 'Referer': 'https://vidsrc.xyz/' }, 8000).then(html => {
      const found = []; let match;
      while ((match = m3u8Re.exec(html)) !== null) {
        const u = match[1];
        if (!u.includes('audio') && !u.includes('subtitle'))
          found.push({ url: u, quality: 'Auto', lang: 'Unknown', provider: 'VidSrc' });
      }
      return found;
    }).catch(() => [])
  )).then(r => r.flat());
}

// 4. VixSrc direct API
function fetchVixSrc(tmdbId, type, s, e) {
  const url = type === 'tv'
    ? `https://vixsrc.to/api/tv?tmdb=${tmdbId}&season=${s}&episode=${e}`
    : `https://vixsrc.to/api/movie?tmdb=${tmdbId}`;
  return nodeGet(url, { 'Referer': 'https://vixsrc.to/' }, 8000)
    .then(raw => parseDirectStreams(JSON.parse(raw), 'VixSrc'))
    .catch(() => []);
}

// 5. MP4Hydra direct API
function fetchMP4Hydra(imdbId, type, s, e) {
  if (!imdbId) return Promise.resolve([]);
  const url = type === 'tv'
    ? `https://mp4hydra.org/tv/${imdbId}/${s}/${e}`
    : `https://mp4hydra.org/movie/${imdbId}`;
  return nodeGet(url, { 'Referer': 'https://mp4hydra.org/' }, 8000)
    .then(raw => parseDirectStreams(JSON.parse(raw), 'MP4Hydra'))
    .catch(() => []);
}

// 6. Vidlink — known for multi-language Indian content
function fetchVidlink(tmdbId, type, s, e) {
  const url = type === 'tv'
    ? `https://vidlink.pro/api/b/tv?id=${tmdbId}&season=${s}&episode=${e}&multiLang=1`
    : `https://vidlink.pro/api/b/movie?id=${tmdbId}&multiLang=1`;
  return nodeGet(url, { 'Referer': 'https://vidlink.pro/' }, 8000)
    .then(raw => {
      const data = JSON.parse(raw);
      const out  = [];
      if (data.stream && data.stream.playlist)
        out.push({ url: data.stream.playlist, quality: 'Auto', lang: 'Multi', provider: 'Vidlink' });
      if (Array.isArray(data.sources))
        data.sources.forEach(src => {
          const link = src.file || src.url;
          if (link && link.startsWith('http')) {
            const meta = [src.label, src.type].filter(Boolean).join(' ');
            out.push({ url: link, quality: qualityLabel(meta), lang: detectLanguage(meta) || 'Unknown', provider: 'Vidlink' });
          }
        });
      return out;
    }).catch(() => []);
}

// 7. VidZee (corrected URL)
function fetchVidZee(tmdbId, type, s, e) {
  const url = type === 'tv'
    ? `https://player.vidzee.wtf/api/server?id=${tmdbId}&ss=${s}&ep=${e}&sr=3`
    : `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=3`;
  return nodeGet(url, { 'Referer': 'https://player.vidzee.wtf/' }, 8000)
    .then(raw => {
      const data = JSON.parse(raw);
      const out  = [];
      [data, data && data.data].forEach(obj => {
        if (!obj) return;
        if (obj.url && obj.url.startsWith('http')) {
          const meta = obj.quality || '';
          out.push({ url: obj.url, quality: qualityLabel(meta), lang: detectLanguage(meta), provider: 'VidZee' });
        }
        if (Array.isArray(obj.sources)) {
          obj.sources.forEach(src => {
            const link = src.url || src.file;
            if (link && link.startsWith('http')) {
              const meta = src.quality || src.label || '';
              out.push({ url: link, quality: qualityLabel(meta), lang: detectLanguage(meta), provider: 'VidZee' });
            }
          });
        }
      });
      return out;
    }).catch(() => []);
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

  // Fire all fetchers in parallel
  const results = await Promise.allSettled([
    safe(fetchMediaFusion(imdbId, mediaType, season, episode)),
    safe(fetchNuvio(imdbId, mediaType, season, episode)),
    safe(fetchVidSrc(tmdbId, imdbId, mediaType, season, episode)),
    safe(fetchVixSrc(tmdbId, mediaType, season, episode)),
    safe(fetchMP4Hydra(imdbId, mediaType, season, episode)),
    safe(fetchVidlink(tmdbId, mediaType, season, episode)),
    safe(fetchVidZee(tmdbId, mediaType, season, episode)),
  ]);

  let allStreams = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value))
      allStreams = allStreams.concat(r.value);
  });

  // ── DEDUP by URL+lang — same URL in different languages = different entry ──
  // This ensures Hindi and English versions of the same CDN URL both survive.
  const seen = new Set();
  const unique = allStreams.filter(s => {
    if (!s || !s.url) return false;
    const key = `${s.url}||${s.lang}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Sort: 1080p first, then Hindi/Multi/English priority, 2160p last
  const qRank = { '1080p':6, '720p':5, '480p':4, '360p':3, 'Auto':2, '2160p':1 };
  const lRank = { 'Multi':10, 'Dual':9, 'Hindi':8, 'Hindi, English':8, 'English':7 };
  unique.sort((a, b) => {
    const qd = (qRank[b.quality] || 0) - (qRank[a.quality] || 0);
    if (qd !== 0) return qd;
    return (lRank[b.lang] || 0) - (lRank[a.lang] || 0);
  });

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId || null,
    // Return up to 30 streams so all language+quality variants reach the player
    streams: unique.slice(0, 30).map(s => ({
      url:      s.url,
      quality:  s.quality,
      lang:     s.lang,
      provider: s.provider,
    })),
  }));
};
