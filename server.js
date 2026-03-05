import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => res.send('🚀 ScrapingBee Scraper is Live!'));

// 🛑 REPLACE WITH YOUR ACTUAL KEY FROM SCRAPINGBEE DASHBOARD
const SCRAPINGBEE_API_KEY = '1KT49HNPNGJCXF0V2TZRNVP7V24IUOAUCEER4YQYG2USX8BE8C7CI0YQTGJ4UOUDRMDTFZVMQH79WYG6';

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;
    if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

    try {
        console.log(`[Bee-Scraper] Requesting: ${targetUrl}`);

        // We ask ScrapingBee to render JS and wait for the video player to load
        const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
            params: {
                'api_key': SCRAPINGBEE_API_KEY,
                'url': targetUrl,
                'render_js': 'true',
                'block_ads': 'true',
                'wait_for': 'video', // Wait for the video element to appear
                'extract_rules': '{"m3u8": "video source@src"}' // Snatch the link from the player
            }
        });

        const extractedLink = response.data.m3u8;

        if (!extractedLink) {
            throw new Error("Page loaded, but could not find the m3u8 link in the player.");
        }

        return res.status(200).json({ 
            success: true, 
            streamUrl: extractedLink 
        });

    } catch (error) {
        console.error("[Scraper Error]:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: "ScrapingBee failed to extract the stream. Ensure the target URL is correct." 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dedicated API running on port ${PORT}`));
