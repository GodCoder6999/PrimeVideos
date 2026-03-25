import axios from 'axios';

export default async function handler(req, res) {
  // Extract parameters sent by the frontend
  const { tmdbId, type = 'movie', season = 1, episode = 1 } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || 'cb1dc311039e6ae85db0aa200345cbc5';

  if (!tmdbId) {
    return res.status(400).json({ success: false, error: "Missing tmdbId" });
  }

  try {
    // Phase 1: Identifier Translation (TMDB -> IMDb)
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
    const imdbId = tmdbRes.data.imdb_id;

    if (!imdbId) return res.status(404).json({ success: false, error: "IMDb ID not found" });

    // Phase 2: Fetch strictly from NuvioStreams
    const nuvioUrl = type === 'tv' 
      ? `https://nuviostreams.hayd.uk/stream/series/${imdbId}:${season}:${episode}.json`
      : `https://nuviostreams.hayd.uk/stream/movie/${imdbId}.json`;
      
    const nuvioRes = await axios.get(nuvioUrl, {
      headers: { 'Referer': 'https://nuviostreams.hayd.uk/' }
    });
    
    const rawStreams = nuvioRes.data.streams || [];

    // Phase 3: Strict Filtering (MoviesMod only) & Metadata Extraction
    const filteredStreams = rawStreams
      .filter(stream => {
         const streamName = (stream.name || stream.title || "").toLowerCase();
         return streamName.includes('moviesmod');
      })
      .map(stream => {
        const title = stream.name || stream.title || "";
        const quality = title.match(/\b(480p|720p|1080p|2160p|4K)\b/i)?.[0] || "Auto";
        
        const languageMatch = title.match(/\b(Hindi|English|Tamil|Telugu|Dual Audio|Multi Audio)\b/i);
        const language = languageMatch ? languageMatch[0] : "Default";
        
        // Phase 4: Proxy Enforcement
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(stream.url)}`;
        
        return {
          url: proxyUrl,
          quality,
          language,
          type: stream.url.includes('.m3u8') ? 'hls' : 'direct'
        };
      });

    // Sort by quality (highest first) for the player menu
    const rank = { '4K': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, 'Auto': 0 };
    filteredStreams.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

    return res.status(200).json({ success: true, streams: filteredStreams });
  } catch (error) {
    console.error("Aggregation failed:", error.message);
    return res.status(500).json({ success: false, error: "Aggregation failed" });
  }
}
