import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertTriangle, Clock } from 'lucide-react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css'; // CRITICAL: This imports the custom UI styles!

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const videoRef = useRef(null);
    const playerRef = useRef(null); // Reference for the Plyr instance

    // src/PrimePlayer.jsx - Modified HLS effect
useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    // Check if the URL is an HLS manifest (.m3u8)
    const isHLS = streamUrl.includes('.m3u8');

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    } else {
      // Direct MP4 or Native HLS (Safari)
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    }

    const handleCanPlay = () => setIsReadyToPlay(true);
    video.addEventListener('canplay', handleCanPlay); // Changed to 'canplay' for faster response

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      if (hlsRef.current) hlsRef.current.destroy();
    };
}, [streamUrl]);

    // UI Renders (Loading & Error States Unchanged)
    if (loading) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-[#00A8E1]">
                <Loader className="animate-spin mb-4" size={48} />
                <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Locating Torrents...</p>
            </div>
        );
    }

    if (isDownloading) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-yellow-500">
                <Clock size={48} className="mb-4 animate-pulse" />
                <p className="font-bold text-lg">Server is caching this torrent.</p>
                <p className="text-gray-400 text-sm mt-2 max-w-md text-center">{error}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-red-500">
                <AlertTriangle size={48} className="mb-4" />
                <p className="font-bold">{error}</p>
            </div>
        );
    }

    // THE PLAYER WRAPPER
    // Notice that we REMOVED the 'controls' attribute from the <video> tag!
    return (
        <div className="w-full h-full bg-black flex items-center justify-center relative prime-player-wrapper">
            {/* Adding a custom CSS class to inject the Prime Video blue color 
               into the Plyr UI variables.
            */}
            <style>{`
                .prime-player-wrapper {
                    --plyr-color-main: #00A8E1;
                    --plyr-video-background: #000000;
                    --plyr-menu-background: #19222b;
                    --plyr-menu-color: #ffffff;
                }
                /* Make it fill the container properly */
                .plyr {
                    width: 100%;
                    height: 100%;
                }
            `}</style>

            <video 
                ref={videoRef}
                playsInline
                className="w-full h-full"
            />
        </div>
    );
};

export default PrimePlayer;
