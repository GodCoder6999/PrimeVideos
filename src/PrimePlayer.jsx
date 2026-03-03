import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertTriangle, Clock } from 'lucide-react';
import Hls from 'hls.js';

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false); // New state
    const videoRef = useRef(null);

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
                    // TorBox is caching the torrent
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

    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;

        // CRITICAL: Catch browser decoding errors silently failing
        video.onerror = () => {
            console.error("Video Error:", video.error);
            setError("Browser cannot decode this video format. Please try another stream.");
        };

        if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(e => console.log(e)));
            return () => hls && hls.destroy();
        } else {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => video.play().catch(e => console.log(e)));
        }
    }, [streamUrl]);

    if (loading) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-[#00A8E1]">
                <Loader className="animate-spin mb-4" size={48} />
                <p className="text-gray-400 font-bold tracking-widest uppercase text-sm">Searching Torrents...</p>
            </div>
        );
    }

    // NEW UI: Show a waiting screen if TorBox is downloading the file
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

    return (
        <div className="w-full h-full bg-black">
            <video ref={videoRef} controls autoPlay playsInline className="w-full h-full object-contain" />
        </div>
    );
};

export default PrimePlayer;
