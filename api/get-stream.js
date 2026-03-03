// File: api/get-stream.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // We are using a public, high-speed Direct Stream API (bypassing Torrents entirely)
        // This API aggregates direct .m3u8 CDN links from hosters like VidCloud, UpStream, etc.
        const API_BASE = "https://consumet-api-clone.vercel.app/meta/tmdb";

        // 1. Fetch the media metadata to get the specific Direct Stream ID
        const infoRes = await fetch(`${API_BASE}/info/${tmdbId}?type=${type}`);
        if (!infoRes.ok) throw new Error("Failed to find media on direct hosters.");
        const infoData = await infoRes.json();

        let targetEpisodeId = null;

        if (type === 'movie') {
            // For movies, the episode ID is usually just the movie ID itself
            targetEpisodeId = infoData.episodeId || infoData.id;
        } else if (type === 'tv') {
            // For TV Shows, we must find the exact season and episode ID in the CDN database
            const targetSeason = parseInt(s);
            const targetEp = parseInt(e);
            
            // Find the correct season data
            const seasonData = infoData.seasons?.find(season => season.season === targetSeason);
            if (!seasonData) throw new Error(`Season ${targetSeason} not found on CDN.`);

            // Find the exact episode
            const episodeData = seasonData.episodes?.find(ep => ep.episode === targetEp);
            if (!episodeData) throw new Error(`Episode ${targetEp} not found on CDN.`);

            targetEpisodeId = episodeData.id;
        }

        if (!targetEpisodeId) throw new Error("Could not extract CDN stream ID.");

        // 2. Fetch the raw .m3u8 Stream Link from the CDN
        const watchRes = await fetch(`${API_BASE}/watch/${targetEpisodeId}?id=${infoData.id}`);
        if (!watchRes.ok) throw new Error("Failed to extract raw video stream.");
        const watchData = await watchRes.json();

        if (!watchData.sources || watchData.sources.length === 0) {
            throw new Error("No playable CDN sources found for this title.");
        }

        // 3. Find the best quality stream (Prioritize Auto/1080p)
        // Direct Hosters usually provide an 'auto' m3u8 playlist that adapts to internet speed
        const bestSource = watchData.sources.find(src => src.quality === 'auto') 
                        || watchData.sources.find(src => src.quality === '1080p') 
                        || watchData.sources[0];

        if (!bestSource || !bestSource.url) {
            throw new Error("Invalid stream URL returned from CDN.");
        }

        // 4. Return the Instant Stream directly to the React Player
        return res.status(200).json({ 
            success: true, 
            streamUrl: bestSource.url,
            subtitles: watchData.subtitles || [] // Bonus: It often fetches direct subtitles too!
        });

    } catch (error) {
        console.error("Direct CDN Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
