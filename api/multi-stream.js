// api/multi-stream.js
// Fetches ONLY MoviessMod streams via NuvioStreams, rewrites all URLs through /api/proxy.
// No iframes. No other providers.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Robust HTTP GET ───────────────────────────────────────────────────────────
function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 12000;
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL: ' + rawUrl)); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  Object.assign({ 'User-Agent': UA, 'Accept': 'application/json, */*' }, extraHeaders),
    }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
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

// ── TMDB → IMDb ID ────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
  try {
    const raw = await nodeGet(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
      {}, 6000
    );
    return JSON.parse(raw).imdb_id || null;
  } catch (_) { return null; }
}

// ── Quality extraction from filename/title string ─────────────────────────────
function extractQuality(str) {
  if (!str) return 'Auto';
  const s = str.toLowerCase();
  if (s.includes('2160') || s.includes('4k') || s.includes('uhd')) return '4K';
  if (s.includes('1080'))  return '1080p';
  if (s.includes('720'))   return '720p';
  if (s.includes('480'))   return '480p';
  if (s.includes('360'))   return '360p';
  return 'Auto';
}

// ── Language extraction from filename/title string ────────────────────────────
function extractLanguage(str) {
  if (!str) return 'Unknown';
  const s = str.toLowerCase();
  if (s.includes('multi audio') || s.includes('multi-audio') || s.includes('multiaudio')) return 'Multi';
  if (s.includes('dual audio')  || s.includes('dual-audio')  || s.includes('dualaudio'))  return 'Dual';

  const langs = [];
  if (s.includes('hindi')     || s.match(/\bhin\b/))  langs.push('Hindi');
  if (s.includes('english')   || s.match(/\beng\b/))  langs.push('English');
  if (s.includes('tamil')     || s.match(/\btam\b/))  langs.push('Tamil');
  if (s.includes('telugu')    || s.match(/\btel\b/))  langs.push('Telugu');
  if (s.includes('malayalam') || s.match(/\bmal\b/))  langs.push('Malayalam');
  if (s.includes('kannada')   || s.match(/\bkan\b/))  langs.push('Kannada');
  if (s.includes('bengali')   || s.match(/\bben\b/))  langs.push('Bengali');
  if (s.includes('korean')    || s.match(/\bkor\b/))  langs.push('Korean');
  if (s.includes('japanese')  || s.match(/\bjpn\b/))  langs.push('Japanese');

  if (langs.length >= 3) return 'Multi';
  if (langs.length === 2) return langs.join(', ');
  if (langs.length === 1) return langs[0];
  return 'Unknown';
}

// ── Enforce proxy: rewrite URL to go through /api/proxy ──────────────────────
function proxyUrl(rawUrl, baseOrigin) {
  if (!rawUrl || !rawUrl.startsWith('http')) return rawUrl;
  return `${baseOrigin}/api/proxy?url=${encodeURIComponent(rawUrl)}`;
}

// ── NuvioStreams fetch — returns all MoviessMod streams only ──────────────────
async function fetchNuvioMoviesMod(imdbId, mediaType, season, episode, baseOrigin) {
  if (!imdbId) return [];

  const url = mediaType === 'tv'
    ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
    : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

  let raw;
  try { raw = await nodeGet(url, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 15000); }
  catch (_) { return []; }

  let data;
  try { data = JSON.parse(raw); }
  catch (_) { return []; }

  const streams = data.streams || [];
  const results = [];

  for (const s of streams) {
    // ── STRICT FILTER: only MoviessMod ──
    const meta = [s.name, s.title, s.description, s.behaviorHints?.filename].filter(Boolean).join(' ').toLowerCase();
    if (!meta.includes('moviesmod')) continue;

    const rawUrl = s.url || s.file;
    if (!rawUrl || !rawUrl.startsWith('http')) continue;

    // Skip torrents / infoHash streams
    if (s.infoHash || s.ytId) continue;

    const quality  = extractQuality(meta);
    const language = extractLanguage(meta);
    const filename = s.behaviorHints?.filename || s.title || s.name || '';

    // Determine stream type
    const isHls = rawUrl.includes('.m3u8') || rawUrl.includes('m3u');
    const isMkv = rawUrl.toLowerCase().includes('.mkv');
    const isMp4 = rawUrl.toLowerCase().includes('.mp4');
    const type   = isHls ? 'hls' : isMkv ? 'mkv' : isMp4 ? 'mp4' : 'unknown';

    results.push({
      url:      proxyUrl(rawUrl, baseOrigin), // all URLs go through /api/proxy
      rawUrl,                                  // kept for logging only
      quality,
      language,
      type,
      filename,
      provider: 'MoviessMod',
    });
  }

  return results;
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

  // Derive base origin for building proxy URLs
  const proto      = req.headers['x-forwarded-proto'] || 'https';
  const host       = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const baseOrigin = `${proto}://${host}`;

  // Step 1: Translate TMDB → IMDb (NuvioStreams requires IMDb)
  const imdbId = await getImdbId(tmdbId, mediaType);
  if (!imdbId) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'Could not resolve IMDb ID for this title.' }));
  }

  // Step 2: Fetch and filter MoviessMod streams
  const streams = await fetchNuvioMoviesMod(imdbId, mediaType, season, episode, baseOrigin);

  if (streams.length === 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: false,
      imdbId,
      error: 'No MoviessMod streams found for this title.',
    }));
  }

  // Step 3: Sort — 1080p first, then 720p, 4K last (4K has AC3 browser issues)
  const qRank = { '1080p': 5, '720p': 4, '480p': 3, '360p': 2, 'Auto': 1, '4K': 0 };
  const lRank = { 'Multi': 10, 'Dual': 9, 'Hindi': 8, 'Hindi, English': 8, 'English': 7 };
  streams.sort((a, b) => {
    const qd = (qRank[b.quality] || 0) - (qRank[a.quality] || 0);
    if (qd !== 0) return qd;
    return (lRank[b.language] || 0) - (lRank[a.language] || 0);
  });

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId,
    count:   streams.length,
    streams: streams.map(s => ({
      url:      s.url,       // proxied URL
      quality:  s.quality,
      language: s.language,
      type:     s.type,
      filename: s.filename,
      provider: s.provider,
    })),
  }));
};
