const axios = require('axios');
const crypto = require('crypto');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
const BASE_URL = 'https://showbox.shegu.net/api/api_client/index/';
const APP_KEY = 'moviebox';

// Bumping app version to bypass deprecation blocks (empty streams)
const APP_VERSION = '11.5'; 
const USER_AGENT = `moviebox/${APP_VERSION} (Linux; U; Android 11)`;

// SuperStream Token Generator
function generateToken(params) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHash('md5').update(`${paramString}${APP_KEY}`).digest('hex');
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

    // Standard device params required by newer SuperStream API versions
    const baseParams = {
        api_key: 'moviebox',
        app_version: APP_VERSION,
        os: 'android',
        device_id: 'ab12c34d56e7890f', // Use a static hex device ID instead of "test-device"
        childmode: '0',
        lang: 'en',
        uid: ''
    };

    // ==========================================
    // STEP 1: Fetch TMDB Title
    // ==========================================
    try {
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`);
        title = tmdbRes.data.title || tmdbRes.data.name;
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
        searchParams.token = generateToken(searchParams);
        
        const searchRes = await axios.get(BASE_URL, { 
            params: searchParams, 
            headers: { 
                'User-Agent': USER_AGENT,
                'Platform': 'android',
                'Accept': '*/*'
            },
            timeout: 15000 
        });

        const results = searchRes.data?.data || [];
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
        
        streamParams.token = generateToken(streamParams);

        const streamRes = await axios.get(BASE_URL, { 
            params: streamParams, 
            headers: { 
                'User-Agent': USER_AGENT,
                'Platform': 'android',
                'Accept': '*/*'
            },
            timeout: 15000
        });

        // Gracefully handle different array structures returned by the API
        let rawStreams = [];
        if (streamRes.data?.data?.list) {
            rawStreams = streamRes.data.data.list;
        } else if (Array.isArray(streamRes.data?.data)) {
            rawStreams = streamRes.data.data;
        } else if (streamRes.data?.data) {
            rawStreams = [streamRes.data.data];
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
            // Include a debug dump so we know exactly why it's failing
            return res.json({ 
                success: false, 
                error: 'No streams available from SuperStream for this item.',
                debug: {
                    searchedTitle: title,
                    matchedId: matchId,
                    serverResponse: streamRes.data // This will output their exact error code/message
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
