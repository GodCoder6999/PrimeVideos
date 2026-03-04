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
        const ZENROWS_API_KEY = "YOUR_ZENROWS_API_KEY"; 

        const domains = ['vidsrc.net', 'vidsrc.cc', 'vidsrc.in', 'vidsrc.xyz', 'vidsrc.rip', 'vidsrc.pro'];

        // Fire requests to ALL domains at the EXACT SAME TIME
        const fetchPromises = domains.map(async (domain) => {
            const targetUrl = type === 'tv' 
                ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` 
                : `https://${domain}/vapi/movie/${imdbId}`;

            const response = await axios({
                url: 'https://api.zenrows.com/v1/',
                method: 'GET',
                timeout: 8500, // We can safely wait 8.5 seconds because they run in parallel
                params: {
                    'url': targetUrl,
                    'apikey': ZENROWS_API_KEY,
                    'premium_proxy': 'true', 
                },
            });

            if (response.data && response.data.source) {
                return { data: response.data, domain }; // Return the winner
            }
            throw new Error(`No video data on ${domain}`);
        });

        // Promise.any() resolves instantly when the FIRST successful response comes back
        const { data: scrapeData, domain: successfulDomain } = await Promise.any(fetchPromises);

        // Extract the Direct Link
        const directLink = scrapeData.source[0].file || scrapeData.source[0].url; 

        // Proxy the Manifest
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud (Bypassed via ${successfulDomain})`,
            format: "m3u8"
        });

    } catch (error) {
        console.error("All domains timed out or returned 404.");
        return res.status(500).json({ 
            success: false, 
            error: "All streaming sources are currently offline or blocked for this title." 
        });
    }
}
