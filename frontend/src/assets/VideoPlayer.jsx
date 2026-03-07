// File: src/components/VideoPlayer.jsx
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const VideoPlayer = ({ tmdbId, type = 'movie', season, episode }) => {
    const videoRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStream = async () => {
            try {
                setLoading(true);
                
                // Build the URL depending on movie vs tv
                let fetchUrl = `http://localhost:3001/api/get-stream/${type}/${tmdbId}`;
                if (type === 'tv' && season && episode) {
                    fetchUrl += `?s=${season}&e=${episode}`;
                }

                const response = await fetch(fetchUrl);
                const data = await response.json();

                if (!data.success) throw new Error('Stream not found');

                const video = videoRef.current;
                
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(data.hlsUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        setLoading(false);
                        video.play().catch(e => console.log("Autoplay blocked"));
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = data.hlsUrl;
                    video.addEventListener('loadedmetadata', () => {
                        setLoading(false);
                        video.play();
                    });
                }
            } catch (err) {
                setError('Failed to load video.');
                setLoading(false);
            }
        };

        if (tmdbId) fetchStream();
    }, [tmdbId, type, season, episode]);

    return (
        <div className="w-full max-w-5xl mx-auto bg-black rounded-lg overflow-hidden">
            {loading && <p className="text-white p-4 text-center">Locating stream...</p>}
            {error && <p className="text-red-500 p-4 text-center">{error}</p>}
            
            <video 
                ref={videoRef} 
                controls 
                className={`w-full h-auto ${loading ? 'hidden' : 'block'}`}
            />
        </div>
    );
};

export default VideoPlayer;
