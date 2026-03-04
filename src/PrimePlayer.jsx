import React, { useEffect } from 'react';

export default function VidFastPlayer({ type, tmdbId, season, episode }) {
  
  // 1. Construct the URL with Advanced Features
  const themeHex = "E50914"; // Netflix Red (Change to whatever matches your app)
  
  const embedUrl = type === 'tv'
    ? `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?title=true&poster=true&theme=${themeHex}&nextButton=true&autoNext=true`
    : `https://vidfast.pro/movie/${tmdbId}?title=true&poster=true&theme=${themeHex}`;

  // 2. Set up the Event Listeners for Watch Progress
  useEffect(() => {
    const vidfastOrigins = [
      'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io',
      'https://vidfast.me', 'https://vidfast.net', 'https://vidfast.pm',
      'https://vidfast.xyz'
    ];

    const handleMessage = (event) => {
      // Security check to ensure the message is actually from VidFast
      if (!vidfastOrigins.includes(event.origin) || !event.data) {
        return;
      }

      // Track raw playback events (play, pause, seeked)
      if (event.data.type === 'PLAYER_EVENT') {
        const { event: playerEvent, currentTime, duration } = event.data.data;
        // You can uncomment this to see the events fire in your browser console:
        // console.log(`[VidFast] ${playerEvent} | Progress: ${Math.floor(currentTime)}s / ${Math.floor(duration)}s`);
      }

      // Save complete watch history to local storage
      if (event.data.type === 'MEDIA_DATA') {
        // Fetch existing history so we don't overwrite other movies
        const existingHistory = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
        
        // Merge the new progress data with the old data
        const updatedHistory = {
          ...existingHistory,
          ...event.data.data
        };
        
        // Save back to the browser's local storage
        localStorage.setItem('vidFastProgress', JSON.stringify(updatedHistory));
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup listener when the video player is unmounted
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0 absolute top-0 left-0"
        allowFullScreen
        allow="encrypted-media"
        title="Video Player"
        referrerPolicy="origin"
      ></iframe>
    </div>
  );
}
