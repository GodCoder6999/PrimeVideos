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
  return [...streams].sort((a, b) => {
    // Force MoviesMod to always be at the absolute top
    if (a._isMoviesMod && !b._isMoviesMod) return -1;
    if (!a._isMoviesMod && b._isMoviesMod) return 1;
    // Then sort by quality
    return (rank[b.quality] || 0) - (rank[a.quality] || 0);
  });
}

async function fetchMoviesModFromNuvio(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

    const raw  = await get(path, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 12000);
    const data = JSON.parse(raw);
    
    // Process all Nuvio streams to prevent the frontend iframe fallback
    const streams = (data.streams || []).filter(s => {
      if (!s.url) return false;
      return s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv');
    }).map(s => {
      const rawName = s.name || s.title || '';
      // Strip emojis, spaces, and casing to perfectly match "MoviesMod"
      const normalizedName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMoviesMod = normalizedName.includes('moviesmod');

      // Clean up the provider name for your custom UI
      let providerName = 'NuvioStream';
      if (isMoviesMod) {
        providerName = 'MoviesMod';
      } else {
        const firstLine = rawName.split('\n')[0];
        providerName = firstLine.replace(/[^\x00-\x7F]/g, "").trim() || 'NuvioStream';
      }

      return {
        url: s.url,
        quality: parseQuality(rawName),
        provider: providerName,
        type: s.url.includes('.m3u8') ? 'hls' : 'mp4',
        _isMoviesMod: isMoviesMod // internal flag for sorting
      };
    });

    return streams;
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
    // Sort streams and remove the internal flag before sending to frontend
    const sortedStreams = sortStreams(streams).map(s => {
      delete s._isMoviesMod;
      return s;
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      imdbId,
      streams: sortedStreams,
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ success: false, imdbId, error: 'No Nuvio streams found' }));
};
