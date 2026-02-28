import React, { useEffect, useRef, useState } from 'react';
// Import Shaka Player and its default UI CSS
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';

const ShakaPlayerUI = ({ tmdbId, type = 'movie', season, episode }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let player = null;
        let ui = null;

        const loadStream = async () => {
            try {
                setLoading(true);
                
                // 1. Fetch the .m3u8 URL from your existing Puppeteer API
                let fetchUrl = `/api/get-stream?type=${type}&tmdbId=${tmdbId}`;
                if (type === 'tv' && season && episode) {
                    fetchUrl += `&s=${season}&e=${episode}`;
                }

                const response = await fetch(fetchUrl);
                const data = await response.json();

                if (!data.success || !data.hlsUrl) {
                    throw new Error('Stream not found');
                }

                // 2. Install polyfills
                shaka.polyfill.installAll();

                if (shaka.Player.isBrowserSupported()) {
                    // 3. Initialize Player and UI
                    player = new shaka.Player(videoRef.current);
                    ui = new shaka.ui.Overlay(player, containerRef.current, videoRef.current);
                    
                    // You can customize the UI configuration here
                    const config = {
                        controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
                    };
                    ui.configure(config);

                    // 4. Load the Vidfast .m3u8 URL
                    await player.load(data.hlsUrl);
                    setLoading(false);
                    videoRef.current.play().catch(e => console.log("Autoplay blocked"));
                } else {
                    setError('Browser not supported for Shaka Player');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load video.');
                setLoading(false);
            }
        };

        if (tmdbId) {
            loadStream();
        }

        // Cleanup
        return () => {
            if (ui) ui.destroy();
            if (player) player.destroy();
        };
    }, [tmdbId, type, season, episode]);

    return (
        <div className="w-full max-w-5xl mx-auto bg-black rounded-lg overflow-hidden relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
                    <p className="text-[#00A8E1] font-bold animate-pulse">Locating stream...</p>
                </div>
            )}
            {error && <p className="text-red-500 p-4 text-center absolute z-50">{error}</p>}
            
            {/* Shaka Player requires a container div to attach custom UI controls to */}
            <div ref={containerRef} className="w-full h-full">
                <video 
                    ref={videoRef} 
                    className="w-full h-full"
                    poster="" // You can pass the TMDB backdrop image here
                />
            </div>
        </div>
    );
};

export default ShakaPlayerUI;
