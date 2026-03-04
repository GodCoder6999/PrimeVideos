export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
    
    // REPLACE THIS WITH YOUR TORBOX API KEY
    const TB_API_KEY = "e6d1e168-3312-4de6-ac80-5480639e3b20"; 

    if (!type || !tmdbId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    try {
        // 1. Get IMDb ID
        const idRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;
        
        if (!imdbId) throw new Error("IMDb ID not found.");

        // 2. Fetch streams from trackers
        const fetchStream = async (url) => {
            try {
                const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) return [];
                const d = await r.json();
                return d.streams || [];
            } catch (error) { 
                return []; 
            }
        };

        const path = type === 'tv' ? `series/${imdbId}:${s}:${e}.json` : `movie/${imdbId}.json`;
        const tUrl = `https://torrentio.strem.fun/stream/${path}`;
        const kUrl = `https://knightcrawler.elfhosted.com/stream/${path}`;

        const [tStreams, kStreams] = await Promise.all([fetchStream(tUrl), fetchStream(kUrl)]);
        const allStreams = [...tStreams, ...kStreams].filter(st => st.infoHash);
        if (allStreams.length === 0) throw new Error("No streams found.");

        const bestStream = allStreams.find(st => !st.title?.toLowerCase().includes('hevc') && !st.title?.toLowerCase().includes('x265')) || allStreams[0];
        const hash = bestStream.infoHash.toLowerCase();
        const magnetLink = `magnet:?xt=urn:btih:${hash}`;

        // 3. TorBox Flow
        // Step A: Add Torrent to TorBox
        const addRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${TB_API_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ magnet: magnetLink })
        });
        
        const addData = await addRes.json();
        
        if (!addData.success && !addData.detail?.includes("already exists")) {
            throw new Error(`TorBox rejected the magnet: ${JSON.stringify(addData)}`);
        }

        // Step B: Check Torrent Status
        const statusRes = await fetch("https://api.torbox.app/v1/api/torrents/mylist", {
            method: "GET",
            headers: { "Authorization": `Bearer ${TB_API_KEY}` }
        });
        const statusData = await statusRes.json();

        if (!statusData.success) throw new Error("Failed to get TorBox torrent list.");

        const myTorrent = statusData.data?.find(t => t.hash.toLowerCase() === hash);
        
        if (!myTorrent) {
            throw new Error("Torrent added successfully but hasn't appeared in TorBox list yet.");
        }

        if (myTorrent.download_state !== "completed" && myTorrent.download_state !== "cached") {
            return res.status(202).json({ 
                success: false, 
                isDownloading: true, 
                message: `TorBox is downloading... Progress: ${myTorrent.progress || 0}%` 
            });
        }

        // Step C: Find the largest VIDEO file
        const files = myTorrent.files || [];
        if (files.length === 0) throw new Error("TorBox finished, but no files were found.");
        
        const videoFiles = files.filter(f => {
            const name = (f.name || f.short_name || '').toLowerCase();
            return name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi');
        });
        
        const targetFiles = videoFiles.length > 0 ? videoFiles : files;
        const bestFile = targetFiles.sort((a, b) => b.size - a.size)[0];

        // Step D: Request the final playable stream link safely
        const dlUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${TB_API_KEY}&torrent_id=${myTorrent.id}&file_id=${bestFile.id}`;
        
        const dlRes = await fetch(dlUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TB_API_KEY}` }
        });
        
        const rawText = await dlRes.text();
        let dlData;
        
        try {
            dlData = JSON.parse(rawText);
        } catch (parseError) {
            throw new Error(`TorBox server crashed (Status: ${dlRes.status}). Response: ${rawText}`);
        }

        if (!dlData.success && !dlData.data) {
            throw new Error(`TorBox rejected the stream link. Reason: ${dlData.detail || JSON.stringify(dlData)}`);
        }

        const rawUrl = dlData.data;

        // Route through your local proxy
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(rawUrl)}` 
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
