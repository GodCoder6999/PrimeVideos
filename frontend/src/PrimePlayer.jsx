import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { 
    Play, Pause, Volume2, VolumeX, Maximize, 
    ArrowLeft, Loader, SkipBack, SkipForward, 
    Settings, ChevronRight, ChevronLeft
} from 'lucide-react';

// Helper to format time
const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper to parse strings like "Hindi + English" or "Hindi/English" into separate array items
const parseLanguages = (langStr) => {
    if (!langStr) return ['Unknown'];
    return langStr.split(/(?:\+|\||,|and|&|\/)/i).map(l => l.trim()).filter(Boolean);
};

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose }) => {
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // Core Stream State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sources, setSources] = useState([]);
    
    // Active Source Identifiers
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentUrlLanguage, setCurrentUrlLanguage] = useState('');
    const [currentUrlQuality, setCurrentUrlQuality] = useState('Auto');

    // Native HLS Tracks (If the m3u8 has embedded options natively)
    const [nativeQualities, setNativeQualities] = useState([]);
    const [currentNativeQuality, setCurrentNativeQuality] = useState(-1);
    const [nativeAudioTracks, setNativeAudioTracks] = useState([]);
    const [currentNativeAudio, setCurrentNativeAudio] = useState(0);

    // Player UI State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    
    // Settings Menu State ('main', 'audio', 'quality', null)
    const [menuView, setMenuView] = useState(null); 

    useEffect(() => {
        const fetchStreams = async () => {
            setLoading(true);
            try {
                let url = `/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.success && data.streams && data.streams.length > 0) {
                    setSources(data.streams);
                    const initialSource = data.streams[0];
                    const initialLangs = parseLanguages(initialSource.language);
                    setCurrentUrlLanguage(initialLangs[0] || 'Unknown');
                    setCurrentUrlQuality(initialSource.quality);
                    loadStream(initialSource.url);
                } else {
                    let fRes = await fetch(`/api/get-stream?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`);
                    const fData = await fRes.json();
                    if (fData.success && fData.streamUrl) {
                        setSources([{ url: fData.streamUrl, language: 'English', quality: 'Auto', source: fData.provider }]);
                        setCurrentUrlLanguage('English');
                        loadStream(fData.streamUrl);
                    } else {
                        throw new Error("No playable streams found.");
                    }
                }
            } catch (err) {
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
        
        setCurrentUrl(url);
        if (hlsRef.current) hlsRef.current.destroy();

        if (url.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls({ maxMaxBufferLength: 60 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                setLoading(false);
                setNativeQualities(hls.levels.map(l => l.height));
                setCurrentNativeQuality(-1);
                
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    setNativeAudioTracks(hls.audioTracks);
                    setCurrentNativeAudio(hls.audioTrack);
                }
                
                if (currentTime > 0) video.currentTime = currentTime;
                video.play().catch(() => {});
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => setNativeAudioTracks(data.audioTracks));
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => setCurrentNativeAudio(data.id));
            
            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                }
            });
        } else {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                setLoading(false);
                if (currentTime > 0) video.currentTime = currentTime;
                video.play().catch(() => {});
            });
        }
    };

    // --- Dynamic Derived Options (Splitting "Hindi + English") ---
    const hasNativeAudio = nativeAudioTracks.length > 1;
    
    // Extract unique languages from backend URL array
    const urlLanguages = useMemo(() => {
        const langs = new Set();
        sources.forEach(src => parseLanguages(src.language).forEach(l => langs.add(l)));
        return Array.from(langs);
    }, [sources]);

    const hasUrlAudio = urlLanguages.length > 1;

    // Construct Audio Menu Array
    let displayAudioOptions = [];
    if (hasNativeAudio) {
        displayAudioOptions = nativeAudioTracks.map((t, i) => ({
            id: i, label: t.name || t.language || `Track ${i + 1}`, isNative: true
        }));
    } else {
        displayAudioOptions = urlLanguages.map(l => ({
            id: l, label: l, isNative: false
        }));
    }

    const currentAudioLabel = hasNativeAudio 
        ? (nativeAudioTracks[currentNativeAudio]?.name || 'Auto') 
        : currentUrlLanguage;

    // Construct Quality Menu Array
    const hasNativeQuality = nativeQualities.length > 1;
    const urlQualities = [...new Set(sources.map(s => s.quality))];
    const hasUrlQuality = urlQualities.length > 1;
    
    const qualityOptions = hasNativeQuality
        ? [{ id: -1, label: 'Auto' }, ...nativeQualities.map((q, i) => ({ id: i, label: `${q}p` }))]
        : urlQualities.map(q => ({ id: q, label: q === 'Auto' ? 'Best' : q }));
        
    const currentQualityLabel = hasNativeQuality
        ? (currentNativeQuality === -1 ? 'Auto' : `${nativeQualities[currentNativeQuality]}p`)
        : currentUrlQuality;

    // --- Selection Handlers ---
    const selectAudio = (opt) => {
        if (opt.isNative) {
            setCurrentNativeAudio(opt.id);
            if (hlsRef.current) hlsRef.current.audioTrack = opt.id;
        } else {
            setCurrentUrlLanguage(opt.id);
            // Find a source that contains the exact selected language inside its string (e.g. finds "Hindi" inside "Hindi + English")
            let match = sources.find(s => parseLanguages(s.language).includes(opt.id) && s.quality === currentUrlQuality);
            if (!match) match = sources.find(s => parseLanguages(s.language).includes(opt.id));
            
            if (match && match.url !== currentUrl) {
                setLoading(true);
                setCurrentUrlQuality(match.quality);
                loadStream(match.url);
            }
        }
        setMenuView(null);
    };

    const selectQuality = (id) => {
        if (hasNativeQuality) {
            setCurrentNativeQuality(id);
            if (hlsRef.current) hlsRef.current.currentLevel = id;
        } else {
            const targetQual = id;
            let match = sources.find(s => s.quality === targetQual && parseLanguages(s.language).includes(currentUrlLanguage));
            if (!match) match = sources.find(s => s.quality === targetQual);
            if (match && match.url !== currentUrl) {
                setLoading(true);
                const matchLangs = parseLanguages(match.language);
                setCurrentUrlLanguage(matchLangs.includes(currentUrlLanguage) ? currentUrlLanguage : matchLangs[0]);
                setCurrentUrlQuality(match.quality);
                loadStream(match.url);
            }
        }
        setMenuView(null);
    };

    // --- Controls ---
    const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    const seek = (sec) => videoRef.current.currentTime += sec;
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen();
        else document.exitFullscreen();
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && !menuView) setShowControls(false);
        }, 3500);
    };

    // --- Prime Video Nested UI Rendering ---
    const renderRadioButton = (isActive) => (
        <div className={`w-5 h-5 rounded-full border-[2px] flex items-center justify-center transition-all ${isActive ? 'border-[#00A8E1]' : 'border-gray-400'}`}>
            {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#00A8E1]" />}
        </div>
    );

    const renderMenu = () => {
        if (!menuView) return null;

        return (
            <div className="absolute bottom-20 right-8 z-[100] animate-in fade-in zoom-in-95 duration-200 origin-bottom-right">
                <div className="bg-[#0f171e] border border-white/5 rounded-2xl shadow-2xl w-[320px] overflow-hidden text-white font-sans">
                    
                    {/* MAIN MENU */}
                    {menuView === 'main' && (
                        <div className="flex flex-col">
                            <div className="py-4 text-center font-bold text-lg border-b border-white/10">Settings</div>
                            <div className="p-2 space-y-1">
                                <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-colors opacity-50 cursor-not-allowed">
                                    <div className="flex items-center gap-4"><Settings size={22}/> <span className="font-semibold text-[15px]">Subtitles</span></div>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">Off <ChevronRight size={18}/></div>
                                </button>
                                
                                <button onClick={() => setMenuView('audio')} disabled={displayAudioOptions.length <= 1} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50">
                                    <div className="flex items-center gap-4"><Volume2 size={22}/> <span className="font-semibold text-[15px]">Audio</span></div>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">{currentAudioLabel} <ChevronRight size={18}/></div>
                                </button>
                            </div>
                            
                            <button onClick={() => setMenuView('quality')} disabled={!hasNativeQuality && !hasUrlQuality} className="w-full flex items-center justify-between p-4 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 mt-1">
                                <div className="flex items-center gap-4"><Settings size={22}/> <span className="font-bold text-[15px]">Video Quality</span></div>
                                <div className="flex items-center gap-2 text-gray-600 text-sm font-bold">{currentQualityLabel} <ChevronRight size={18}/></div>
                            </button>
                        </div>
                    )}

                    {/* AUDIO SUB-MENU */}
                    {menuView === 'audio' && (
                        <div className="flex flex-col max-h-[400px]">
                            <button onClick={() => setMenuView('main')} className="flex items-center gap-3 p-4 font-bold text-lg hover:bg-white/5 border-b border-white/10 transition">
                                <ChevronLeft size={24}/> Audio Languages
                            </button>
                            <div className="overflow-y-auto p-2">
                                {displayAudioOptions.map((opt, idx) => {
                                    const isActive = opt.isNative ? currentNativeAudio === opt.id : currentUrlLanguage === opt.id;
                                    return (
                                        <button key={idx} onClick={() => selectAudio(opt)} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            {renderRadioButton(isActive)}
                                            <div className="flex flex-col text-left">
                                                <span className={`text-[15px] ${isActive ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>{opt.label}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* QUALITY SUB-MENU */}
                    {menuView === 'quality' && (
                        <div className="flex flex-col max-h-[400px]">
                            <button onClick={() => setMenuView('main')} className="flex items-center gap-3 p-4 font-bold text-lg hover:bg-white/5 border-b border-white/10 transition">
                                <ChevronLeft size={24}/> Video Quality
                            </button>
                            <div className="overflow-y-auto p-2">
                                {qualityOptions.map((opt, idx) => {
                                    const isActive = hasNativeQuality ? currentNativeQuality === opt.id : currentUrlQuality === opt.id;
                                    return (
                                        <button key={idx} onClick={() => selectQuality(opt.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            {renderRadioButton(isActive)}
                                            <div className="flex flex-col text-left">
                                                <span className={`text-[15px] ${isActive ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>{opt.label}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div ref={playerContainerRef} className="fixed inset-0 bg-black z-[999] flex items-center justify-center font-sans" onMouseMove={handleMouseMove} onMouseLeave={() => setShowControls(false)}>
            
            {/* Header */}
            <div className={`absolute top-0 left-0 w-full p-6 z-50 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={onClose} className="text-white hover:text-[#00A8E1] transition flex items-center gap-2 font-bold text-lg drop-shadow-md">
                    <ArrowLeft size={28} /> Back
                </button>
            </div>

            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/60 backdrop-blur-sm">
                    <Loader className="animate-spin text-[#00A8E1] mb-4" size={48} />
                    <p className="text-white font-bold tracking-widest text-sm uppercase drop-shadow-md">Optimizing Stream</p>
                </div>
            )}
            
            {error && (
                <div className="absolute z-50 bg-[#19222b] border border-white/10 p-8 rounded-2xl text-center max-w-md shadow-2xl">
                    <p className="text-white font-bold mb-2 text-xl">Playback Error</p>
                    <p className="text-gray-400 text-sm mb-6">{error}</p>
                    <button onClick={onClose} className="bg-[#00A8E1] hover:bg-[#008ebf] text-white px-8 py-3 rounded-lg font-bold transition">Close Player</button>
                </div>
            )}

            <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => { if (menuView) setMenuView(null); else togglePlay(); }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                playsInline
            />

            {renderMenu()}

            {/* Controls Bar */}
            <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent px-8 pb-8 pt-24 transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                
                {/* Timeline */}
                <div className="flex items-center gap-4 mb-6 group cursor-pointer pointer-events-auto">
                    <span className="text-white text-sm font-medium w-12 text-right">{formatTime(currentTime)}</span>
                    <input 
                        type="range" min="0" max={duration || 100} value={currentTime} 
                        onChange={(e) => { const newTime = parseFloat(e.target.value); videoRef.current.currentTime = newTime; setCurrentTime(newTime); }}
                        className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#00A8E1] group-hover:h-2.5 transition-all"
                    />
                    <span className="text-white text-sm font-medium w-12">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between pointer-events-auto">
                    <div className="flex items-center gap-8 text-white">
                        <button onClick={togglePlay} className="hover:text-[#00A8E1] hover:scale-110 transition drop-shadow-lg">
                            {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
                        </button>
                        <button onClick={() => seek(-10)} className="hover:text-white text-gray-300 hover:scale-110 transition"><SkipBack size={26} /></button>
                        <button onClick={() => seek(10)} className="hover:text-white text-gray-300 hover:scale-110 transition"><SkipForward size={26} /></button>
                        
                        <div className="flex items-center gap-2 group relative">
                            <button onClick={() => { setIsMuted(!isMuted); videoRef.current.muted = !isMuted; }} className="hover:text-[#00A8E1] text-gray-300 transition">
                                {isMuted || volume === 0 ? <VolumeX size={26} /> : <Volume2 size={26} />}
                            </button>
                            <input 
                                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} 
                                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); videoRef.current.volume = v; setIsMuted(v===0); }}
                                className="w-24 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#00A8E1] opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-white">
                        {displayAudioOptions.length > 1 && (
                            <button onClick={() => setMenuView(menuView === 'audio' ? null : 'audio')} className={`transition hover:scale-110 ${menuView === 'audio' ? 'text-[#00A8E1]' : 'text-gray-300 hover:text-white'}`}>
                                <Volume2 size={24} />
                            </button>
                        )}
                        
                        <button onClick={() => setMenuView(menuView === 'main' ? null : 'main')} className={`transition hover:scale-110 ${menuView === 'main' || menuView === 'quality' ? 'text-[#00A8E1]' : 'text-gray-300 hover:text-white'}`}>
                            <Settings size={24} />
                        </button>

                        <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition hover:scale-110 ml-2">
                            <Maximize size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrimePlayer;
