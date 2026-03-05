import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();

// Enable CORS so your Vercel frontend can communicate with this Render backend
app.use(cors({ origin: '*' }));

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).json({ success: false, message: 'Missing targetUrl parameter' });
    }

    let browser = null;
    try {
        console.log(`[Scraper] Launching headless Chrome for: ${targetUrl}`);
        
        // Render requires these exact arguments to run Chrome without a GUI
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set exact 1080p viewport so our simulated mouse clicks hit dead center
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        let extractedM3u8 = null;
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            const url = request.url();
            
            // Look for the m3u8 file
            if (url.includes('.m3u8') && !url.includes('audio') && !url.includes('subtitles')) {
                extractedM3u8 = url;
                console.log(`[HIT] Stream grabbed: ${url.substring(0, 50)}...`);
            }
            
            // Block images to save Render's bandwidth, but ALLOW CSS/Scripts so the player renders properly
            if (['image', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Load the page (Render gives us plenty of time, we'll wait up to 25 seconds)
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

        console.log("[Scraper] Page loaded. Simulating Play button click...");
        
        // 🚀 The VidFast Fix: Click the center of the screen to trigger the video load
        try {
            await new Promise(r => setTimeout(r, 1500)); // Wait for player UI to settle
            await page.mouse.click(960, 540); // Click center
            
            await new Promise(r => setTimeout(r, 500));
            await page.mouse.click(960, 540); // Double click to bypass potential invisible ad-overlay
        } catch (clickErr) {
            console.log("[Scraper] Mouse click skipped or failed.");
        }

        // Wait up to 10 seconds for the network request to fire after our click
        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 50) {
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        await browser.close();

        if (!extractedM3u8) {
            throw new Error("Page loaded and clicked, but no m3u8 was requested by the embed player.");
        }

        // Send the raw m3u8 link back to your frontend!
        return res.status(200).json({ 
            success: true, 
            streamUrl: extractedM3u8,
            provider: "Render Scraper",
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error("[Extraction Error]:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Dedicated Scraper Server running flawlessly on port ${PORT}`);
});
