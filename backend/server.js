/**
 * PrimeVideo Clone — Stream API Backend
 *
 * Extracts direct m3u8 URLs from embed sources using plain HTTP requests.
 * No Puppeteer, no ScrapingBee, no headless browser needed.
 *
 * Strategy:
 *  1. /api/get-stream  → Try to extract a direct m3u8 from known sources
 *  2. /api/proxy       → CORS proxy so the frontend can fetch m3u8 manifests
 *  3. /api/resolve     → Resolve TMDB → IMDB ID
 */

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { URL } from 'url';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── Browser-like headers to bypass basic bot detection ───────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'no-cache',
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Resolve TMDB → IMDB ID
// ─────────────────────────────────────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType = 'movie') {
  try {
    const { data } = await axios.get(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
      { timeout: 5000 }
    );
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Extract m3u8 URL from an HTML page or JS response
// ─────────────────────────────────────────────────────────────────────────────
function extractM3u8(text) {
  const patterns = [
    /https?:\/\/[^\s"']+\.m3u8[^\s"']*/g,
    /file:\s*["']([^"']+\.m3u8[^"']*)/g,
    /src:\s*["']([^"']+\.m3u8[^"']*)/g,
    /source:\s*["']([^"']+\.m3u8[^"']*)/g,
    /["'](https?:\/\/[^"']+\/(?:index|master|playlist|hls)[^"']*\.m3u8[^"']*)/g,
  ];

  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const url = m[1] || m[0];
      if (url && url.includes('.m3u8') && !url.includes('example')) {
        found.add(url.trim().replace(/\\/g, ''));
      }
    }
  }

  // Prefer non-audio tracks, non-subtitle tracks
  const all = [...found];
  const main = all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0];
  return main || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE EXTRACTORS
// Each function tries to get a direct m3u8 URL for a title.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VidSrc.to — parses their JS embed to find the source API
 */
async function tryVidSrcTo(imdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`
      : `https://vidsrc.to/embed/movie/${imdbId}`;

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://vidsrc.to/' },
      timeout: 8000,
    });

    // VidSrc.to loads its source list from /api/source/
    const srcIdMatch = html.match(/data-id=["']([^"']+)["']/);
    if (!srcIdMatch) return null;

    const srcId = srcIdMatch[1];
    const { data: srcData } = await axios.get(`https://vidsrc.to/api/source/${srcId}`, {
      headers: {
        ...HEADERS,
        Referer: embedUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 8000,
    });

    // Returns { status: 200, result: [{ title, url }] }
    const sources = srcData?.result || [];
    for (const src of sources) {
      if (src.url) {
        // src.url is usually a sub-embed URL — fetch it to get the final m3u8
        try {
          const { data: subHtml } = await axios.get(src.url, {
            headers: { ...HEADERS, Referer: 'https://vidsrc.to/' },
            timeout: 8000,
          });
          const m3u8 = extractM3u8(subHtml);
          if (m3u8) return m3u8;
        } catch { /* try next */ }
      }
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * VidSrc.me — simpler structure
 */
async function tryVidSrcMe(imdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?imdb=${imdbId}`;

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://vidsrc.me/' },
      timeout: 8000,
    });

    const m3u8 = extractM3u8(html);
    if (m3u8) return m3u8;

    // Try to find sub-iframe src
    const iframeMatch = html.match(/src=["']([^"']+rcp\.moe[^"']*)["']/);
    if (iframeMatch) {
      const { data: subHtml } = await axios.get(iframeMatch[1], {
        headers: { ...HEADERS, Referer: embedUrl },
        timeout: 8000,
      });
      return extractM3u8(subHtml);
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * AutoEmbed — TMDB-based, sometimes exposes m3u8 in page HTML
 */
async function tryAutoEmbed(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`;

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://autoembed.cc/' },
      timeout: 8000,
    });

    return extractM3u8(html);
  } catch { /* fall through */ }
  return null;
}

/**
 * EmbedSu — TMDB-based
 */
async function tryEmbedSu(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`;

    // EmbedSu uses a config JSON endpoint
    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://embed.su/' },
      timeout: 8000,
    });

    // They load config via /api/e/{hash}
    const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (hashMatch) {
      const { data: config } = await axios.get(`https://embed.su/api/e/${hashMatch[1]}`, {
        headers: { ...HEADERS, Referer: embedUrl },
        timeout: 8000,
      });

      // Config contains sources array
      const sources = config?.sources || [];
      const m3u8Source = sources.find(s => s.file?.includes('.m3u8'));
      if (m3u8Source?.file) return m3u8Source.file;

      return extractM3u8(JSON.stringify(config));
    }

    return extractM3u8(html);
  } catch { /* fall through */ }
  return null;
}

/**
 * MoviesAPI — simple, sometimes has direct m3u8 in page
 */
async function tryMoviesApi(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://moviesapi.club/' },
      timeout: 8000,
    });

    // moviesapi.club sometimes has a JSON config embedded in the page
    const configMatch = html.match(/JWConfig\s*=\s*({.+?});/s) || html.match(/jwplayer\([^)]+\)\.setup\(({.+?})\)/s);
    if (configMatch) {
      return extractM3u8(configMatch[1]);
    }

    return extractM3u8(html);
  } catch { /* fall through */ }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /api/resolve?tmdbId=&mediaType=
