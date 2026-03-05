import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// 1. Use Stealth, but REMOVE the Adblocker. We need the video host scripts to run!
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors({ origin: '*' }));

// --- WEBSHARE PROXY POOL ---
const PROXY_USERNAME = 'chmkovfs';
const PROXY_PASSWORD = 'zk304sqheh0b';

const proxyList = [
    "31.59.20.176:6754",   "23.95.150.145:6114",  "198.23.239.134:6540", 
    "45.38.107.97:6014",   "107.172.163.27:6543", "198.105.121.200:6462",
    "64.137.96.74:6641",   "216.10.27.159:6837",  "142.111.67.146:5611", 
    "194.39.32.164:6461"
];

app.get('/', (req, res) => {
    res.send('🚀 Enterprise Scraper Live!');
});

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;
    if (!targetUrl) return res.status(400).json({ success: false, message: 'Missing targetUrl' });

    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    let browser = null;

    try {
        console.log(`[Scraper] Connecting via: ${randomProxy}`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                `--proxy-server=http://${randomProxy}`, 
                '--window-size=1920,1080'
            ]
        });
        
        const page = await browser.newPage();
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
        await page.setViewport({ width: 1920, height: 1080 });
        
        let extractedM3u8 = null;
        await page.setRequestInterception(true);

        // 2. Pure Sniffing: No blocking. Let the CSS and UI render perfectly.
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') && !url.includes('audio') && !url.includes('subtitles')) {
                extractedM3u8 = url;
                console.log(`[HIT] Found stream!`);
            }
            request.continue(); 
        });

        // 3. Network Idle ensures all scripts and iframes have finished loading
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});

        console.log("[Scraper] Page fully rendered. Executing UI bypass...");
        await new Promise(r => setTimeout(r, 2000));
        
        try {
            await page.mouse.click(960, 540); 
            await new Promise(r => setTimeout(r, 1000));
            await page.mouse.click(960, 540); 
        } catch (e) {
            console.log("Click skipped.");
        }

        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 50) {
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        if (!extractedM3u8) {
            const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 50 });
            await browser.close();
            return res.status(500).json({
                success: false, 
                error: "Target loaded, CSS rendered, but m3u8 failed.",
                debugImage: `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`
            });
        }

        await browser.close();

        return res.status(200).json({ 
            success: true, 
            streamUrl: extractedM3u8,
            provider: `Webshare Proxy`,
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Scraper on port ${PORT}`));
