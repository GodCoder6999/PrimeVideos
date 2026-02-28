import React, { useEffect, useRef, useState } from 'react';
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
                setError(null);
                
                // Fetch the stream from a CORS-friendly API instead of scraping Vidfast locally
                let fetchUrl = type === 'movie' 
                    ? `https://vidlink.pro/api/movie/${tmdbId}` 
                    : `https://vidlink.pro/api/tv/${tmdbId}/${season}/${episode}`;

                const response = await fetch(fetchUrl);
                const data = await response.json();

                // Check if the API successfully returned a stream URL
                const streamUrl = data.streamUrl || (data.source && data.source[0]?.url);
                
                if (!streamUrl) {
                    throw new Error('Stream not found or blocked by provider.');
                }

                // Install polyfills
                shaka.polyfill.installAll();

                if (shaka.Player.isBrowserSupported()) {
                    // Initialize Player and UI
                    player = new shaka.Player(videoRef.current);
                    ui = new shaka.ui.Overlay(player, containerRef.current, videoRef.current);
                    
                    // Customize the UI configuration
                    const config = {
                        controlPanelElements: [
                            'play_pause', 
                            'time_and_duration', 
                            'spacer', 
                            'mute', 
                            'volume', 
                            'fullscreen', 
                            'overflow_menu'
                        ],
                    };
                    ui.configure(config);

                    // Load the direct .m3u8 URL
                    await player.load(streamUrl);
                    setLoading(false);
                    videoRef.current.play().catch(e => console.log("Autoplay blocked by browser."));
                } else {
                    setError('Browser not supported for Shaka Player.');
                    setLoading(false);
                }
            } catch (err) {
                console.error("Playback Error:", err);
                setError('Failed to load video stream. The source might be temporarily unavailable.');
                setLoading(false);
            }
        };

        if (tmdbId) {
            loadStream();
        }

        // Cleanup on unmount
        return () => {
            if (ui) ui.destroy();
            if (player) player.destroy();
        };
    }, [tmdbId, type, season, episode]);

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center">
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90">
                    <div className="w-12 h-12 border-4 border-[#00A8E1] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#00A8E1] font-bold animate-pulse tracking-widest uppercase text-sm">Loading Stream...</p>
                </div>
            )}
            
            {error && (
                <div className="absolute z-50 bg-[#19222b] border border-red-500/30 p-6 rounded-xl text-center max-w-sm">
                    <p className="text-red-500 font-bold mb-2">Playback Error</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                </div>
            )}
            
            {/* Shaka Player Container */}
            <div ref={containerRef} className="w-full h-full shadow-[0_0_50px_rgba(0,168,225,0.1)]">
                <video 
                    ref={videoRef} 
                    className="w-full h-full object-contain"
                />
            </div>
        </div>
    );
};

export default ShakaPlayerUI;
