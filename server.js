import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

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

        // 🚀 THE POPUP ASSASSIN
        // This listens for any new tabs attempting to open and violently closes them.
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                // If it's a popup and not our main page, kill it.
                if (newPage) {
                    console.log("🔪 [Security] Intercepted and destroyed popup ad.");
                    await newPage.close();
                }
            }
        });
        
        const page = await (await browser.pages())[0]; // Ensure we are on the original tab
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
        await page.setViewport({ width: 1920, height: 1080 });
        
        let extractedM3u8 = null;
        await page.setRequestInterception(true);

        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') && !url.includes('audio') && !url.includes('subtitles')) {
                extractedM3u8 = url;
                console.log(`[HIT] Found stream: ${url}`);
            }
            request.continue(); 
        });

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});

        console.log("[Scraper] Page fully rendered. Executing UI bypass...");
        await new Promise(r => setTimeout(r, 2000));
        
        // Dynamic DOM Targeting instead of blind coordinates
        // Look for common play button elements or standard iframes
        const iframeElement = await page.$('iframe');
        
        if (iframeElement) {
            console.log("[Scraper] Found video iframe. Clicking dead center of the element.");
            const box = await iframeElement.boundingBox();
            if (box) {
                // Click the center of the iframe itself, no matter where it is on screen
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                await new Promise(r => setTimeout(r, 1500));
                // Click again in case the first click triggered the popup we just destroyed
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            }
        } else {
            console.log("[Scraper] No iframe found. Falling back to viewport center.");
            await page.mouse.click(960, 540); 
            await new Promise(r => setTimeout(r, 1500));
            await page.mouse.click(960, 540); 
        }

        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 60) {
            await new Promise(r => setTimeout(r, 250)); // Wait up to 15 seconds after clicking
            waitLoops++;
        }

        if (!extractedM3u8) {
            const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            await browser.close();
            return res.status(500).json({
                success: false, 
                error: "Target loaded and clicked, but m3u8 failed.",
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
app.listen(PORT, () => console.log(`🚀 Advanced Scraper on port ${PORT}`));
