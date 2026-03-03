import React, { useState, useEffect } from 'react';

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [useFallback, setUseFallback] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStream = async () => {
            try {
                // Notice we now pass the 'title' to the API
                const res = await fetch(`/api/get-stream?type=${mediaType}&title=${encodeURIComponent(title)}&s=${season}&e=${episode}`);
                const data = await res.json();

                if (data.success && data.hlsUrl) {
                    setStreamUrl(data.hlsUrl);
                } else {
                    // Extraction failed, trigger the fallback
                    setUseFallback(true);
                }
            } catch (error) {
                console.error("Backend scraping failed, using fallback", error);
                setUseFallback(true);
            } finally {
                setLoading(false);
            }
        };

        fetchStream();
    }, [tmdbId, title, mediaType, season, episode]);

    if (loading) {
        return <div className="text-white flex items-center justify-center h-full">Loading Stream...</div>;
    }

    // THE FALLBACK: If Consumet fails, embed a reliable free aggregator
    if (useFallback) {
        const fallbackUrl = mediaType === 'tv' 
            ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
            : `https://vidsrc.to/embed/movie/${tmdbId}`;

        return (
            <iframe 
                src={fallbackUrl}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
                title="Video Player Fallback"
            />
        );
    }

    // SUCCESS: Pass the extracted streamUrl to your custom ShakaPlayer/Plyr setup
    return (
        <div className="w-full h-full">
            {/* Assuming you have a standard video element or Shaka integration here */}
            <video 
                src={streamUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
            />
        </div>
    );
};

export default PrimePlayer;
