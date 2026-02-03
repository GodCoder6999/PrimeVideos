import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// --- CONFIGURATION ---
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 's-maxage=10, stale-while-revalidate',
};

// In-memory cache (resets on serverless cold start)
const streamCache = new Map();

// --- HEADLESS RESOLVER ---
async function resolveHLS(embedUrl) {
  let browser = null;
  try {
    // Launch Vercel-optimized Chrome
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Optimize: Block images, fonts, and stylesheets to speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Capture the first .m3u8 URL that isn't an ad
    let hlsUrl = null;
    const hlsPromise = new Promise((resolve) => {
        page.on('response', (response) => {
            const url = response.url();
            // Filter logic: Must be m3u8 and not a known ad domain
            if (url.includes('.m3u8') && !url.includes('google') && !url.includes('doubleclick')) { 
                hlsUrl = url;
                resolve(url);
            }
        });
    });

    // Navigate to the embed URL
    // standard 15s timeout for page load
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Race: Wait for either the HLS url to be found OR a timeout
    const result = await Promise.race([
        hlsPromise,
        new Promise(r => setTimeout(() => r(null), 8000)) // 8s scraping timeout
    ]);

    return result;

  } catch (error) {
    console.error("Resolver Error:", error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// --- PROVIDERS (Source Rotator) ---
const providers = [
    {
        name: 'Vidsrc',
        search: async (id, type, season, episode) => {
            // Logic to construct the embed URL for Vidsrc
            if (type === 'movie') {
                return `https://vidsrc.to/embed/movie/${id}`;
            } else {
                return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
            }
        }
    },
    // Add more providers here (e.g., SuperStream, VidLink, etc.)
];

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  // Set Headers
  Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const { id, type = 'movie', season, episode } = req.query;

  if (!id) return res.status(400).json({ error: "Missing ID" });

  const cacheKey = `${type}-${id}-${season || ''}-${episode || ''}`;

  // 1. Check Cache
  if (streamCache.has(cacheKey)) {
    return res.status(200).json({ streamUrl: streamCache.get(cacheKey), source: 'cache' });
  }

  try {
    // 2. Loop through providers until a stream is found
    for (const provider of providers) {
        console.log(`Checking provider: ${provider.name}`);
        
        const embedUrl = await provider.search(id, type, season, episode);
        if (!embedUrl) continue;

        // 3. Resolve HLS using Headless Browser
        const hls = await resolveHLS(embedUrl);

        if (hls) {
            // Success! Cache and return
            streamCache.set(cacheKey, hls);
            // Clear cache entry after 1 hour to prevent stale links
            setTimeout(() => streamCache.delete(cacheKey), 1000 * 60 * 60);

            return res.status(200).json({ streamUrl: hls, source: provider.name });
        }
    }

    return res.status(404).json({ error: "No stream found across all providers" });

  } catch (error) {
    console.error("Stream API Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}