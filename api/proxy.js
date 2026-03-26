// api/proxy.js — Vercel Serverless, CommonJS
// Proxies HLS manifests and rewrites segment/key URIs so the browser
// can fetch every chunk through this same proxy (no CORS issues).

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetchRaw(rawUrl, extraHeaders, timeoutMs) {
  extraHeaders = extraHeaders || {};
  timeoutMs    = timeoutMs    || 15000;
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  Object.assign({
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': parsed.origin,
      }, extraHeaders),
    }, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = `${parsed.protocol}//${parsed.host}${loc}`;
        return fetchRaw(loc, extraHeaders, timeoutMs).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve({ body: Buffer.concat(chunks), headers: res.headers, status: res.statusCode }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Resolve a relative URI against a base URL
function resolveUri(uri, baseUrl) {
  if (!uri || !uri.trim()) return null;
  uri = uri.trim();
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try {
    return new URL(uri, baseUrl).toString();
  } catch (_) {
    // Fallback: join base path with relative
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return base + uri;
  }
}

// Rewrite an HLS manifest so all URIs route through this proxy
function rewriteManifest(text, originalUrl, proxyBase) {
  const lines = text.split('\n');
  const out   = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { out.push(line); continue; }

    // Rewrite URI= attributes inside tag lines (keys, audio tracks, subtitles)
    if (trimmed.startsWith('#')) {
      const rewritten = line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const abs = resolveUri(uri, originalUrl);
        if (!abs) return match;
        return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
      });
      out.push(rewritten);
      continue;
    }

    // Non-comment, non-empty line = a segment or playlist URI
    const abs = resolveUri(trimmed, originalUrl);
    if (abs) {
      out.push(`${proxyBase}${encodeURIComponent(abs)}`);
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type');

  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

  const { url, referer } = req.query;
  if (!url) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing url parameter' }));
  }

  let decodedUrl;
  try { decodedUrl = decodeURIComponent(url); } catch (_) { decodedUrl = url; }

  // Build extra headers to pass upstream
  const extraHeaders = {};
  if (referer) {
    extraHeaders['Referer'] = referer;
    try { extraHeaders['Origin'] = new URL(referer).origin; } catch (_) {}
  } else {
    try { extraHeaders['Referer'] = new URL(decodedUrl).origin + '/'; } catch (_) {}
  }

  try {
    const { body, headers, status } = await fetchRaw(decodedUrl, extraHeaders);
    const contentType = (headers['content-type'] || '').toLowerCase();
    const isM3u8 = decodedUrl.includes('.m3u8') || contentType.includes('mpegurl');

    if (isM3u8) {
      const text = body.toString('utf-8');

      // Build the proxy base URL from request headers (works on Vercel)
      const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const proxyBase = `${proto}://${host}/api/proxy?url=`;

      const rewritten = rewriteManifest(text, decodedUrl, proxyBase);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.statusCode = 200;
      return res.end(rewritten);
    }

    // Binary passthrough (TS segments, MP4, keys, etc.)
    const ct = headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
    if (headers['accept-ranges']) res.setHeader('Accept-Ranges', headers['accept-ranges']);
    res.statusCode = status || 200;
    return res.end(body);

  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }));
  }
};
