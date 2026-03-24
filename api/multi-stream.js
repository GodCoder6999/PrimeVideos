// api/multi-stream.js
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

function fetchText(url, extraHeaders = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...extraHeaders },
    }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
        return fetchText(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function extractM3u8(text) {
  const patterns = [
    /https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g,
    /file:\s*["']([^"']+\.m3u8[^"']*)/g,
    /src:\s*["']([^"']+\.m3u8[^"']*)/g,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const u = (m[1] || m[0]).trim().replace(/\\/g, '');
      if (u.includes('.m3u8') && !u.includes('example') && u.startsWith('http')) found.add(u);
    }
  }
  const all = [...found];
  return all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

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

// Advanced Multi-Language Extractor
function getLanguages(rawMeta, provider) {
  const s = String(rawMeta).toLowerCase();
  let langs = [];
  
  if (s.includes('hindi') || s.match(/\bhin\b/)) langs.push('Hindi');
  if (s.includes('english') || s.match(/\beng\b/)) langs.push('English');
  if (s.includes('tamil') || s.match(/\btam\b/)) langs.push('Tamil');
  if (s.includes('telugu') || s.match(/\btel\b/)) langs.push('Telugu');
  if (s.includes('malayalam') || s.match(/\bmal\b/)) langs.push('Malayalam');
  if (s.includes('kannada') || s.match(/\bkan\b/)) langs.push('Kannada');
  if (s.includes('bengali') || s.match(/\bben\b/)) langs.push('Bengali');
  if (s.includes('marathi') || s.match(/\bmar\b/)) langs.push('Marathi');
  
  if (s.includes('multi') || s.includes('multi-audio') || s.includes('multi audio')) {
      if(!langs.includes('Multi Audio')) langs.push('Multi Audio');
  }
  if (s.includes('dual') || s.includes('dual-audio') || s.includes('dual audio')) {
      if(!langs.includes('Dual Audio')) langs.push('Dual Audio');
  }

  // Fallbacks if no explicit language tags are found
  if (langs.length === 0) {
     const p = String(provider).toLowerCase();
     if (['vidsrc', 'embed.su', 'autoembed'].some(x => p.includes(x))) {
        return 'English';
     }
     return 'Unknown';
  }
  
  return langs.join(', ');
}

function parseStreams(data, providerName) {
  const arr = data.streams || data.sources || data.data || [];
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => {
      if (s.infoHash || s.ytId) return false;
      const link = s.url || s.file || s.link;
      return link && typeof link === 'string' && link.startsWith('http');
  }).map(s => {
      const link = s.url || s.file || s.link;
      const rawMeta = s.quality || s.name || s.title || s.description || s.behaviorHints?.videoSize || '';
      return { 
        url: link, 
        quality: qualityLabel(rawMeta),
        lang: getLanguages(rawMeta, providerName),
        provider: providerName
      };
  });
}

const fetchers = [
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    const url = type === 'tv' ? `https://mediafusion.elfhosted.com/stream/series/${imdb}:${s}:${e}.json` : `https://mediafusion.elfhosted.com/stream/movie/${imdb}.json`;
    return fetchText(url).then(raw => parseStreams(JSON.parse(raw), 'MediaFusion')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    const url = type === 'tv' ? `https://nuviostreams.hayd.uk/stream/series/${imdb}:${s}:${e}.json` : `https://nuviostreams.hayd.uk/stream/movie/${imdb}.json`;
    return fetchText(url).then(raw => parseStreams(JSON.parse(raw), 'Nuvio')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    const url = type === 'tv' ? `https://vidzee.wtf/api/tv?imdb=${tmdb}&season=${s}&episode=${e}` : `https://vidzee.wtf/api/movie?imdb=${tmdb}`;
    return fetchText(url, { 'Referer': 'https://vidzee.wtf/' }).then(raw => parseStreams(JSON.parse(raw), 'VidZee')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    const url = type === 'tv' ? `https://vixsrc.to/api/tv?tmdb=${tmdb}&season=${s}&episode=${e}` : `https://vixsrc.to/api/movie?tmdb=${tmdb}`;
    return fetchText(url, { 'Referer': 'https://vixsrc.to/' }).then(raw => parseStreams(JSON.parse(raw), 'VixSrc')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    if(!imdb) return Promise.resolve([]);
    const url = type === 'tv' ? `https://mp4hydra.org/tv/${imdb}/${s}/${e}` : `https://mp4hydra.org/movie/${imdb}`;
    return fetchText(url, { 'Referer': 'https://mp4hydra.org/' }).then(raw => parseStreams(JSON.parse(raw), 'MP4Hydra')).catch(()=>[]);
  },
  (tmdb, imdb, type, s, e) => {
    const url = type === 'tv' ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdb}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tmdb}`;
    return fetchText(url, { 'Referer': 'https://vidsrc.xyz/' }).then(html => {
       const m3u8 = extractM3u8(html);
       return m3u8 ? [{ url: m3u8, quality: 'Auto', lang: 'English', provider: 'VidSrc' }] : [];
    }).catch(()=>[]);
  }
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'tmdbId required' })); }

  const imdbId = await safe(getImdbId(tmdbId, mediaType));
  
  const allResults = await Promise.allSettled(fetchers.map(f => f(tmdbId, imdbId, mediaType, season, episode)));
  
  let allStreams = [];
  allResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
          allStreams = allStreams.concat(r.value);
      }
  });

  const seen = new Set();
  const unique = allStreams.filter(s => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url); return true;
  });

  const rank = { '2160p': 6, '1080p': 5, '720p': 4, '480p': 3, '360p': 2, 'Auto': 1 };
  unique.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

  res.statusCode = 200;
  return res.end(JSON.stringify({
    success: true,
    imdbId: imdbId || null,
    // Expanded limits to ensure all MoviesMod audios are fetched
    streams: unique.slice(0, 100).map(s => ({ url: s.url, quality: s.quality, lang: s.lang }))
  }));
};
