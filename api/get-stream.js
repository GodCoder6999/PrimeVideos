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

        if (!imdbId) throw new Error("Could not find IMDb ID for this title.");

        // 2. Define the Multi-Scraper Array (MediaFusion is KING for Indian content)
        const ADDONS = [
            "https://torrentio.strem.fun", 
            "https://mediafusion.fun",           // Best for Bollywood, Tollywood, Bengali
            "https://knightcrawler.elfhosted.com", // Great backup for older TV shows
            "https://annatar.elfhosted.com"        // High quality premium scraper fallback
        ];

        // 3. Fetch from all 4 add-ons simultaneously
        const fetchPromises = ADDONS.map(async (addonBaseUrl) => {
            const url = type === 'tv' 
                ? `${addonBaseUrl}/stream/series/${imdbId}:${s}:${e}.json`
                : `${addonBaseUrl}/stream/movie/${imdbId}.json`;
            
            try {
                // Set a 4-second timeout so one slow scraper doesn't hang the whole site
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!res.ok) return [];
                const data = await res.json();
                return data.streams || [];
            } catch (err) {
                return []; // If one addon fails/times out, quietly ignore it
            }
        });

        const results = await Promise.allSettled(fetchPromises);
        
        // 4. Aggregate all streams into one giant list
        let allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allStreams.push(...result.value);
            }
        });

        // Filter out streams that don't have an infoHash (TorBox requires torrents)
        allStreams = allStreams.filter(stream => stream.infoHash);

        if (allStreams.length === 0) {
            return res.status(404).json({ success: false, message: 'No streams found across any network.' });
        }

        // 5. Filter for browser compatibility (Avoid HEVC/x265 to prevent blank screens)
        let compatibleStreams = allStreams.filter(stream => {
            const title = (stream.title || stream.name || '').toLowerCase();
            return !title.includes('hevc') && !title.includes('x265');
        });

        // If ALL streams are HEVC, fallback to the main list and let the browser try its best
        if (compatibleStreams.length === 0) {
            compatibleStreams = allStreams;
        }

        // 6. Pick the absolute best stream (Addons sort by highest seeders/quality automatically)
        const bestStream = compatibleStreams[0];
        const magnetLink = `magnet:?xt=urn:btih:${bestStream.infoHash}`;
        
        // Ensure we grab the actual video file inside the torrent, not a text file
        const fileIdx = bestStream.fileIdx !== undefined ? bestStream.fileIdx : 0;

        // 7. Send the magnet to TorBox
        const formData = new URLSearchParams();
        formData.append("magnet", magnetLink);

        const addRes = await fetch("https://api.torbox.app/v1/api/torrents/createtorrent", {
            method: "POST",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` },
            body: formData
        });
        
        const addData = await addRes.json();
        if (!addData.success) throw new Error("Failed to add to TorBox");

        const torrentId = addData.data.torrent_id;

        // 8. Request the direct download link
        const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&torrent_id=${torrentId}&file_id=${fileIdx}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${TORBOX_API_KEY}` }
        });

        const dlData = await dlRes.json();

        // 9. Check if Torbox has cached it yet
        if (dlData.success && dlData.data) {
            return res.status(200).json({ success: true, streamUrl: dlData.data });
        } else {
            // Tell the React frontend to keep spinning the loader while TorBox downloads it
            return res.status(202).json({ success: false, isDownloading: true, message: "Caching file..." });
        }

    } catch (error) {
        console.error("Streaming Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
