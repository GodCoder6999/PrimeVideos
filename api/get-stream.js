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
        // 1. Get the Title and Year from TMDB
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        
        const title = type === 'tv' ? tmdbRes.data.name : tmdbRes.data.title;
        const year = type === 'tv' 
            ? tmdbRes.data.first_air_date?.split('-')[0] 
            : tmdbRes.data.release_date?.split('-')[0];

        if (!title) throw new Error("Could not find title.");

        console.log(`[DuckDuckGo OD] Hunting for: ${title} (${year})`);

        // 2. The Search Query (Looking for exposed mp4/mkv files)
        const dorkQuery = `intitle:"index of" +(mp4|mkv) +"${title}" +"${year}"`;
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dorkQuery)}`;

        // 3. Scrape DuckDuckGo (No API Key Required!)
        const { data } = await axios.get(ddgUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 8000
        });

        // 4. Extract the hidden links from DuckDuckGo's HTML
        // DuckDuckGo wraps search results in a redirect link (e.g., //duckduckgo.com/l/?uddg=https://...)
        // This Regex pulls the actual direct URL out of that wrapper.
        const links = [...data.matchAll(/uddg=([^&]+)/g)].map(match => decodeURIComponent(match[1]));

        // 5. Find the first link that is actually a video file
        const directVideoUrl = links.find(link => link.match(/\.(mp4|mkv|avi)$/i));

        if (!directVideoUrl) {
            throw new Error("No raw video files found on the open internet for this title.");
        }

        console.log(`[SUCCESS] Found Raw File: ${directVideoUrl}`);

        return res.status(200).json({ 
            success: true, 
            streamUrl: directVideoUrl,
            provider: "Open Directory (Direct File)",
            format: directVideoUrl.endsWith('.mkv') ? "mkv" : "mp4" 
        });

    } catch (error) {
        console.error("[Search Error]:", error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Could not find a direct raw file for this movie." 
        });
    }
}
