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
        // 1. Convert TMDB ID to IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID.");

        // 2. STRICT TORRENTGALAXY ISOLATION
        // We pass the "providers=torrentgalaxy" parameter to bypass Cloudflare 
        // while strictly pulling only TorrentGalaxy's database results.
        const tgxUrl = type === 'tv' 
            ? `https://torrentio.strem.fun/providers=torrentgalaxy/stream/series/${imdbId}:${s}:${e}.json`
            : `https://torrentio.strem.fun/providers=torrentgalaxy/stream/movie/${imdbId}.json`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); 
        const response = await fetch(tgxUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("TorrentGalaxy aggregator failed to respond.");
        const data = await response.json();
        const allStreams = data.streams || [];

        if (allStreams.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie/Show not found on TorrentGalaxy.' });
        }

        // 3. Filter for browser-compatible streams (Prioritize MP4, Avoid HEVC/x265)
        let compatibleStreams = allStreams.filter(stream => {
            const title = (stream.title || stream.name || '').toLowerCase();
            return !title.includes('hevc') && !title.includes('x265');
        });

        if (compatibleStreams.length === 0) compatibleStreams = allStreams;

        // Grab the best TorrentGalaxy stream
        const bestStream = compatibleStreams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // 4. CHECK TORBOX QUEUE (Prevents Duplicate Crashing Bug)
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
            // Send the TorrentGalaxy magnet to TorBox
            const formData = new URLSearchParams();
            formData.append("magnet", magnetLink);
            const addRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
                method: "POST",
                headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
                body: formData
            });
            const addData = await addRes.json();
            if (!addData.success) throw new Error(addData.detail || "Failed to add TorrentGalaxy magnet to TorBox.");
            torrentId = addData.data.torrent_id;
        }

        // 5. Request Direct Download Link
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`);
        const dlData = await dlRes.json();

        // 6. Handle Caching vs Playing
        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
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
