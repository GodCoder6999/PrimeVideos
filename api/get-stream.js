import axios from 'axios';

// Mimic a standard Chrome browser to bypass basic anti-bot firewalls
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type, tmdbId, s, e } = req.query;

    if (!type || !tmdbId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        // 1. Fetch IMDb ID (Crucial for some APIs)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        if (!imdbId) throw new Error("IMDb ID not found.");

        const fetchPromises = [];

        // --- Source 1: VidLink API ---
        fetchPromises.push((async () => {
            try {
                const url = type === 'tv' 
                    ? `https://vidlink.pro/api/video/tv/${tmdbId}/${s}/${e}`
                    : `https://vidlink.pro/api/video/movie/${tmdbId}`;
                
                const { data } = await axios.get(url, { 
                    timeout: 7500,
                    headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidlink.pro/' }
                });
                
                const streamUrl = data?.stream_url || data?.source?.[0]?.file || data?.sources?.[0]?.file;
                if (streamUrl) return { link: streamUrl, provider: "VidLink" };
                throw new Error("Stream data missing in response");
            } catch (err) {
                console.log(`[VidLink] Failed: ${err.message}`);
                throw err;
            }
        })());

        // --- Source 2: AutoEmbed API ---
        fetchPromises.push((async () => {
            try {
                const url = type === 'tv'
                    ? `https://autoembed.cc/api/getStreams?id=${imdbId}&s=${s}&e=${e}`
                    : `https://autoembed.cc/api/getStreams?id=${imdbId}`;
                
                const { data } = await axios.get(url, { 
                    timeout: 7500,
                    headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://autoembed.cc/' }
                });
                
                const streamUrl = data?.data?.[0]?.file || data?.sources?.[0]?.file || data?.sources?.[0]?.url;
                if (streamUrl) return { link: streamUrl, provider: "AutoEmbed" };
                throw new Error("Stream data missing in response");
            } catch (err) {
                console.log(`[AutoEmbed] Failed: ${err.message}`);
                throw err;
            }
        })());

        // --- Source 3: VidSrc PRO API ---
        fetchPromises.push((async () => {
             try {
                 const url = type === 'tv' 
                    ? `https://vidsrc.pro/api/tv/${tmdbId}/${s}/${e}`
                    : `https://vidsrc.pro/api/movie/${tmdbId}`;
                    
                const { data } = await axios.get(url, { 
                    timeout: 7500,
                    headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidsrc.pro/' }
                });
                
                const streamUrl = data?.stream_url || data?.source?.[0]?.file || data?.sources?.[0]?.file;
                if (streamUrl) return { link: streamUrl, provider: "VidSrc PRO" };
                throw new Error("Stream data missing in response");
             } catch (err) {
                 console.log(`[VidSrc PRO] Failed: ${err.message}`);
                 throw err;
             }
        })());
        
        // --- Source 4: 8Stream Community API ---
        fetchPromises.push((async () => {
            try {
                const url = type === 'tv' 
                    ? `https://8-stream-api.vercel.app/api/tv?id=${imdbId}&s=${s}&e=${e}`
                    : `https://8-stream-api.vercel.app/api/movie?id=${imdbId}`;
                    
                const { data } = await axios.get(url, { 
                    timeout: 7500,
                    headers: { 'User-Agent': USER_AGENT }
                });
                
                const streamUrl = data?.url || data?.sources?.[0]?.url || data?.sources?.[0]?.file;
                if (streamUrl) return { link: streamUrl, provider: "8StreamApi" };
                throw new Error("Stream data missing in response");
            } catch (err) {
                 console.log(`[8StreamApi] Failed: ${err.message}`);
                 throw err;
            }
        })());

        // Race all sources at the exact same time
        const winner = await Promise.any(fetchPromises);
        console.log(`[SUCCESS] Stream found via ${winner.provider}`);

        // Proxy the manifest to bypass CORS blocks in the browser
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(winner.link)}`,
            provider: winner.provider,
            format: "m3u8"
        });

    } catch (error) {
        // This only fires if EVERY promise throws an error
        console.error("[CRITICAL FAILURE] All aggregators exhausted.");
        return res.status(500).json({ 
            success: false, 
            error: "All streaming sources are currently offline or blocked for this title. Please try another movie." 
        });
    }
}
