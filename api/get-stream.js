import { gotScraping } from 'got-scraping';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Convert TMDB ID to IMDb ID (Using standard fetch, TMDB doesn't block bots)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. The Domains
        const domains = ['vidsrc.cc', 'vidsrc.rip', 'vidsrc.xyz', 'vidsrc.in', 'vidsrc.net', 'vidsrc.pro'];
        let scrapeData = null;
        let successfulDomain = null;

        // 3. Match TLS/HTTP2 Fingerprints using Got Scraping
        for (const domain of domains) {
            try {
                const searchUrl = type === 'tv' 
                    ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` 
                    : `https://${domain}/vapi/movie/${imdbId}`;

                // gotScraping AUTOMATICALLY spoofs the TLS handshake, ciphers, and HTTP/2 
                // frames to look exactly like a real desktop browser.
                const response = await gotScraping({
                    url: searchUrl,
                    responseType: 'json',
                    headers: {
                        "Referer": `https://${domain}/`
                    },
                    timeout: { request: 6000 } // Don't hang on dead domains
                });
                
                // If Cloudflare lets us through, we get a 200 OK!
                if (response.statusCode === 200 && response.body?.source) {
                    scrapeData = response.body;
                    successfulDomain = domain;
                    break; 
                }
            } catch (err) {
                console.log(`Cloudflare blocked ${domain} or it is offline. Trying next...`);
            }
        }

        if (!scrapeData) {
            throw new Error("Cloudflare's highest security level is active. TLS spoofing failed on all domains.");
        }

        // 4. Extract the Direct Link
        const directLink = scrapeData.source[0].file || scrapeData.source[0].url; 

        if (!directLink) throw new Error(`Bypassed Cloudflare on ${successfulDomain}, but no video files were found.`);

        // 5. Proxy the Manifest to bypass CORS in the browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: `VidCloud (TLS Spoof via ${successfulDomain})`,
            format: "m3u8"
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
