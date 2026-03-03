import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, AlertTriangle, Clock, ArrowLeft, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, MessageSquare, List } from 'lucide-react';
import Hls from 'hls.js';

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // --- STREAM STATE ---
    const [streamUrl, setStreamUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // --- PLAYER UI STATE ---
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // --- 1. FETCH STREAM (TorBox Integration) ---
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

    // --- 2. ATTACH HLS & VIDEO LISTENERS ---
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;
        const video = videoRef.current;

        video.onerror = () => setError("Browser cannot decode this video format. Please try another stream.");
        
        // Sync React state with Video tag
        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleDurationChange = () => setDuration(video.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleDurationChange);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(e => console.log(e)));
            return () => {
                hls.destroy();
                video.removeEventListener('timeupdate', handleTimeUpdate);
                video.removeEventListener('loadedmetadata', handleDurationChange);
                video.removeEventListener('play', handlePlay);
                video.removeEventListener('pause', handlePause);
            };
        } else {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => video.play().catch(e => console.log(e)));
        }
    }, [streamUrl]);

    // --- 3. CUSTOM UI CONTROLS LOGIC ---
    const togglePlay = () => {
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
    };

    const skipTime = (amount) => {
        videoRef.current.currentTime += amount;
    };

    const handleSeek = (e) => {
        const seekTime = (e.target.value / 100) * duration;
        videoRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
    };

    const toggleMute = () => {
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(!isMuted);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    };

    // Auto-hide controls after 3 seconds of inactivity
    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    // Format time from seconds to HH:MM:SS
    const formatTime = (time) => {
        if (isNaN(time)) return "00:00";
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // --- RENDER LOADING / ERRORS ---
    if (loading) return <div className="w-full h-full bg-black flex flex-col items-center justify-center text-[#00A8E1]"><Loader className="animate-spin mb-4" size={48} /><p className="font-bold tracking-widest text-sm uppercase">Locating Torrents...</p></div>;
    if (isDownloading) return <div className="w-full h-full bg-black flex flex-col items-center justify-center text-yellow-500"><Clock size={48} className="mb-4 animate-pulse" /><p className="font-bold text-lg">Server caching torrent.</p></div>;
    if (error) return <div className="w-full h-full bg-black flex flex-col items-center justify-center text-red-500"><AlertTriangle size={48} className="mb-4" /><p className="font-bold">{error}</p></div>;

    // --- RENDER CUSTOM PLAYER ---
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div 
            ref={containerRef}
            className="prime-video-player" 
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <style>{`
                .prime-video-player {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100vh;
                    background-color: #000;
                    overflow: hidden;
                    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
                    color: #ffffff;
                }
                .video-view {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .playback-overlay-fragment {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 15%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.9) 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 2% 4%;
                    transition: opacity 0.3s ease;
                }
                .top-bar { display: flex; justify-content: space-between; align-items: center; }
                .top-left, .top-right { display: flex; gap: 24px; align-items: center; }
                .nav-btn, .utility-btn { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; }
                .nav-btn:hover, .utility-btn:hover { opacity: 1; }
                .technical-badges .badge { border: 1px solid rgba(255, 255, 255, 0.4); padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #ccc; margin-left: 8px; }
                
                .temporal-btn.skip-intro {
                    position: absolute; bottom: 120px; right: 4%;
                    background-color: rgba(255, 255, 255, 0.9); color: #000;
                    padding: 10px 20px; border-radius: 4px; font-weight: bold; font-size: 14px;
                    cursor: pointer; z-index: 10; border: none; transition: transform 0.2s;
                }
                .temporal-btn.skip-intro:hover { transform: scale(1.05); }

                .bottom-bar { display: flex; flex-direction: column; gap: 20px; width: 100%; padding-bottom: 20px; }
                .progress-bar-container { display: flex; align-items: center; gap: 20px; width: 100%; }
                .timestamp { font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; opacity: 0.9; }
                
                .scrubber-track {
                    flex-grow: 1; height: 5px; background-color: rgba(255, 255, 255, 0.2);
                    border-radius: 2.5px; cursor: pointer; position: relative;
                    display: flex; align-items: center;
                }
                .scrubber-fill {
                    height: 100%; background-color: #00A8E1; border-radius: 2.5px;
                    pointer-events: none;
                }
                .scrubber-thumb {
                    width: 14px; height: 14px; background-color: white; border-radius: 50%;
                    position: absolute; top: 50%; transform: translate(-50%, -50%);
                    box-shadow: 0 0 10px rgba(0,0,0,0.5); pointer-events: none;
                }
                .scrubber-input {
                    position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;
                }

                .transport-cluster { display: flex; justify-content: center; align-items: center; gap: 40px; }
                .transport-btn { background: none; border: none; color: white; cursor: pointer; transition: transform 0.2s; opacity: 0.9; }
                .transport-btn:hover { transform: scale(1.1); opacity: 1; }
                .play-pause-btn { background: white; color: black; border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; }
                .play-pause-btn:hover { background: #e0e0e0; transform: scale(1.05); }
            `}</style>

            {/* THE ACTUAL VIDEO ELEMENT */}
            <video 
                ref={videoRef} 
                className="video-view"
                onClick={togglePlay} // Clicking video toggles play/pause
                playsInline
            />

            {/* THE CUSTOM UI OVERLAY */}
            <div 
                className="playback-overlay-fragment"
                style={{ opacity: showControls || !isPlaying ? 1 : 0, pointerEvents: showControls || !isPlaying ? 'auto' : 'none' }}
            >
                {/* TOP BAR */}
                <div className="top-bar">
                    <div className="top-left">
                        <button className="nav-btn" onClick={() => navigate(-1)}><ArrowLeft size={28} /></button>
                        <h2 className="text-xl font-bold drop-shadow-md truncate max-w-md">{title || "Prime Video"}</h2>
                        {mediaType === 'tv' && (
                            <button className="nav-btn flex items-center gap-2 ml-4 font-bold text-sm bg-white/10 px-3 py-1.5 rounded border border-white/20 hover:bg-white/20">
                                <List size={18} /> Episodes
                            </button>
                        )}
                    </div>
                    
                    <div className="top-right">
                        {mediaType === 'movie' && (
                            <div className="technical-badges">
                                <span className="badge">UHD</span>
                                <span className="badge">HDR</span>
                            </div>
                        )}
                        <button className="utility-btn" onClick={toggleMute}>
                            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </button>
                        <button className="utility-btn"><MessageSquare size={24} /></button>
                        <button className="utility-btn font-bold text-sm ml-2" onClick={toggleFullScreen}>
                            <Maximize size={22} />
                        </button>
                    </div>
                </div>

                {/* SKIP INTRO (Shows only in first 3 minutes of TV Shows as a placeholder logic) */}
                {mediaType === 'tv' && currentTime > 10 && currentTime < 180 && (
                    <button className="temporal-btn skip-intro" onClick={() => skipTime(85)}>
                        Skip Intro
                    </button>
                )}

                {/* BOTTOM BAR */}
                <div className="bottom-bar">
                    {/* Scrubber */}
                    <div className="progress-bar-container">
                        <span className="timestamp">{formatTime(currentTime)}</span>
                        <div className="scrubber-track">
                            <div className="scrubber-fill" style={{ width: `${progressPercent}%` }}></div>
                            <div className="scrubber-thumb" style={{ left: `${progressPercent}%` }}></div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={progressPercent || 0} 
                                onChange={handleSeek} 
                                className="scrubber-input"
                            />
                        </div>
                        <span className="timestamp">-{formatTime(duration - currentTime)}</span>
                    </div>
                    
                    {/* Controls */}
                    <div className="transport-cluster relative">
                        <div className="absolute left-0 text-sm font-bold text-gray-400">
                            {mediaType === 'tv' ? `S${season} E${episode}` : ''}
                        </div>

                        <button className="transport-btn" onClick={() => skipTime(-10)} title="Rewind 10s">
                            <RotateCcw size={32} />
                        </button>
                        
                        <button className="transport-btn play-pause-btn" onClick={togglePlay}>
                            {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
                        </button>
                        
                        <button className="transport-btn" onClick={() => skipTime(10)} title="Fast Forward 10s">
                            <RotateCw size={32} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrimePlayer;
