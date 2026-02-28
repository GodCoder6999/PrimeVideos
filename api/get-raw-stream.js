// api/get-raw-stream.js
import { MOVIES } from "@consumet/extensions";

export default async function handler(req, res) {
    // Add CORS headers so your frontend can call it
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { title, type, season, episode } = req.query;
    if (!title) return res.status(400).json({ success: false, error: "Title required" });

    // We use FlixHQ as it usually provides unlocked .m3u8 links
    const flixhq = new MOVIES.FlixHQ();

    try {
        // 1. Search for the movie/tv show
        const searchResults = await flixhq.search(title);
        if (!searchResults.results || searchResults.results.length === 0) {
            return res.status(404).json({ success: false, error: "Media not found on host" });
        }

        const mediaId = searchResults.results[0].id;

        // 2. Get the specific episode or movie info
        const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
        let targetEpisodeId;

        if (type === 'tv') {
            const ep = mediaInfo.episodes.find(e => e.season === Number(season) && e.number === Number(episode));
            if (!ep) throw new Error("Episode not found");
            targetEpisodeId = ep.id;
        } else {
            targetEpisodeId = mediaInfo.episodes[0].id;
        }

        // 3. Extract the raw, unlocked .m3u8 source!
        const streamData = await flixhq.fetchEpisodeSources(targetEpisodeId, mediaId);
        
        // Find the auto quality m3u8 (usually the best one for Shaka Player)
        const bestStream = streamData.sources.find(s => s.quality === 'auto') || streamData.sources[0];

        return res.status(200).json({
            success: true,
            streamUrl: bestStream.url,
            subtitles: streamData.subtitles
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
