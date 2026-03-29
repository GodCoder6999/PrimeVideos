import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { URL, fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import CommonJS API handlers via dynamic import (interop: module.exports → .default)
const { default: proxyHandler } = await import('./api/proxy.js');
const { default: multiStreamHandler } = await import('./api/multi-stream.js');

const app = express();
app.use(cors({ origin: '*' }));

// ==========================================
// ADD THIS BLOCK: Serve DASH Video Files
// ==========================================
app.use('/video', express.static('output', {
  setHeaders: (res, filePath) => {
    // Explicit CORS headers for video chunks
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (filePath.endsWith('.mpd')) {
      res.setHeader('Content-Type', 'application/dash+xml');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.m4s') || filePath.endsWith('.mp4') || filePath.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'video/iso.segment');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));
// ==========================================

const SCRAPINGBEE_API_KEY = 'YOUR_API_KEY';

// 1. Source Aggregation
const PROVIDERS = [
    { name: 'VidFast', url: (id) => `https://vidfast.pro/movie/${id}` },
    { name: 'VidSrc',  url: (id) => `https://vidsrc.to/embed/movie/${id}` },
    { name: 'VidScr',  url: (id) => `https://vidscr.me/embed/movie/${id}` }
];

// --- CORE AGGREGATOR ---
app.get('/api/get-stream', async (req, res) => {
    const { tmdbId } = req.query; // Use TMDB ID for universal mapping
    if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });

    for (const provider of PROVIDERS) {
        try {
            console.log(`[Aggregator] Trying ${provider.name}...`);
            const targetUrl = provider.url(tmdbId);

            const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
                params: {
                    'api_key': SCRAPINGBEE_API_KEY,
                    'url': targetUrl,
                    'render_js': 'true',
                    'json_response': 'true',
                    'premium_proxy': 'true',
                    'js_scenario': JSON.stringify({ "instructions": [{"wait": 4000}, {"click": "body"}] })
                },
                timeout: 30000 
            });

            const logs = [...(response.data.xhr_responses || []), ...(response.data.request_responses || [])];
            const m3u8 = logs.find(l => l.url?.includes('.m3u8') && !l.url.includes('audio'));

            if (m3u8) {
                console.log(`✅ Success with ${provider.name}`);
                return res.json({ success: true, provider: provider.name, streamUrl: m3u8.url });
            }
        } catch (e) {
            console.log(`❌ ${provider.name} failed, trying next...`);
        }
    }

    res.status(404).json({ success: false, error: "All sources exhausted." });
});

// --- MANIFEST REWRITING PROXY ---
app.get('/api/proxy-stream', async (req, res) => {
    const targetUrl = req.query.url;
    try {
        const response = await axios.get(targetUrl, {
            headers: { 'Referer': new URL(targetUrl).origin, 'User-Agent': 'Mozilla/5.0...' },
            responseType: 'text'
        });

        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const myProxy = `${req.protocol}://${req.get('host')}/api/proxy-stream?url=`;

        const rewritten = response.data.split('\n').map(line => {
            if (!line.trim() || line.startsWith('#')) return line;
            const absolute = line.startsWith('http') ? line : new URL(line, baseUrl).href;
            return `${myProxy}${encodeURIComponent(absolute)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
    } catch (e) {
        // Fallback for .ts chunks (stream binary data)
        if (targetUrl.includes('.ts')) {
            const stream = await axios.get(targetUrl, { responseType: 'stream' });
            return stream.data.pipe(res);
        }
        res.status(500).send("Proxy Error");
    }
});

// --- PROXY (normalised name — same handler as proxy-stream) ---
app.get('/api/proxy', proxyHandler);
app.options('/api/proxy', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.status(200).end();
});

// --- MULTI-STREAM AGGREGATOR ---
app.get('/api/multi-stream', multiStreamHandler);

app.listen(3000, () => console.log('🚀 100% Resilient Server Live'));
