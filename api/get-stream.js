// File: api/get-stream.js
import { MOVIES } from '@consumet/extensions';

export default async function handler(req, res) {
    // 1. Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. We now need the 'title' along with the type to search
    const { type, title, s, e } = req.query;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Missing title parameter' });
    }

    try {
        // Initialize the FlixHQ provider from your installed Consumet package
        const flixhq = new MOVIES.FlixHQ();
        
        // 3. Search for the Movie or TV Show
        const searchQuery = type === 'tv' && s && e ? `${title} Season ${s}` : title;
        const searchResults = await flixhq.search(searchQuery);
        
        if (searchResults.results.length === 0) {
            return res.status(404).json({ success: false, message: 'Media not found on provider.' });
        }

        const mediaId = searchResults.results[0].id;

        // 4. Fetch the specific media info (which contains episode lists)
        const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
        
        let targetEpisodeId = null;

        if (type === 'tv' && s && e) {
            // Find the exact episode the user clicked
            const episode = mediaInfo.episodes.find(
                (ep) => ep.season === parseInt(s) && ep.number === parseInt(e)
            );
            if (!episode) throw new Error("Episode not found");
            targetEpisodeId = episode.id;
        } else {
            // It's a movie, just grab the first (and only) episode id
            targetEpisodeId = mediaInfo.episodes[0].id;
        }

        // 5. Extract the direct streaming sources
        const sources = await flixhq.fetchEpisodeSources(targetEpisodeId, mediaId);
        
        // Grab the best quality stream (Usually Auto or 1080p)
        const hlsStream = sources.sources.find(s => s.quality === 'auto') || sources.sources[0];

        if (hlsStream && hlsStream.url) {
            return res.status(200).json({ 
                success: true, 
                hlsUrl: hlsStream.url,
                subtitles: sources.subtitles // Consumet also grabs subtitles!
            });
        } else {
            throw new Error("Could not extract stream URL");
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Failed to scrape free stream.' });
    }
}
