// api/multi-stream.js
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 6000; // Fast timeout so one bad source doesn't block playback
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
        'Accept-Language': 'en-US,en;q=0.9',
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
  return nodeGet('https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '/external_ids?api_key=' + TMDB_KEY, {}, 6000)
    .then(function(raw) { return JSON.parse(raw).imdb_id || null; })
    .catch(function() { return null; });
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

function sortStreams(streams) {
  var rank = { '1080p': 6, '720p': 5, '480p': 4, '360p': 3, 'Auto': 2, '2160p': 1 };
  return streams.slice().sort(function(a, b) {
    return (rank[b.quality] || 0) - (rank[a.quality] || 0);
  });
}

// ── NEW PROVIDERS ─────────────────────────────────────────────────────────────

function getNuvioStreams(imdbId, mediaType, season, episode) {
  if (!imdbId) return Promise.resolve([]);
  var url = mediaType === 'tv'
    ? 'https://nuviostreams.hayd.uk/stream/series/' + imdbId + ':' + season + ':' + episode + '.json'
    : 'https://nuviostreams.hayd.uk/stream/movie/' + imdbId + '.json';
  return nodeGet(url, { 'Referer': 'https://nuviostreams.hayd.uk/' }).then(function(raw) {
    var data = JSON.parse(raw);
    return (data.streams || []).filter(s => s && s.url && s.url.startsWith('http')).map(s => {
      return { url: s.url, quality: qualityLabel(s.name || s.title), provider: 'NuvioStreams' };
    });
  }).catch(()=>[]);
}

function getMediaFusion(imdbId, mediaType, season, episode) {
  if (!imdbId) return Promise.resolve([]);
  var url = mediaType === 'tv'
    ? 'https://mediafusion.elfhosted.com/stream/series/' + imdbId + ':' + season + ':' + episode + '.json'
    : 'https://mediafusion.elfhosted.com/stream/movie/' + imdbId + '.json';
  return nodeGet(url, {}).then(function(raw) {
    var data = JSON.parse(raw);
    return (data.streams || []).filter(s => s && s.url && s.url.startsWith('http')).map(s => {
      var n = (s.name || '').toLowerCase();
      var prov = 'MediaFusion';
      if (n.includes('uhdmovies')) prov = 'UHDMovies';
      else if (n.includes('moviesmod')) prov = 'MoviesMod';
      else if (n.includes('moviesdrive')) prov = 'MoviesDrive';
      else if (n.includes('4khdhub')) prov = '4KHDHub';
      else if (n.includes('hdhub4u')) prov = 'HDHub4u';
      else if (n.includes('topmovies')) prov = 'TopMovies';
      else if (n.includes('showbox')) prov = 'ShowBox';
      return { url: s.url, quality: qualityLabel(s.description || s.title || s.name), provider: prov };
    });
  }).catch(()=>[]);
}

function getVidZee(tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? 'https://vidzee.wtf/api/tv?imdb=' + tmdbId + '&season=' + season + '&episode=' + episode
    : 'https://vidzee.wtf/api/movie?imdb=' + tmdbId;
  return nodeGet(url, { 'Referer': 'https://vidzee.wtf/' }).then(function(raw) {
    var data = JSON.parse(raw);
    var streams = data.streams || data.sources || [];
    return streams.filter(s => s && (s.url||s.file||'').startsWith('http')).map(s => {
      return { url: s.url||s.file, quality: qualityLabel(s.quality||s.label), provider: 'VidZee' };
    });
  }).catch(()=>[]);
}

function getVixSrc(tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? 'https://vixsrc.to/api/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode
    : 'https://vixsrc.to/api/movie?tmdb=' + tmdbId;
  return nodeGet(url, { 'Referer': 'https://vixsrc.to/' }).then(function(raw) {
    var data = JSON.parse(raw);
    var streams = data.sources || data.streams || [];
    return streams.filter(s => s && (s.url||s.file||'').startsWith('http')).map(s => {
      return { url: s.url||s.file, quality: qualityLabel(s.quality||s.label), provider: 'VixSrc' };
    });
  }).catch(()=>[]);
}

function getMP4Hydra(imdbId, mediaType, season, episode) {
  if(!imdbId) return Promise.resolve([]);
  var url = mediaType === 'tv'
    ? 'https://mp4hydra.org/tv/' + imdbId + '/' + season + '/' + episode
    : 'https://mp4hydra.org/movie/' + imdbId;
  return nodeGet(url, { 'Referer': 'https://mp4hydra.org/' }).then(function(raw) {
    var data = JSON.parse(raw);
    var list = data.sources || data.streams || [];
    return list.filter(s => s && (s.url||s.src||'').startsWith('http')).map(s => {
      return { url: s.url||s.src, quality: qualityLabel(s.quality||s.label), provider: 'MP4Hydra' };
    });
  }).catch(()=>[]);
}

function getVidSrc(tmdbId, imdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? 'https://vidsrc.xyz/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode
    : 'https://vidsrc.xyz/embed/movie?tmdb=' + tmdbId;
  return nodeGet(url, { 'Referer': 'https://vidsrc.xyz/' }).then(function(html) {
    var m3u8Re = /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g;
    var found = [];
    var match;
    while ((match = m3u8Re.exec(html)) !== null) {
      if (!match[1].includes('audio') && !match[1].includes('subtitle') && !match[1].includes('example')) {
        found.push({ url: match[1], quality: 'Auto', provider: 'VidSrc' });
      }
    }
    return found;
  }).catch(()=>[]);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  var query     = req.query;
  var tmdbId    = query.tmdbId;
  var type      = query.type;
  var season    = query.season  || '1';
  var episode   = query.episode || '1';
  var mediaType = type === 'tv' ? 'tv' : 'movie';

  if (!tmdbId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));
  }

  var imdbPromise = safe(getImdbId(tmdbId, mediaType));

  var allStreams = await new Promise(function(resolve) {
    var collected = [];
    var pending   = 4;
    var timer     = setTimeout(function() { resolve(collected); }, 9000);
    function onDone(streams) {
      if (streams && streams.length) collected = collected.concat(streams);
      pending--;
      if (pending <= 0) { clearTimeout(timer); resolve(collected); }
    }
    
    safe(getVidZee(tmdbId, mediaType, season, episode)).then(onDone);
    safe(getVixSrc(tmdbId, mediaType, season, episode)).then(onDone);
    
    imdbPromise.then(function(imdbId) {
      var p1 = safe(getMP4Hydra(imdbId, mediaType, season, episode));
      var p2 = safe(getVidSrc(tmdbId, imdbId, mediaType, season, episode));
      var p3 = safe(getNuvioStreams(imdbId, mediaType, season, episode));
      
      Promise.all([p1, p2, p3]).then(function(results) {
        results.forEach(function(s) { collected = collected.concat(s); });
        onDone([]);
      });
      safe(getMediaFusion(imdbId, mediaType, season, episode)).then(onDone);
    }).catch(function() { onDone([]); onDone([]); });
  });

  var seen   = new Set();
  var unique = allStreams.filter(function(s) {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url); return true;
  });

  var sorted = sortStreams(unique);

  if (sorted.length === 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found' }));
  }

  var imdbId = await imdbPromise;
  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId || null,
    streams: sorted.slice(0, 25).map(function(s) {
      return { url: s.url, quality: s.quality, provider: s.provider };
    }),
  }));
};
