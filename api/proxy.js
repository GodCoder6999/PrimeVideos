import { Parser } from 'm3u8-parser';
import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, referer } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  // Step 2: Inject expected CORS and Referer headers to bypass CDN blocks
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    'Accept': '*/*',
    ...(referer && { 'Referer': referer, 'Origin': new URL(referer).origin })
  };

  try {
    const upstreamRes = await fetch(url, { headers });
    const contentType = upstreamRes.headers.get('content-type') || '';

    // Step 3: Intercept and rewrite if it's an HLS Manifest
    if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
      const manifestText = await upstreamRes.text();
      const rewrittenManifest = rewriteManifestWithParser(manifestText, url, req);
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(rewrittenManifest);
    } 
    
    // For video segments (.ts), pipe the binary data directly
    res.setHeader('Content-Type', contentType);
    const buffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (err) {
    return res.status(502).json({ error: 'Upstream fetch failed' });
  }
}

// Implement On-the-Fly Manifest Rewriting
function rewriteManifestWithParser(text, originalUrl, req) {
  const parser = new Parser();
  parser.push(text);
  parser.end();

  const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);
  const proxyBase = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/proxy?url=`;

  const makeAbsolute = (uri) => {
    if (uri.startsWith('http')) return uri;
    if (uri.startsWith('/')) return new URL(originalUrl).origin + uri;
    return baseUrl + uri;
  };

  const encodeProxied = (uri) => `${proxyBase}${encodeURIComponent(makeAbsolute(uri))}`;

  // Reconstruct manifest with rewritten URIs
  let lines = text.split('\n');
  return lines.map(line => {
    // Rewrite Audio/Subtitle Tracks and Keys
    if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-KEY:')) {
      return line.replace(/URI="([^"]+)"/, (match, uri) => `URI="${encodeProxied(uri)}"`);
    }
    // Rewrite Video Chunks
    if (line.trim() && !line.startsWith('#')) {
      return encodeProxied(line.trim());
    }
    return line;
  }).join('\n');
}
