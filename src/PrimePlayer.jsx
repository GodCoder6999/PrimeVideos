import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertTriangle } from 'lucide-react';
import Hls from 'hls.js'; // Import HLS.js to handle complex streams

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);

    // 1. Fetch the stream URL from TorBox
    // 2. Attach the URL to the video player safely
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;

        // CRITICAL FIX: Catch browser decoding errors (like MKV failures)
        video.onerror = () => {
            console.error("Video Error:", video.error);
            setError("Browser cannot decode this video format (Likely an unsupported MKV). Please try another stream.");
        };

        if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.log("Autoplay prevented:", e));
            });

            return () => {
                if (hls) hls.destroy();
            };
        } else {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.log("Autoplay prevented:", e));
            });
        }
    }, [streamUrl]);

    // UI Renders
    if (loading) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-[#00A8E1]">
                <Loader className="animate-spin mb-4" size={48} />
                <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Locating Torrents...</p>
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

    return (
        <div className="w-full h-full bg-black">
            <video 
                ref={videoRef}
                controls 
                autoPlay 
                playsInline
                className="w-full h-full object-contain"
            />
        </div>
    );
};

export default PrimePlayer;
