export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
    const RD_API_KEY = "G5AGJXNA2UXL4H7MTZ5RX3K5HS6PPA2K3KOU4XP2WYTNJO3CEMZQ";

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
                // FIX: Increased timeout to 8000ms. Torrentio/Mediafusion need 4-7 seconds to scrape.
                const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) return [];
                const d = await r.json();
                return d.streams || [];
            } catch (error) { 
                return []; 
            }
        };

        const path = type === 'tv' ? `series/${imdbId}:${s}:${e}.json` : `movie/${imdbId}.json`;

        // FIX: Replaced dead Mediafusion endpoint and added Knightcrawler for redundancy
        const tUrl = `https://torrentio.strem.fun/stream/${path}`;
        const kUrl = `https://knightcrawler.elfhosted.com/stream/${path}`;
        const mUrl = `https://mediafusion.elfhosted.com/stream/${path}`;

        // Fetch from all sources simultaneously
        const [tStreams, kStreams, mStreams] = await Promise.all([
            fetchStream(tUrl), 
            fetchStream(kUrl), 
            fetchStream(mUrl)
        ]);

        const allStreams = [...tStreams, ...kStreams, ...mStreams].filter(st => st.infoHash);
        if (allStreams.length === 0) throw new Error("No streams found.");

        // Prefer non-HEVC streams for maximum browser compatibility (some browsers can't render HEVC)
        const bestStream = allStreams.find(st => !st.title?.toLowerCase().includes('hevc') && !st.title?.toLowerCase().includes('x265')) || allStreams[0];
        const hash = bestStream.infoHash.toLowerCase();

        // 3. Real-Debrid Flow
        const addRes = await fetch("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RD_API_KEY}` },
            body: new URLSearchParams({ magnet: `magnet:?xt=urn:btih:${hash}` })
        });
        const addData = await addRes.json();
        
        if (!addData.id) throw new Error("Failed to add magnet to Real-Debrid.");

        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${addData.id}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${RD_API_KEY}` },
            body: new URLSearchParams({ files: "all" })
        });

        const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${addData.id}`, {
            headers: { "Authorization": `Bearer ${RD_API_KEY}` }
        });
        const infoData = await infoRes.json();

        if (infoData.links && infoData.links.length > 0) {
            const unrestrictRes = await fetch("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
                method: "POST",
                headers: { "Authorization": `Bearer ${RD_API_KEY}` },
                body: new URLSearchParams({ link: infoData.links[0] })
            });
            const unrestrictData = await unrestrictRes.json();
            
            if (!unrestrictData.download) throw new Error("Failed to unrestrict link.");
            const rawUrl = unrestrictData.download;

            // FIX: Dynamic Protocol. Handles http:// on localhost and https:// on Vercel deployment automatically.
            const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
            const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

            if (rawUrl.includes('.m3u8')) {
                const manifestRes = await fetch(rawUrl);
                let manifestText = await manifestRes.text();
                
                const baseUrl = rawUrl.substring(0, rawUrl.lastIndexOf('/') + 1);

                const updatedManifest = manifestText.replace(/^(?!#)(.*)$/gm, (match) => {
                    if (!match.trim()) return match;
                    const fullUrl = match.startsWith('http') ? match : `${baseUrl}${match}`;
                    return `${proxyBase}${encodeURIComponent(fullUrl)}`;
                });

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                return res.status(200).send(updatedManifest);
            }

            return res.status(200).json({ 
                success: true, 
                streamUrl: `${proxyBase}${encodeURIComponent(rawUrl)}` 
            });
        } else {
            // Stream is downloading to Real-Debrid servers, tell the frontend to poll
            return res.status(202).json({ success: false, isDownloading: true });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
