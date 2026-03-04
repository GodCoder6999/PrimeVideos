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

        // 2. The Domains
        const domains = ['vidsrc.cc', 'vidsrc.rip', 'vidsrc.xyz', 'vidsrc.in', 'vidsrc.net', 'vidsrc.pro'];

        // 3. The Fetch Logic (Designed to throw an error if blocked, so Promise.any ignores it)
        const fetchLink = async (domain, useProxy = false) => {
            let url = type === 'tv' 
                ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` 
                : `https://${domain}/vapi/movie/${imdbId}`;

            // Hide Vercel IP behind a public CORS proxy
            if (useProxy) {
                url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            }

            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                    "Referer": `https://${domain}/`
                },
                signal: AbortSignal.timeout(6000) // 6 second limit per request
            });

            if (!response.ok) throw new Error("Blocked by Cloudflare");
            
            const data = await response.json();
            const directLink = data?.source?.[0]?.file || data?.source?.[0]?.url;
            
            if (!directLink) throw new Error("No stream found on this domain");
            return directLink; // The winning URL!
        };

        // 4. Create the Shotgun Race
        const tasks = [];
        domains.forEach(domain => {
            tasks.push(fetchLink(domain, false)); // Direct attempt
            tasks.push(fetchLink(domain, true));  // Proxied attempt
        });

        // 5. Race them! The fastest successful response instantly resolves.
        let directLink;
        try {
            directLink = await Promise.any(tasks);
        } catch (aggregateError) {
            // If Promise.any fails, it means ALL 12 requests were blocked or failed.
            throw new Error("All Scraper APIs and Proxies are heavily blocked by Cloudflare right now.");
        }

        // 6. Send the winning link to the PrimePlayer frontend
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        
        // We wrap it in your local proxy to bypass browser CORS rules during playback
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: "VidCloud Multi-Scraper",
            format: "m3u8"
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
