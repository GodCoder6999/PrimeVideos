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

        // 2. HTTP-BASED STREMIO ADDONS (Zero Torrents, Zero Waiting)
        // These servers scrape high-speed CDNs and output raw .m3u8 links instantly.
        const HTTP_ADDONS = [ // Best for Hollywood
            "https://stremify.hayd.uk",        // Great for international & dubbed
            "https://nodebrid.fly.dev"         // High-speed fallback
        ];

        const fetchStream = async (baseUrl) => {
            const url = type === 'tv' 
                ? `${baseUrl}/stream/series/${imdbId}:${s}:${e}.json`
                : `${baseUrl}/stream/movie/${imdbId}.json`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

            try {
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!r.ok) return [];
                const d = await r.json();
                return d.streams || [];
            } catch {
                return [];
            }
        };

        // 3. Fetch from all HTTP addons simultaneously
        const results = await Promise.allSettled(HTTP_ADDONS.map(fetchStream));
        
        let allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allStreams.push(...result.value);
            }
        });

        // 4. Strict Filtering: Ensure we only get direct HTTP URLs, NO MAGNETS
        let directStreams = allStreams.filter(stream => 
            stream.url && 
            !stream.infoHash && 
            !stream.url.startsWith('magnet:')
        );

        if (directStreams.length === 0) {
            return res.status(404).json({ success: false, message: 'No direct streams found. Try another movie.' });
        }

        // 5. Select the highest quality stream
        // CDNs usually return "Auto", "1080p", or server names like "UpCloud".
        let bestStream = directStreams.find(s => 
            s.name?.toLowerCase().includes('1080') || 
            s.name?.toLowerCase().includes('auto')
        ) || directStreams[0];

        // 6. Return INSTANTLY to the Prime Player (No caching state needed)
        return res.status(200).json({ 
            success: true, 
            streamUrl: bestStream.url 
        });

    } catch (error) {
        console.error("Direct HTTP Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
