import axios from 'axios';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Get IMDb ID
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. Define the target URL you want to scrape
        const targetUrl = type === 'tv' 
            ? `https://vidsrc.cc/vapi/episode/${imdbId}/${s}/${e}` 
            : `https://vidsrc.cc/vapi/movie/${imdbId}`;

        // 3. 100% Reliable Cloudflare Bypass via ZenRows (or similar API)
        // Sign up for ZenRows/ScraperAPI to get your API key
        const ZENROWS_API_KEY = "YOUR_ZENROWS_API_KEY"; 
        
        const response = await axios({
            url: 'https://api.zenrows.com/v1/',
            method: 'GET',
            params: {
                'url': targetUrl,
                'apikey': ZENROWS_API_KEY,
                'js_render': 'true', // Forces their browsers to execute Cloudflare's JS
                'premium_proxy': 'true', // Uses residential IPs so Cloudflare doesn't block it
            },
        });

        const scrapeData = response.data;

        if (!scrapeData || !scrapeData.source) {
            throw new Error("Failed to extract video data.");
        }

        // 4. Extract the Direct Link
        const directLink = scrapeData.source[0].file || scrapeData.source[0].url; 

        // 5. Proxy the Manifest to bypass CORS in the browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud (Bypassed)`,
            format: "m3u8"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
