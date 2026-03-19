/**
 * Stream Extractor Backend
 * 
 * Extracts direct m3u8 URLs from multiple sources without headless browsers.
 * 
 * Sources supported:
 *  1. vidsrc.me  — fetch embed → find rcp iframe → fetch rcp → find sources → decode RC4 → m3u8
 *  2. vidsrc.xyz — fetch embed → find JSON config → decode base64 → m3u8  
 *  3. vidsrc.in  — same pipeline as vidsrc.xyz
 *  4. vidsrc.pm  — same pipeline
 *  5. moviesapi.club — fetch embed → find JWConfig → m3u8
 *  6. autoembed.cc  — fetch embed → regex extract m3u8
 * 
 * Also includes:
 *  - /api/proxy  — rewrites m3u8 manifests so chunks work cross-origin
 *  - /api/resolve — TMDB → IMDB ID lookup
 */

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { URL } from 'url';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const TMDB_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

// ── Browser-like headers ───────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// ── RC4 Decrypt (used by vidsrc.me) ───────────────────────────────────────
function rc4Decrypt(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;

  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }

  let i = 0; j = 0;
  return Array.from(data).map(char => {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    return String.fromCharCode(char.charCodeAt(0) ^ s[(s[i] + s[j]) % 256]);
  }).join('');
}

// ── Shift-decode (used by vidsrc.xyz/in/pm) ───────────────────────────────
function shiftDecode(str) {
  // vidsrc.xyz encodes the URL as base64 with a char shift
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    // Each char is shifted by a value encoded in the string
    return decoded;
  } catch {
    return str;
  }
}

// Vidsrc.xyz specific: the stream URL is encoded as hex with alternating XOR
function decodeVidsrcXyz(encoded) {
  try {
    // Try plain base64 first
    const plain = Buffer.from(encoded, 'base64').toString('utf-8');
    if (plain.includes('.m3u8') || plain.includes('http')) return plain;
  } catch { /* */ }

  try {
    // Hex decode
    const bytes = [];
    for (let i = 0; i < encoded.length; i += 2) {
      bytes.push(parseInt(encoded.substr(i, 2), 16));
    }
    const key = bytes[0];
    const result = bytes.slice(1).map((b, i) => String.fromCharCode(b ^ (key + i) % 256)).join('');
    if (result.includes('.m3u8') || result.includes('http')) return result;
  } catch { /* */ }

  return null;
}

// ── Utility: extract m3u8 from arbitrary text ─────────────────────────────
function extractM3u8(text) {
  const patterns = [
    /https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g,
    /file:\s*["']([^"']+\.m3u8[^"']*)/g,
    /src:\s*["']([^"']+\.m3u8[^"']*)/g,
    /"hls"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
    /["'](https?:\/\/[^"']+\/(?:index|master|playlist|hls)[^"']*\.m3u8[^"']*)/g,
  ];

  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const url = (m[1] || m[0]).trim().replace(/\\/g, '');
      if (url.includes('.m3u8') && !url.includes('example') && url.startsWith('http')) {
        found.add(url);
      }
    }
  }

  const all = [...found];
  // Prefer non-audio non-subtitle tracks
  return all.find(u => !/audio|subtitle|caption|webvtt/i.test(u)) || all[0] || null;
}

