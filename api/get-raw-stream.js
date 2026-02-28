import { MOVIES } from "@consumet/extensions";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { title, type, season, episode } = req.query;
    if (!title) return res.status(400).json({ success: false, error: "Title required" });

    // Try multiple providers just in case one is down
    const providers = [new MOVIES.FlixHQ(), new MOVIES.Goku()];

    for (const provider of providers) {
        try {
            const searchResults = await provider.search(title);
            if (!searchResults.results || searchResults.results.length === 0) continue;

            const mediaId = searchResults.results[0].id;
            const mediaInfo = await provider.fetchMediaInfo(mediaId);
            
            let targetEpisodeId;
            if (type === 'tv') {
                const ep = mediaInfo.episodes.find(e => e.season === Number(season) && e.number === Number(episode));
                if (!ep) continue;
                targetEpisodeId = ep.id;
            } else {
                targetEpisodeId = mediaInfo.episodes[0].id;
            }

            const streamData = await provider.fetchEpisodeSources(targetEpisodeId, mediaId);
            const bestStream = streamData.sources.find(s => s.quality === 'auto' || s.quality === '1080p') || streamData.sources[0];

            if (bestStream && bestStream.url) {
                return res.status(200).json({
                    success: true,
                    streamUrl: bestStream.url,
                    provider: provider.name
                });
            }
        } catch (error) {
            console.log(`Provider ${provider.name} failed, trying next...`);
        }
    }

    return res.status(404).json({ success: false, error: "Could not find a working stream for this title on any provider." });
}
