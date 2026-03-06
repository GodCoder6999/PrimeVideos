import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { URL } from 'url';

const app = express();
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => res.send('🚀 Ultimate Scraper & Proxy is Live!'));

// 🛑 REPLACE WITH YOUR ACTUAL KEY FROM SCRAPINGBEE DASHBOARD
const SCRAPINGBEE_API_KEY = 'YOUR_SCRAPINGBEE_API_KEY';

// ==========================================
// ROUTE 1: The Network Sniffer (Finds the m3u8)
// ==========================================
app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;
    if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

    try {
        console.log(`[Enterprise-Bee] Sniffing network for: ${targetUrl}`);

        const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
            params: {
                'api_key': SCRAPINGBEE_API_KEY,
                'url': targetUrl,
                'render_js': 'true',
                'json_response': 'true',
                'block_ads': 'true',
                'premium_proxy': 'true',
                'country_code': 'us',
                'wait_for': 'video',
                'js_scenario': JSON.stringify({
                    "instructions": [
                        {"wait": 3000},
                        {"click": "body"}
                    ]
                })
            }
        });

        const networkLogs = [
            ...response.data.xhr_responses,
            ...response.data.request_responses
        ];

        const m3u8Link = networkLogs.find(log => 
            log.url.includes('.m3u8') && 
            !log.url.includes('audio') && 
            !log.url.includes('subtitles')
        );

        if (!m3u8Link) {
            throw new Error("Cloudflare bypassed, but the player did not request an m3u8 file.");
        }

        console.log("🚀 Stream Captured:", m3u8Link.url);

        return res.status(200).json({ 
            success: true, 
            streamUrl: m3u8Link.url 
        });

    } catch (error) {
        console.error("[Bee Error]:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: "The sniffer could not find the stream." 
        });
    }
});

// ==========================================
// ROUTE 2: The M3U8 Rewriting Proxy (Bypasses CORS)
// ==========================================
app.get('/api/proxy-stream', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Target URL is required');
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'Referer': new URL(targetUrl).origin,
                'Origin': new URL(targetUrl).origin,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            responseType: 'text'
        });

        const m3u8Content = response.data;
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const myProxyUrl = `${req.protocol}://${req.get('host')}/api/proxy-stream?url=`;

        const rewrittenManifest = m3u8Content.split('\n').map(line => {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return line;
            }

            let absoluteChunkUrl = trimmedLine;
            if (!trimmedLine.startsWith('http')) {
                absoluteChunkUrl = new URL(trimmedLine, baseUrl).href;
            }

            return `${myProxyUrl}${encodeURIComponent(absoluteChunkUrl)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rewrittenManifest);

    } catch (error) {
        console.error('[Proxy Error]:', error.message);
        
        if (targetUrl.includes('.ts')) {
             try {
                 const chunkStream = await axios.get(targetUrl, { responseType: 'stream' });
                 chunkStream.data.pipe(res);
                 return;
             } catch(e) {
                 return res.status(500).send('Chunk proxy failed');
             }
        }
        res.status(500).send('Proxy failed to fetch the stream.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dedicated Server running on port ${PORT}`));
