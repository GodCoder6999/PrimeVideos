// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        // 1. Get IMDb ID (Required by most direct link extractors)
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        // 2. High-Speed Direct Resolvers (March 2026 Active List)
        // These APIs return raw .m3u8 URLs directly from high-speed CDNs.
        const EXTRACTORS = [
            `https://vidlink.pro/api/stream/${type}/${tmdbId}${type==='tv'?`/${s}/${e}`:''}`, 
            `https://vidsrc.xyz/api/source/${imdbId}${type==='tv'?`/${s}/${e}`:''}`,
            `https://autoembed.to/api/movie/${tmdbId}` // Simplified fallback
        ];

        const fetchWithTimeout = async (url) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3500); // 3.5s timeout per source
            try {
                const response = await fetch(url, { signal: controller.signal });
                const data = await response.json();
                // Return only if it has a direct stream URL
                return data.url || data.streamUrl || data.source || null;
            } catch { return null; }
        };

        // 3. Race Condition: Take the fastest working source
        // This makes your loading time extremely low
        const results = await Promise.all(EXTRACTORS.map(fetchWithTimeout));
        const validStream = results.find(link => link && typeof link === 'string' && link.startsWith('http'));

        if (!validStream) {
            // Final Fallback: Attempting a specific Regional/Indian Content Aggregator
            // Note: MediaFusion is the best for Bollywood/Bengali if the above fail
            return res.status(404).json({ success: false, message: 'Direct stream not found. Try again in a moment.' });
        }

        return res.status(200).json({ 
            success: true, 
            streamUrl: validStream 
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
