import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
};

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose, title = "Prime Video" }) => {
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // Stream State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Native HLS Tracks (From Vidsrc.pro m3u8)
    const [nativeQualities, setNativeQualities] = useState([]);
    const [currentNativeQuality, setCurrentNativeQuality] = useState(-1);
    const [nativeAudioTracks, setNativeAudioTracks] = useState([]);
    const [currentNativeAudio, setCurrentNativeAudio] = useState(0);

    // Playback & UI State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [activePanel, setActivePanel] = useState('none');

    useEffect(() => {
        const fetchVidsrcStream = async () => {
            setLoading(true);
            try {
                // Call our new backend route
                const res = await fetch(`/api/vidsrc?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`);
                const data = await res.json();

                if (data.success && data.streamUrl) {
                    loadStream(data.streamUrl);
                } else {
                    throw new Error("Could not extract stream from Vidsrc.");
                }
            } catch (err) {
                setError(err.message || "Failed to load stream.");
                setLoading(false);
            }
        };

        if (tmdbId) fetchVidsrcStream();

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
            clearTimeout(controlsTimeoutRef.current);
        };
    }, [tmdbId, mediaType, season, episode]);

    const loadStream = (url) => {
        const video = videoRef.current;
        if (!video) return;
        
        setError(null);
        if (hlsRef.current) hlsRef.current.destroy();

        if (Hls.isSupported() && url.includes('.m3u8')) {
            const hls = new Hls({ maxMaxBufferLength: 60 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                
                // 1. Extract Qualities
                const availableLevels = hls.levels.map((l, idx) => ({ id: idx, height: l.height })).sort((a, b) => b.height - a.height); 
                setNativeQualities(availableLevels);
                setCurrentNativeQuality(-1); // Auto
                
                // 2. Extract Multiple Audio Tracks Natively
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    setNativeAudioTracks(hls.audioTracks);
                    
                    // Force Hindi to play by default if available
                    let defaultTrackId = hls.audioTrack;
                    const hindiTrack = hls.audioTracks.find(t => 
                        t.language?.toLowerCase() === 'hi' || 
                        t.language?.toLowerCase() === 'hin' || 
                        t.name?.toLowerCase().includes('hindi')
                    );
                    
                    if (hindiTrack) {
                        defaultTrackId = hindiTrack.id;
                        hls.audioTrack = hindiTrack.id; // Tell HLS engine to switch audio instantly
                    }
                    setCurrentNativeAudio(defaultTrackId);
                }
                
                video.play().catch(() => console.log("Autoplay blocked"));
            });

            // Keep UI Synced with Native Track Switches
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => setNativeAudioTracks(data.audioTracks));
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => setCurrentNativeAudio(data.id));
            
            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                }
            });
        }
    };

    // --- Dynamic UI Formatters ---
    const currentAudioLabel = nativeAudioTracks.find(t => t.id === currentNativeAudio)?.name || 
                              nativeAudioTracks.find(t => t.id === currentNativeAudio)?.language || 
                              'Default';

    const currentQualityLabel = currentNativeQuality === -1 
        ? 'Best' 
        : `${nativeQualities.find(q => q.id === currentNativeQuality)?.height}p`;

    // --- Action Handlers ---
    const selectAudio = (trackId) => {
        setCurrentNativeAudio(trackId);
        // INSTANT NATIVE SWITCH - No reloading video, no buffering!
        if (hlsRef.current) hlsRef.current.audioTrack = trackId; 
        setActivePanel('none');
    };

    const selectQuality = (levelId) => {
        setCurrentNativeQuality(levelId);
        if (hlsRef.current) hlsRef.current.currentLevel = levelId;
        setActivePanel('none');
    };

    const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    const skipBack = () => videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    const skipFwd = () => videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
    
    const scrubTo = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = Math.round(pct * duration);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen();
        else document.exitFullscreen();
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && activePanel === 'none') setShowControls(false);
        }, 3500);
    };

    const closeAll = (e) => {
        if(e) e.stopPropagation();
        setActivePanel('none');
    };

    return (
        <div 
            id="player" 
            ref={playerContainerRef} 
            onMouseMove={handleMouseMove} 
            onMouseLeave={() => setShowControls(false)}
            onClick={closeAll}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Amazon+Ember:wght@400;700&display=swap');
                
                #player {
                    --bg: #000;
                    --panel-bg: #1a1d21;
                    --panel-border: #2e3239;
                    --text-primary: #fff;
                    --text-secondary: #8b8f97;
                    --accent-blue: #1a98ff;
                    --hover-bg: rgba(255,255,255,0.08);
                    --active-bg: rgba(255,255,255,0.12);
                    --scrubber-bar: #fff;
                    --scrubber-track: rgba(255,255,255,0.3);
                    --dot-color: rgba(255,255,255,0.5);
                    
                    background: var(--bg);
                    color: var(--text-primary);
                    font-family: 'Amazon Ember', 'Arial', sans-serif;
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    overflow: hidden;
                    user-select: none;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                }

                #video-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1; }
                #video-click-area { position: absolute; inset: 0; z-index: 2; cursor: pointer; }

                #topbar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; z-index: 10; transition: opacity 0.3s; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); }
                #topbar-left { display: flex; align-items: center; gap: 14px; }
                #close-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; transition: background 0.15s; }
                #close-btn:hover { background: var(--hover-bg); }
                #close-btn svg { width: 20px; height: 20px; }
                #title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }

                #topbar-right { display: flex; align-items: center; gap: 4px; }
                .icon-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
                .icon-btn:hover { background: var(--hover-bg); }
                .icon-btn.active { background: var(--active-bg); }
                .icon-btn svg { width: 22px; height: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }

                #controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 0 28px 0; z-index: 10; transition: opacity 0.3s; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); }
                #scrubber-container { padding: 0 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
                #time-current, #time-total { font-size: 13px; font-weight: 400; color: #fff; min-width: 45px; letter-spacing: 0.02em; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
                #time-total { text-align: right; }
                
                #scrubber-track { flex: 1; position: relative; height: 3px; background: var(--scrubber-track); border-radius: 2px; cursor: pointer; transition: height 0.1s; }
                #scrubber-container:hover #scrubber-track { height: 5px; margin-top: -1px; }
                #scrubber-filled { height: 100%; background: var(--scrubber-bar); border-radius: 2px; position: relative; pointer-events: none; }
                #scrubber-thumb { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; background: #fff; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.2s; }
                #scrubber-container:hover #scrubber-thumb { opacity: 1; }

                #playback-controls { display: flex; align-items: center; justify-content: center; gap: 20px; }
                .ctrl-btn { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.15s, transform 0.1s; padding: 6px; }
                .ctrl-btn:hover { background: var(--hover-bg); }
                .ctrl-btn:active { transform: scale(0.9); }
                .ctrl-btn svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
                #play-pause-btn { width: 56px; height: 56px; background: rgba(255,255,255,0.95) !important; border-radius: 50%; }
                #play-pause-btn:hover { background: rgba(255,255,255,1) !important; transform: scale(1.05); }
                #play-pause-btn svg { color: #000; width: 24px; height: 24px; filter: none; }

                .panel-base { position: absolute; top: 60px; right: 16px; width: 320px; background: var(--panel-bg); border-radius: 8px; overflow: hidden; z-index: 100; animation: slideDown 0.18s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                
                .panel-header { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--panel-border); font-size: 16px; font-weight: 600; gap: 12px; }
                .panel-back-btn { background: none; border: none; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; padding: 2px; border-radius: 4px; }
                .panel-back-btn:hover { background: var(--hover-bg); }
                .panel-back-btn svg { width: 18px; height: 18px; }

                .settings-row { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 16px; }
                .settings-row:last-child { border-bottom: none; }
                .settings-row:hover { background: var(--hover-bg); }
                .settings-row svg { width: 20px; height: 20px; color: var(--text-primary); flex-shrink: 0; }
                .settings-row-label { flex: 1; font-size: 15px; font-weight: 500; }
                .settings-row-value { font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; text-transform: capitalize; }
                .settings-row-value svg { width: 14px; height: 14px; color: var(--text-secondary); }

                .radio-option { display: flex; align-items: flex-start; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .radio-option:hover { background: var(--hover-bg); }
                .radio-circle { width: 20px; height: 20px; border: 2px solid var(--text-secondary); border-radius: 50%; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s; }
                .radio-circle.selected { border-color: var(--accent-blue); background: var(--accent-blue); }
                .radio-circle.selected::after { content: ''; width: 8px; height: 8px; background: #fff; border-radius: 50%; }
                .radio-label { font-size: 15px; font-weight: 500; text-transform: capitalize; }

                .quality-option { display: flex; align-items: flex-start; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .quality-option.selected { background: rgba(255,255,255,0.95); border-radius: 6px; margin: 4px; }
                .quality-option.selected .radio-label { color: #000; }
                .quality-option.selected .radio-circle.selected { border-color: #000; background: #000; }
                .quality-option:hover:not(.selected) { background: var(--hover-bg); }
            `}</style>

            {loading && (
                <div style={{position:'absolute', inset:0, zIndex:5, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)'}}>
                    <div style={{width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#1a98ff', borderRadius:'50%', animation:'spin 1s linear infinite'}} />
                </div>
            )}

            {error && (
                <div style={{position:'absolute', zIndex:5, left:'50%', top:'50%', transform:'translate(-50%, -50%)', background:'#1a1d21', padding:'24px', borderRadius:'8px', textAlign:'center', border:'1px solid #2e3239'}}>
                    <p style={{fontWeight:'bold', fontSize:'18px', marginBottom:'8px'}}>Playback Error</p>
                    <p style={{color:'#8b8f97', fontSize:'14px', marginBottom:'20px'}}>{error}</p>
                    <button onClick={onClose} style={{background:'#1a98ff', color:'#fff', border:'none', padding:'10px 24px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>Close Player</button>
                </div>
            )}

            <video 
                id="video-layer" 
                ref={videoRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                playsInline
            />
            
            <div id="video-click-area" onClick={() => { if(activePanel !== 'none') setActivePanel('none'); else togglePlay(); }} />

            <div id="topbar" style={{ opacity: showControls || activePanel !== 'none' ? 1 : 0, pointerEvents: showControls || activePanel !== 'none' ? 'auto' : 'none' }}>
                <div id="topbar-left">
                    <button id="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                    <span id="title">{title}</span>
                </div>
                <div id="topbar-right">
                    <button className={`icon-btn ${activePanel === 'audio' ? 'active' : ''}`} onClick={(e) => {e.stopPropagation(); setActivePanel(activePanel==='audio' ? 'none' : 'audio')}} title="Audio">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="6" width="4" height="12" rx="1"/><rect x="8" y="3" width="4" height="18" rx="1"/><rect x="14" y="8" width="4" height="10" rx="1"/>
                        </svg>
                    </button>
                    <button className={`icon-btn ${activePanel === 'settings' ? 'active' : ''}`} onClick={(e) => {e.stopPropagation(); setActivePanel(activePanel==='settings' ? 'none' : 'settings')}} title="Settings">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div id="controls" style={{ opacity: showControls || activePanel !== 'none' ? 1 : 0, pointerEvents: showControls || activePanel !== 'none' ? 'auto' : 'none' }}>
                <div id="scrubber-container">
                    <span id="time-current">{formatTime(currentTime)}</span>
                    <div id="scrubber-track" onClick={scrubTo}>
                        <div id="scrubber-filled" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                            <div id="scrubber-thumb"></div>
                        </div>
                    </div>
                    <span id="time-total">{formatTime(duration)}</span>
                </div>

                <div id="playback-controls">
                    <button className="ctrl-btn" onClick={skipBack} title="Back 10 seconds">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                            <path d="M12.5 3C7.81 3 4 6.81 4 11.5H1l4 4 4-4H6c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5c-1.56 0-2.99-.55-4.11-1.47l-1.42 1.42C8.87 19.37 10.59 20 12.5 20c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3z"/>
                            <text x="12.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                    <button className="ctrl-btn" id="play-pause-btn" onClick={togglePlay} title="Play/Pause">
                        {!isPlaying ? (
                            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
                        )}
                    </button>
                    <button className="ctrl-btn" onClick={skipFwd} title="Forward 10 seconds">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                            <path d="M11.5 3c4.69 0 8.5 3.81 8.5 8.5H23l-4 4-4-4h3c0-3.58-2.92-6.5-6.5-6.5S5 7.92 5 11.5 7.92 18 11.5 18c1.56 0 2.99-.55 4.11-1.47l1.42 1.42C15.13 19.37 13.41 20 11.5 20 6.81 20 3 16.19 3 11.5S6.81 3 11.5 3z"/>
                            <text x="11.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* MAIN SETTINGS PANEL */}
            {activePanel === 'settings' && (
                <div className="panel-base" onClick={(e) => e.stopPropagation()}>
                    <div className="panel-header">Settings</div>
                    <div className="settings-row" onClick={() => setActivePanel('audio')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="6" width="4" height="12" rx="1"/><rect x="8" y="3" width="4" height="18" rx="1"/><rect x="14" y="8" width="4" height="10" rx="1"/>
                        </svg>
                        <span className="settings-row-label">Audio Languages</span>
                        <span className="settings-row-value">{currentAudioLabel} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                    </div>
                    <div className="settings-row" onClick={() => setActivePanel('quality')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="20" x2="8" y2="22"/><line x1="16" y1="20" x2="16" y2="22"/><line x1="5" y1="22" x2="19" y2="22"/>
                        </svg>
                        <span className="settings-row-label">Video Quality</span>
                        <span className="settings-row-value">{currentQualityLabel} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                    </div>
                </div>
            )}

            {/* AUDIO SUB-PANEL */}
            {activePanel === 'audio' && (
                <div className="panel-base" onClick={(e) => e.stopPropagation()}>
                    <div className="panel-header">
                        <button className="panel-back-btn" onClick={() => setActivePanel('settings')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        Audio
                    </div>
                    <div style={{maxHeight:'250px', overflowY:'auto'}}>
                        {nativeAudioTracks.length === 0 && <div style={{padding:'16px 20px', color:'#8b8f97', fontSize:'14px'}}>Only default audio available</div>}
                        {nativeAudioTracks.map((opt) => (
                            <div key={opt.id} className="radio-option" onClick={() => selectAudio(opt.id)}>
                                <div className={`radio-circle ${currentNativeAudio === opt.id ? 'selected' : ''}`}></div>
                                <div>
                                    <div className="radio-label">{opt.name || opt.language || `Track ${opt.id}`}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* QUALITY SUB-PANEL */}
            {activePanel === 'quality' && (
                <div className="panel-base" onClick={(e) => e.stopPropagation()}>
                    <div className="panel-header">
                        <button className="panel-back-btn" onClick={() => setActivePanel('settings')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        Video Quality
                    </div>
                    <div style={{maxHeight:'350px', overflowY:'auto', paddingBottom:'8px'}}>
                        <div className={`quality-option ${currentNativeQuality === -1 ? 'selected' : ''}`} onClick={() => selectQuality(-1)}>
                            <div className={`radio-circle ${currentNativeQuality === -1 ? 'selected' : ''}`}></div>
                            <div>
                                <div className="radio-label">Best (Auto)</div>
                            </div>
                        </div>
                        {nativeQualities.map((opt) => (
                            <div key={opt.id} className={`quality-option ${currentNativeQuality === opt.id ? 'selected' : ''}`} onClick={() => selectQuality(opt.id)}>
                                <div className={`radio-circle ${currentNativeQuality === opt.id ? 'selected' : ''}`}></div>
                                <div>
                                    <div className="radio-label">{opt.height}p</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrimePlayer;
