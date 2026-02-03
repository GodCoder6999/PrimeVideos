import { MOVIES } from '@consumet/extensions';
import axios from 'axios';

// Initialize the provider directly on the backend
const flixhq = new MOVIES.FlixHQ();

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id, type, season = 1, episode = 1 } = req.query;

  if (!id || !type) {
    return res.status(400).json({ error: "Missing id or type" });
  }

  try {
    // 1. Get Accurate Metadata from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=09ca3ca71692ba80b848d268502d24ed`;
    const tmdbRes = await axios.get(tmdbUrl);
    
    // Use original title for better matching
    const title = tmdbRes.data.original_title || tmdbRes.data.original_name || tmdbRes.data.title || tmdbRes.data.name;
    const releaseYear = (tmdbRes.data.release_date || tmdbRes.data.first_air_date || "").split("-")[0];

    console.log(`Searching for: ${title} (${releaseYear})`);

    // 2. Search using Consumet Library (Running locally)
    const searchResults = await flixhq.search(title);

    if (!searchResults.results || searchResults.results.length === 0) {
      throw new Error(`No results found for ${title}`);
    }

    // Filter results to find the best match
    let media = searchResults.results.find(m => 
      (m.title.toLowerCase() === title.toLowerCase()) && 
      (m.releaseDate === releaseYear || m.type === (type === 'movie' ? 'Movie' : 'TV Series'))
    );

    if (!media) media = searchResults.results[0];

    console.log(`Found Match: ${media.title} (ID: ${media.id})`);

    // 3. Fetch Media Info (Episodes)
    const mediaInfo = await flixhq.fetchMediaInfo(media.id);

    if (!mediaInfo.episodes || mediaInfo.episodes.length === 0) {
      throw new Error("No episodes found for this media");
    }

    // 4. Locate the Specific Episode ID
    let episodeId = null;

    if (type === 'movie') {
      episodeId = mediaInfo.episodes[0].id;
    } else {
      const foundEp = mediaInfo.episodes.find(
        e => e.season === Number(season) && e.number === Number(episode)
      );
      if (foundEp) episodeId = foundEp.id;
      else throw new Error(`Season ${season} Episode ${episode} not found`);
    }

    // 5. Fetch Actual Stream Sources
    let sourcesData = null;
    try {
        sourcesData = await flixhq.fetchEpisodeSources(episodeId, media.id, 'vidcloud');
    } catch (err) {
        sourcesData = await flixhq.fetchEpisodeSources(episodeId, media.id, 'upcloud');
    }

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      throw new Error("No stream sources returned");
    }

    const bestSource = sourcesData.sources.find(s => s.quality === 'auto') || sourcesData.sources[0];

    return res.status(200).json({ 
      streamUrl: bestSource.url,
      referer: sourcesData.headers?.Referer || null
    });

  } catch (error) {
    console.error("Stream Error:", error.message);
    return res.status(500).json({ error: "Failed to generate stream", details: error.message });
  }
}
