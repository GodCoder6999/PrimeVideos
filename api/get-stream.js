import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    // 1. Handle CORS (Allow your frontend to call this Vercel function)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Grab the parameters from the URL
    // e.g., /api/get-stream?type=movie&tmdbId=550
    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing type or tmdbId' });
    }

    let vidfastUrl = `https://vidfast.pro/embed/${type}/${tmdbId}`;
    if (type === 'tv' && s && e) {
        vidfastUrl = `https://vidfast.pro/embed/tv/${tmdbId}?s=${s}&e=${e}`;
    }

    let browser;
    try {
        // 3. Launch the lightweight Serverless Chromium
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let m3u8Url = null;
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') && !m3u8Url) {
                m3u8Url = url;
            }
            request.continue();
        });

        await page.goto(vidfastUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await browser.close();

        if (m3u8Url) {
            return res.status(200).json({ success: true, hlsUrl: m3u8Url });
        } else {
            return res.status(404).json({ success: false, message: 'Stream not found.' });
        }

    } catch (error) {
        console.error(error);
        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: 'Server error during scraping.' });
    }
}
