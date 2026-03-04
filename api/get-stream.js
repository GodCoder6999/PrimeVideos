import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// 🚀 Aggressive Extractor: Hunts for any .m3u8 link hidden anywhere in the JSON payload
const findM3u8InJson = (obj) => {
    const str = JSON.stringify(obj);
    const match = str.match(/https?:\/\/[^"'\s]+\.m3u8/);
    return match ? match[0] : null;
};

const fetchStream = async (name, requestConfig, extractFn) => {
    try {
        const { data } = await axios({ 
            ...requestConfig, 
            timeout: 8000 
        });
        
        // Try the standard extraction first, then fallback to aggressive regex hunting
        let streamUrl = extractFn(data) || findM3u8InJson(data);

        if (streamUrl && streamUrl.includes('.m3u8')) {
            console.log(`[SUCCESS] Stream found on: ${name}`);
            return { link: streamUrl, provider: name };
        }
        throw new Error('Valid .m3u8 stream data missing from response');
    } catch (error) {
        console.log(`[${name}] Failed:`, error.message);
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
        // Fetch IMDb ID
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        const fetchPromises = [];

        // --- 1. VidFast (TMDB ID Endpoint) ---
        fetchPromises.push(fetchStream('VidFast (TMDB)', {
            url: type === 'tv' ? `https://vidfast.pro/api/tv/${tmdbId}/${s}/${e}` : `https://vidfast.pro/api/movie/${tmdbId}`,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidfast.pro/' }
        }, data => data?.source?.[0]?.file || data?.file || data?.url));

        // --- 2. VidFast (IMDB ID Endpoint) ---
        if (imdbId) {
            fetchPromises.push(fetchStream('VidFast (IMDB)', {
                url: type === 'tv' ? `https://vidfast.pro/api/tv/${imdbId}/${s}/${e}` : `https://vidfast.pro/api/movie/${imdbId}`,
                headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidfast.pro/' }
            }, data => data?.source?.[0]?.file || data?.file || data?.url));
        }

        // --- 3. VidLink Fallback ---
        fetchPromises.push(fetchStream('VidLink', {
            url: type === 'tv' ? `https://vidlink.pro/api/video/tv/${tmdbId}/${s}/${e}` : `https://vidlink.pro/api/video/movie/${tmdbId}`,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidlink.pro/' }
        }, data => data?.stream_url || data?.source?.[0]?.file));

        // --- 4. AutoEmbed Fallback ---
        if (imdbId) {
            fetchPromises.push(fetchStream('AutoEmbed', {
                url: type === 'tv' ? `https://autoembed.cc/api/getStreams?id=${imdbId}&s=${s}&e=${e}` : `https://autoembed.cc/api/getStreams?id=${imdbId}`,
                headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://autoembed.cc/' }
            }, data => data?.data?.[0]?.file || data?.sources?.[0]?.file));
        }

        // Race them!
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
        console.error("[CRITICAL FAILURE] All aggregators exhausted.");
        return res.status(500).json({ 
            success: false, 
            error: "Unable to extract the .m3u8 link from VidFast or fallbacks." 
        });
    }
}
