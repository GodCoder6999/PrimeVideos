const crypto = require('crypto');

const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';
// Added fallbacks just in case Vercel's IP gets temporarily blocked on the main domain
const DOMAINS = ['https://showbox.shegu.net', 'https://mbpapi.shegu.net', 'https://api.mbxdz.com'];
const APP_KEY = 'moviebox';
const APP_VERSION = '11.5'; 
const USER_AGENT = `moviebox/${APP_VERSION} (Linux; U; Android 11)`;

function generateToken(params) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHash('md5').update(`${paramString}${APP_KEY}`).digest('hex');
}

// Custom query builder to ensure spaces are %20, not + (Prevents MD5 signature mismatch)
function buildQuery(params) {
    return Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
}

async function fetchSuperStream(params) {
    params.token = generateToken(params);
    const query = buildQuery(params);
    
    let lastError;
    
    // Try multiple SuperStream endpoints to bypass strict IP blocks
    for (const domain of DOMAINS) {
        try {
            const url = `${domain}/api/api_client/index/?${query}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Platform': 'android',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'X-Requested-With': 'com.tdo.showbox', // CRITICAL: Bypasses Cloudflare App Check
                    'Origin': domain
                }
            });

            if (response.ok) {
                return await response.json();
            } else {
                lastError = `Status ${response.status}`;
            }
        } catch (err) {
            lastError = err.message;
        }
    }
    throw new Error(`All SuperStream endpoints blocked the request. Last WAF Error: ${lastError}`);
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

    let title = '';
    let matchId = '';
    const randomDeviceId = crypto.randomBytes(8).toString('hex');

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

    try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`);
        const tmdbData = await tmdbRes.json();
        title = tmdbData.title || tmdbData.name;
    } catch (error) {
        return res.status(500).json({ success: false, error: `TMDB Failed: ${error.message}` });
    }

    try {
        const searchParams = { ...baseParams, module: 'Search4', keyword: title, page: '1', type: 'all' };
        const searchData = await fetchSuperStream(searchParams);
        const results = searchData?.data || [];
        
        const match = results.find(r => r.title === title || r.name === title) || results[0];
        if (!match) return res.json({ success: false, error: `Title not found on SuperStream` });
        matchId = match.id;
    } catch (error) {
        return res.status(500).json({ success: false, error: `Search Failed: ${error.message}` });
    }

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

        let rawStreams = streamData?.data?.list || streamData?.data || [];
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

        if (!formattedStreams.length) {
            return res.json({ success: false, error: 'No streams available' });
        }

        res.json({
            success: true,
            count: formattedStreams.length,
            streams: formattedStreams,
            subtitles,
            audioTracks
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: `Stream Extract Failed: ${error.message}` });
    }
};
