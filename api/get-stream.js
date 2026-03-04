import axios from 'axios';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Get the actual Movie Title and Year from TMDB
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbUrl = type === 'tv' 
            ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}` 
            : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
            
        const tmdbRes = await axios.get(tmdbUrl);
        const title = type === 'tv' ? tmdbRes.data.name : tmdbRes.data.title;
        const year = type === 'tv' 
            ? tmdbRes.data.first_air_date?.split('-')[0] 
            : tmdbRes.data.release_date?.split('-')[0];

        if (!title) throw new Error("Could not find title for this TMDB ID.");

        console.log(`[OD Scraper] Hunting for: ${title} (${year})`);

        // 2. 🛑 PASTE YOUR GOOGLE API CREDENTIALS HERE 🛑
        const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY";
        const GOOGLE_CX_ID = "YOUR_SEARCH_ENGINE_CX_ID";

        // 3. Construct the Google Dork
        // We force "https" to prevent browser Mixed Content errors, and look for mp4/mkv
        const dorkQuery = `inurl:https intitle:"index of" +(mp4|mkv) +"${title}" +"${year}" -inurl:(jsp|pl|php|html|aspx|htm|cf|shtml)`;

        // 4. Execute the Search
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(dorkQuery)}`;
        const searchRes = await axios.get(searchUrl);

        const items = searchRes.data.items || [];

        if (items.length === 0) {
            throw new Error("Google found no Open Directories for this title.");
        }

        // 5. Aggressive Link Extraction
        // We scan the search results (both titles and snippets) for the direct video link
        let directVideoUrl = null;
        
        for (const item of items) {
            // Check the main link
            if (item.link.match(/\.(mp4|mkv)$/i)) {
                directVideoUrl = item.link;
                break;
            }
            
            // Check the snippet (sometimes the direct file link is in the text preview)
            const snippetMatch = item.snippet.match(/https?:\/\/[^\s"'<>]+\.(mp4|mkv)/i);
            if (snippetMatch) {
                directVideoUrl = snippetMatch[0];
                break;
            }
        }

        if (!directVideoUrl) {
             throw new Error("Found directories, but could not extract a direct .mp4 or .mkv link from the search snippet.");
        }

        console.log(`[SUCCESS] Found OD Link: ${directVideoUrl}`);

        return res.status(200).json({ 
            success: true, 
            streamUrl: directVideoUrl,
            provider: "Open Directory Scraper",
            format: directVideoUrl.endsWith('.mkv') ? "mkv" : "mp4" // Let the frontend know it's a raw file, not m3u8
        });

    } catch (error) {
        console.error("[OD Error]:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: `Failed to locate an Open Directory for this title.` 
        });
    }
}
