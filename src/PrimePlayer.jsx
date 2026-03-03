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

    // 1. Fetch the stream URL (Unchanged)
    useEffect(() => {
        const fetchStream = async () => {
            setLoading(true);
            setError(null);
            setIsDownloading(false);
            try {
                const res = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
                const data = await res.json();

                if (data.success && data.streamUrl) {
                    setStreamUrl(data.streamUrl);
                } else if (data.isDownloading) {
                    setIsDownloading(true);
                    setError(data.message);
                } else {
                    setError(data.error || data.message || "Stream not available.");
                }
            } catch (err) {
                console.error("Player Error", err);
                setError("Failed to connect to streaming server.");
            } finally {
                setLoading(false);
            }
        };

        fetchStream();
    }, [tmdbId, mediaType, season, episode]);

    // 2. Attach HLS and initialize Plyr
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;

        // Initialize the custom Plyr UI
        playerRef.current = new Plyr(video, {
            controls: [
                'play-large', // The big play button in the center
                'play',       // Play/pause playback
                'progress',   // The progress bar and scrubber
                'current-time', // The current time of playback
                'duration',   // The full duration of the media
                'mute',       // Toggle mute
                'volume',     // Volume control
                'captions',   // Toggle captions
                'settings',   // Settings menu (quality, speed)
                'pip',        // Picture-in-picture
                'airplay',    // Airplay
                'fullscreen', // Toggle fullscreen
            ],
            settings: ['quality', 'speed'],
            autoplay: true,
        });

        video.onerror = () => {
            console.error("Video Error:", video.error);
            setError("Browser cannot decode this video format. Please try another stream.");
        };

        if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.log("Autoplay blocked:", e));
            });

            return () => {
                hls.destroy();
                if (playerRef.current) playerRef.current.destroy();
            };
        } else {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.log("Autoplay blocked:", e));
            });

            return () => {
                if (playerRef.current) playerRef.current.destroy();
            };
        }
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
