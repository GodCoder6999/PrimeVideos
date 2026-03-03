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
        // 1. Convert TMDB to IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;

        if (!imdbId) throw new Error("Could not find IMDb ID for this title.");

        // 2. Fetch from Torrentio
        let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        if (type === 'tv') {
            torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json`;
        }

        const torrentioRes = await fetch(torrentioUrl);
        const torrentioData = await torrentioRes.json();
        
        if (!torrentioData.streams || torrentioData.streams.length === 0) {
            return res.status(404).json({ success: false, message: 'No torrents found on Torrentio.' });
        }

        // 3. FILTER AND SORT: Remove HEVC/x265 and prioritize MP4
        const compatibleStreams = torrentioData.streams.filter(stream => {
            const title = (stream.title || '').toLowerCase();
            return !title.includes('hevc') && !title.includes('x265');
        }).sort((a, b) => {
            // Push MP4 files to the top of the list
            const aIsMp4 = (a.title || '').toLowerCase().includes('mp4');
            const bIsMp4 = (b.title || '').toLowerCase().includes('mp4');
            return (aIsMp4 === bIsMp4) ? 0 : aIsMp4 ? -1 : 1; 
        });

        const bestStream = compatibleStreams.length > 0 ? compatibleStreams[0] : torrentioData.streams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        
        // CRITICAL FIX: Get the exact file index from Torrentio (fallback to 0 if missing)
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // 4. Send Magnet to TorBox
        const formData = new FormData();
        formData.append("magnet", magnetLink);

        const addTorrentRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
            method: "POST",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
            body: formData
        });
        
        const torrentData = await addTorrentRes.json();
        if (!torrentData.success) throw new Error(torrentData.detail || "Failed to add torrent");

        const torrentId = torrentData.data.torrent_id;

        // 5. Request the EXACT file using the extracted fileIdx
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });

        const dlData = await dlRes.json();

        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
            throw new Error("Torrent is not cached on TorBox yet. Try another title.");
        }

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
