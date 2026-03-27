const axios = require('axios');
const crypto = require('crypto');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const BASE_URL = 'https://showbox.shegu.net/api/api_client/index/';
const APP_KEY = 'moviebox';

// Exactly matching your original axios instance
const api = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'moviebox/2.6.8 (Linux; U; Android 11)',
        'Referer': 'https://showbox.shegu.net/'
    }
});

// Original token generator
function generateToken(params) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const finalString = `${paramString}${APP_KEY}`;
    return crypto.createHash('md5').update(finalString).digest('hex');
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;

    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId required' });

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${proto}://${host}`;
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    try {
        // 1. Fetch TMDB Title
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`);
        const title = tmdbRes.data.title || tmdbRes.data.name;

        // 2. Search SuperStream (Exact params from Step 2.1)
        const searchParams = {
            module: 'Search4',
            keyword: title,
            page: '1',
            type: 'all',
            api_key: 'moviebox',
            app_version: '2.6.8',
            os: 'android',
            device_id: 'test-device'
        };
        searchParams.token = generateToken(searchParams);
        
        const searchRes = await api.get(BASE_URL, { params: searchParams });
        const results = searchRes.data?.data || [];
        
        const match = results.find(r => r.title === title || r.name === title) || results[0];
        if (!match) return res.json({ success: false, error: `Title not found on SuperStream` });

        // 3. Fetch Streams (Exact params from Step 2.1)
        const streamParams = {
            module: type === 'movie' ? 'Movie_downloadurl_v3' : 'TV_downloadurl_v3',
            mid: match.id,
            api_key: 'moviebox',
            app_version: '2.6.8',
            os: 'android',
            device_id: 'test-device'
        };

        if (type === 'tv') {
             streamParams.season = String(season);
             streamParams.episode = String(episode);
        }
        
        streamParams.token = generateToken(streamParams);

        const streamRes = await api.get(BASE_URL, { params: streamParams });

        let rawStreams = streamRes.data?.data?.list || streamRes.data?.data || [];
        if (!Array.isArray(rawStreams)) rawStreams = [rawStreams];

        const formattedStreams = rawStreams
            .filter(s => s.path || s.url)
            .map(s => {
                const rawUrl = s.path || s.url;
                return {
                    url: px(rawUrl),
                    quality: s.quality || s.real_quality || '1080p',
                    source: 'SuperStream',
                    type: rawUrl.includes('.m3u8') ? 'hls' : 'mp4'
                };
            });

        if (!formattedStreams.length) {
            return res.json({ success: false, error: 'No streams available' });
        }

        let subtitles = [], audioTracks = [];
        if (rawStreams[0]) {
            if (rawStreams[0].subtitle_tracks) {
                subtitles = rawStreams[0].subtitle_tracks.map(sub => ({
                    lang: sub.lang,
                    url: px(sub.url || sub.path)
                }));
            }
            if (rawStreams[0].audio_tracks) {
                audioTracks = rawStreams[0].audio_tracks.map(audio => ({
                    lang: audio.lang,
                    label: audio.name
                }));
            }
        }

        res.json({
            success: true,
            count: formattedStreams.length,
            streams: formattedStreams,
            subtitles,
            audioTracks
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: `Extraction Failed: ${error.message}` });
    }
};
