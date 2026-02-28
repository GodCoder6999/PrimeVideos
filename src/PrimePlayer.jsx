// src/components/PrimePlayer.jsx
import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.compiled.js'; // Use compiled, NOT UI version
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrimePlayer = ({ title, mediaType, season, episode }) => {
    const videoRef = useRef(null);
    const navigate = useNavigate();
    const [playerConfigured, setPlayerConfigured] = useState(false);
    
    // Custom UI States
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(true);
    let controlTimeout = useRef(null);

    useEffect(() => {
        let player = null;

        const initPlayer = async () => {
            try {
                // 1. Fetch the raw unlocked M3U8 from your new Consumet API
                // Note: We pass the TITLE instead of TMDB ID because Consumet searches by text
                let fetchUrl = `/api/get-raw-stream?title=${encodeURIComponent(title)}&type=${mediaType}`;
                if (mediaType === 'tv') fetchUrl += `&season=${season}&episode=${episode}`;

                const response = await fetch(fetchUrl);
                const data = await response.json();

                if (!data.success) throw new Error("Stream not found");

                // 2. Initialize Core Shaka Player (No Default UI)
                shaka.polyfill.installAll();
                player = new shaka.Player(videoRef.current);

                // 3. Load the video
                await player.load(data.streamUrl);
                setPlayerConfigured(true);
                videoRef.current.play();
                setIsPlaying(true);

            } catch (error) {
                console.error("Failed to load stream:", error);
            }
        };

        initPlayer();

        return () => {
            if (player) player.destroy();
        };
    }, [title, mediaType, season, episode]);

    // --- Custom UI Logic ---
    const togglePlay = () => {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        setProgress((current / total) * 100);
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlTimeout.current);
        controlTimeout.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000); // Hide controls after 3 seconds of inactivity
    };

    return (
        <div 
            className="w-full h-screen bg-black relative group overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {/* The Raw Video Element */}
            <video 
                ref={videoRef} 
                className="w-full h-full object-contain cursor-pointer"
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
            />

            {/* --- CUSTOM PRIME VIDEO UI OVERLAY --- */}
            <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                
                {/* Top Bar (Title & Back Button) */}
                <div className="w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-white hover:text-[#00A8E1] transition-colors">
                        <ArrowLeft size={32} />
                    </button>
                    <h1 className="text-white text-xl font-bold tracking-wide drop-shadow-md">{title}</h1>
                </div>

                {/* Bottom Bar (Controls & Progress) */}
                <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    
                    {/* Prime-Style Scrubber Bar */}
                    <div className="w-full h-1.5 bg-gray-600/50 rounded-full mb-4 cursor-pointer relative group/scrubber">
                        {/* Hover effect on scrubber */}
                        <div className="absolute top-1/2 -translate-y-1/2 h-3 w-full bg-transparent"></div> 
                        <div 
                            className="h-full bg-[#00A8E1] rounded-full relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_#00A8E1] opacity-0 group-hover/scrubber:opacity-100 scale-0 group-hover/scrubber:scale-100 transition-all"></div>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button onClick={togglePlay} className="text-white hover:text-[#00A8E1] transition">
                                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                            </button>
                            <button className="text-white hover:text-[#00A8E1] transition">
                                <Volume2 size={24} />
                            </button>
                            <span className="text-gray-300 text-sm font-medium">X-Ray</span>
                        </div>

                        <div className="flex items-center gap-6">
                            <button className="text-white hover:text-[#00A8E1] transition">
                                <Maximize size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrimePlayer;
