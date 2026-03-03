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

        if (!imdbId) throw new Error("IMDb ID not found.");

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
        let allStreams = [...tStreams, ...mStreams].filter(st => st.infoHash);

        if (allStreams.length === 0) throw new Error("No streams found.");

        // Prioritize MP4 and avoid HEVC for browser compatibility
        let valid = allStreams.filter(st => {
            const title = (st.title || "").toLowerCase();
            return !title.includes('hevc') && !title.includes('x265') && !title.includes('mkv'); 
        });
        if (valid.length === 0) valid = allStreams;

        const bestStream = valid[0];
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // Prevent duplicate add errors by checking mylist
        const listRes = await fetch("https://api.torbox.app/v1/api/torrents/mylist?bypass_cache=true", {
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });
        const listData = await listRes.json();
        const existing = listData?.data?.find(t => t.hash.toLowerCase() === bestStream.infoHash.toLowerCase());

        let torrentId = existing ? existing.id : null;

        if (!torrentId) {
            const addRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
                method: "POST",
                headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
                body: new URLSearchParams({ magnet: `magnet:?xt=urn:btih:${bestStream.infoHash}` })
            });
            const addData = await addRes.json();
            if (!addData.success) throw new Error(addData.detail || "TorBox Error");
            torrentId = addData.data.torrent_id;
        }

        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`);
        const dlData = await dlRes.json();

        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
            const percent = existing ? Math.round(existing.progress * 100) : 0;
            return res.status(202).json({ success: false, isDownloading: true, message: percent > 0 ? `Downloading: ${percent}%` : "Caching..." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
