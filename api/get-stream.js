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

        if (!imdbId) throw new Error("Could not find IMDb ID for this title.");

        let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        if (type === 'tv') {
            torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json`;
        }

        const torrentioRes = await fetch(torrentioUrl);
        const torrentioData = await torrentioRes.json();
        
        if (!torrentioData.streams || torrentioData.streams.length === 0) {
            return res.status(404).json({ success: false, message: 'No torrents found.' });
        }

        // --- THE CRITICAL FIX: STRICT BROWSER COMPATIBILITY FILTER ---
        // We MUST find an mp4. MKV files will break the HTML5 video player.
        const compatibleStreams = torrentioData.streams.filter(stream => {
            const title = (stream.title || '').toLowerCase();
            return title.includes('mp4') && !title.includes('hevc') && !title.includes('x265') && !title.includes('mkv');
        });

        if (compatibleStreams.length === 0) {
            return res.status(404).json({ success: false, message: 'No browser-compatible MP4 streams found. Try another movie.' });
        }

        // Grab the best MP4 stream
        const bestStream = compatibleStreams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        
        // Use Torrentio's file index to ensure we grab the video, not a text file
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // Send to TorBox
        const formData = new FormData();
        formData.append("magnet", magnetLink);

        const addTorrentRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
            method: "POST",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
            body: formData
        });
        
        const torrentData = await addTorrentRes.json();
        if (!torrentData.success) throw new Error("Failed to add torrent to TorBox");

        const torrentId = torrentData.data.torrent_id;

        // Request Download Link
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });

        const dlData = await dlRes.json();

        // Check if Torbox actually has the file ready
        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
            // TorBox is currently downloading it to their servers. Free users must wait.
            return res.status(202).json({ success: false, isDownloading: true, message: "TorBox is downloading this movie to their servers. Please wait 2-3 minutes and refresh." });
        }

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