// ── RESOLVER: TMDB → IMDB ID ───────────────────────────────────────────────
async function getImdbId(tmdbId, mediaType) {
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

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 1: vidsrc.me
// Flow: embed page → find iframe[src*="rcp"] → fetch rcp page → 
//       find script with sources array → decode each source URL (RC4) → m3u8
// ══════════════════════════════════════════════════════════════════════════
async function tryVidsrcMe(imdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?imdb=${imdbId}`;

    console.log(`  [vidsrc.me] Fetching embed: ${embedUrl}`);

    const { data: embedHtml } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://vidsrc.me/' },
      timeout: 10000,
    });

    const $ = cheerio.load(embedHtml);

    // Find the rcp.moe iframe
    let rcpUrl = null;
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('rcp') || src.includes('v2.vidsrc')) {
        rcpUrl = src.startsWith('//') ? `https:${src}` : src;
      }
    });

    // Also try data-src
    if (!rcpUrl) {
      $('[data-src]').each((_, el) => {
        const src = $(el).attr('data-src') || '';
        if (src.includes('rcp')) rcpUrl = src.startsWith('//') ? `https:${src}` : src;
      });
    }

    // Fallback: regex search
    if (!rcpUrl) {
      const match = embedHtml.match(/src=["']((?:https?:)?\/\/[^"']*rcp[^"']*)["']/);
      if (match) rcpUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    }

    if (!rcpUrl) {
      console.log(`  [vidsrc.me] No rcp iframe found`);
      return null;
    }

    console.log(`  [vidsrc.me] RCP URL: ${rcpUrl}`);

    const { data: rcpHtml } = await axios.get(rcpUrl, {
      headers: { ...HEADERS, Referer: embedUrl },
      timeout: 10000,
    });

    // vidsrc.me encodes the stream URL in a JS variable, often as:
    // var sources = [{"file": "rc4_encoded_string", "label": "..."}]
    // OR directly as RC4 encoded in a specific variable

    // Try direct m3u8 extraction first
    const direct = extractM3u8(rcpHtml);
    if (direct) return direct;

    // Try finding encoded source
    // Pattern: Playerjs({file:"ENCODED_STRING"}) or similar
    const fileMatch = rcpHtml.match(/["']?file["']?\s*:\s*["']([^"']{20,})["']/);
    if (fileMatch) {
      const encoded = fileMatch[1];
      // Try base64
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const m3u8 = extractM3u8(decoded);
        if (m3u8) return m3u8;
      } catch { /* */ }

      // Try RC4 with common keys
      for (const key of ['8z5Ag5wgagfsOuhz', 'vidfastpro', '123456', '']) {
        try {
          const decoded = rc4Decrypt(key, Buffer.from(encoded, 'base64').toString('binary'));
          const m3u8 = extractM3u8(decoded);
          if (m3u8) return m3u8;
        } catch { /* */ }
      }
    }

  } catch (err) {
    console.log(`  [vidsrc.me] Error: ${err.message}`);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 2: vidsrc.xyz / vidsrc.in / vidsrc.pm
// Flow: fetch embed → parse HTML for encoded stream data → decode → m3u8
// These sites store the stream in a JS variable as encoded/obfuscated string
// ══════════════════════════════════════════════════════════════════════════
async function tryVidsrcXyz(domain, tmdbId, imdbId, mediaType, season, episode) {
  try {
    const embedUrl = imdbId
      ? (mediaType === 'tv'
        ? `https://${domain}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
        : `https://${domain}/embed/movie?imdb=${imdbId}`)
      : (mediaType === 'tv'
        ? `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://${domain}/embed/movie?tmdb=${tmdbId}`);

    console.log(`  [${domain}] Fetching: ${embedUrl}`);

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: `https://${domain}/` },
      timeout: 10000,
    });

    // Try direct extraction
    const direct = extractM3u8(html);
    if (direct) return direct;

    // Look for encoded stream in script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const script of scriptMatches) {
      // Pattern: var player = {..., "file": "ENCODED"} or sources: [{"file":"..."}]
      const patterns = [
        /var\s+\w+\s*=\s*["']([A-Za-z0-9+/=_-]{40,})["']/g,
        /["']?hls["']?\s*:\s*["']([^"']{20,})["']/g,
        /["']?stream["']?\s*:\s*["']([^"']{20,})["']/g,
        /atob\(["']([^"']+)["']\)/g,
      ];

      for (const pat of patterns) {
        let m;
        while ((m = pat.exec(script)) !== null) {
          const candidate = m[1];

          // Try base64
          try {
            const decoded = Buffer.from(candidate, 'base64').toString('utf-8');
            const m3u8 = extractM3u8(decoded);
            if (m3u8) return m3u8;
          } catch { /* */ }

          // Try our hex XOR decoder
          const decoded2 = decodeVidsrcXyz(candidate);
          if (decoded2) {
            const m3u8 = extractM3u8(decoded2);
            if (m3u8) return m3u8;
          }
        }
      }
    }

    // Try fetching sub-iframes
    const $ = cheerio.load(html);
    for (const el of $('iframe').toArray()) {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src === embedUrl) continue;

      try {
        const absUrl = src.startsWith('http') ? src : src.startsWith('//') ? `https:${src}` : new URL(src, embedUrl).href;
        const { data: subHtml } = await axios.get(absUrl, {
          headers: { ...HEADERS, Referer: embedUrl },
          timeout: 8000,
        });
        const m3u8 = extractM3u8(subHtml);
        if (m3u8) return m3u8;
      } catch { /* */ }
    }

  } catch (err) {
    console.log(`  [${domain}] Error: ${err.message}`);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 3: moviesapi.club
// Flow: fetch embed → find JWConfig or jwplayer setup → extract m3u8
// ══════════════════════════════════════════════════════════════════════════
async function tryMoviesApi(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`
      : `https://moviesapi.club/movie/${tmdbId}`;

    console.log(`  [moviesapi] Fetching: ${embedUrl}`);

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://moviesapi.club/' },
      timeout: 10000,
    });

    // Try direct
    const direct = extractM3u8(html);
    if (direct) return direct;

    // JWConfig pattern
    const configMatch = html.match(/JWConfig\s*=\s*({.+?});/s)
      || html.match(/jwplayer\([^)]+\)\.setup\(({.+?})\)/s)
      || html.match(/sources\s*:\s*\[([^\]]+)\]/s);

    if (configMatch) {
      return extractM3u8(configMatch[1]);
    }
  } catch (err) {
    console.log(`  [moviesapi] Error: ${err.message}`);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 4: autoembed.cc
// Flow: fetch embed → regex for m3u8
// ══════════════════════════════════════════════════════════════════════════
async function tryAutoEmbed(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`;

    console.log(`  [autoembed] Fetching: ${embedUrl}`);

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://autoembed.cc/' },
      timeout: 10000,
    });

    return extractM3u8(html);
  } catch (err) {
    console.log(`  [autoembed] Error: ${err.message}`);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 5: embed.su
// Flow: fetch embed → find /api/e/{hash} → fetch config JSON → extract source
// ══════════════════════════════════════════════════════════════════════════
async function tryEmbedSu(tmdbId, mediaType, season, episode) {
  try {
    const embedUrl = mediaType === 'tv'
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`;

    console.log(`  [embed.su] Fetching: ${embedUrl}`);

    const { data: html } = await axios.get(embedUrl, {
      headers: { ...HEADERS, Referer: 'https://embed.su/' },
      timeout: 10000,
    });

    const direct = extractM3u8(html);
    if (direct) return direct;

    // embed.su stores stream config behind a hashed API endpoint
    const hashMatch = html.match(/\/api\/e\/([a-zA-Z0-9]+)/);
    if (hashMatch) {
      const { data: config } = await axios.get(
        `https://embed.su/api/e/${hashMatch[1]}`,
        {
          headers: { ...HEADERS, Referer: embedUrl },
          timeout: 8000,
        }
      );

      const sources = config?.sources || config?.stream || [];
      if (Array.isArray(sources)) {
        for (const src of sources) {
          if (src.file?.includes('.m3u8')) return src.file;
          if (src.url?.includes('.m3u8')) return src.url;
        }
      }

      return extractM3u8(JSON.stringify(config));
    }
  } catch (err) {
    console.log(`  [embed.su] Error: ${err.message}`);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTE: GET /api/resolve
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/resolve', async (req, res) => {
  const { tmdbId, mediaType = 'movie' } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });
  const imdbId = await getImdbId(tmdbId, mediaType);
  res.json({ tmdbId, imdbId, mediaType });
});

