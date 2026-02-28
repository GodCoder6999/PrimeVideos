import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, Loader, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const videoRef = useRef(null);
    const navigate = useNavigate();
    
    // UI & Logic States
    const [loading, setLoading] = useState(true);
    const [useIframeFallback, setUseIframeFallback] = useState(false); // The Hybrid Switch
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    
    let controlTimeout = useRef(null);
    let hlsRef = useRef(null);

    // VidKing/Vidfast Iframe URLs (Styled to match your Neon Blue theme)
    const fallbackIframeUrl = mediaType === 'tv'
        ? `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=00A8E1&autoPlay=true`
        : `https://www.vidking.net/embed/movie/${tmdbId}?color=00A8E1&autoPlay=true`;

    useEffect(() => {
        const initPlayer = async () => {
            try {
                setLoading(true);

                // 1. Try to fetch the UNLOCKED stream first (for the Custom Prime Player)
                let fetchUrl = `/api/get-raw-stream?title=${encodeURIComponent(title)}&type=${mediaType}`;
                if (mediaType === 'tv') fetchUrl += `&season=${season}&episode=${episode}`;

                const response = await fetch(fetchUrl);
                const data = await response.json();

                // 2. IF UNAVAILABLE (like Kohrra), switch to the Iframe Fallback!
                if (!data.success || !data.streamUrl) {
                    console.log("Unlocked stream not found. Switching to highly-available Iframe Fallback.");
                    setUseIframeFallback(true);
                    setLoading(false);
                    return;
                }

                // 3. IF AVAILABLE, initialize your Custom Prime Video Player!
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
                            // If the custom stream crashes mid-load, switch to iframe
                            setUseIframeFallback(true);
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
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                setUseIframeFallback(true); // Always fallback to iframe on any network error
                setLoading(false);
            }
        };

        if (title) initPlayer();

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [tmdbId, title, mediaType, season, episode]);

    // --- Custom UI Logic (Only used if NOT in iframe mode) ---
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

    // ==========================================
    // RENDER: THE IFRAME FALLBACK (For Regional/Locked Content)
    // ==========================================
    if (useIframeFallback) {
        return (
            <div className="w-full h-screen bg-black relative flex flex-col">
                {/* Seamless Back Button Overlay */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/90 to-transparent pointer-events-none z-[250] flex items-center px-6">
                    <button onClick={() => navigate(-1)} className="pointer-events-auto bg-black/40 hover:bg-[#00A8E1] text-white w-12 h-12 rounded-full backdrop-blur-md border border-white/10 transition-all flex items-center justify-center shadow-lg group">
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="ml-4 flex items-center gap-2 text-[#00A8E1] text-xs font-bold uppercase tracking-widest bg-black/50 px-3 py-1.5 rounded-full border border-[#00A8E1]/30">
                        <Info size={14} /> Server 2
                    </div>
                </div>

                {/* The Iframe */}
                <div className="flex-1 relative w-full h-full bg-black">
                    <iframe
                        src={fallbackIframeUrl}
                        className="w-full h-full border-none absolute inset-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        title="Backup Player"
                    ></iframe>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: THE CUSTOM PRIME PLAYER (For Hollywood/Mainstream)
    // ==========================================
    return (
        <div 
            id="player-container"
            className="w-full h-screen bg-black relative group overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80">
                    <Loader size={48} className="animate-spin text-[#00A8E1] mb-4" />
                    <p className="text-white font-bold tracking-widest uppercase text-sm">Loading Premium Stream...</p>
                </div>
            )}

            <video 
                ref={videoRef} 
                className="w-full h-full object-contain cursor-pointer"
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
            />

            <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
                
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
