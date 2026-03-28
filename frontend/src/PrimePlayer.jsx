import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
    Play, Pause, Volume2, VolumeX, Maximize, 
    ArrowLeft, Loader, SkipBack, SkipForward, 
    Server, AudioLines, Settings 
} from 'lucide-react';

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose }) => {
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // Stream state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sources, setSources] = useState([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

    // Player state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    
    // Menu States
    const [activeMenu, setActiveMenu] = useState(null); // 'audio', 'quality', 'server', or null

    // HLS native tracks
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1); // -1 is Auto
    const [audioTracks, setAudioTracks] = useState([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState(0);

    useEffect(() => {
        const fetchStreams = async () => {
            setLoading(true);
            setError(null);
            try {
                let url = `/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.success && data.streams && data.streams.length > 0) {
                    setSources(data.streams);
                    loadStream(data.streams[0].url);
                } else {
                    let fallbackUrl = `/api/get-stream?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`;
                    const fRes = await fetch(fallbackUrl);
                    const fData = await fRes.json();
                    
                    if (fData.success && fData.streamUrl) {
                        const fallbackSource = { url: fData.streamUrl, language: 'Auto', quality: 'Auto', source: fData.provider };
                        setSources([fallbackSource]);
                        loadStream(fData.streamUrl);
                    } else {
                        throw new Error("No playable streams found.");
                    }
                }
            } catch (err) {
                console.error("Stream Fetch Error:", err);
                setError(err.message || "Failed to load stream.");
                setLoading(false);
            }
        };

        if (tmdbId) fetchStreams();

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
            clearTimeout(controlsTimeoutRef.current);
        };
    }, [tmdbId, mediaType, season, episode]);

    const loadStream = (url) => {
        const video = videoRef.current;
        if (!video) return;

        if (hlsRef.current) {
            hlsRef.current.destroy();
        }

        if (url.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls({ maxMaxBufferLength: 60 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                setLoading(false);
                
                // Extract video qualities
                const availableQualities = hls.levels.map(l => l.height);
                setQualities(availableQualities);
                setCurrentQuality(-1); // Auto
                
                // Extract audio tracks
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    setAudioTracks(hls.audioTracks);
                    setCurrentAudioTrack(hls.audioTrack);
                }

                video.play().catch(() => console.log("Autoplay blocked. User interaction required."));
            });

            // Listen for dynamic audio track updates
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
                if (data.audioTracks) setAudioTracks(data.audioTracks);
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
                setCurrentAudioTrack(data.id);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            setError("Stream encountered a fatal error.");
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl') || url.includes('.mp4')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                setLoading(false);
                video.play().catch(() => {});
            });
        } else {
            setError("Your browser does not support this video format.");
            setLoading(false);
        }
    };

    // --- Controls ---
    const togglePlay = () => {
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        videoRef.current.volume = val;
        setIsMuted(val === 0);
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
        if (!newMuted && volume === 0) {
            setVolume(1);
            videoRef.current.volume = 1;
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(err => console.error(err));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const seek = (seconds) => { videoRef.current.currentTime += seconds; };

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    // --- Mouse idle timer ---
    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && !activeMenu) {
                setShowControls(false);
            }
        }, 3000);
    };

    // --- Track Switching ---
    const changeQuality = (index) => {
        setCurrentQuality(index);
        if (hlsRef.current) hlsRef.current.currentLevel = index;
    };

    const changeAudioTrack = (index) => {
        setCurrentAudioTrack(index);
        if (hlsRef.current) hlsRef.current.audioTrack = index;
    };

    const changeSource = (index) => {
        setCurrentSourceIndex(index);
        setLoading(true);
        loadStream(sources[index].url);
    };

    const toggleMenu = (menuName) => {
        setActiveMenu(activeMenu === menuName ? null : menuName);
    };

    return (
        <div 
            ref={playerContainerRef} 
            className="fixed inset-0 bg-black z-[999] flex items-center justify-center font-sans"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Header / Back Button */}
            <div className={`absolute top-0 left-0 w-full p-6 z-50 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={onClose} className="text-white hover:text-[#00A8E1] transition flex items-center gap-2 font-bold text-lg">
                    <ArrowLeft size={28} /> Back
                </button>
            </div>

            {/* Loading & Error States */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/50 backdrop-blur-sm">
                    <Loader className="animate-spin text-[#00A8E1] mb-4" size={48} />
                    <p className="text-white font-bold tracking-widest text-sm uppercase">Optimizing Stream</p>
                </div>
            )}
            
            {error && (
                <div className="absolute z-50 bg-[#19222b] border border-white/10 p-6 rounded-xl text-center max-w-md">
                    <p className="text-white font-bold mb-2 text-xl">Playback Error</p>
                    <p className="text-gray-400 text-sm mb-4">{error}</p>
                    <button onClick={onClose} className="bg-[#00A8E1] hover:bg-[#008ebf] text-white px-6 py-2 rounded font-bold transition">Close Player</button>
                </div>
            )}

            {/* Video Element */}
            <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => {
                    if (activeMenu) setActiveMenu(null);
                    else togglePlay();
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                playsInline
            />

            {/* Controls Overlay */}
            <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-20 transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                
                {/* Timeline */}
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-white text-sm font-medium">{formatTime(currentTime)}</span>
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={currentTime} 
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#00A8E1] hover:h-2 transition-all"
                    />
                    <span className="text-white text-sm font-medium">{formatTime(duration)}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-white">
                        <button onClick={togglePlay} className="hover:text-[#00A8E1] transition hover:scale-110">
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                        </button>
                        <button onClick={() => seek(-10)} className="hover:text-[#00A8E1] transition">
                            <SkipBack size={24} />
                        </button>
                        <button onClick={() => seek(10)} className="hover:text-[#00A8E1] transition">
                            <SkipForward size={24} />
                        </button>
                        
                        <div className="flex items-center gap-2 group relative">
                            <button onClick={toggleMute} className="hover:text-[#00A8E1] transition">
                                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                            </button>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05" 
                                value={isMuted ? 0 : volume} 
                                onChange={handleVolumeChange}
                                className="w-20 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#00A8E1] opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-white relative">
                        
                        {/* Audio Button (Only show if multiple tracks exist) */}
                        {audioTracks.length > 1 && (
                            <div className="relative">
                                <button onClick={() => toggleMenu('audio')} className={`transition hover:scale-110 flex items-center gap-2 ${activeMenu === 'audio' ? 'text-[#00A8E1]' : 'hover:text-[#00A8E1]'}`}>
                                    <AudioLines size={24} />
                                </button>
                                
                                {activeMenu === 'audio' && (
                                    <div className="absolute bottom-12 right-0 bg-[#19222b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-48 p-2 z-[100] flex flex-col gap-1">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 border-b border-white/10 mb-1">Audio Language</div>
                                        {audioTracks.map((track, idx) => (
                                            <button key={idx} onClick={() => {changeAudioTrack(idx); setActiveMenu(null)}} className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${currentAudioTrack === idx ? 'bg-[#00A8E1] text-white' : 'text-gray-200 hover:bg-white/10'}`}>
                                                {track.name || track.language || `Track ${idx + 1}`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Video Quality Button */}
                        {qualities.length > 0 && (
                            <div className="relative">
                                <button onClick={() => toggleMenu('quality')} className={`transition hover:scale-110 flex items-center gap-2 ${activeMenu === 'quality' ? 'text-[#00A8E1]' : 'hover:text-[#00A8E1]'}`}>
                                    <Settings size={24} />
                                </button>
                                
                                {activeMenu === 'quality' && (
                                    <div className="absolute bottom-12 right-0 bg-[#19222b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-40 p-2 z-[100] flex flex-col gap-1">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 border-b border-white/10 mb-1">Video Quality</div>
                                        <button onClick={() => {changeQuality(-1); setActiveMenu(null)}} className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${currentQuality === -1 ? 'bg-[#00A8E1] text-white' : 'text-gray-200 hover:bg-white/10'}`}>Auto</button>
                                        {qualities.map((q, idx) => (
                                            <button key={idx} onClick={() => {changeQuality(idx); setActiveMenu(null)}} className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${currentQuality === idx ? 'bg-[#00A8E1] text-white' : 'text-gray-200 hover:bg-white/10'}`}>
                                                {q}p
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Servers / Mirrors Button */}
                        {sources.length > 1 && (
                            <div className="relative">
                                <button onClick={() => toggleMenu('server')} className={`transition hover:scale-110 flex items-center gap-2 ${activeMenu === 'server' ? 'text-[#00A8E1]' : 'hover:text-[#00A8E1]'}`}>
                                    <Server size={24} />
                                </button>

                                {activeMenu === 'server' && (
                                    <div className="absolute bottom-12 right-0 bg-[#19222b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-64 p-2 z-[100] flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 border-b border-white/10 mb-1">Servers / Mirrors</div>
                                        {sources.map((src, idx) => (
                                            <button key={idx} onClick={() => {changeSource(idx); setActiveMenu(null)}} className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition flex flex-col ${currentSourceIndex === idx ? 'bg-[#00A8E1] text-white' : 'text-gray-200 hover:bg-white/10'}`}>
                                                <span>{src.source || 'Server'} {idx + 1}</span>
                                                <span className="text-[10px] opacity-70 mt-0.5">{src.language} • {src.quality}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fullscreen Toggle */}
                        <button onClick={toggleFullscreen} className="hover:text-[#00A8E1] transition hover:scale-110">
                            <Maximize size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrimePlayer;
