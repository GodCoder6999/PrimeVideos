export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Convert TMDB ID to IMDb ID (Many hoster APIs require IMDb IDs)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. The Scraper Phase
        // We are querying an aggregator API that crawls hosters like VidCloud/UpCloud
        // and returns the raw .m3u8 extraction. 
        // Note: Public APIs rotate, so if this specific endpoint dies in the future, 
        // you just swap this URL with another Consumet/FlixHQ instance.
        const searchUrl = type === 'tv' 
            ? `https://vidsrc.xyz/vapi/episode/${imdbId}/${s}/${e}` 
            : `https://vidsrc.xyz/vapi/movie/${imdbId}`;

        // We fetch the scraper API
        const scrapeRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
        
        if (!scrapeRes.ok) throw new Error("Scraper API failed to find hoster links.");
        
        const scrapeData = await scrapeRes.json();
        
        // 3. Extract the Direct Link
        // The scraper usually returns a list of sources. We want the primary HLS (.m3u8) stream.
        let directLink = null;
        
        if (scrapeData?.source && scrapeData.source.length > 0) {
            // Find the highest quality stream link available from the hoster
            directLink = scrapeData.source[0].file || scrapeData.source[0].url; 
        }

        if (!directLink) throw new Error("Scraper connected, but no direct video files were found on the hoster.");

        // 4. Proxy the Manifest (Crucial for bypassing Hoster CORS blocks)
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(directLink)}`,
            provider: "VidCloud/UpCloud (via Scraper)",
            format: "m3u8"
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
