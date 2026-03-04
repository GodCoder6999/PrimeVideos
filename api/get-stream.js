// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
    
    // REPLACE THIS WITH YOUR ALLDEBRID API KEY
    const AD_API_KEY = "GWYGgp4WbZazT153xWtJ"; 
    const AD_AGENT = "prime"; // AllDebrid requires an agent name

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
        const mUrl = `https://mediafusion.elfhosted.com/stream/${path}`;

        const [tStreams, kStreams, mStreams] = await Promise.all([
            fetchStream(tUrl), 
            fetchStream(kUrl), 
            fetchStream(mUrl)
        ]);

        const allStreams = [...tStreams, ...kStreams, ...mStreams].filter(st => st.infoHash);
        if (allStreams.length === 0) throw new Error("No streams found.");

        const bestStream = allStreams.find(st => !st.title?.toLowerCase().includes('hevc') && !st.title?.toLowerCase().includes('x265')) || allStreams[0];
        const hash = bestStream.infoHash.toLowerCase();

        // 3. AllDebrid Flow
        const magnetLink = `magnet:?xt=urn:btih:${hash}`;
        
        // Step A: Upload Magnet to AllDebrid
        const addUrl = `https://api.alldebrid.com/v4/magnet/upload?agent=${AD_AGENT}&apikey=${AD_API_KEY}&magnets[]=${encodeURIComponent(magnetLink)}`;
        const addRes = await fetch(addUrl);
        const addData = await addRes.json();

        if (addData.status !== 'success') {
            throw new Error(`AllDebrid rejected the magnet. Details: ${JSON.stringify(addData)}`);
        }

        const magnetId = addData.data.magnets[0].id;

        // Step B: Check Magnet Status to get the file link
        const statusUrl = `https://api.alldebrid.com/v4/magnet/status?agent=${AD_AGENT}&apikey=${AD_API_KEY}&id=${magnetId}`;
        const statusRes = await fetch(statusUrl);
        const statusData = await statusRes.json();

        if (statusData.status !== 'success') throw new Error("Failed to get magnet status from AllDebrid.");

        const magnetInfo = statusData.data.magnets;
        
        // statusCode 4 means "Ready" in AllDebrid
        if (magnetInfo.statusCode !== 4) { 
            return res.status(202).json({ success: false, isDownloading: true, message: "AllDebrid is downloading the torrent to their servers..." });
        }

        if (!magnetInfo.links || magnetInfo.links.length === 0) {
             throw new Error("AllDebrid finished downloading but found no playable video files.");
        }

        // Grab the largest file link (usually the main video file)
        const fileLink = magnetInfo.links[0].link; 

        // Step C: Unrestrict the link to get the final playable stream URL
        const unlockUrl = `https://api.alldebrid.com/v4/link/unlock?agent=${AD_AGENT}&apikey=${AD_API_KEY}&link=${encodeURIComponent(fileLink)}`;
        const unlockRes = await fetch(unlockUrl);
        const unlockData = await unlockRes.json();

        if (unlockData.status !== 'success') throw new Error(`AllDebrid failed to unlock link: ${unlockData.error?.message || 'Unknown Error'}`);

        const rawUrl = unlockData.data.link;

        // NETMIRROR LOGIC: Rewrite Manifests / Route through Proxy
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

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
