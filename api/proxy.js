// api/proxy.js — Vercel serverless, CommonJS
const https = require('https');
const http  = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing url param' }));
  }

  try {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Referer': `${parsed.protocol}//${parsed.hostname}/`,
      },
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      res.setHeader('x-proxy-status', 'ok');
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: e.message }));
    });
    proxyReq.setTimeout(15000, () => { proxyReq.destroy(); });
    proxyReq.end();
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid URL' }));
  }
};
