/**
 * /api/multi-stream.js  —  Vercel Serverless Function
 *
 * Fans out to 3 fast direct-stream providers IN PARALLEL:
 *   • VidZee   (3 CDN servers, pure JSON API)
 *   • MP4Hydra (direct API, returns m3u8/mp4)
 *   • Vixsrc   (HTML page scrape → extracts master.m3u8)
 *
 * Returns the first successful stream immediately, or all streams
 * if the caller wants to pick quality.
 *
 * Usage:
 *   GET /api/multi-stream?tmdbId=550&type=movie
 *   GET /api/multi-stream?tmdbId=1396&type=tv&season=1&episode=1
 *
 * Response:
 *   { success: true, streams: [{ name, url, quality, provider }] }
 *   { success: false, error: "..." }
 */

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const TIMEOUT  = 10000; // 10s per provider

// ─── helpers ──────────────────────────────────────────────────────────────────

function withTimeout(promise, ms = TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

async function safeFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ─── PROVIDER 1: VidZee ───────────────────────────────────────────────────────
// 3 CDN servers queried in parallel, returns JSON with stream URLs directly

async function getVidZeeStreams(tmdbId, mediaType, season, episode) {
  const servers = [3, 4, 5];
  const base = 'https://player.vidzee.wtf/api/server';
  const tv   = mediaType === 'tv';

  const results = await Promise.allSettled(
    servers.map(async sr => {
      const url = tv
        ? `${base}?id=${tmdbId}&sr=${sr}&ss=${season}&ep=${episode}`
        : `${base}?id=${tmdbId}&sr=${sr}`;
      const res  = await safeFetch(url);
      const data = await res.json();
      return data;
    })
  );

  const streams = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const data = r.value;
    // VidZee returns { url, quality } or { sources: [...] }
    if (data?.url) {
      streams.push({ name: `VidZee ${data.quality || 'Auto'}`, url: data.url, quality: data.quality || 'Auto', provider: 'VidZee' });
    }
    if (Array.isArray(data?.sources)) {
      for (const s of data.sources) {
        if (s?.url) streams.push({ name: `VidZee ${s.quality || 'Auto'}`, url: s.url, quality: s.quality || 'Auto', provider: 'VidZee' });
      }
    }
    // Also check nested data object
    if (data?.data?.url) {
      streams.push({ name: `VidZee ${data.data.quality || 'Auto'}`, url: data.data.url, quality: data.data.quality || 'Auto', provider: 'VidZee' });
    }
  }
  return streams;
}

// ─── PROVIDER 2: MP4Hydra ────────────────────────────────────────────────────
// Direct API, returns stream list with quality labels

async function getMP4HydraStreams(tmdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const url = tv
    ? `https://mp4hydra.org/tv/${tmdbId}/${season}/${episode}`
    : `https://mp4hydra.org/movie/${tmdbId}`;

  const res  = await safeFetch(url);
  const data = await res.json();

  const streams = [];
  // MP4Hydra returns { streams: [{ url, quality }] } or { url, quality }
  const list = data?.streams || (data?.url ? [data] : []);
  for (const s of list) {
    if (s?.url) {
      streams.push({ name: `MP4Hydra ${s.quality || 'Auto'}`, url: s.url, quality: s.quality || 'Auto', provider: 'MP4Hydra' });
    }
  }
  return streams;
}

// ─── PROVIDER 3: Vixsrc ──────────────────────────────────────────────────────
// Fetches an HTML page, extracts the master m3u8 URL embedded in it

async function getVixsrcStreams(tmdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const url = tv
    ? `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`
    : `https://vixsrc.to/movie/${tmdbId}`;

  const res  = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://vixsrc.to/',
    }
  });
  const html = await res.text();

  // Method 1: look for master.m3u8 URL with token/expires pattern
  const m3u8Match = html.match(/["']([^"']*master\.m3u8[^"']*token[^"']*)["']/i)
    || html.match(/["']([^"']*\.m3u8[^"']*)["']/i);

  if (m3u8Match) {
    const streamUrl = m3u8Match[1].startsWith('http') ? m3u8Match[1] : `https://vixsrc.to${m3u8Match[1]}`;
    return [{ name: 'Vixsrc Auto', url: streamUrl, quality: 'Auto', provider: 'Vixsrc' }];
  }

  // Method 2: look for JSON-embedded stream data
  const jsonMatch = html.match(/\{[^{}]*"url"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"[^{}]*\}/);
  if (jsonMatch) {
    return [{ name: 'Vixsrc Auto', url: jsonMatch[1], quality: 'Auto', provider: 'Vixsrc' }];
  }

  return [];
}

// ─── PROVIDER 4: SoaperTV ────────────────────────────────────────────────────
// Simple API: /api/episode/sources/{tmdbId}/{season}/{episode} or /api/movie/sources/{tmdbId}

async function getSoaperTVStreams(tmdbId, mediaType, season, episode) {
  const tv  = mediaType === 'tv';
  const url = tv
    ? `https://soapertv.cc/api/episode/sources/${tmdbId}/${season}/${episode}`
    : `https://soapertv.cc/api/movie/sources/${tmdbId}`;

  const res  = await safeFetch(url, {
    headers: { 'Referer': 'https://soapertv.cc/', 'X-Requested-With': 'XMLHttpRequest' }
  });
  const data = await res.json();

  const streams = [];
  const list = data?.sources || data?.streams || (data?.url ? [data] : []);
  for (const s of list) {
    if (s?.url && (s.url.includes('.m3u8') || s.url.includes('.mp4'))) {
      streams.push({ name: `SoaperTV ${s.quality || s.label || 'Auto'}`, url: s.url, quality: s.quality || s.label || 'Auto', provider: 'SoaperTV' });
    }
  }
  return streams;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tmdbId, type, season = '1', episode = '1' } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'tmdbId is required' });
  }

  // Run all 4 providers in parallel, swallow individual failures
  const [vidzee, mp4hydra, vixsrc, soapertv] = await Promise.allSettled([
    withTimeout(getVidZeeStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getMP4HydraStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getVixsrcStreams(tmdbId, mediaType, season, episode)),
    withTimeout(getSoaperTVStreams(tmdbId, mediaType, season, episode)),
  ]);

  const allStreams = [
    ...(vidzee.status   === 'fulfilled' ? vidzee.value   : []),
    ...(mp4hydra.status === 'fulfilled' ? mp4hydra.value : []),
    ...(vixsrc.status   === 'fulfilled' ? vixsrc.value   : []),
    ...(soapertv.status === 'fulfilled' ? soapertv.value : []),
  ].filter(s => s?.url);

  // Sort: prefer 1080p > 4K > 720p > Auto > rest
  const qualityOrder = { '1080p': 0, '4K': 1, '2160p': 1, '720p': 2, 'Auto': 3 };
  allStreams.sort((a, b) => {
    const qa = qualityOrder[a.quality] ?? 9;
    const qb = qualityOrder[b.quality] ?? 9;
    return qa - qb;
  });

  if (allStreams.length === 0) {
    return res.status(200).json({
      success: false,
      error: 'No streams found from any provider',
      providerErrors: {
        vidzee:   vidzee.reason?.message,
        mp4hydra: mp4hydra.reason?.message,
        vixsrc:   vixsrc.reason?.message,
        soapertv: soapertv.reason?.message,
      }
    });
  }

  return res.status(200).json({ success: true, streams: allStreams });
}
