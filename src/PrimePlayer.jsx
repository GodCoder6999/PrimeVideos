import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertTriangle } from 'lucide-react'; // Assuming you use lucide-react

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);

    useEffect(() => {
        const fetchStream = async () => {
            setLoading(true);
            setError(null);
            try {
                // Call your newly updated Vercel API
                const res = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
                const data = await res.json();

                if (data.success && data.streamUrl) {
                    setStreamUrl(data.streamUrl);
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
                <p className="text-gray-500 text-sm mt-2 max-w-md text-center">
                   (If using TorBox free tier, the file might not be cached yet, or you reached your daily limit).
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black">
            <video 
                ref={videoRef}
                src={streamUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
            />
        </div>
    );
};

export default PrimePlayer;
