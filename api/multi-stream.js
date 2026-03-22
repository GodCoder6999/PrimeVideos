/**
 * api/multi-stream.js — Vercel Serverless (CommonJS)
 *
 * Calls the NuvioStreams Stremio addon API + fallback providers.
 * NuvioStreams aggregates from VidSrc, VidZee, MP4Hydra etc server-side
 * and returns real, working direct stream URLs in a clean JSON format.
 *
 * Provider order (all fire in parallel, first valid URL wins):
 *   1. NuvioStreams    — Stremio addon, aggregates many sources, best quality
 *   2. VidZee         — direct API, returns mp4/m3u8
 *   3. MP4Hydra       — direct API, returns mp4
 *   4. SoaperTV       — direct API, returns m3u8/mp4
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── Robust HTTP GET with redirect following and per-call timeout ──────────────
function nodeGet(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 9000;

  return new Promise(function(resolve, reject) {
    var url;
    try { url = new URL(rawUrl); }
    catch (e) { return reject(new Error('Bad URL: ' + rawUrl)); }

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
      // Follow redirects up to 5 times
      if ([301,302,307,308].indexOf(res.statusCode) !== -1 && res.headers.location) {
        var loc = res.headers.location;
        if (!loc.startsWith('http')) loc = url.protocol + '//' + url.host + loc;
        return nodeGet(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' from ' + url.hostname));
      }
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
    var d = JSON.parse(raw);
    return d.imdb_id || null;
  }).catch(function() { return null; });
}

// ── PROVIDER 1: NuvioStreams Stremio addon ────────────────────────────────────
// This is the main source. It calls multiple real stream providers server-side
// and returns working direct mp4/m3u8 URLs in a clean Stremio JSON format.
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
      return streams.map(function(s) {
        var name = (s.name || s.title || '').toLowerCase();
        var q = name.includes('2160') || name.includes('4k') ? '4K'
              : name.includes('1080') ? '1080p'
              : name.includes('720')  ? '720p'
              : name.includes('480')  ? '480p' : 'Auto';
        var provider = (s.name || '').split('\n')[0].split('|')[0].split('•')[0].trim() || 'NuvioStreams';
        return { url: s.url, quality: q, provider: provider };
      });
    })
    .catch(function() { return []; });
}

// ── PROVIDER 2: VidZee direct API ────────────────────────────────────────────
function getVidZeeStreams(tmdbId, mediaType, season, episode) {
  var tv = mediaType === 'tv';
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
      var objs = [d, d && d.data];
      objs.forEach(function(obj) {
        if (!obj) return;
        if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) {
          var q = (obj.quality || '').toLowerCase();
          found.push({ url: obj.url, quality: q.includes('1080') ? '1080p' : q.includes('720') ? '720p' : 'Auto', provider: 'VidZee' });
        }
        if (Array.isArray(obj.sources)) {
          obj.sources.forEach(function(s) {
            if (s && s.url && s.url.startsWith('http')) {
              var q = (s.quality || '').toLowerCase();
              found.push({ url: s.url, quality: q.includes('1080') ? '1080p' : q.includes('720') ? '720p' : 'Auto', provider: 'VidZee' });
            }
          });
        }
      });
    });
    return found;
  }).catch(function() { return []; });
}

// ── PROVIDER 3: MP4Hydra direct API ──────────────────────────────────────────
function getMP4HydraStreams(tmdbId, mediaType, season, episode) {
  var tv = mediaType === 'tv';
  var url = tv
    ? 'https://mp4hydra.org/tv/' + tmdbId + '/' + season + '/' + episode
    : 'https://mp4hydra.org/movie/' + tmdbId;

  return nodeGet(url, {}, 7000).then(function(raw) {
    var data = JSON.parse(raw);
    var list = data.streams || data.sources || (data.url ? [data] : []);
    return list
      .filter(function(s) { return s && s.url && typeof s.url === 'string' && s.url.startsWith('http'); })
      .map(function(s) {
        var q = (s.quality || '').toLowerCase();
        return { url: s.url, quality: q.includes('1080') ? '1080p' : q.includes('720') ? '720p' : 'Auto', provider: 'MP4Hydra' };
      });
  }).catch(function() { return []; });
}

// ── PROVIDER 4: SoaperTV API ──────────────────────────────────────────────────
function getSoaperTVStreams(tmdbId, mediaType, season, episode) {
  var tv = mediaType === 'tv';
  var url = tv
    ? 'https://soapertv.cc/api/episode/sources/' + tmdbId + '/' + season + '/' + episode
    : 'https://soapertv.cc/api/movie/sources/' + tmdbId;

  return nodeGet(url, { 'Referer': 'https://soapertv.cc/', 'X-Requested-With': 'XMLHttpRequest' }, 7000)
    .then(function(raw) {
      var data = JSON.parse(raw);
      var list = data.sources || data.streams || (data.url ? [data] : []);
      return list
        .filter(function(s) { return s && s.url && (s.url.includes('.m3u8') || s.url.includes('.mp4')); })
        .map(function(s) {
          var q = (s.quality || s.label || '').toLowerCase();
          return { url: s.url, quality: q.includes('1080') ? '1080p' : q.includes('720') ? '720p' : 'Auto', provider: 'SoaperTV' };
        });
    }).catch(function() { return []; });
}

// ── Quality sort: 1080p > 720p > 4K > 480p > Auto ────────────────────────────
function sortByQuality(streams) {
  var rank = { '1080p': 5, '720p': 4, '4K': 3, '480p': 2, 'Auto': 1 };
  return streams.slice().sort(function(a, b) {
    return (rank[b.quality] || 1) - (rank[a.quality] || 1);
  });
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

  // Get IMDB ID — needed for NuvioStreams (best provider)
  // Fires in parallel with TMDB-id providers so nothing blocks
  var imdbPromise = safe(getImdbId(tmdbId, mediaType));

  // All providers race — collect ALL their streams, pick best quality winner
  var allStreams = await new Promise(function(resolve) {
    var collected = [];
    var pending   = 4; // 3 tmdb-id providers + 1 imdb-dependent batch
    var timer     = setTimeout(function() { resolve(collected); }, 12000);

    function onDone(streams) {
      if (streams && streams.length) collected = collected.concat(streams);
      pending--;
      if (pending <= 0) { clearTimeout(timer); resolve(collected); }
    }

    // Providers that work with TMDB ID — start immediately
    safe(getVidZeeStreams(tmdbId, mediaType, season, episode)).then(onDone);
    safe(getMP4HydraStreams(tmdbId, mediaType, season, episode)).then(onDone);
    safe(getSoaperTVStreams(tmdbId, mediaType, season, episode)).then(onDone);

    // NuvioStreams needs IMDB ID — fires as soon as we have it
    imdbPromise.then(function(imdbId) {
      safe(getNuvioStreams(imdbId, mediaType, season, episode)).then(onDone);
    }).catch(function() { onDone([]); });
  });

  // Deduplicate by URL
  var seen    = new Set();
  var unique  = allStreams.filter(function(s) {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  var sorted = sortByQuality(unique);

  if (sorted.length === 0) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: false, error: 'No streams found from any provider' }));
  }

  var imdbId = await imdbPromise;

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId:  imdbId || null,
    // Return top 3 sorted streams so player can try fallbacks
    streams: sorted.slice(0, 3).map(function(s) {
      return { url: s.url, quality: s.quality, provider: s.provider, name: s.provider + ' ' + s.quality };
    }),
  }));
};
