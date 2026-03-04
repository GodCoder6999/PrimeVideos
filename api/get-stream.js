import chromium from '@sparticuz/chromium';
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
        // 1. Convert TMDB ID to IMDB ID
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        const targetUrl = type === 'tv' 
            ? `https://vidfast.pro/embed/tv/${imdbId}/${s}/${e}` 
            : `https://vidfast.pro/embed/movie/${imdbId}`;

        console.log(`[Puppeteer] Launching headless browser for: ${targetUrl}`);

        // 2. Launch Chromium (Node 20 AL2023 Compatible Setup)
        const isLocal = !process.env.VERCEL_REGION;
        
        // Sparticuz 132+ automatically handles missing Node 20 libraries
        chromium.setGraphicsMode = false;
        
        browser = await puppeteer.launch({
            args: isLocal ? ['--disable-web-security'] : chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: isLocal 
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Change if on Mac
                : await chromium.executablePath(),
            headless: isLocal ? true : 'shell', // 'shell' is required for Node 20+ Chromium
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 3. Network Interception (The Extension Method)
        await page.setRequestInterception(true);
        let extractedM3u8 = null;

        page.on('request', (request) => {
            const url = request.url();

            // 🔥 TARGET LOCK: Catch the exact worker.dev link you found OR any standard m3u8
            if (url.includes('.m3u8') || url.includes('fatherlessdad.workers.dev')) {
                if (!url.includes('audio') && !url.includes('subtitles')) {
                    extractedM3u8 = url;
                    console.log(`[Puppeteer] HIT! Stream grabbed: ${url.substring(0, 50)}...`);
                }
            }

            // Block everything else to make the page load in under 3 seconds
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media', 'fetch'].includes(resourceType) && !url.includes('.m3u8')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 4. Navigate and wait for the JS to execute and fire the network request
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 7500 }).catch(() => {});

        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 15) { 
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        await browser.close();

        if (!extractedM3u8) {
            throw new Error("Page loaded, but no m3u8 was detected in the network traffic.");
        }

        // 5. Proxy the extracted link securely to your PrimePlayer
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(extractedM3u8)}`,
            provider: "VidFast (Network Extracted)",
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error("[Puppeteer Error]:", error.message);
        
        return res.status(500).json({ 
            success: false, 
            error: `Failed to extract stream: ${error.message}` 
        });
    }
}
