import puppeteer from 'puppeteer-core';
import axios from 'axios';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    let browser = null;

    try {
        // 1. Get IMDb ID
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        const targetUrl = type === 'tv' 
            ? `https://vidfast.pro/embed/tv/${imdbId}/${s}/${e}` 
            : `https://vidfast.pro/embed/movie/${imdbId}`;

        // 🛑 PASTE YOUR BROWSERLESS API KEY HERE 🛑
        const BROWSERLESS_API_KEY = "2U5Uo4hDU4WLtHLbfa6adecd9f34e90147cec50222fca3ab0";

        console.log(`[Remote Puppeteer] Connecting to Browserless for: ${targetUrl}`);

        // 2. Connect to the Remote Browser (ZERO Vercel OS Errors)
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_API_KEY}`,
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 3. The Extension-Style Interceptor
        await page.setRequestInterception(true);
        let extractedM3u8 = null;

        page.on('request', (request) => {
            const url = request.url();

            // Lock onto the m3u8 file the moment it's generated
            if (url.includes('.m3u8') || url.includes('fatherlessdad.workers.dev')) {
                if (!url.includes('audio') && !url.includes('subtitles')) {
                    extractedM3u8 = url;
                    console.log(`[HIT] Stream grabbed: ${url.substring(0, 60)}...`);
                }
            }

            // Block heavy elements to keep the scrape under Vercel's timeout
            if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType()) && !url.includes('.m3u8')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 4. Load the page and wait for the network request
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});

        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 15) { 
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        await browser.close();

        if (!extractedM3u8) {
            throw new Error("Page loaded, but no m3u8 was requested by the embed player.");
        }

        // 5. Proxy the link back to your PrimePlayer
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(extractedM3u8)}`,
            provider: "VidFast (Remote Extraction)",
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error("[Extraction Error]:", error.message);
        
        return res.status(500).json({ 
            success: false, 
            error: `Failed to extract stream: ${error.message}` 
        });
    }
}
