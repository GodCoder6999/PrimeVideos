// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        // 1. Convert TMDB ID to IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID.");

        // 2. THE CURRENTLY ACTIVE HTTP EXTRACTORS
        // These servers bypass iframes and ads, returning pure .m3u8 or .mp4 files.
        const HTTP_ADDONS = [
            "https://vidsrc.elfhosted.com",        // Highly reliable VidSrc extractor
            "https://stremio-vidsrc.vercel.app",   // Backup VidSrc extractor
            "https://superflix.elfhosted.com"      // Scrapes SuperStream (Great for Hollywood)
        ];

        const fetchStream = async (baseUrl) => {
            const url = type === 'tv' 
                ? `${baseUrl}/stream/series/${imdbId}:${s}:${e}.json`
                : `${baseUrl}/stream/movie/${imdbId}.json`;
            
            const controller = new AbortController();
            // 4-second timeout to ensure the player doesn't hang if one server is slow
            const timeoutId = setTimeout(() => controller.abort(), 4000); 

            try {
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!r.ok) return [];
                const d = await r.json();
                return d.streams || [];
            } catch {
                return []; // Fail silently so other scrapers can finish
            }
        };

        // 3. Fetch from all active HTTP addons simultaneously
        const results = await Promise.allSettled(HTTP_ADDONS.map(fetchStream));
        
        let allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allStreams.push(...result.value);
            }
        });

        // 4. Strict Filtering: Keep ONLY direct video links. KILL all magnets/torrents.
        let directStreams = allStreams.filter(stream => 
            stream.url && 
            !stream.infoHash && 
            !stream.url.startsWith('magnet:')
        );

        if (directStreams.length === 0) {
            return res.status(404).json({ success: false, message: 'No direct HTTP streams found right now.' });
        }

        // 5. Select the highest quality stream available
        let bestStream = directStreams.find(s => 
            s.name?.toLowerCase().includes('1080') || 
            s.name?.toLowerCase().includes('auto')
        ) || directStreams[0];

        // 6. Instantly send the URL to your Prime Video Player
        return res.status(200).json({ 
            success: true, 
            streamUrl: bestStream.url 
        });

    } catch (error) {
        console.error("Direct HTTP Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
