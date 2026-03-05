import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import axios from 'axios';

export default function PrimePlayer({ type, tmdbId, season, episode }) {
    const videoRef = useRef(null);
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 🛑 PASTE YOUR LIVE RENDER URL HERE ONCE DEPLOYED 🛑
    // Example: "https://my-scraper-api.onrender.com"
    const RENDER_BACKEND_URL = "YOUR_RENDER_APP_URL"; 
    const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; 

    // 1. Fetch the Stream URL from your Render Backend
    useEffect(() => {
        async function fetchStream() {
            try {
                setLoading(true);
                setError(null);

                // Step A: Convert TMDB ID to IMDB ID
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
                const imdbId = tmdbRes.data.imdb_id;

                if (!imdbId) throw new Error("IMDb ID not found for this title.");

                // Step B: Construct the exact VidFast URL to scrape
                const targetVidFastUrl = type === 'tv' 
                    ? `https://vidfast.pro/embed/tv/${imdbId}/${season}/${episode}` 
                    : `https://vidfast.pro/embed/movie/${imdbId}`;

                console.log("Asking Render Server to scrape:", targetVidFastUrl);

                // Step C: Call your Render backend!
                const scrapeRes = await axios.get(`${RENDER_BACKEND_URL}/api/get-stream`, {
                    params: { targetUrl: targetVidFastUrl }
                });

                if (scrapeRes.data.success && scrapeRes.data.streamUrl) {
                    console.log("Render returned the stream link!", scrapeRes.data.streamUrl);
                    setStreamUrl(scrapeRes.data.streamUrl);
                } else {
                    throw new Error(scrapeRes.data.error || "Backend failed to find the m3u8 stream.");
                }

            } catch (err) {
                console.error("Player Error:", err);
                setError(err.response?.data?.error || err.message || "An error occurred while finding the video.");
            } finally {
                setLoading(false);
            }
        }

        if (tmdbId) {
            fetchStream();
        }
    }, [type, tmdbId, season, episode]);

    // 2. Initialize the HLS Video Player
    useEffect(() => {
        let hls;

        if (streamUrl && videoRef.current) {
            const video = videoRef.current;

            // Check if browser supports HLS.js (Most modern browsers except Safari)
            if (Hls.isSupported()) {
                hls = new Hls({
                    maxMaxBufferLength: 60, // Prevents the browser from downloading too far ahead
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log("Video is ready to play!");
                    // Autoplay is sometimes blocked by browsers, so we catch the error silently
                    video.play().catch(() => {}); 
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error("HLS Fatal Error:", data);
                        setError("The video stream crashed or was blocked.");
                    }
                });
            } 
            // Fallback for Safari (Apple devices support m3u8 natively)
            else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = streamUrl;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(() => {});
                });
            }
        }

        // Cleanup the player when the component unmounts
        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [streamUrl]);

    // --- UI RENDERING ---

    if (loading) {
        return (
            <div className="w-full aspect-video bg-gray-900 flex flex-col items-center justify-center text-white rounded-lg shadow-xl border border-gray-800">
                <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-semibold text-gray-300">Server is bypassing protections...</p>
                <p className="text-xs text-gray-500 mt-2">This usually takes 5-15 seconds</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full aspect-video bg-gray-900 flex flex-col items-center justify-center text-white rounded-lg shadow-xl border border-gray-800">
                <p className="text-red-500 font-bold mb-2">Error Playing Video</p>
                <p className="text-sm text-gray-400 text-center max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative group">
            <video 
                ref={videoRef}
                controls
                className="w-full h-full object-contain focus:outline-none"
                crossOrigin="anonymous"
            />
        </div>
    );
}
