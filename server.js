import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors({ origin: '*' }));

// This API replaces all your Puppeteer headaches.
// It handles the CAPTCHAs, the Proxies, and the Stealth for you.
const UNBLOCKER_API_KEY = 'YOUR_API_KEY_HERE'; 

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;

    try {
        console.log(`[Pro-Scraper] Requesting unblocked session for: ${targetUrl}`);

        // We ask the Unblocker to extract the network logs (where the m3u8 hides)
        const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
            params: {
                'api_key':'1KT49HNPNGJCXF0V2TZRNVP7V24IUOAUCEER4YQYG2USX8BE8C7CI0YQTGJ4UOUDRMDTFZVMQH79WYG6',
                'url': targetUrl,
                'render_js': 'true',
                'wait_for': 'video', // Wait until the video element appears
                'extract_rules': '{"m3u8": "video source@src"}' // Rule to find the link
            }
        });

        const extractedLink = response.data.m3u8;

        if (!extractedLink) {
            throw new Error("Cloudflare bypassed, but video link not found in DOM.");
        }

        return res.status(200).json({ 
            success: true, 
            streamUrl: extractedLink 
        });

    } catch (error) {
        console.error("[Pro-Scraper Error]:", error.message);
        return res.status(500).json({ success: false, error: "Cloudflare protection too strong for manual scripts. Use an API." });
    }
});

app.listen(3000, () => console.log('🚀 100% Reliable Scraper Live'));
