// api/multi-stream.js
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 8000;
  return new Promise(function(resolve, reject) {
    var url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL')); }
    var lib = url.protocol === 'https:' ? https : http;
    var req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  Object.assign({
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept':          'application/json, text/plain, */*',
      }, extraHeaders),
    }, function(res) {
      if ([301, 302, 307, 308].indexOf(res.statusCode) !== -1 && res.headers.location) {
        var loc = res.headers.location;
        if (!loc.startsWith('http')) loc = url.protocol + '//' + url.host + loc;
        return nodeGet(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function()  { resolve(Buffer.concat(chunks).toString('utf-8')); });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, function() { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function safe(p) { return p.catch(function() { return []; }); }

function getImdbId(tmdbId, mediaType) {
  return nodeGet('https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '/external_ids?api_key=' + TMDB_KEY, {}, 5000)
    .then(raw => JSON.parse(raw).imdb_id || null)
    .catch(() => null);
}

function qualityLabel(raw) {
  if (!raw) return 'Auto';
  var s = String(raw).toLowerCase();
  if (s.includes('2160') || s.includes('4k') || s.includes('uhd')) return '2160p';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  if (s.includes('360'))  return '360p';
  return 'Auto';
}

function parseStreams(data, defaultProv) {
  let arr = data.streams || data.sources || data.data || [];
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => s && (s.url || s.file || s.link) && (s.url || s.file || s.link).startsWith('http')).map(s => {
      let n = (s.name || s.title || s.description || '').toLowerCase();
      let prov = defaultProv;
      if(n.includes('moviesmod')) prov = 'MoviesMod';
      else if(n.includes('uhdmovies')) prov = 'UHDMovies';
      else if(n.includes('hdhub4u')) prov = 'HDHub4u';
      else if(n.includes('moviesdrive')) prov = 'MoviesDrive';
      else if(n.includes('showbox')) prov = 'ShowBox';
      return {
          url: s.url || s.file || s.link,
          quality: qualityLabel(s.quality || s.name || s.title || s.description),
          provider: prov
      };
  });
}

const fetchers = [
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    let url = type === 'tv' ? `https://mediafusion.elfhosted.com/stream/series/${imdb}:${s}:${e}.json` : `https://mediafusion.elfhosted.com/stream/movie/${imdb}.json`;
    return nodeGet(url).then(raw => parseStreams(JSON.parse(raw), 'MediaFusion')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    let url = type === 'tv' ? `https://nuviostreams.hayd.uk/stream/series/${imdb}:${s}:${e}.json` : `https://nuviostreams.hayd.uk/stream/movie/${imdb}.json`;
    return nodeGet(url).then(raw => parseStreams(JSON.parse(raw), 'Nuvio')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    let url = type === 'tv' ? `https://vidzee.wtf/api/tv?imdb=${tmdb}&season=${s}&episode=${e}` : `https://vidzee.wtf/api/movie?imdb=${tmdb}`;
    return nodeGet(url, { 'Referer': 'https://vidzee.wtf/' }).then(raw => parseStreams(JSON.parse(raw), 'VidZee')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    let url = type === 'tv' ? `https://vixsrc.to/api/tv?tmdb=${tmdb}&season=${s}&episode=${e}` : `https://vixsrc.to/api/movie?tmdb=${tmdb}`;
    return nodeGet(url, { 'Referer': 'https://vixsrc.to/' }).then(raw => parseStreams(JSON.parse(raw), 'VixSrc')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    let url = type === 'tv' ? `https://mp4hydra.org/tv/${imdb}/${s}/${e}` : `https://mp4hydra.org/movie/${imdb}`;
    return nodeGet(url, { 'Referer': 'https://mp4hydra.org/' }).then(raw => parseStreams(JSON.parse(raw), 'MP4Hydra')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    let url = type === 'tv' ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdb}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tmdb}`;
    return nodeGet(url, { 'Referer': 'https://vidsrc.xyz/' }).then(html => {
       var m3u8Re = /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g;
       var found = []; var match;
       while ((match = m3u8Re.exec(html)) !== null) {
         if (!match[1].includes('audio') && !match[1].includes('subtitle')) {
           found.push({ url: match[1], quality: 'Auto', provider: 'VidSrc' });
         }
       }
       return found;
    }).catch(()=>[]);
  }
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  var query = req.query;
  var tmdbId = query.tmdbId;
  var mediaType = query.type === 'tv' ? 'tv' : 'movie';
  var season = query.season || '1';
  var episode = query.episode || '1';

  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'tmdbId required' })); }

  var imdbId = await safe(getImdbId(tmdbId, mediaType));

  // Run all scrapers in parallel regardless of failures
  var allResults = await Promise.allSettled(fetchers.map(f => f(tmdbId, imdbId, mediaType, season, episode)));
  
  var allStreams = [];
  allResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
          allStreams = allStreams.concat(r.value);
      }
  });

  // Deduplicate
  var seen = new Set();
  var unique = allStreams.filter(s => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url); return true;
  });

  // Sort by Quality
  var rank = { '1080p': 6, '720p': 5, '480p': 4, '360p': 3, 'Auto': 2, '2160p': 1 };
  unique.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId: imdbId || null,
    streams: unique.slice(0, 30).map(s => ({ url: s.url, quality: s.quality, provider: s.provider })),
  }));
};
