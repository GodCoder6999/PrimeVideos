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
                
                // 1. Ask your Vercel Puppeteer API to scrape Vidfast
                let fetchUrl = `/api/get-stream?type=${type}&tmdbId=${tmdbId}`;
                if (type === 'tv' && season && episode) {
                    fetchUrl += `&s=${season}&e=${episode}`;
                }

                const response = await fetch(fetchUrl);
                const data = await response.json();

                if (!data.success || !data.hlsUrl) {
                    throw new Error('Your scraper could not find the stream on Vidfast.');
                }

                const rawM3u8 = data.hlsUrl;

                // 2. Wrap the Vidfast link in a CORS Proxy to bypass browser security blocks
                // We use corsproxy.io to mask the request
                const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(rawM3u8)}`;

                // Install polyfills
                shaka.polyfill.installAll();

                if (shaka.Player.isBrowserSupported()) {
                    player = new shaka.Player(videoRef.current);
                    ui = new shaka.ui.Overlay(player, containerRef.current, videoRef.current);
                    
                    const config = {
                        controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
                    };
                    ui.configure(config);

                    // 3. Optional: Configure Shaka to allow cross-origin cookies/requests
                    player.getNetworkingEngine().registerRequestFilter((type, request) => {
                        // This helps bypass some basic host protections
                        request.allowCrossSiteCredentials = false; 
                    });

                    // 4. Try loading the proxied URL
                    await player.load(proxiedUrl);
                    setLoading(false);
                    videoRef.current.play().catch(e => console.log("Autoplay blocked by browser."));
                } else {
                    setError('Browser not supported for Shaka Player.');
                    setLoading(false);
                }
            } catch (err) {
                console.error("Playback Error:", err);
                // If it fails, it means Vidfast has strict IP-locking active on the video chunks.
                setError('Vidfast blocked the stream (CORS/IP Mismatch). Shaka Player cannot play this source directly.');
                setLoading(false);
            }
        };

        if (tmdbId) {
            loadStream();
        }

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
                    <p className="text-[#00A8E1] font-bold animate-pulse uppercase tracking-widest text-xs">Scraping Vidfast & Bypassing CORS...</p>
                </div>
            )}
            
            {error && (
                <div className="absolute z-50 bg-[#19222b] border border-red-500/30 p-6 rounded-xl text-center max-w-sm">
                    <p className="text-red-500 font-bold mb-2">Host Blocked Request</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                </div>
            )}
            
            <div ref={containerRef} className="w-full h-full">
                <video ref={videoRef} className="w-full h-full object-contain" />
            </div>
        </div>
    );
};

export default ShakaPlayerUI;
