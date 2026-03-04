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

        // IMPORTANT: Put your actual ZenRows API Key here
        const ZENROWS_API_KEY = "6bc46d18cdcb59931e895ba2658e883301541eea"; 

        // We will try these domains in order. If one gives a 404, it moves to the next.
        const domains = ['vidsrc.net', 'vidsrc.in', 'vidsrc.xyz', 'vidsrc.rip', 'vidsrc.pro'];
        let scrapeData = null;
        let successfulDomain = null;

        for (const domain of domains) {
            const targetUrl = type === 'tv' 
                ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` 
                : `https://${domain}/vapi/movie/${imdbId}`;

            try {
                const response = await axios({
                    url: 'https://api.zenrows.com/v1/',
                    method: 'GET',
                    timeout: 4000, // Short 4-second timeout so it quickly tries the next domain
                    params: {
                        'url': targetUrl,
                        'apikey': ZENROWS_API_KEY,
                        'premium_proxy': 'true', 
                    },
                });

                // If we get valid JSON data back, stop the loop!
                if (response.data && response.data.source) {
                    scrapeData = response.data;
                    successfulDomain = domain;
                    break; 
                }
            } catch (err) {
                // It threw a 404 or timed out. Log it and let the loop continue to the next domain.
                console.log(`${domain} failed:`, err.response?.data?.title || err.message);
            }
        }

        if (!scrapeData || !scrapeData.source) {
            throw new Error("All domains returned 404 or failed. The content might not be available.");
        }

        const directLink = scrapeData.source[0].file || scrapeData.source[0].url; 

        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud (Bypassed via ${successfulDomain})`,
            format: "m3u8"
        });

    } catch (error) {
        const errorMessage = error.response?.data 
            ? JSON.stringify(error.response.data) 
            : error.message;
            
        console.error("API Error:", errorMessage);
        return res.status(500).json({ success: false, error: errorMessage });
    }
}
