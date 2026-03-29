// api/multi-stream.js
// Fetches streams from multiple Stremio-addon sources in parallel.
// Returns deduplicated, ranked streams with correct language labels.

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

async function fetchJson(url, timeoutMs = 9000) {
  const tryFetch = async (targetUrl) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json, */*' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) { return null; }
    finally { clearTimeout(timer); }
  };
  const direct = await tryFetch(url);
  if (direct) return direct;
  return tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
}

function detectLanguage(streamObj, sourceName) {
  const raw = [streamObj.name, streamObj.title, streamObj.description].filter(Boolean).join(' ').toLowerCase();
  const hasHindi   = /\b(hin|hindi)\b/.test(raw);
  const hasEnglish = /\b(eng|english)\b/.test(raw);
  const hasDual    = /\b(dual[\s.-]?audio|multi[\s.-]?audio)\b/.test(raw);
  const hasTamil   = /\b(tam|tamil)\b/.test(raw);
  const hasTelugu  = /\b(tel|telugu)\b/.test(raw);
  if (hasDual || (hasHindi && hasEnglish)) return 'Hindi + English';
  if (hasHindi)   return 'Hindi';
  if (hasTamil)   return 'Tamil';
  if (hasTelugu)  return 'Telugu';
  if (hasEnglish) return 'English';
  const src = sourceName.toLowerCase();
  if (src.includes('nuvio') || src.includes('moviesmod')) return 'Hindi + English';
  return 'English';
}

function detectQuality(streamObj) {
  const raw = [streamObj.name, streamObj.title, streamObj.description].filter(Boolean).join(' ').toLowerCase();
  if (/\b(2160p?|4k|uhd)\b/.test(raw)) return '4K';
  if (/\b1080p?\b/.test(raw))           return '1080p';
  if (/\b720p?\b/.test(raw))            return '720p';
  if (/\b480p?\b/.test(raw))            return '480p';
  return 'Auto';
}

function buildEndpoints(imdbId, season, episode) {
  const s = season || 1;
  const e = episode || 1;
  return [
    { name: 'Superflix', movieUrl: `https://stremio-addon.superflix.to/stream/movie/${imdbId}.json`, tvUrl: `https://stremio-addon.superflix.to/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'Nuvio',     movieUrl: `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`,       tvUrl: `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'Chillx',    movieUrl: `https://chillx.top/stream/movie/${imdbId}.json`,                 tvUrl: `https://chillx.top/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'JaMovies',  movieUrl: `https://jamovies.baby/stream/movie/${imdbId}.json`,               tvUrl: `https://jamovies.baby/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'CineSnatch',movieUrl: `https://cinesnatch.vercel.app/stream/movie/${imdbId}.json`,       tvUrl: `https://cinesnatch.vercel.app/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'WatchHub',  movieUrl: `https://watchhub.store/stream/movie/${imdbId}.json`,              tvUrl: `https://watchhub.store/stream/series/${imdbId}:${s}:${e}.json` },
    { name: 'NetZone',   movieUrl: `https://netzone.hayd.uk/stream/movie/${imdbId}.json`,             tvUrl: `https://netzone.hayd.uk/stream/series/${imdbId}:${s}:${e}.json` },
  ];
}

const QUALITY_RANK  = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, 'Auto': 1 };
const LANGUAGE_RANK = { 'English': 10, 'Hindi': 8, 'Hindi + English': 6, 'Tamil': 4, 'Telugu': 3 };
const SOURCE_RANK   = { Superflix: 7, Nuvio: 6, Chillx: 5, JaMovies: 4, CineSnatch: 3, WatchHub: 2, NetZone: 1 };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) return res.end(JSON.stringify({ success: false, error: 'tmdbId required' }));

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const px    = (url) => `${proto}://${host}/api/proxy?url=${encodeURIComponent(url)}`;

  let imdbId = null;
  try {
    const d = await fetchJson(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
    imdbId = d?.imdb_id || null;
  } catch (_) {}

  if (!imdbId) return res.end(JSON.stringify({ success: false, error: 'No IMDB ID found.' }));

  const endpoints = buildEndpoints(imdbId, season, episode);
  const rawStreams = [];

  await Promise.all(endpoints.map(async (ep) => {
    const url  = type === 'tv' ? ep.tvUrl : ep.movieUrl;
    const data = await fetchJson(url);
    if (!data?.streams) return;
    for (const s of data.streams) {
      if (!s.url || s.url.startsWith('magnet:') || s.url.length < 20) continue;
      rawStreams.push({
        url:     px(s.url),
        quality: detectQuality(s),
        language:detectLanguage(s, ep.name),
        source:  ep.name,
        type:    s.url.includes('.m3u8') ? 'hls' : 'mp4',
      });
    }
  }));

  if (rawStreams.length === 0) return res.end(JSON.stringify({ success: false, error: 'No streams found.' }));

  const buckets = new Map();
  for (const s of rawStreams) {
    const key = `${s.language}|${s.quality}`;
    const ex  = buckets.get(key);
    if (!ex) { buckets.set(key, s); continue; }
    if (s.type === 'hls' && ex.type !== 'hls') { buckets.set(key, s); continue; }
    if (s.type === ex.type && (SOURCE_RANK[s.source] ?? 0) > (SOURCE_RANK[ex.source] ?? 0)) buckets.set(key, s);
  }

  const deduped = Array.from(buckets.values()).sort((a, b) => {
    const ld = (LANGUAGE_RANK[b.language] ?? 2) - (LANGUAGE_RANK[a.language] ?? 2);
    if (ld !== 0) return ld;
    const qd = (QUALITY_RANK[b.quality] ?? 0) - (QUALITY_RANK[a.quality] ?? 0);
    if (qd !== 0) return qd;
    return (SOURCE_RANK[b.source] ?? 0) - (SOURCE_RANK[a.source] ?? 0);
  });

  return res.end(JSON.stringify({ success: true, streams: deduped }));
};
