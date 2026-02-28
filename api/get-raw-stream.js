import { MOVIES } from "@consumet/extensions";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { title, type, season, episode } = req.query;
    if (!title) return res.status(400).json({ success: false, error: "Title required" });

    // 1. Array of unlocked providers to hunt through
    // SFlix and Goku have massive libraries and are more likely to carry Indian content
    const providers = [
        new MOVIES.SFlix(),
        new MOVIES.Goku(),
        new MOVIES.FlixHQ(),
        new MOVIES.ZoeChip(),
        new MOVIES.VidsrcTo()
    ];

    for (const provider of providers) {
        try {
            console.log(`Checking provider: ${provider.name}...`);
            const searchResults = await provider.search(title);
            
            if (!searchResults.results || searchResults.results.length === 0) continue;

            // Grab the first exact match
            const mediaId = searchResults.results[0].id;
            const mediaInfo = await provider.fetchMediaInfo(mediaId);
            
            let targetEpisodeId;
            if (type === 'tv') {
                const ep = mediaInfo.episodes.find(e => e.season === Number(season) && e.number === Number(episode));
                if (!ep) continue; // Episode not found on this provider, try next
                targetEpisodeId = ep.id;
            } else {
                targetEpisodeId = mediaInfo.episodes[0].id;
            }

            // Extract the unlocked m3u8 stream!
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
            // Silently fail and move to the next provider
            console.log(`[Scraper] ${provider.name} failed. Moving to next.`);
        }
    }

    // If ALL providers fail to find an unlocked stream
    return res.status(404).json({ 
        success: false, 
        error: "This title is currently unavailable." 
    });
}
