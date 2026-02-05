// File: lib/downloads.js (or your equivalent filename)

/**
 * AG Downloads Integration
 * Supports both Movies and TV Shows via Supabase.
 */
async function getAgDownloads({ tmdbId, mediaItem, mediaType = 'movie' }) {
  if (!tmdbId) return [];

  // It is best practice to use Environment Variables for these
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xuzfdkkkklmrilcitsec.supabase.co/rest/v1';
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; 
  
  const headers = { 
    'apikey': apikey, 
    'Authorization': `Bearer ${apikey}`, 
    'Content-Type': 'application/json' 
  };

  try {
    const table = mediaType === 'tv' ? 'tv_shows' : 'movies';
    const res = await fetch(`${baseUrl}/${table}?tmdb_id=eq.${tmdbId}`, { headers });
    
    const response = await res.json();
    if (!response || !response[0]) return [];

    const downloadUrl = response[0]?.download_url;
    if (!downloadUrl) return [];

    const title = mediaItem?.title || mediaItem?.name || '';
    const date = mediaItem?.release_date || mediaItem?.first_air_date;
    const releaseYear = date ? date.slice(0, 4) : '';
    const displayTitle = releaseYear && title ? `${title} (${releaseYear})` : title || 'AG Download';

    return [{ 
      source: 'AG',
      title: displayTitle, 
      url: downloadUrl, 
      type: 'download' 
    }];

  } catch (error) {
    console.error('AG Download Error:', error);
    return [];
  }
}

export async function getDownloadLinks({ tmdbId, mediaItem, mediaType }) {
  return await getAgDownloads({ tmdbId, mediaItem, mediaType });
}
