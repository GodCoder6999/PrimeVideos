import { makeProviders, makeStandardFetcher, targets } from '@movie-web/providers';

// Initialize the extraction aggregator
const providers = makeProviders({
  fetcher: makeStandardFetcher(fetch),
  target: targets.BROWSER, 
});

export default async function handler(req, res) {
  // Add basic CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { tmdbId, title, releaseYear, type = 'movie', season, episode } = req.query;

  if (!tmdbId || !title || !releaseYear) {
    return res.status(400).json({ error: 'Missing required media parameters' });
  }

  try {
    // Construct the media object required by @movie-web/providers
    const media = {
      type: type === 'tv' ? 'show' : 'movie',
      title: decodeURIComponent(title),
      releaseYear: Number(releaseYear),
      tmdbId: tmdbId,
      ...(type === 'tv' && {
        season: { number: Number(season), tmdbId: '0' },
        episode: { number: Number(episode), tmdbId: '0' }
      })
    };

    // Run the extraction (this searches multiple providers concurrently)
    const output = await providers.runAll({ media });

    if (!output || !output.stream) {
      return res.status(404).json({ error: 'No stream found' });
    }

    // Find the master HLS playlist
    const hlsPlaylist = output.stream.playlist 
      || (output.stream.type === 'hls' ? output.stream.url : null);

    return res.status(200).json({
      success: true,
      streamUrl: hlsPlaylist,
      headers: output.stream.headers // Important: Pass required upstream headers
    });

  } catch (error) {
    console.error('Extraction Error:', error);
    return res.status(500).json({ error: 'Failed to extract stream' });
  }
}
