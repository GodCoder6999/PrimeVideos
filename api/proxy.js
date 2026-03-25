const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url param' });

  try {
    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === 'https:'? https : http;
    const options = {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${parsedUrl.protocol}//${parsedUrl.hostname}/`,
        'Accept': '*/*'
      }
    };

    // Forward Range header to support seeking and prevent Vercel memory crashes
    if (req.headers.range) {
      options.headers = req.headers.range;
    }

    const proxyReq = lib.request(parsedUrl, options, (proxyRes) => {
      // Intercept and rewrite HLS Manifests for Multi-Audio support
      if (targetUrl.includes('.m3u8')) {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          const myProxyUrl = `${req.headers['x-forwarded-proto'] |

| 'http'}://${req.headers.host}/api/proxy`;
          const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

          const rewritten = body.split('\n').map(line => {
            // Rewrite URIs embedded inside tags (Audio tracks, decryption keys)
            if (line.startsWith('#EXT-X-MEDIA:') |

| line.startsWith('#EXT-X-KEY:') |
| line.startsWith('#EXT-X-STREAM-INF:')) {
              return line.replace(/URI=["']([^"']+)["']/g, (match, p1) => {
                const absUrl = p1.startsWith('http')? p1 : new URL(p1, baseUrl).href;
                return `URI="${myProxyUrl}?url=${encodeURIComponent(absUrl)}"`;
              });
            } 
            // Rewrite standard segment lines
            else if (!line.startsWith('#') && line.trim().length > 0) {
              const absUrl = line.startsWith('http')? line : new URL(line, baseUrl).href;
              return `${myProxyUrl}?url=${encodeURIComponent(absUrl)}`;
            }
            return line;
          }).join('\n');

          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.status(200).send(rewritten);
        });
      } else {
        // Direct binary piping for.ts,.mp4, and.mkv files
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', () => res.status(502).end());
    req.pipe(proxyReq);
  } catch (e) {
    res.status(400).json({ error: 'Invalid URL' });
  }
};
