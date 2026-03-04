import React, { useState, useEffect } from 'react';

export default function EmbedPlayer({ type, tmdbId, season, episode }) {
  const [imdbId, setImdbId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. We quickly convert the TMDB ID to an IMDB ID since VidFast prefers it
    async function fetchImdbId() {
      try {
        const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        
        if (data.imdb_id) {
          setImdbId(data.imdb_id);
        }
      } catch (error) {
        console.error("Failed to fetch IMDB ID:", error);
      } finally {
        setLoading(false);
      }
    }

    if (tmdbId) {
      fetchImdbId();
    }
  }, [type, tmdbId]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        Loading Player...
      </div>
    );
  }

  if (!imdbId) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white">
        Media not available.
      </div>
    );
  }

  // 2. Construct the VidFast URL
  const embedUrl = type === 'tv' 
    ? `https://vidfast.pro/embed/tv/${imdbId}/${season}/${episode}` 
    : `https://vidfast.pro/embed/movie/${imdbId}`;

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        allowFullScreen
        title="Movie Player"
        // This is crucial: it stops the iframe from knowing it's embedded on your site, preventing blocks
        referrerPolicy="origin" 
      ></iframe>
    </div>
  );
}
