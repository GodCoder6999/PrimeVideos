// File: api/get-stream.js
export default async function handler(req, res) {
    // 1. Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type, tmdbId, s, e } = req.query;

    // YOUR KEYS (In a real app, put these in Vercel Environment Variables)
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
    const TORBOX_API_KEY = "c94190bd-70f2-4c0c-b30f-32c1b6ada48d"; // PASTE YOUR TORBOX KEY HERE

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // --- 1. CONVERT TMDB ID TO IMDB ID ---
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID for this title.");

        // --- 2. GET TORRENTS FROM TORRENTIO ---
        let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        if (type === 'tv') {
            torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json`;
        }

        const torrentioRes = await fetch(torrentioUrl);
        const torrentioData = await torrentioRes.json();
        
        if (!torrentioData.streams || torrentioData.streams.length === 0) {
            return res.status(404).json({ success: false, message: 'No torrents found on Torrentio.' });
        }

        // NEW: Filter out HEVC/x265 because Chrome/Firefox show a blank screen for them
        const compatibleStreams = torrentioData.streams.filter(stream => {
            const title = (stream.title || '').toLowerCase();
            return !title.includes('hevc') && !title.includes('x265');
        });

        // Use the first compatible stream, or fallback to the first available if none exist
        const bestStream = compatibleStreams.length > 0 ? compatibleStreams[0] : torrentioData.streams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        // --- 3. SEND MAGNET TO TORBOX API ---
        const formData = new FormData();
        formData.append("magnet", magnetLink);

        const addTorrentRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${TORBOX_API_KEY}` 
            },
            body: formData
        });
        
        const torrentData = await addTorrentRes.json();
        
        if (!torrentData.success) {
            throw new Error(torrentData.detail || "Failed to add torrent to TorBox");
        }

        const torrentId = torrentData.data.torrent_id;

        // --- 4. REQUEST THE DIRECT PLAYABLE LINK FROM TORBOX ---
        // Note: For the free tier, the torrent needs to be cached. If it's a popular movie, 
        // TorBox usually has it cached instantly.
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=0`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });

        const dlData = await dlRes.json();

        if (dlData.success && dlData.data) {
            // WE HAVE THE DIRECT LINK! Send it to the React Player
            return res.status(200).json({ 
                success: true, 
                streamUrl: dlData.data 
            });
        } else {
            throw new Error("TorBox is still downloading this file, or it failed.");
        }

    } catch (error) {
        console.error("Streaming Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
