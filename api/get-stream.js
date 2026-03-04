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
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        const targetUrl = type === 'tv' 
            ? `https://vidsrc.cc/vapi/episode/${imdbId}/${s}/${e}` 
            : `https://vidsrc.cc/vapi/movie/${imdbId}`;

        const ZENROWS_API_KEY = "YOUR_ZENROWS_API_KEY"; 
        
        const response = await axios({
            url: 'https://api.zenrows.com/v1/',
            method: 'GET',
            timeout: 8500, // Force axios to give up before Vercel's 10s limit
            params: {
                'url': targetUrl,
                'apikey': ZENROWS_API_KEY,
                // Removed 'js_render' to drastically speed up the response
                'premium_proxy': 'true', 
            },
        });

        const scrapeData = response.data;

        if (!scrapeData || !scrapeData.source) {
            throw new Error("Target site returned data, but no video files were found.");
        }

        const directLink = scrapeData.source[0].file || scrapeData.source[0].url; 

        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud (Bypassed)`,
            format: "m3u8"
        });

    } catch (error) {
        // This extracts the EXACT error from ZenRows or Axios instead of swallowing it
        const errorMessage = error.response?.data 
            ? JSON.stringify(error.response.data) 
            : error.message;
            
        console.error("API Error:", errorMessage);
        return res.status(500).json({ success: false, error: errorMessage });
    }
}
