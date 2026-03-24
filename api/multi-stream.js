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

// Map the language based on the scraped tags OR the provider's typical language
function getLanguage(rawMeta, provider) {
  const s = String(rawMeta).toLowerCase();
  if (s.includes('hindi') || s.match(/\bhin\b/)) return 'Hindi';
  if (s.includes('english') || s.match(/\beng\b/)) return 'English';
  if (s.includes('tamil') || s.match(/\btam\b/)) return 'Tamil';
  if (s.includes('telugu') || s.match(/\btel\b/)) return 'Telugu';
  if (s.includes('multi')) return 'Multi-Audio';
  
  const p = String(provider).toLowerCase();
  if (p.includes('vidsrc') || p.includes('vixsrc') || p.includes('autoembed') || p.includes('embed.su')) {
    return 'English / Original';
  }
  return 'Hindi / Dual Audio';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, error: 'Missing tmdbId' })); }

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const s = season;
  const e = episode;

  let imdbId = null;
  try {
    const data = await fetchText(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
    imdbId = JSON.parse(data).imdb_id;
  } catch (_) {}

  const allStreams = [];

  const addStream = (url, q, prov) => {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      allStreams.push({ url, quality: qualityLabel(q), provider: prov, lang: getLanguage(q, prov) });
    }
  };

  const tasks = [
    // 1. VidSrc (English)
    (async () => {
      try {
        const url = imdbId 
          ? (mediaType === 'tv' ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`)
          : (mediaType === 'tv' ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`);
        const html = await fetchText(url, { Referer: 'https://vidsrc.xyz/' });
        const m3u8 = extractM3u8(html);
        if (m3u8) addStream(m3u8, 'Auto', 'VidSrc');
      } catch(_) {}
    })(),
    // 2. Embed.su (English)
    (async () => {
      try {
        const url = mediaType === 'tv' ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` : `https://embed.su/embed/movie/${tmdbId}`;
        const html = await fetchText(url, { Referer: 'https://embed.su/' });
        const direct = extractM3u8(html);
        if (direct) addStream(direct, 'Auto', 'Embed.su');
      } catch(_) {}
    })(),
    // 3. MoviesAPI (Hindi)
    (async () => {
      try {
        const url = mediaType === 'tv' ? `https://moviesapi.club/tv/${tmdbId}-${s}-${e}` : `https://moviesapi.club/movie/${tmdbId}`;
        const html = await fetchText(url, { Referer: 'https://moviesapi.club/' });
        const m3u8 = extractM3u8(html);
        if (m3u8) addStream(m3u8, 'Auto', 'MoviesAPI');
      } catch(_) {}
    })(),
    // 4. VidZee (Hindi)
    (async () => {
      try {
        const url = mediaType === 'tv' ? `https://vidzee.wtf/api/tv?imdb=${tmdbId}&season=${s}&episode=${e}` : `https://vidzee.wtf/api/movie?imdb=${tmdbId}`;
        const raw = await fetchText(url, { Referer: 'https://vidzee.wtf/' });
        const parsed = JSON.parse(raw);
        const arr = parsed.streams || parsed.sources || [];
        arr.forEach(x => addStream(x.url || x.file, x.quality || x.label, 'VidZee'));
      } catch(_) {}
    })(),
    // 5. NuvioStreams (Hindi/Multi)
    (async () => {
      if(!imdbId) return;
      try {
        const url = mediaType === 'tv' ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json` : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;
        const raw = await fetchText(url, { Referer: 'https://nuviostreams.hayd.uk/' });
        const parsed = JSON.parse(raw);
        (parsed.streams || []).forEach(x => addStream(x.url, x.name || x.title, 'NuvioStreams'));
      } catch(_) {}
    })(),
    // 6. MediaFusion (Multi)
    (async () => {
      if(!imdbId) return;
      try {
        const url = mediaType === 'tv' ? `https://mediafusion.elfhosted.com/stream/series/${imdbId}:${s}:${e}.json` : `https://mediafusion.elfhosted.com/stream/movie/${imdbId}.json`;
        const raw = await fetchText(url);
        const parsed = JSON.parse(raw);
        (parsed.streams || []).forEach(x => {
          if (!x.infoHash && !x.ytId) {
             addStream(x.url || x.file, x.description || x.name || x.title, 'MediaFusion');
          }
        });
      } catch(_) {}
    })()
  ];

  await Promise.allSettled(tasks);

  const seen = new Set();
  const unique = allStreams.filter(x => {
    if (seen.has(x.url)) return false;
    seen.add(x.url); return true;
  });

  const rank = { '2160p': 6, '1080p': 5, '720p': 4, '480p': 3, '360p': 2, 'Auto': 1 };
  unique.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    imdbId,
    streams: unique.slice(0, 30)
  }));
};
