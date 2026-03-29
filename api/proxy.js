// api/proxy.js
const axios = require('axios');
const { URL } = require('url');

function resolveUri(uri, baseUrl) {
    if (!uri || !uri.trim()) return null;
    uri = uri.trim();
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    try { return new URL(uri, baseUrl).toString(); } 
    catch (_) {
        const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
        return base + uri;
    }
}

function rewriteManifest(text, originalUrl, proxyBase) {
    const lines = text.split('\n');
    const out = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { out.push(line); continue; }

        if (trimmed.startsWith('#')) {
            const rewritten = line.replace(/URI="([^"]+)"/g, (match, uri) => {
                const abs = resolveUri(uri, originalUrl);
                if (!abs) return match;
                return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
            });
            out.push(rewritten);
            continue;
        }

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
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');

    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

    const targetUrl = req.query.url;
    if (!targetUrl) { res.statusCode = 400; return res.end('Target URL is required'); }

    try {
        // Standard Desktop Chrome Headers (Crucial for EmbedSU and VidSrc)
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': new URL(targetUrl).origin + '/'
        };

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const isM3u8 = targetUrl.includes('.m3u8');

        const response = await axios({
            method: 'get',
            url: targetUrl,
            headers: headers,
            responseType: isM3u8 ? 'text' : 'stream',
            validateStatus: status => status >= 200 && status < 400,
            timeout: 20000 
        });

        const headersToForward = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
        headersToForward.forEach(header => {
            if (response.headers[header]) {
                res.setHeader(header, response.headers[header]);
            }
        });

        res.statusCode = response.status;

        if (isM3u8) {
            const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
            const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
            const proxyBase = `${proto}://${host}/api/proxy?url=`;

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');

            const rewrittenManifest = rewriteManifest(response.data, targetUrl, proxyBase);
            return res.end(rewrittenManifest);
        } else {
            return response.data.pipe(res);
        }

    } catch (error) {
        console.error('Proxy Error on Target:', targetUrl, '| Detail:', error.message);
        res.statusCode = 500;
        res.end('Failed to proxy content');
    }
};
