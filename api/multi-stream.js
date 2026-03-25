// api/multi-stream.js — Vercel Serverless, CommonJS
// Replaced to strictly act as a proxy for MoviesMod from NuvioStreams.
// This ensures your frontend uses MoviesMod regardless of the endpoint requested.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function get(rawUrl, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'application/json, */*', 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
        return get(loc, headers, timeoutMs).then(resolve).catch(reject);
      }
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

async function getImdbId(tmdbId, mediaType) {
  try {
    const data = JSON.parse(await get(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`
    ));
    return data.imdb_id || null;
  } catch (_) { return null; }
}

function parseQuality(str) {
  const s = str.toLowerCase();
  if (s.includes('2160') || s.includes('4k'))  return '4K';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  return 'Auto';
}

function sortStreams(streams) {
  const rank = { '1080p': 5, '720p': 4, '4K': 3, '480p': 2, 'Auto': 1 };
  return [...streams].sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));
}

async function fetchMoviesModFromNuvio(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

    const raw  = await get(path, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 12000);
    const data = JSON.parse(raw);
    
    // Filter strictly for "MoviesMod" streams
    const streams = (data.streams || []).filter(s => {
      if (!s.url) return false;
      const nameStr = (s.name || s.title || '').toLowerCase();
      if (!nameStr.includes('moviesmod')) return false;
      return s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv');
    });

    return streams.map(s => ({
      url:      s.url,
      quality:  parseQuality(s.name || s.title || ''),
      provider: 'MoviesMod',
      type:     s.url.includes('.m3u8') ? 'hls' : 'mp4',
    }));
  } catch (e) {
    console.warn('[nuvio-proxy] fetch error:', e.message);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
  }

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const imdbId = await getImdbId(tmdbId, mediaType);
  const streams = await fetchMoviesModFromNuvio(imdbId, mediaType, season, episode);

  if (streams.length > 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      imdbId,
      streams: sortStreams(streams),
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ success: false, imdbId, error: 'No MoviesMod streams found' }));
};
