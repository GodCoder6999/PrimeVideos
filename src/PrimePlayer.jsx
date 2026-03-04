import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function VidFastPlayer({ type, tmdbId, season, episode }) {
    const [embedUrl, setEmbedUrl] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        async function fetchEmbed() {
            try {
                // 1. Convert TMDB ID to IMDB ID directly from the browser
                const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 
                const res = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
                const imdbId = res.data.imdb_id;

                if (!imdbId) throw new Error("IMDb ID not found");

                // 2. Construct the exact VidFast Embed URL
                const targetUrl = type === 'tv' 
                    ? `https://vidfast.pro/embed/tv/${imdbId}/${season}/${episode}` 
                    : `https://vidfast.pro/embed/movie/${imdbId}`;

                setEmbedUrl(targetUrl);
            } catch (err) {
                console.error("Failed to load player data:", err);
                setError(true);
            }
        }

        if (tmdbId) {
            fetchEmbed();
        }
    }, [type, tmdbId, season, episode]);

    if (error) return <div className="text-white text-center p-10">Movie not available.</div>;
    if (!embedUrl) return <div className="text-white text-center p-10">Loading Player...</div>;

    return (
        <div className="w-full h-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            <iframe 
                src={embedUrl}
                className="w-full h-full border-0"
                allowFullScreen
                title="VidFast Player"
                referrerPolicy="origin"
            ></iframe>
        </div>
    );
}
