// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
    
    // --- REPLACE THIS WITH YOUR REAL-DEBRID API KEY ---
    const RD_API_KEY = "YOUR_REAL_DEBRID_API_KEY"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        // 1. Get IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;
        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. Dual Scraper (Torrentio + MediaFusion for Bollywood/South content)
        const fetchStream = async (url) => {
            try {
                const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
                const d = await r.json();
                return d.streams || [];
            } catch { return []; }
        };

        const tUrl = type === 'tv' ? `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json` : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        const mUrl = type === 'tv' ? `https://mediafusion.fun/stream/series/${imdbId}:${s}:${e}.json` : `https://mediafusion.fun/stream/movie/${imdbId}.json`;

        const [tStreams, mStreams] = await Promise.all([fetchStream(tUrl), fetchStream(mUrl)]);
        const allStreams = [...tStreams, ...mStreams].filter(st => st.infoHash);
        if (allStreams.length === 0) throw new Error("No streams found on trackers.");

        // 3. Filter and pick best stream
        const bestStream = allStreams.find(st => !st.title?.toLowerCase().includes('hevc')) || allStreams[0];
        const hash = bestStream.infoHash.toLowerCase();

        // 4. REAL-DEBRID FLOW
        // Step A: Add magnet to Real-Debrid
        const addRes = await fetch("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RD_API_KEY}` },
            body: new URLSearchParams({ magnet: `magnet:?xt=urn:btih:${hash}` })
        });
        const addData = await addRes.json();
        if (!addData.id) throw new Error("Failed to add magnet to Real-Debrid.");

        // Step B: Select all files to trigger instant caching (if available)
        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${addData.id}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${RD_API_KEY}` },
            body: new URLSearchParams({ files: "all" })
        });

        // Step C: Get Torrent Info to find the hoster link
        const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${addData.id}`, {
            headers: { "Authorization": `Bearer ${RD_API_KEY}` }
        });
        const infoData = await infoRes.json();

        // If cached, it will have links immediately
        if (infoData.links && infoData.links.length > 0) {
            // Unrestrict the first link (usually the biggest video file)
            const unrestrictRes = await fetch("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
                method: "POST",
                headers: { "Authorization": `Bearer ${RD_API_KEY}` },
                body: new URLSearchParams({ link: infoData.links[0] })
            });
            const unrestrictData = await unrestrictRes.json();
            
            return res.status(200).json({ success: true, streamUrl: unrestrictData.download });
        } else {
            // If not cached, provide progress update
            const progress = Math.round(infoData.progress || 0);
            return res.status(202).json({ 
                success: false, 
                isDownloading: true, 
                message: progress > 0 ? `RD Downloading: ${progress}%` : "Adding to RD..." 
            });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
