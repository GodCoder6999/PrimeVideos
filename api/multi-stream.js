const https = require('https');
const http = require('http');

function get(url, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function parseQuality(str) {
  const s = str.toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return '4k';
  if (s.includes('1080')) return '1080p';
  if (s.includes('720')) return '720p';
  if (s.includes('480')) return '480p';
  if (s.includes('360')) return '360p';
  return 'Auto';
}

function parseLanguage(str) {
  if (!str) return 'Original';
  const s = str.toLowerCase();
  const langs = [];
  if (s.includes('hindi')) langs.push('Hindi');
  if (s.includes('english')) langs.push('English');
  if (s.includes('tamil')) langs.push('Tamil');
  if (s.includes('telugu')) langs.push('Telugu');
  if (s.includes('malayalam')) langs.push('Malayalam');
  if (s.includes('kannada')) langs.push('Kannada');
  if (s.includes('bengali')) langs.push('Bengali');
  if (s.includes('marathi')) langs.push('Marathi');
  
  if (s.includes('dual audio') || s.includes('multi audio') || s.includes('multi-audio') || s.includes('dual-audio')) {
      if (langs.length === 0) return 'Dual/Multi Audio';
      return langs.join(' + ') + ' (Multi)';
  }
  
  if (langs.length > 0) return langs.join(' + ');
  return 'Original';
}

async function getImdbId(tmdbId, mediaType) {
  try {
    const TMDB_KEY = '1e34e56598c37d0dc82adbcfa77a8342';
    const data = JSON.parse(await get(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`));
    return data.imdb_id || null;
  } catch (e) {
    return null;
  }
}

// 1. Nuvio Streams (Primary Multi-Audio / MoviesMod source)
async function fetchMoviesModFromNuvio(imdbId, mediaType, season, episode) {
  if (!imdbId) return [];
  try {
    const path = mediaType === 'tv'
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;

    const raw = await get(path, { 'Referer': 'https://nuviostreams.hayd.uk/' }, 12000);
    const data = JSON.parse(raw);
    
    const streams = (data.streams || []).filter(s => {
      if (!s.url) return false;
      return s.url.includes('.mp4') || s.url.includes('.m3u8') || s.url.includes('.mkv');
    }).map(s => {
      const rawName = s.name || s.title || '';
      const normalizedName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMoviesMod = normalizedName.includes('moviesmod');

      let providerName = 'NuvioStream';
      if (isMoviesMod) {
        providerName = 'MoviesMod';
      } else {
        const firstLine = rawName.split('\n')[0];
        providerName = firstLine.replace(/[^\x00-\x7F]/g, "").trim() || 'NuvioStream';
      }

      return {
        url: s.url,
        quality: parseQuality(rawName),
        language: parseLanguage(rawName), // Multi-audio parser
        provider: providerName,
        type: s.url.includes('.m3u8') ? 'hls' : 'mp4',
        _isMoviesMod: isMoviesMod
      };
    });

    return streams;
  } catch (e) {
    console.warn('[nuvio] fetch error:', e.message);
    return [];
  }
}

// 2. VidSrc Pro (Fallback)
async function fetchVidSrcPro(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === 'tv'
      ? `https://vidsrc.pro/api/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.pro/api/movie/${tmdbId}`;
    
    // Logic for vidsrc omitted to keep example focused, but returns []
    return [];
  } catch(e) { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { tmdbId, type, s, e } = req.query;
  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  const mediaType = type === 'movie' ? 'movie' : 'tv';
  const season = s || 1;
  const episode = e || 1;

  try {
    const imdbId = await getImdbId(tmdbId, mediaType);
    
    const [nuvioStreams, vidsrcStreams] = await Promise.all([
      fetchMoviesModFromNuvio(imdbId, mediaType, season, episode),
      fetchVidSrcPro(tmdbId, mediaType, season, episode)
    ]);

    let allStreams = [...nuvioStreams, ...vidsrcStreams];

    // Priority Sort: MoviesMod > 4k > 1080p
    allStreams.sort((a, b) => {
      if (a._isMoviesMod && !b._isMoviesMod) return -1;
      if (!a._isMoviesMod && b._isMoviesMod) return 1;
      
      const qVal = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1, 'Auto': 0 };
      return (qVal[b.quality] || 0) - (qVal[a.quality] || 0);
    });

    res.status(200).json({ streams: allStreams });
  } catch (error) {
    console.error('[multi-stream] Error:', error);
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
}