// ══════════════════════════════════════════════════════════════════════════
// ROUTE: GET /api/get-stream
// Tries all extractors in order, returns first m3u8 found
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/get-stream', async (req, res) => {
  const { tmdbId, mediaType = 'movie', season = 1, episode = 1 } = req.query;
  if (!tmdbId) return res.status(400).json({ success: false, error: 'Missing tmdbId' });

  const s = Number(season);
  const e = Number(episode);

  console.log(`\n[Stream Request] tmdbId=${tmdbId} type=${mediaType} S${s}E${e}`);

  // Step 1: Resolve IMDB ID (needed by most sources)
  const imdbId = await getImdbId(tmdbId, mediaType);
  console.log(`  IMDB ID: ${imdbId || 'not found'}`);

  // Step 2: Define extractor chain
  const extractors = [
    {
      name: 'vidsrc.xyz',
      fn: () => tryVidsrcXyz('vidsrc.xyz', tmdbId, imdbId, mediaType, s, e),
    },
    {
      name: 'vidsrc.in',
      fn: () => tryVidsrcXyz('vidsrc.in', tmdbId, imdbId, mediaType, s, e),
    },
    {
      name: 'vidsrc.pm',
      fn: () => tryVidsrcXyz('vidsrc.pm', tmdbId, imdbId, mediaType, s, e),
    },
    {
      name: 'vidsrc.me',
      fn: () => imdbId ? tryVidsrcMe(imdbId, mediaType, s, e) : null,
    },
    {
      name: 'embed.su',
      fn: () => tryEmbedSu(tmdbId, mediaType, s, e),
    },
    {
      name: 'moviesapi',
      fn: () => tryMoviesApi(tmdbId, mediaType, s, e),
    },
    {
      name: 'autoembed',
      fn: () => tryAutoEmbed(tmdbId, mediaType, s, e),
    },
  ];

  // Step 3: Run extractors
  for (const ext of extractors) {
    try {
      console.log(`\n→ Trying ${ext.name}…`);
      const m3u8 = await ext.fn();
      if (m3u8) {
        console.log(`✅ ${ext.name} returned: ${m3u8.slice(0, 80)}`);
        return res.json({
          success: true,
          provider: ext.name,
          streamUrl: m3u8,
          imdbId,
          proxyUrl: `/api/proxy?url=${encodeURIComponent(m3u8)}`,
        });
      }
    } catch (err) {
      console.log(`✗ ${ext.name}: ${err.message}`);
    }
  }

  // Step 4: All failed — return embed fallbacks so frontend can use them
  console.log('⚠ All extractors failed, returning embed fallbacks');
  return res.json({
    success: false,
    imdbId,
    error: 'Could not extract direct stream',
    embeds: {
      vidsrc_xyz: imdbId
        ? (mediaType === 'tv'
          ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}`
          : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`)
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

// ══════════════════════════════════════════════════════════════════════════
// ROUTE: GET /api/proxy?url=
// CORS proxy — rewrites m3u8 manifests so segment URLs also go through proxy
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/proxy', async (req, res) => {
  const { url: targetUrl } = req.query;
  if (!targetUrl) return res.status(400).send('Missing url');

  try {
    const decoded = decodeURIComponent(targetUrl);
    const parsedUrl = new URL(decoded);
    const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const base = decoded.substring(0, decoded.lastIndexOf('/') + 1);

    const response = await axios.get(decoded, {
      headers: {
        ...HEADERS,
        Referer: origin,
        Origin: origin,
      },
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || '';
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);

    // Rewrite m3u8 manifests so all segment URLs go through this proxy
    if (contentType.includes('mpegurl') || decoded.includes('.m3u8')) {
      const text = response.data.toString('utf-8');
      const myProxy = `/api/proxy?url=`;

      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absUrl;
        if (trimmed.startsWith('http')) {
          absUrl = trimmed;
        } else {
          try {
            absUrl = new URL(trimmed, base).href;
          } catch {
            absUrl = trimmed;
          }
        }

        return `${myProxy}${encodeURIComponent(absUrl)}`;
      }).join('\n');

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // Binary data (ts chunks, mp4, etc.)
    res.set('Content-Length', response.data.byteLength);
    if (response.headers['content-range']) res.set('Content-Range', response.headers['content-range']);
    if (response.headers['accept-ranges']) res.set('Accept-Ranges', response.headers['accept-ranges']);
    res.status(response.status).send(Buffer.from(response.data));

  } catch (err) {
    const status = err.response?.status || 500;
    console.error(`[Proxy Error] ${err.message}`);
    res.status(status).send(`Proxy error: ${err.message}`);
  }
});

app.get('/', (_, res) => res.send('🎬 Stream Extractor API — running'));

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`   GET /api/get-stream?tmdbId=&mediaType=&season=&episode=`);
  console.log(`   GET /api/proxy?url=`);
  console.log(`   GET /api/resolve?tmdbId=&mediaType=\n`);
});
