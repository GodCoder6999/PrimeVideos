/**
 * api/multi-stream.js — Vercel Serverless (CommonJS)
 *
 * Returns streams at 1080p / 720p / 480p ONLY.
 * 4K is explicitly excluded because browsers cannot decode AC3/EAC3 audio
 * that almost all 4K HLS streams carry — video plays but audio is silent.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── HTTP GET with redirect following ─────────────────────────────────────────
function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 9000;
  return new Promise(function(resolve, reject) {
    var url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('Bad URL: ' + rawUrl)); }
    var lib = url.protocol === 'https:' ? https : http;
    var req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  Object.assign({
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

function safe(p) { return p.catch(function() { return null; }); }

// ── Get IMDB ID from TMDB ─────────────────────────────────────────────────────
function getImdbId(tmdbId, mediaType) {
  return nodeGet(
    'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '/external_ids?api_key=' + TMDB_KEY,
    {}, 6000
  ).then(function(raw) {
    return JSON.parse(raw).imdb_id || null;
  }).catch(function() { return null; });
}

// ── Quality helpers ────────────────────────────────────────────────────────────
// Returns a normalised quality label, or null if the stream is 4K/2160p.
// Returning null signals the caller to drop this stream entirely.
function normaliseQuality(rawLabel) {
  if (!rawLabel) return 'Auto';
  var s = String(rawLabel).toLowerCase();

  // ── DROP 4K / 2160p unconditionally ──
  if (s.includes('4k') || s.includes('2160') || s.includes('uhd')) return null;

  if (s.includes('1080')) return '1080p';
  if (s.includes('720'))  return '720p';
  if (s.includes('480'))  return '480p';
  if (s.includes('360'))  return '360p';

  // Generic "Auto" streams are kept — they will be capped by HLS.js ABR
  return 'Auto';
}

// Sort: 1080p > 720p > Auto > 480p > 360p  (best quality first, no 4K)
function sortByQuality(streams) {
  var rank = { '1080p': 5, '720p': 4, 'Auto': 3, '480p': 2, '360p': 1 };
  return streams.slice().sort(function(a, b) {
    return (rank[b.quality] || 0) - (rank[a.quality] || 0);
  });
}

// ── PROVIDER 1: NuvioStreams ───────────────────────────────────────────────────
function getNuvioStreams(imdbId, mediaType, season, episode) {
  if (!imdbId) return Promise.resolve([]);
  var url = mediaType === 'tv'
    ? 'https://nuviostreams.hayd.uk/stream/series/' + imdbId + ':' + season + ':' + episode + '.json'
    : 'https://nuviostreams.hayd.uk/stream/movie/' + imdbId + '.json';

  return nodeGet(url, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 12000)
    .then(function(raw) {
      var data = JSON.parse(raw);
      var streams = (data.streams || []).filter(function(s) {
        return s && s.url && typeof s.url === 'string' && s.url.startsWith('http') &&
          (s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv') || s.url.includes('cdn'));
      });
      var results = [];
      streams.forEach(function(s) {
        var name  = (s.name || s.title || '').toLowerCase();
        var q     = normaliseQuality(name);
        if (q === null) return;   // skip 4K
        var prov  = (s.name || '').split('\n')[0].split('|')[0].split('•')[0].trim() || 'NuvioStreams';
        results.push({ url: s.url, quality: q, provider: prov });
      });
      return results;
    })
    .catch(function() { return []; });
}

// ── PROVIDER 2: VidZee ────────────────────────────────────────────────────────
function getVidZeeStreams(tmdbId, mediaType, season, episode) {
  var tv   = mediaType === 'tv';
  var urls = [3, 4, 5].map(function(sr) {
    return tv
      ? 'https://player.vidzee.wtf/api/server?id=' + tmdbId + '&sr=' + sr + '&ss=' + season + '&ep=' + episode
      : 'https://player.vidzee.wtf/api/server?id=' + tmdbId + '&sr=' + sr;
  });

  return Promise.allSettled(urls.map(function(u) {
    return nodeGet(u, {}, 7000).then(function(t) { return JSON.parse(t); });
  })).then(function(results) {
    var found = [];
    results.forEach(function(r) {
      if (r.status !== 'fulfilled') return;
      var d = r.value;
      [d, d && d.data].forEach(function(obj) {
        if (!obj) return;
        if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) {
          var q = normaliseQuality(obj.quality || '');
          if (q !== null) found.push({ url: obj.url, quality: q, provider: 'VidZee' });
        }
        if (Array.isArray(obj.sources)) {
          obj.sources.forEach(function(s) {
            if (s && s.url && s.url.startsWith('http')) {
              var q = normaliseQuality(s.quality || '');
              if (q !== null) found.push({ url: s.url, quality: q, provider: 'VidZee' });
            }
          });
        }
      });
    });
    return found;
  }).catch(function() { return []; });
}

// ── PROVIDER 3: MP4Hydra ──────────────────────────────────────────────────────
function getMP4HydraStreams(tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? 'https://mp4hydra.org/tv/' + tmdbId + '/' + season + '/' + episode
    : 'https://mp4hydra.org/movie/' + tmdbId;

  return nodeGet(url, {}, 7000).then(function(raw) {
    var data = JSON.parse(raw);
    var list = data.streams || data.sources || (data.url ? [data] : []);
    var found = [];
    list.filter(function(s) { return s && s.url && typeof s.url === 'string' && s.url.startsWith('http'); })
      .forEach(function(s) {
        var q = normaliseQuality(s.quality || '');
        if (q !== null) found.push({ url: s.url, quality: q, provider: 'MP4Hydra' });
      });
    return found;
  }).catch(function() { return []; });
}

// ── PROVIDER 4: SoaperTV ──────────────────────────────────────────────────────
function getSoaperTVStreams(tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? 'https://soapertv.cc/api/episode/sources/' + tmdbId + '/' + season + '/' + episode
    : 'https://soapertv.cc/api/movie/sources/' + tmdbId;

  return nodeGet(url, { 'Referer': 'https://soapertv.cc/', 'X-Requested-With': 'XMLHttpRequest' }, 7000)
    .then(function(raw) {
      var data = JSON.parse(raw);
      var list = data.sources || data.streams || (data.url ? [data] : []);
      var found = [];
      list.filter(function(s) { return s && s.url && (s.url.includes('.m3u8') || s.url.includes('.mp4')); })
        .forEach(function(s) {
          var q = normaliseQuality(s.quality || s.label || '');
          if (q !== null) found.push({ url: s.url, quality: q, provider: 'SoaperTV' });
        });
      return found;
    }).catch(function() { return []; });
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
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
    var timer     = setTimeout(function() { resolve(collected); }, 12000);

    function onDone(streams) {
      if (streams && streams.length) collected = collected.concat(streams);
      pending--;
      if (pending <= 0) { clearTimeout(timer); resolve(collected); }
    }

    safe(getVidZeeStreams(tmdbId, mediaType, season, episode)).then(onDone);
    safe(getMP4HydraStreams(tmdbId, mediaType, season, episode)).then(onDone);
    safe(getSoaperTVStreams(tmdbId, mediaType, season, episode)).then(onDone);

    imdbPromise.then(function(imdbId) {
      safe(getNuvioStreams(imdbId, mediaType, season, episode)).then(onDone);
    }).catch(function() { onDone([]); });
  });

  // Deduplicate by URL
  var seen   = new Set();
  var unique = allStreams.filter(function(s) {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  var sorted = sortByQuality(unique);

  if (sorted.length === 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found (1080p/720p/480p)' }));
  }

  var imdbId = await imdbPromise;

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId || null,
    streams: sorted.slice(0, 4).map(function(s) {
      return { url: s.url, quality: s.quality, provider: s.provider, name: s.provider + ' ' + s.quality };
    }),
  }));
};
