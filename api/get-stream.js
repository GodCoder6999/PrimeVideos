import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    let browser = null;

    try {
        // 1. Convert TMDB ID to IMDB ID (Required for most embed players)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        // We will target VidFast's embed player as our primary source
        const targetUrl = type === 'tv' 
            ? `https://vidfast.pro/embed/tv/${imdbId}/${s}/${e}` 
            : `https://vidfast.pro/embed/movie/${imdbId}`;

        console.log(`[Puppeteer] Launching headless browser for: ${targetUrl}`);

        // 2. Launch Lightweight Chromium optimized for Vercel
        // Optional: you may need to adjust the chromium executable path based on your specific Vercel deployment setup if this fails, but @sparticuz handles it 99% of the time.
        browser = await puppeteer.launch({
            args: [...chromium.args, '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Set a realistic User-Agent to avoid immediate bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 3. Enable Network Interception (This is the "Extension" logic)
        await page.setRequestInterception(true);

        let extractedM3u8 = null;

        page.on('request', (request) => {
            const url = request.url();

            // 🚀 FAST EXTRACTION: If we see an m3u8 in the network traffic, GRAB IT!
            if (url.includes('.m3u8')) {
                // Ignore audio-only or subtitle manifests if possible, we want the master or video manifest
                if (!url.includes('audio') && !url.includes('subtitles')) {
                    extractedM3u8 = url;
                    console.log(`[Puppeteer] HIT! Found m3u8: ${url.substring(0, 60)}...`);
                }
            }

            // SPEED OPTIMIZATION: Block heavy files so the page loads instantly
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 4. Navigate to the page and wait for network activity
        // We set a strict 8-second timeout so Vercel doesn't kill our function at 10 seconds
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});

        // Wait a tiny bit more for obfuscated JS to execute and make the XHR request
        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 15) { // Wait up to ~3 seconds max
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        // 5. Cleanup Browser
        await browser.close();

        if (!extractedM3u8) {
            throw new Error("Puppeteer watched the network traffic but no .m3u8 was requested by the site.");
        }

        // 6. Return the perfectly extracted link through your Proxy
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(extractedM3u8)}`,
            provider: "VidFast (Puppeteer Extracted)",
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error("[Puppeteer Extractor Error]:", error.message);
        
        return res.status(500).json({ 
            success: false, 
            error: `Failed to extract stream: ${error.message}` 
        });
    }
}
