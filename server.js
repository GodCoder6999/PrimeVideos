import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors({ origin: '*' }));

// 🛑 REPLACE WITH YOUR ACTUAL KEY
const SCRAPINGBEE_API_KEY = '1KT49HNPNGJCXF0V2TZRNVP7V24IUOAUCEER4YQYG2USX8BE8C7CI0YQTGJ4UOUDRMDTFZVMQH79WYG6';

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;
    if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

    try {
        console.log(`[Enterprise-Bee] Sniffing network for: ${targetUrl}`);

        // We use 'json_response=true' to get the network logs back
        const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
            params: {
                'api_key': SCRAPINGBEE_API_KEY,
                'url': targetUrl,
                'render_js': 'true',
                'json_response': 'true', // This returns the full browser state
                'block_ads': 'true',
                'premium_proxy': 'true', // Required for high-security sites like Vidfast
                'country_code': 'us',
                'wait_for': 'video',
                'js_scenario': JSON.stringify({
                    "instructions": [
                        {"wait": 3000}, // Give the player 3s to start the network request
                        {"click": "body"} // Trigger a click to wake up the player
                    ]
                })
            }
        });

        // ScrapingBee returns 'xhr_responses' and 'request_responses' in the JSON
        const networkLogs = [
            ...response.data.xhr_responses,
            ...response.data.request_responses
        ];

        // We filter through every single network request to find the .m3u8 link
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
            error: "The sniffer could not find the stream. Vidfast may have updated their security." 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dedicated Sniffer running on port ${PORT}`));
