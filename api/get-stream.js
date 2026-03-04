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

        // 2. Connect to the Remote Browser
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_API_KEY}`,
            defaultViewport: { width: 1920, height: 1080 } // Set exact 1080p resolution for accurate clicking
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 3. The Extension-Style Interceptor
        await page.setRequestInterception(true);
        let extractedM3u8 = null;

        page.on('request', (request) => {
            const url = request.url();

            // Lock onto the m3u8 file or the specific worker domain you found
            if (url.includes('.m3u8') || url.includes('fatherlessdad.workers.dev')) {
                if (!url.includes('audio') && !url.includes('subtitles')) {
                    extractedM3u8 = url;
                    console.log(`[HIT] Stream grabbed: ${url.substring(0, 60)}...`);
                }
            }

            // ONLY block images and fonts. Do not block CSS or Media, otherwise the player won't render the play button!
            if (['image', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 4. Load the page
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 7000 }).catch(() => {});

        // 🚀 THE FIX: Simulating Human Interaction
        // We wait a brief moment for the player to initialize, then click the center of the screen
        console.log("[Puppeteer] Page loaded. Simulating Play button click...");
        try {
            await new Promise(r => setTimeout(r, 1000));
            // Click the exact center of our 1920x1080 viewport
            await page.mouse.click(960, 540); 
            
            // Wait 500ms and click again just in case the first click triggered an ad-overlay
            await new Promise(r => setTimeout(r, 500));
            await page.mouse.click(960, 540); 
        } catch (clickErr) {
            console.log("Mouse click failed, continuing anyway...");
        }

        // 5. Wait for the network request to fire after our click
        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 20) {  // Give it up to 4 seconds after the click to fetch the video
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        await browser.close();

        if (!extractedM3u8) {
            throw new Error("Clicked the play button, but the player still did not request the .m3u8 file.");
        }

        // 6. Proxy the link back to your PrimePlayer
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
