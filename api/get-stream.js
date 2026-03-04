import axios from 'axios';

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
        // 1. Fetch IMDb ID (Required by some endpoints)
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const imdbId = tmdbRes.data.imdb_id;

        const fetchPromises = [];

        // --- SOURCE 1: VidLink API (Highly Reliable JSON) ---
        fetchPromises.push((async () => {
            const url = type === 'tv' 
                ? `https://vidlink.pro/api/video/tv/${tmdbId}/${s}/${e}` 
                : `https://vidlink.pro/api/video/movie/${tmdbId}`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vidlink.pro/' }});
            const link = data?.stream_url || data?.source?.[0]?.file;
            if (link?.includes('.m3u8')) return { link, provider: 'VidLink' };
            throw new Error('VidLink failed');
        })());

        // --- SOURCE 2: AutoEmbed API ---
        if (imdbId) {
            fetchPromises.push((async () => {
                const url = type === 'tv' 
                    ? `https://autoembed.cc/api/getStreams?id=${imdbId}&s=${s}&e=${e}` 
                    : `https://autoembed.cc/api/getStreams?id=${imdbId}`;
                const { data } = await axios.get(url, { headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://autoembed.cc/' }});
                const link = data?.data?.[0]?.file || data?.sources?.[0]?.file;
                if (link?.includes('.m3u8')) return { link, provider: 'AutoEmbed' };
                throw new Error('AutoEmbed failed');
            })());
        }

        // --- SOURCE 3: 8Stream API ---
        if (imdbId) {
            fetchPromises.push((async () => {
                const url = type === 'tv' 
                    ? `https://8-stream-api.vercel.app/api/tv?id=${imdbId}&s=${s}&e=${e}` 
                    : `https://8-stream-api.vercel.app/api/movie?id=${imdbId}`;
                const { data } = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }});
                const link = data?.url || data?.sources?.[0]?.url;
                if (link?.includes('.m3u8')) return { link, provider: '8Stream' };
                throw new Error('8Stream failed');
            })());
        }

        // Race them to get the fastest valid .m3u8 link
        const winner = await Promise.any(fetchPromises);

        // Proxy the link back to your PrimePlayer
        const protocol = req.headers['x-forwarded-proto'] || (req.headers.host.includes('localhost') ? 'http' : 'https');
        const proxyBase = `${protocol}://${req.headers.host}/api/proxy?url=`;

        return res.status(200).json({ 
            success: true, 
            streamUrl: `${proxyBase}${encodeURIComponent(winner.link)}`,
            provider: winner.provider,
            format: "m3u8"
        });

    } catch (error) {
        console.error("All APIs exhausted.");
        return res.status(500).json({ 
            success: false, 
            error: "Content currently unavailable from upstream providers." 
        });
    }
}
