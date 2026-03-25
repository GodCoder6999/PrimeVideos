// api/proxy.js
// Smart CORS proxy:
//   • For .m3u8  → downloads text, rewrites ALL internal URIs (segments, audio tracks, keys) through itself
//   • For .mkv/.mp4 → transparent pipe with Range header forwarding (enables seeking)
//   • Never buffers binary into memory — streams directly to client

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Determine if a URL points to an HLS manifest
function isM3u8(url, contentType) {
  if (url.includes('.m3u8') || url.includes('m3u')) return true;
  if (contentType && (contentType.includes('mpegurl') || contentType.includes('x-mpegurl'))) return true;
  return false;
}

// Rewrite every URI inside an HLS manifest to go through this proxy.
// Handles:
//   - Relative segment paths (e.g. "index0.ts" → absolute → proxied)
//   - Absolute segment URLs
//   - URI="..." inside #EXT-X-MEDIA tags (audio/subtitle track playlists)
//   - URI="..." inside #EXT-X-KEY tags (AES decryption keys)
//   - URI="..." inside #EXT-X-MAP tags (init segments)
function rewriteManifest(text, originalUrl, selfOrigin) {
  const base   = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);
  const encode = (u) => `${selfOrigin}/api/proxy?url=${encodeURIComponent(u)}`;

  const makeAbsolute = (uri) => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    if (uri.startsWith('/')) {
      try { const u = new URL(originalUrl); return u.protocol + '//' + u.host + uri; } catch (_) {}
    }
    return base + uri;
  };

  const lines = text.split('\n');
  const out   = [];

  for (let line of lines) {
    // Rewrite URI="..." attributes in EXT-X-MEDIA, EXT-X-KEY, EXT-X-MAP, EXT-X-IMAGE-STREAM-INF
    line = line.replace(/URI="([^"]+)"/g, (match, uri) => {
      const abs = makeAbsolute(uri);
      return `URI="${encode(abs)}"`;
    });

    // Rewrite bare segment lines (non-comment, non-empty lines that are URIs)
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const abs = makeAbsolute(trimmed);
      out.push(encode(abs));
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

// Make an outbound request, following redirects
function makeRequest(targetUrl, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(targetUrl); } catch (e) { return reject(new Error('Invalid URL')); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers,
    }, (res) => {
      // Follow redirects
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = url.protocol + '//' + url.host + loc;
        // Keep Range header through redirect
        return makeRequest(loc, headers, timeoutMs).then(resolve).catch(reject);
      }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // CORS headers — allow all origins so the browser can load media
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers','Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

  const targetUrl = req.query && req.query.url;
  if (!targetUrl) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing url param' }));
  }

  // Determine self-origin for manifest rewriting
  const proto      = req.headers['x-forwarded-proto'] || 'https';
  const host       = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const selfOrigin = `${proto}://${host}`;

  // Build outbound headers — forward Range (critical for seeking in MP4/MKV)
  const outHeaders = {
    'User-Agent':       UA,
    'Accept':           '*/*',
    'Accept-Language':  'en-US,en;q=0.9',
    'Origin':           '',
    'Referer':          '',
  };
  // Forward the Range header so partial content (seeking) works
  if (req.headers['range']) {
    outHeaders['Range'] = req.headers['range'];
  }
  // Forward If-Range for conditional requests
  if (req.headers['if-range']) {
    outHeaders['If-Range'] = req.headers['if-range'];
  }

  let upstream;
  try {
    upstream = await makeRequest(targetUrl, outHeaders, 30000);
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'Upstream fetch failed: ' + err.message }));
  }

  const contentType = (upstream.headers['content-type'] || '').toLowerCase();
  const lowerUrl    = targetUrl.toLowerCase().split('?')[0];

  // ── PATH A: HLS Manifest (.m3u8) ──────────────────────────────────────────
  if (isM3u8(lowerUrl, contentType)) {
    // Read the manifest text
    const chunks = [];
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      const text     = Buffer.concat(chunks).toString('utf-8');
      const rewritten = rewriteManifest(text, targetUrl, selfOrigin);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.statusCode = 200;
      res.end(rewritten);
    });
    upstream.on('error', err => {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // ── PATH B: Binary files (.mkv, .mp4, .ts segments, etc.) ─────────────────
  // Pipe directly — NEVER buffer. Forward status and key headers.
  const statusCode = upstream.statusCode || 200;

  // Forward critical headers for range/seeking support
  const forwardHeaders = [
    'content-type', 'content-length', 'content-range',
    'accept-ranges', 'last-modified', 'etag', 'cache-control',
  ];
  const responseHeaders = { 'Access-Control-Allow-Origin': '*' };
  forwardHeaders.forEach(h => {
    if (upstream.headers[h]) responseHeaders[h] = upstream.headers[h];
  });

  // Always declare we support ranges (needed for video seeking)
  if (!responseHeaders['accept-ranges']) responseHeaders['accept-ranges'] = 'bytes';

  res.writeHead(statusCode, responseHeaders);
  upstream.pipe(res);

  upstream.on('error', err => {
    console.error('[proxy] upstream error:', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  req.on('close', () => upstream.destroy());
};
