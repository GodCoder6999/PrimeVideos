import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

const TMDB_KEY = "09ca3ca71692ba80b848d268502d24ed"; // Your key from App.jsx

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper to find the correct browser path (Local vs Vercel)
async function getBrowser() {
    // If running on Vercel/AWS
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL) {
        return puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
    } else {
        // Local Development - uses your local Chrome
        // You might need to adjust this path if on Mac/Linux
        const localPaths = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome"
        ];
        // Find first valid path or fail (simplified for snippet)
        return puppeteer.launch({
            channel: 'chrome', // Try to auto-detect
            headless: false,   // Show browser locally for debugging
            ignoreHTTPSErrors: true,
        });
    }
}

async function resolveHLS(embedUrl) {
  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Set a real User-Agent to avoid detection
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    let hlsUrl = null;
    const hlsPromise = new Promise((resolve) => {
        page.on('response', (response) => {
            const url = response.url();
            if (url.includes('.m3u8') && !url.includes('google') && !url.includes('doubleclick')) { 
                hlsUrl = url;
                resolve(url);
            }
        });
    });

    // 15s timeout to load page
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for .m3u8 or timeout (8s)
    const result = await Promise.race([
        hlsPromise,
        new Promise(r => setTimeout(() => r(null), 8000))
    ]);

    return result;

  } catch (error) {
    console.error("Resolver Error:", error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }
  Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const { id, type = 'movie', season, episode } = req.query;

  if (!id) return res.status(400).json({ error: "Missing ID" });

  try {
    // 1. CONVERT TMDB ID -> IMDB ID (Critical Step!)
    // Vidsrc uses IMDb IDs (tt12345), but your App uses TMDB IDs (12345).
    const metaUrl = `https://api.themoviedb.org/3/${type}/${id}/external_ids?api_key=${TMDB_KEY}`;
    const metaRes = await axios.get(metaUrl);
    const imdbId = metaRes.data.imdb_id;

    if (!imdbId) {
        return res.status(404).json({ error: "IMDb ID not found for this title" });
    }

    // 2. Construct Vidsrc URL
    let embedUrl;
    if (type === 'movie') {
        embedUrl = `https://vidsrc.to/embed/movie/${imdbId}`;
    } else {
        embedUrl = `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`;
    }
    
    console.log(`Scraping: ${embedUrl}`);

    // 3. Resolve Stream
    const hls = await resolveHLS(embedUrl);

    if (hls) {
        return res.status(200).json({ streamUrl: hls });
    } else {
        return res.status(404).json({ error: "Stream not found (Scraper failed)" });
    }

  } catch (error) {
    console.error("Handler Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}