import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

// 1. Apply Stealth AND Adblocker to destroy click-traps and hide bot fingerprints
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
app.use(cors({ origin: '*' }));

// --- WEBSHARE PROXY POOL ---
const PROXY_USERNAME = 'chmkovfs';
const PROXY_PASSWORD = 'zk304sqheh0b';

// Array of your 10 active proxy IPs and Ports
const proxyList = [
    "31.59.20.176:6754",   // UK, London
    "23.95.150.145:6114",  // US, Buffalo
    "198.23.239.134:6540", // US, Buffalo
    "45.38.107.97:6014",   // UK, London
    "107.172.163.27:6543", // US, Bloomingdale
    "198.105.121.200:6462",// UK, City Of London
    "64.137.96.74:6641",   // Spain, Madrid
    "216.10.27.159:6837",  // US, Dallas
    "142.111.67.146:5611", // Japan, Tokyo
    "194.39.32.164:6461"   // Germany, Frankfurt
];

app.get('/', (req, res) => {
    res.send('🚀 Enterprise Rotating Proxy Scraper is Live!');
});

app.get('/api/get-stream', async (req, res) => {
    const { targetUrl } = req.query;

    if (!targetUrl) return res.status(400).json({ success: false, message: 'Missing targetUrl' });

    // 2. Select a random proxy from the pool for IP Rotation
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    
    let browser = null;
    try {
        console.log(`[Scraper] Connecting via Proxy: ${randomProxy}`);
        console.log(`[Scraper] Hunting: ${targetUrl}`);
        
        // 3. Launch Chrome routed through the Webshare Proxy
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                `--proxy-server=http://${randomProxy}`, // 🚀 Route traffic through residential IP
                '--window-size=1920,1080'
            ]
        });
        
        const page = await browser.newPage();
        
        // 4. Authenticate the Proxy
        await page.authenticate({ 
            username: PROXY_USERNAME, 
            password: PROXY_PASSWORD 
        });

        await page.setViewport({ width: 1920, height: 1080 });
        
        let extractedM3u8 = null;
        await page.setRequestInterception(true);

        // 5. The Ultimate Sniffer Logic
        page.on('request', (request) => {
            const url = request.url();
            
            // Look for the m3u8 file
            if (url.includes('.m3u8') && !url.includes('audio') && !url.includes('subtitles')) {
                extractedM3u8 = url;
                console.log(`[HIT] Found stream: ${url.substring(0, 60)}...`);
            }
            
            // Block heavy media to save your proxy bandwidth!
            if (['image', 'font', 'stylesheet'].includes(request.resourceType()) && !url.includes('.m3u8')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 6. Load the page (With a generous timeout because proxies can be slightly slower)
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

        console.log("[Scraper] Page loaded. Bypassing UI...");
        await new Promise(r => setTimeout(r, 2000));
        
        // 7. Aggressive clicking strategy
        try {
            await page.mouse.click(960, 540); 
            await new Promise(r => setTimeout(r, 1000));
            await page.mouse.click(960, 540); 
        } catch (e) {
            console.log("Mouse click skipped.");
        }

        // 8. Wait for the stream
        let waitLoops = 0;
        while (!extractedM3u8 && waitLoops < 50) {
            await new Promise(r => setTimeout(r, 200));
            waitLoops++;
        }

        // --- THE DEBUGGER ---
        if (!extractedM3u8) {
            console.log("[Scraper] Failed. Taking visual snapshot...");
            const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 50 });
            const base64Image = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
            
            await browser.close();
            
            return res.status(500).json({
                success: false, 
                error: "Target loaded via proxy, but no m3u8 was exposed. Check the visual debugger image.",
                debugImage: base64Image 
            });
        }

        await browser.close();

        return res.status(200).json({ 
            success: true, 
            streamUrl: extractedM3u8,
            provider: `Webshare Proxy (${randomProxy.split(':')[0]})`,
            format: "m3u8"
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error("[Error]:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Enterprise Rotating Scraper Server running on port ${PORT}`);
});
