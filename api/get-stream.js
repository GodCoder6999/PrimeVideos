// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
    
    // --- INSERT YOUR PREMIUMIZE API KEY HERE ---
    const PREMIUMIZE_API_KEY = "c9k7rnbbt6ge982k"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        // 1. Get IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID.");

        // 2. ULTRA-FAST DUAL SCRAPING (Hollywood + Regional/Indian)
        const fetchStream = async (url) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 1800); 
            try {
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (!r.ok) return [];
                const d = await r.json();
                return d.streams || [];
            } catch { return []; }
        };

        const tUrl = type === 'tv' ? `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json` : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        const mUrl = type === 'tv' ? `https://mediafusion.fun/stream/series/${imdbId}:${s}:${e}.json` : `https://mediafusion.fun/stream/movie/${imdbId}.json`;

        const [tStreams, mStreams] = await Promise.all([fetchStream(tUrl), fetchStream(mUrl)]);
        let allStreams = [...tStreams, ...mStreams].filter(st => st.infoHash);

        if (allStreams.length === 0) return res.status(404).json({ success: false, message: 'No streams found on trackers.' });

        // 3. STRICT BROWSER COMPATIBILITY
        let valid = allStreams.filter(st => {
            const title = (st.title || st.name || "").toLowerCase();
            return !title.includes('hevc') && !title.includes('x265'); 
        });
        
        if (valid.length === 0) valid = allStreams;

        const bestStream = valid[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;

        // 4. PREMIUMIZE INSTANT CACHE CHECK
        const formData = new URLSearchParams();
        formData.append("src", magnetLink);

        const premRes = await fetch(`https://www.premiumize.me/api/transfer/directdl?apikey=${PREMIUMIZE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        const premData = await premRes.json();

        // 5. CACHE MISS FALLBACK
        if (premData.status !== "success" || !premData.content) {
            // It is not cached. We must tell Premiumize to start downloading it.
            await fetch(`https://www.premiumize.me/api/transfer/create?apikey=${PREMIUMIZE_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ src: magnetLink })
            });

            // The React UI will keep polling this endpoint until Premiumize finishes the download
            return res.status(202).json({ 
                success: false, 
                isDownloading: true, 
                message: "Uncached file. Premiumize is downloading it to servers..." 
            });
        }

        // 6. CACHE HIT: EXTRACT VIDEO FILE
        // Premiumize returns all files in the torrent. We want the biggest video file.
        const videoFiles = premData.content.filter(file => 
            file.path.match(/\.(mp4|mkv|avi|webm)$/i)
        );

        if (videoFiles.length === 0) {
            throw new Error("No playable video files found in the premiumize cache.");
        }

        // Sort by size descending to grab the actual movie, not a tiny sample file
        videoFiles.sort((a, b) => b.size - a.size);
        const bestFile = videoFiles[0];

        // Premiumize provides a direct raw 'link' and sometimes a 'stream_link' transcoded specifically for browsers
        const finalStreamUrl = bestFile.stream_link || bestFile.link;

        return res.status(200).json({ success: true, streamUrl: finalStreamUrl });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
