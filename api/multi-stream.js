const https = require('https');
const http = require('http');
const { URL } = require('url');

const TMDB_KEY = process.env.TMDB_API_KEY |

| 'cb1dc311039e6ae85db0aa200345cbc5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function get(rawUrl, headers = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const lib = parsed.protocol === 'https:'? https : http;
    
    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': UA,...headers },
    }, (res) => {
      if (.includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, headers, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function parseLanguage(str) {
  const s = (str |

| '').toLowerCase();
  const langs =;
  if (s.includes('hindi')) langs.push('Hindi');
  if (s.includes('english')) langs.push('English');
  if (s.includes('tamil')) langs.push('Tamil');
  if (s.includes('telugu')) langs.push('Telugu');
  
  if (s.includes('dual audio') |

| s.includes('multi audio')) return langs.length > 0? langs.join(' + ') + ' (Multi)' : 'Dual/Multi Audio';
  return langs.length > 0? langs.join(' + ') : 'Original';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tmdbId, type = 'movie', season = '1', episode = '1' } = req.query;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId required' });

  try {
    const tmdbRes = await get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
    const imdbId = JSON.parse(tmdbRes).imdb_id;
    if (!imdbId) throw new Error('No IMDb ID found');

    const path = type === 'tv' 
     ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;
      
    const nuvioRes = await get(path, { 'Referer': 'https://nuviostreams.hayd.uk/' });
    const data = JSON.parse(nuvioRes);

    const streams = (data.streams ||).filter(s => {
      const nameStr = (s.name |

| s.title |
| '').toLowerCase();
      return nameStr.includes('moviesmod') && s.url && (s.url.includes('.mp4') |

| s.url.includes('.mkv') |
| s.url.includes('.m3u8'));
    }).map(s => {
      const isHls = s.url.includes('.m3u8');
      return {
        // Enforce all traffic goes through the proxy to bypass CORS
        url: `/api/proxy?url=${encodeURIComponent(s.url)}`,
        quality: (s.name |

| s.title |
| '').match(/4K|1080p|720p|480p/i)?. |
| 'Auto',
        language: parseLanguage(s.name |

| s.title),
        type: isHls? 'hls' : 'direct'
      };
    });

    if (streams.length > 0) {
      return res.status(200).json({ success: true, streams });
    }
    
    return res.status(404).json({ success: false, error: 'No MoviesMod streams found' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
