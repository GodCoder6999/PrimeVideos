import axios from 'axios';

export default async function handler(req, res) {
  const { id, type } = req.query; // Expecting TMDB ID
  const TMDB_API_KEY = process.env.TMDB_API_KEY;

  try {
    // 1. Identifier Translation (TMDB -> IMDb)
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${id}/external_ids?api_key=${TMDB_API_KEY}`);
    const imdbId = tmdbRes.data.imdb_id;

    if (!imdbId) return res.status(404).json({ error: "IMDb ID not found" });

    // 2. Fetch from NuvioStreams API
    // Note: Replace with the actual NuvioStreams endpoint URL
    const nuvioRes = await axios.get(`https://nuviostreams.api/get?id=${imdbId}`);
    const rawStreams = nuvioRes.data.streams || [];

    // 3. Strict Filtering (MoviesMod only) & Metadata Extraction
    const filteredStreams = rawStreams
      .filter(stream => stream.title.toLowerCase().includes('moviesmod'))
      .map(stream => {
        const title = stream.title || "";
        const quality = title.match(/\b(480p|720p|1080p|2160p|4K)\b/i)?.[0] || "Unknown";
        const language = title.match(/\b(Hindi|English|Tamil|Telugu|Dual|Multi)\b/i)?.[0] || "Default";
        
        // 4. Proxy Enforcement
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(stream.url)}`;
        
        return {
          url: proxyUrl,
          quality,
          language,
          type: stream.url.endsWith('.m3u8') ? 'hls' : 'direct'
        };
      });

    return res.status(200).json({ streams: filteredStreams });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Aggregation failed" });
  }
}
