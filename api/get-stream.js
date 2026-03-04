export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Convert TMDB ID to IMDb ID
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. Domain Rotation & Headers (Bypassing Cloudflare blocks on Vercel)
        const domains = ['vidsrc.xyz', 'vidsrc.in', 'vidsrc.pm', 'vidsrc.net'];
        let scrapeData = null;
        let successfulDomain = null;

        // Pretend to be a real Windows Desktop Chrome Browser
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9"
        };

        for (const domain of domains) {
            try {
                const searchUrl = type === 'tv' 
                    ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` 
                    : `https://${domain}/vapi/movie/${imdbId}`;

                headers["Referer"] = `https://${domain}/`; // Required by some hosters

                const scrapeRes = await fetch(searchUrl, { 
                    headers, 
                    signal: AbortSignal.timeout(6000) // Don't hang too long on dead domains
                });
                
                if (scrapeRes.ok) {
                    scrapeData = await scrapeRes.json();
                    successfulDomain = domain;
                    break; // Stop looking once we get a successful response
                }
            } catch (err) {
                console.log(`Failed to reach ${domain}, trying next...`);
            }
        }

        if (!scrapeData) {
            throw new Error("All Scraper API domains are currently blocked or offline.");
        }

        // 3. Extract the Direct Link
        let directLink = null;
        
        if (scrapeData?.source && scrapeData.source.length > 0) {
            directLink = scrapeData.source[0].file || scrapeData.source[0].url; 
        }

        if (!directLink) throw new Error(`Scraper connected to ${successfulDomain}, but no direct video files were found.`);

        // 4. Proxy the Manifest to bypass CORS in the browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud/UpCloud (via ${successfulDomain})`,
            format: "m3u8"
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
