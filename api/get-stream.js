// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
    const TORBOX_API_KEY = "c94190bd-70f2-4c0c-b30f-32c1b6ada48d"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID.");

        const ADDONS = [
            "https://torrentio.strem.fun", 
            "https://mediafusion.fun",
            "https://knightcrawler.elfhosted.com",
            "https://annatar.elfhosted.com"
        ];

        // 1. FAST SCRAPING: Reduced timeout to 2000ms (2 seconds)
        const fetchPromises = ADDONS.map(async (addonBaseUrl) => {
            const url = type === 'tv' 
                ? `${addonBaseUrl}/stream/series/${imdbId}:${s}:${e}.json`
                : `${addonBaseUrl}/stream/movie/${imdbId}.json`;
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); 
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) return [];
                const data = await response.json();
                return data.streams || [];
            } catch (err) {
                return []; 
            }
        });

        const results = await Promise.allSettled(fetchPromises);
        
        let allStreams = [];
        results.forEach(r => { if (r.status === 'fulfilled') allStreams.push(...r.value); });
        allStreams = allStreams.filter(stream => stream.infoHash);

        if (allStreams.length === 0) return res.status(404).json({ success: false, message: 'No streams found.' });

        let compatibleStreams = allStreams.filter(stream => {
            const title = (stream.title || stream.name || '').toLowerCase();
            return !title.includes('hevc') && !title.includes('x265');
        });

        if (compatibleStreams.length === 0) compatibleStreams = allStreams;

        const bestStream = compatibleStreams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // 2. THE QUEUE FIX: Check Torbox's active list first to prevent duplicate errors
        const listRes = await fetch("https://api.torbox.app/v1/api/torrents/mylist?bypass_cache=true", {
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });
        const listData = await listRes.json();
        
        let torrentId = null;
        let existingTorrent = null;

        if (listData.success && listData.data) {
            existingTorrent = listData.data.find(t => t.hash.toLowerCase() === bestStream.infoHash.toLowerCase());
        }

        if (existingTorrent) {
            torrentId = existingTorrent.id;
        } else {
            const formData = new URLSearchParams();
            formData.append("magnet", magnetLink);
            const addRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
                method: "POST",
                headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
                body: formData
            });
            const addData = await addRes.json();
            if (!addData.success) throw new Error(addData.detail || "Failed to add to TorBox limit.");
            torrentId = addData.data.torrent_id;
        }

        // 3. Request Download Link
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`);
        const dlData = await dlRes.json();

        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
            // 4. Provide real-time progress for uncached files
            let progressMsg = "Initializing Cache...";
            if (existingTorrent) {
                const percent = Math.round(existingTorrent.progress * 100);
                progressMsg = `Downloading to Server: ${percent}%`;
            }
            return res.status(202).json({ success: false, isDownloading: true, message: progressMsg });
        }

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
