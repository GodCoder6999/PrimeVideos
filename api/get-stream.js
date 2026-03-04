import axios from 'axios';

// Mimic a standard browser to bypass basic anti-bot WAFs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Helper function to safely fetch and validate a stream URL
const fetchStream = async (name, requestConfig, extractFn) => {
    try {
        const { data } = await axios({ 
            ...requestConfig, 
            timeout: 7000 // 7-second timeout to respect Vercel's limits
        });
        const streamUrl = extractFn(data);
        if (streamUrl && streamUrl.includes('.m3u8')) {
            console.log(`[SUCCESS] Stream found on: ${name}`);
            return { link: streamUrl, provider: name };
        }
        throw new Error('Valid .m3u8 stream data missing');
    } catch (error) {
        // Silently throw so Promise.any() can move on to the next one
        throw error; 
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Fetch IMDb ID (Required by AutoEmbed and VidSrc)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        const fetchPromises = [];

        // --- 1. AutoEmbed API ---
        fetchPromises.push(fetchStream('AutoEmbed', {
            url: type === 'tv' ? `https://autoembed.cc/api/getStreams?id=${imdbId}&s=${s}&e=${e}` : `https://autoembed.cc/api/getStreams?id=${imdbId}`,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://autoembed.cc/' }
        }, data => data?.data?.[0]?.file || data?.sources?.[0]?.file));

        // --- 2. VidLink API ---
        fetchPromises.push(fetchStream('VidLink', {
            url: type === 'tv' ? `https://vidlink.pro/api/video/tv/${tmdbId}/${s}/${e}` : `https://vidlink.pro/api/video/movie/${tmdbId}`,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidlink.pro/' }
        }, data => data?.stream_url || data?.source?.[0]?.file));

        // --- 3. VidFast API ---
        fetchPromises.push(fetchStream('VidFast', {
            url: type === 'tv' ? `https://vidfast.pro/api/tv/${tmdbId}/${s}/${e}` : `https://vidfast.pro/api/movie/${tmdbId}`,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidfast.pro/' }
        }, data => data?.stream_url || data?.sources?.[0]?.file));

        // --- 4. FlixQuest Community API ---
        fetchPromises.push(fetchStream('FlixQuest', {
            url: type === 'tv' ? `https://flixquest-api.vercel.app/vidsrc/watch-tv?tmdbId=${tmdbId}&season=${s}&ep=${e}` : `https://flixquest-api.vercel.app/vidsrc/watch-movie?tmdbId=${tmdbId}`,
            headers: { 'User-Agent': USER_AGENT }
        }, data => data?.sources?.[0]?.url || data?.streamUrl));

        // --- 5. 8Stream API ---
        fetchPromises.push(fetchStream('8Stream', {
            url: type === 'tv' ? `https://8-stream-api.vercel.app/api/tv?id=${imdbId}&s=${s}&e=${e}` : `https://8-stream-api.vercel.app/api/movie?id=${imdbId}`,
            headers: { 'User-Agent': USER_AGENT }
        }, data => data?.url || data?.sources?.[0]?.url));

        // --- 6. VidSrc Direct 'vapi' Endpoints (Brute Force Array) ---
        // We will hit 5 different VidSrc domains simultaneously. If Cloudflare blocks one, another might let it through.
        const vidsrcDomains = ['vidsrc.net', 'vidsrc.cc', 'vidsrc.to', 'vidsrc.me', 'vidsrc.in'];
        vidsrcDomains.forEach(domain => {
            fetchPromises.push(fetchStream(`VidSrc (${domain})`, {
                url: type === 'tv' ? `https://${domain}/vapi/episode/${imdbId}/${s}/${e}` : `https://${domain}/vapi/movie/${imdbId}`,
                headers: { 'User-Agent': USER_AGENT, 'Referer': `https://${domain}/` }
            }, data => data?.source?.[0]?.file || data?.source?.[0]?.url));
        });

        // 🚀 THE RACE: Fire all 10 requests at the exact same time
        // Promise.any instantly resolves the moment ONE of these succeeds, ignoring all failures/blocks.
        const winner = await Promise.any(fetchPromises);

        // Proxy the manifest to bypass CORS blocks in the user's browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(winner.link)}`,
            provider: winner.provider,
            format: "m3u8"
        });

    } catch (error) {
        // This only fires if all 10 aggregators crash, time out, or hit Cloudflare blocks.
        console.error("[CRITICAL FAILURE] All aggregators exhausted.");
        return res.status(500).json({ 
            success: false, 
            error: "All 10 streaming sources (including VidSrc and AutoEmbed) failed to return a valid stream for this title." 
        });
    }
}
