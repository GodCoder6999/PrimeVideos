import axios from 'axios';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Fetch IMDb ID (Required by some aggregators)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        // 2. Define our Aggregator Promises
        const fetchPromises = [];

        // --- Source 1: VidLink API (Currently very reliable) ---
        fetchPromises.push((async () => {
            const url = type === 'tv' 
                ? `https://vidlink.pro/api/video/tv/${tmdbId}/${s}/${e}`
                : `https://vidlink.pro/api/video/movie/${tmdbId}`;
            
            const { data } = await axios.get(url, { timeout: 7000 });
            const streamUrl = data?.stream_url || data?.source?.[0]?.file;
            if (streamUrl) return { link: streamUrl, provider: "VidLink" };
            throw new Error("VidLink failed");
        })());

        // --- Source 2: AutoEmbed API ---
        if (imdbId) {
            fetchPromises.push((async () => {
                const url = type === 'tv'
                    ? `https://autoembed.cc/api/getStreams?id=${imdbId}&s=${s}&e=${e}`
                    : `https://autoembed.cc/api/getStreams?id=${imdbId}`;
                
                const { data } = await axios.get(url, { timeout: 7000 });
                const streamUrl = data?.data?.[0]?.file || data?.sources?.[0]?.file;
                if (streamUrl) return { link: streamUrl, provider: "AutoEmbed" };
                throw new Error("AutoEmbed failed");
            })());
        }

        // --- Source 3: FlixQuest / Community API ---
        fetchPromises.push((async () => {
            let url = `https://flixquest-api.vercel.app/vidsrc/watch-${type}?tmdbId=${tmdbId}`;
            if (type === 'tv') url += `&season=${s}&ep=${e}`;
            
            const { data } = await axios.get(url, { timeout: 7000 });
            const streamUrl = data?.sources?.[0]?.url || data?.streamUrl;
            if (streamUrl) return { link: streamUrl, provider: "FlixQuest" };
            throw new Error("FlixQuest failed");
        })());

        // 3. Race them! Promise.any resolves the millisecond ONE of them succeeds.
        const winner = await Promise.any(fetchPromises);

        // 4. Proxy the stream URL to bypass CORS blocks in the user's browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(winner.link)}`,
            provider: winner.provider,
            format: "m3u8"
        });

    } catch (error) {
        // If it gets down here, it means EVERY single aggregator failed to find the movie or timed out.
        console.error("All aggregators failed.");
        return res.status(500).json({ 
            success: false, 
            error: "All streaming sources are currently offline or blocked for this title. Please try another movie." 
        });
    }
}
