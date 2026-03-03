// src/assets/VideoPlayer.jsx
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
                // Use relative URL for Vercel compatibility
                let fetchUrl = `/api/get-stream?type=${type}&tmdbId=${tmdbId}`;
                if (type === 'tv' && season && episode) {
                    fetchUrl += `&s=${season}&e=${episode}`;
                }

                const response = await fetch(fetchUrl);
                const data = await response.json();

                if (!data.success || !data.streamUrl) throw new Error('Stream not found');

                const video = videoRef.current;
                const url = data.streamUrl;

                if (url.includes('.m3u8') && Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        setLoading(false);
                        video.play().catch(() => {});
                    });
                } else {
                    video.src = url;
                    video.onloadedmetadata = () => {
                        setLoading(false);
                        video.play().catch(() => {});
                    };
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
            <video ref={videoRef} controls className={`w-full h-auto ${loading ? 'hidden' : 'block'}`} />
        </div>
    );
};

export default VideoPlayer;
