const crypto = require('crypto');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const BASE_URL = 'https://showbox.shegu.net/api/api_client/index/';
const APP_KEY = 'moviebox';

const APP_VERSION = '11.5'; 
const USER_AGENT = `moviebox/${APP_VERSION} (Linux; U; Android 11)`;

// SuperStream Token Generator
function generateToken(params) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHash('md5').update(`${paramString}${APP_KEY}`).digest('hex');
}

// Helper to bypass WAF blocks using native fetch (instead of axios)
async function fetchSuperStream(params) {
    params.token = generateToken(params);
    const query = new URLSearchParams(params).toString();
    const url = `${BASE_URL}?${query}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': USER_AGENT,
            'Platform': 'android',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        }
    });

    if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status} (${response.statusText})`);
    }

    return await response.json();
}

module.exports = async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end('{}'); }

    const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;

    if (!tmdbId) {
        return res.status(400).json({ success: false, error: 'tmdbId required' });
    }

    // Helper to format URL to use our proxy
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${proto}://${host}`;
    const px = (url) => `${origin}/api/proxy?url=${encodeURIComponent(url)}`;

    let title = '';
    let matchId = '';

    // Generate a random device ID per request to prevent IP/Device bans (403s)
    const randomDeviceId = crypto.randomBytes(8).toString('hex');

    // Fully spoofed device parameters to bypass Cloudflare/WAF
    const baseParams = {
        api_key: 'moviebox',
        appid: 'com.tdo.showbox',
        app_version: APP_VERSION,
        os: 'android',
        device_id: randomDeviceId,
        childmode: '0',
        lang: 'en',
        uid: '',
        sys_valid: '11',
        brand: 'samsung',
        model: 'SM-G998B'
    };

    // ==========================================
    // STEP 1: Fetch TMDB Title (Using native fetch)
    // ==========================================
    try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`);
        const tmdbData = await tmdbRes.json();
        title = tmdbData.title || tmdbData.name;
    } catch (error) {
        console.error('[TMDB Error]', error.message);
        return res.status(500).json({ success: false, error: `TMDB API Failed: ${error.message}` });
    }

    // ==========================================
    // STEP 2: SuperStream Search
    // ==========================================
    try {
        const searchParams = {
            ...baseParams,
            module: 'Search4',
            keyword: title,
            page: '1',
            type: 'all'
        };
        
        const searchData = await fetchSuperStream(searchParams);
        const results = searchData?.data || [];
        
        const match = results.find(r => r.title === title || r.name === title) || results[0];
        
        if (!match) {
            return res.json({ success: false, error: `Title '${title}' not found on SuperStream` });
        }
        matchId = match.id;

    } catch (error) {
        console.error('[SuperStream Search Error]', error.message);
        return res.status(500).json({ success: false, error: `SuperStream Search Failed: ${error.message}` });
    }

    // ==========================================
    // STEP 3: Fetch Streams
    // ==========================================
    try {
        const streamParams = {
            ...baseParams,
            module: type === 'movie' ? 'Movie_downloadurl_v3' : 'TV_downloadurl_v3',
            mid: matchId
        };

        if (type === 'tv') {
             streamParams.season = String(season);
             streamParams.episode = String(episode);
        }
        
        const streamData = await fetchSuperStream(streamParams);

        // Gracefully handle different array structures returned by the API
        let rawStreams = [];
        if (streamData?.data?.list) {
            rawStreams = streamData.data.list;
        } else if (Array.isArray(streamData?.data)) {
            rawStreams = streamData.data;
        } else if (streamData?.data) {
            rawStreams = [streamData.data];
        }

        const formattedStreams = rawStreams
            .filter(s => s.path || s.url)
            .map(s => {
                const rawUrl = s.path || s.url;
                return {
                    url: px(rawUrl), // Route through your api/proxy.js
                    quality: s.quality || s.real_quality || '1080p',
                    source: 'SuperStream',
                    type: rawUrl.includes('.m3u8') ? 'hls' : 'mp4'
                };
            });

        let subtitles = [];
        let audioTracks = [];
        
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

        if (!formattedStreams.length) {
            return res.json({ 
                success: false, 
                error: 'No streams available from SuperStream for this item.',
                debug: {
                    searchedTitle: title,
                    matchedId: matchId,
                    serverResponse: streamData 
                }
            });
        }

        res.json({
            success: true,
            count: formattedStreams.length,
            streams: formattedStreams,
            subtitles: subtitles,
            audioTracks: audioTracks
        });

    } catch (error) {
        console.error('[SuperStream Extract Error]', error.message);
        return res.status(500).json({ success: false, error: `SuperStream Extract Failed: ${error.message}` });
    }
};
