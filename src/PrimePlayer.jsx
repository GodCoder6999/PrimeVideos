import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, Loader, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrimePlayer = ({ title, mediaType, season, episode }) => {
    const videoRef = useRef(null);
    const navigate = useNavigate();
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    let controlTimeout = useRef(null);
    let hlsRef = useRef(null);

    useEffect(() => {
        const initPlayer = async () => {
            try {
                setLoading(true);
                setError(null);

                // 1. Call your new Mega Scraper
                let fetchUrl = `/api/get-raw-stream?title=${encodeURIComponent(title)}&type=${mediaType}`;
                if (mediaType === 'tv') fetchUrl += `&season=${season}&episode=${episode}`;

                const response = await fetch(fetchUrl);
                const data = await response.json();

                // 2. Strict Failure (No Iframe Fallback)
                if (!data.success || !data.streamUrl) {
                    throw new Error("This video is currently unavailable in our premium library.");
                }

                // 3. Initialize HLS.js Player
                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();
                    const hls = new Hls({ maxBufferSize: 0, maxBufferLength: 30 });
                    hlsRef.current = hls;
                    
                    hls.loadSource(data.streamUrl);
                    hls.attachMedia(videoRef.current);
                    
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        setLoading(false);
                        videoRef.current.play().catch(e => console.log("Autoplay blocked"));
                        setIsPlaying(true);
                    });

                    hls.on(Hls.Events.ERROR, (event, errorData) => {
                        if (errorData.fatal) {
                            setError("The stream crashed unexpectedly.");
                            setLoading(false);
                        }
                    });
                } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                    videoRef.current.src = data.streamUrl;
                    videoRef.current.addEventListener('loadedmetadata', () => {
                        setLoading(false);
                        videoRef.current.play();
                        setIsPlaying(true);
                    });
                } else {
                    throw new Error("Your browser does not support video playback.");
                }
            } catch (err) {
                console.error("Playback Error:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        if (title) initPlayer();

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [title, mediaType, season, episode]);

    // --- Custom UI Controls ---
    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        if (total > 0) setProgress((current / total) * 100);
    };

    const handleScrub = (e) => {
        if (!videoRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = clickPosition * videoRef.current.duration;
    };

    const toggleFullScreen = () => {
        const container = document.getElementById('player-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlTimeout.current);
        controlTimeout.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    return (
        <div 
            id="player-container"
            className="w-full h-screen bg-black relative group overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
                    <Loader size={48} className="animate-spin text-[#00A8E1] mb-4" />
                    <p className="text-white font-bold tracking-widest uppercase text-sm">Loading...</p>
                </div>
            )}

            {/* Error Overlay (No more iframes) */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#0f171e] px-4 text-center">
                    <AlertCircle size={64} className="text-gray-500 mb-6" />
                    <h2 className="text-white font-bold text-2xl mb-2">Video Unavailable</h2>
                    <p className="text-gray-400 mb-8 max-w-md">{error}</p>
                    <button onClick={() => navigate(-1)} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-3 rounded font-bold transition-all">
                        Back to Browse
                    </button>
                </div>
            )}

            <video 
                ref={videoRef} 
                className="w-full h-full object-contain cursor-pointer"
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
            />

            <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls && !error ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
                
                <div className="w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4 pointer-events-auto">
                    <button onClick={() => navigate(-1)} className="text-white hover:text-[#00A8E1] transition-colors">
                        <ArrowLeft size={32} />
                    </button>
                    <h1 className="text-white text-xl font-bold tracking-wide drop-shadow-md">{title}</h1>
                </div>

                <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
                    <div className="w-full h-1.5 bg-gray-600/50 rounded-full mb-4 cursor-pointer relative group/scrubber" onClick={handleScrub}>
                        <div className="absolute top-1/2 -translate-y-1/2 h-4 w-full bg-transparent"></div> 
                        <div className="h-full bg-[#00A8E1] rounded-full relative" style={{ width: `${progress}%` }}>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_#00A8E1] opacity-0 group-hover/scrubber:opacity-100 scale-0 group-hover/scrubber:scale-100 transition-all"></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button onClick={togglePlay} className="text-white hover:text-[#00A8E1] transition">
                                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                            </button>
                            <button onClick={toggleMute} className="text-white hover:text-[#00A8E1] transition">
                                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                            </button>
                            <span className="text-gray-300 text-sm font-bold tracking-wider hover:text-white cursor-pointer uppercase">X-Ray</span>
                        </div>

                        <div className="flex items-center gap-6">
                            <button onClick={toggleFullScreen} className="text-white hover:text-[#00A8E1] transition">
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