// Returns IMDB ID for a TMDB title
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/resolve', async (req, res) => {
  const { tmdbId, mediaType = 'movie' } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });

  const imdbId = await getImdbId(tmdbId, mediaType);
  res.json({ tmdbId, imdbId, mediaType });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /api/get-stream?tmdbId=&mediaType=&season=&episode=
// Main endpoint — tries all extractors and returns a direct m3u8 URL
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/get-stream', async (req, res) => {
  const { tmdbId, mediaType = 'movie', season = 1, episode = 1 } = req.query;

  if (!tmdbId) return res.status(400).json({ success: false, error: 'Missing tmdbId' });

  const s = Number(season);
  const e = Number(episode);

  // Step 1: Get IMDB ID (run in background, don't block)
  const imdbId = await getImdbId(tmdbId, mediaType);
  console.log(`[Stream] tmdbId=${tmdbId} imdbId=${imdbId} type=${mediaType} S${s}E${e}`);

  // Step 2: Try extractors in order
  const extractors = [
    { name: 'VidSrc.to',  fn: () => imdbId ? tryVidSrcTo(imdbId, mediaType, s, e) : null },
    { name: 'EmbedSu',    fn: () => tryEmbedSu(tmdbId, mediaType, s, e) },
    { name: 'MoviesAPI',  fn: () => tryMoviesApi(tmdbId, mediaType, s, e) },
    { name: 'AutoEmbed',  fn: () => tryAutoEmbed(tmdbId, mediaType, s, e) },
    { name: 'VidSrc.me',  fn: () => imdbId ? tryVidSrcMe(imdbId, mediaType, s, e) : null },
  ];

  for (const ext of extractors) {
    try {
      console.log(`  → Trying ${ext.name}…`);
      const m3u8 = await ext.fn();
      if (m3u8) {
        console.log(`  ✅ ${ext.name} returned: ${m3u8.slice(0, 80)}…`);
        return res.json({ success: true, provider: ext.name, streamUrl: m3u8, imdbId });
      }
    } catch (err) {
      console.log(`  ✗ ${ext.name} threw: ${err.message}`);
    }
  }

  // Step 3: No direct m3u8 found — return embed URLs so client can iframe them
  console.log('  ⚠ No direct stream found, returning embed fallbacks');
  return res.json({
    success: false,
    imdbId,
    error: 'Could not extract direct stream — use embed fallbacks',
    embeds: {
      vidsrc: imdbId
        ? (mediaType === 'tv'
          ? `https://vidsrc.to/embed/tv/${imdbId}/${s}/${e}`
          : `https://vidsrc.to/embed/movie/${imdbId}`)
        : null,
      autoembed: mediaType === 'tv'
        ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${s}-${e}`
        : `https://autoembed.cc/movie/tmdb/${tmdbId}`,
      embedsu: mediaType === 'tv'
        ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`
        : `https://embed.su/embed/movie/${tmdbId}`,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /api/proxy?url=
// CORS proxy — rewrites m3u8 manifests so chunk URLs also go through the proxy
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/proxy', async (req, res) => {
  const { url: targetUrl } = req.query;
  if (!targetUrl) return res.status(400).send('Missing url param');

  try {
    const decoded = decodeURIComponent(targetUrl);
    const parsedUrl = new URL(decoded);
    const referer = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const response = await axios.get(decoded, {
      headers: {
        ...HEADERS,
        Referer: referer,
        Origin: referer,
        Range: req.headers.range || '',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || '';
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);

    // If it's an m3u8 manifest, rewrite chunk URLs to also go through this proxy
    if (contentType.includes('mpegurl') || decoded.includes('.m3u8')) {
      const text = response.data.toString('utf-8');
      const base = decoded.substring(0, decoded.lastIndexOf('/') + 1);
      const proxyBase = `/api/proxy?url=`;

      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absolute = trimmed.startsWith('http') ? trimmed : new URL(trimmed, base).href;
        return `${proxyBase}${encodeURIComponent(absolute)}`;
      }).join('\n');

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // Binary data (ts chunks, etc.)
    res.set('Content-Length', response.data.byteLength);
    if (response.headers['content-range']) res.set('Content-Range', response.headers['content-range']);
    res.status(response.status).send(Buffer.from(response.data));

  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).send(`Proxy error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /api/stream-video (legacy compat)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/stream-video', async (req, res) => {
  const { sourceUrl } = req.query;
  if (!sourceUrl) return res.status(400).send('Missing sourceUrl');

  try {
    const decoded = decodeURIComponent(sourceUrl);
    const response = await axios({
      method: 'get',
      url: decoded,
      responseType: 'stream',
      headers: {
        ...HEADERS,
        Range: req.headers.range || '',
        Referer: new URL(decoded).origin,
      },
      timeout: 10000,
    });

    res.status(response.status || 200);
    res.set('Access-Control-Allow-Origin', '*');
    for (const [k, v] of Object.entries(response.headers)) res.set(k, v);
    response.data.pipe(res);
    req.on('close', () => response.data.destroy?.());
  } catch (err) {
    if (!res.headersSent) res.status(500).send(`Stream error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.send('🎬 PrimeClone Stream API — alive'));

app.listen(PORT, () => {
  console.log(`\n🚀 Stream API running on port ${PORT}`);
  console.log(`   GET /api/get-stream?tmdbId=&mediaType=&season=&episode=`);
  console.log(`   GET /api/proxy?url=`);
  console.log(`   GET /api/resolve?tmdbId=&mediaType=\n`);
});
