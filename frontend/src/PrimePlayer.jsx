import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
};

const parseLanguages = (langStr) => {
    if (!langStr) return ['Unknown'];
    return langStr.split(/(?:\+|\||,|and|&|\/)/i).map(l => l.trim()).filter(Boolean);
};

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose, title = "Prime Video" }) => {
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const sourcesRef = useRef([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [sources, setSources] = useState([]);
    
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentUrlLanguage, setCurrentUrlLanguage] = useState('');
    const [currentUrlQuality, setCurrentUrlQuality] = useState('Auto');

    const [nativeQualities, setNativeQualities] = useState([]);
    const [currentNativeQuality, setCurrentNativeQuality] = useState(-1);
    const [nativeAudioTracks, setNativeAudioTracks] = useState([]);
    const [currentNativeAudio, setCurrentNativeAudio] = useState(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    
    const [activePanel, setActivePanel] = useState('none');
    const [currentSubtitles, setCurrentSubtitles] = useState('Off');
    const [adToggle, setAdToggle] = useState(false);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 5000);
    };

    useEffect(() => {
        const fetchStreams = async () => {
            setLoading(true);
            try {
                // Priority 1: Native HLS Streams (Vidsrc/Embed.su)
                let fRes = await fetch(`/api/get-stream?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`);
                const fData = await fRes.json();
                
                if (fData.success && fData.streamUrl) {
                    loadStream(fData.streamUrl);
                    return;
                }

                // Priority 2: Fallback Multi-Stream
                let mRes = await fetch(`/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`);
                const mData = await mRes.json();

                if (mData.success && mData.streams && mData.streams.length > 0) {
                    setSources(mData.streams);
                    sourcesRef.current = mData.streams;
                    let defaultSource = mData.streams.find(s => s.language?.toLowerCase().includes('english')) || mData.streams[0]; 
                    
                    const initialLangs = parseLanguages(defaultSource.language);
                    let defaultUiLang = initialLangs[0] || 'Unknown';
                    const isDual = defaultSource.language.includes('+') || defaultSource.language.toLowerCase().includes('dual');
                    if (isDual) defaultUiLang = 'Hindi';

                    setCurrentUrlLanguage(defaultUiLang);
                    setCurrentUrlQuality(defaultSource.quality || 'Auto');
                    loadStream(defaultSource.url);
                    return;
                }

                throw new Error("No playable streams found across any provider.");
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

    const loadStream = (rawUrl) => {
        const video = videoRef.current;
        if (!video) return;
        
        setError(null);
        setLoading(true);
        setCurrentUrl(rawUrl);
        if (hlsRef.current) hlsRef.current.destroy();

        const proxiedUrl = rawUrl.includes('/api/proxy') ? rawUrl : `/api/proxy?url=${encodeURIComponent(rawUrl)}`;

        // Decode proxy-wrapped URLs to check the original for HLS detection
        let originalUrl = rawUrl;
        if (rawUrl.includes('/api/proxy?url=')) {
            try {
                const params = new URLSearchParams(rawUrl.split('?').slice(1).join('?'));
                originalUrl = decodeURIComponent(params.get('url') || rawUrl);
            } catch (_) {}
        }
        const isHls = Hls.isSupported() && originalUrl.includes('.m3u8');

        if (isHls) {
            const hls = new Hls({ 
                maxMaxBufferLength: 60,
                xhrSetup: (xhr, url) => {
                    if (!url.includes('/api/proxy')) xhr.open('GET', `/api/proxy?url=${encodeURIComponent(url)}`, true);
                }
            });
            
            hlsRef.current = hls;
            hls.loadSource(proxiedUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                const availableLevels = hls.levels.map((l, idx) => ({ id: idx, height: l.height || 'Unknown' })).sort((a, b) => b.height - a.height); 
                setNativeQualities(availableLevels);
                setCurrentNativeQuality(-1);
                
                // FIXED: Always create audio track options
                let audioTracks = [];
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    audioTracks = hls.audioTracks;
                } else {
                    // Fallback: Create default options if HLS doesn't expose tracks
                    audioTracks = [
                        { id: 0, name: 'English', language: 'en' },
                        { id: 1, name: 'Hindi', language: 'hi' }
                    ];
                }
                
                setNativeAudioTracks(audioTracks);
                
                // Auto-select English if available
                const engTrack = audioTracks.find(t => 
                    t.language?.toLowerCase() === 'en' || 
                    t.language?.toLowerCase() === 'eng' || 
                    t.name?.toLowerCase().includes('english')
                );
                if (engTrack && hls) {
                    hls.audioTrack = engTrack.id;
                    setCurrentNativeAudio(engTrack.id);
                }
                
                if (currentTime > 0) video.currentTime = currentTime;
                video.play().catch(() => {});
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => {
                if (data.audioTracks && data.audioTracks.length > 0) {
                    setNativeAudioTracks(data.audioTracks);
                }
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => setCurrentNativeAudio(data.id));
            
            hls.on(Hls.Events.ERROR, (e, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, retrying...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, recovering...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal error:', data);
                            // Try next source from multi-stream fallback list
                            const nextSrc = sourcesRef.current.find(s => s.url !== rawUrl);
                            if (nextSrc) {
                                console.log('HLS fatal: trying fallback source', nextSrc.source);
                                loadStream(nextSrc.url);
                            } else {
                                setError('Stream failed to load. The source may be offline or unavailable.');
                                setLoading(false);
                            }
                            break;
                    }
                }
            });
        } else {
            video.src = proxiedUrl;
            
            const handleLoadedMetadata = () => {
                setLoading(false);
                // Create default audio options for MP4/non-HLS
                setNativeAudioTracks([
                    { id: 0, name: 'Default Audio', language: 'und' }
                ]);
                setCurrentNativeAudio(0);
                if (currentTime > 0) video.currentTime = currentTime;
                video.play().catch(() => {});
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            };
            
            const handleError = () => {
                const errorMsg = `Stream loading failed. Status: ${video.error?.code || 'Unknown'}. ${video.error?.message || ''}`;
                console.error(errorMsg);
                video.removeEventListener('error', handleError);
                // Try next source from multi-stream fallback list
                const nextSrc = sourcesRef.current.find(s => s.url !== rawUrl);
                if (nextSrc) {
                    console.log('MP4 error: trying fallback source', nextSrc.source);
                    loadStream(nextSrc.url);
                } else {
                    setError('Stream is currently offline or unsupported. Try another quality/language.');
                    setLoading(false);
                }
            };
            
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('error', handleError);
        }
    };

    // --- Dynamic Options Maps ---
    const hasNativeAudio = nativeAudioTracks && nativeAudioTracks.length > 0;
    const urlLanguages = useMemo(() => {
        const langs = new Set();
        sources.forEach(src => parseLanguages(src.language).forEach(l => langs.add(l)));
        return Array.from(langs);
    }, [sources]);

    let displayAudioOptions = [];

    if (hasNativeAudio) {
        // Show native HLS audio tracks
        displayAudioOptions = nativeAudioTracks.map(t => ({ 
            id: t.id, 
            label: t.name || t.language || `Track ${t.id}`, 
            isNative: true 
        }));
    } 

    if (displayAudioOptions.length === 0 && urlLanguages.length > 0) {
        // Fallback to URL-based languages
        displayAudioOptions = urlLanguages.map(l => ({ id: l, label: l, isNative: false }));
    }

    if (displayAudioOptions.length === 0) {
        // Last resort: show default
        displayAudioOptions = [{ id: 'default', label: 'Default Audio', isNative: false }];
    }

    const currentAudioLabel = hasNativeAudio 
        ? (nativeAudioTracks.find(t => t.id === currentNativeAudio)?.name || 
           nativeAudioTracks.find(t => t.id === currentNativeAudio)?.language || 'Auto') 
        : currentUrlLanguage;

    const hasNativeQuality = nativeQualities.length > 1;
    const urlQualities = [...new Set(sources.map(s => s.quality))];
    
    const qualityOptions = hasNativeQuality
        ? [{ id: -1, label: 'Best' }, ...nativeQualities.map(q => ({ id: q.id, label: `${q.height}p` }))]
        : urlQualities.map(q => ({ id: q, label: q === 'Auto' ? 'Best' : q }));
        
    const currentQualityLabel = hasNativeQuality
        ? (currentNativeQuality === -1 ? 'Best' : `${nativeQualities.find(q => q.id === currentNativeQuality)?.height}p`)
        : currentUrlQuality;

    // --- Action Handlers ---
    const selectAudio = (opt) => {
        if (opt.isNative) {
            // Native HLS audio track switching
            showToast(`🔄 Switching to ${opt.label}...`);
            setCurrentNativeAudio(opt.id);
            
            if (hlsRef.current) {
                try {
                    hlsRef.current.audioTrack = opt.id;
                    
                    // Proper buffer flush: pause, seek back, play
                    const video = videoRef.current;
                    if (video && !video.paused) {
                        const currentTimeVal = video.currentTime;
                        video.pause();
                        video.currentTime = Math.max(0, currentTimeVal - 0.05);
                        
                        setTimeout(() => {
                            video.play().catch(err => console.log('Play failed:', err));
                            showToast(`✅ Switched to ${opt.label}`);
                        }, 100);
                    } else {
                        showToast(`✅ Switched to ${opt.label}`);
                    }
                } catch (err) {
                    console.error('Audio switch error:', err);
                    showToast(`❌ Failed to switch audio: ${err.message}`);
                }
            }
            setActivePanel('none');
        } else {
            // URL-based language switching for multi-source
            showToast(`🔄 Switching to ${opt.id}...`);
            setCurrentUrlLanguage(opt.id);
            
            const pureStreams = sources.filter(s => {
                const langs = parseLanguages(s.language).map(l => l.toLowerCase());
                return langs.length === 1 && langs[0] === opt.id.toLowerCase();
            });

            let targetStream = pureStreams.find(s => s.quality === currentUrlQuality) || pureStreams[0];
            
            if (!targetStream) {
                const mixedStreams = sources.filter(s => 
                    parseLanguages(s.language).map(l => l.toLowerCase()).includes(opt.id.toLowerCase()) && 
                    s.url !== currentUrl
                );
                targetStream = mixedStreams.find(s => s.quality === currentUrlQuality) || mixedStreams[0];
            }
            
            if (targetStream && targetStream.url !== currentUrl) {
                setLoading(true);
                setCurrentUrlQuality(targetStream.quality || 'Auto');
                loadStream(targetStream.url);
                showToast(`✅ Switched to ${opt.id}`);
            } else {
                showToast(`⚠️ No ${opt.id} stream available. Showing available options.`);
            }
            setActivePanel('none');
        }
    };

    const selectQuality = (id) => {
        if (hasNativeQuality) {
            setCurrentNativeQuality(id);
            if (hlsRef.current) hlsRef.current.currentLevel = id;
        } else {
            let match = sources.find(s => s.quality === id && parseLanguages(s.language).includes(currentUrlLanguage));
            if (!match) match = sources.find(s => s.quality === id);
            if (match && match.url !== currentUrl) {
                setLoading(true);
                setCurrentUrlLanguage(parseLanguages(match.language)[0] || 'Unknown');
                setCurrentUrlQuality(match.quality);
                loadStream(match.url);
            }
        }
        setActivePanel('none');
    };

    const togglePlay = (e) => {
        if (e) e.stopPropagation();
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
    };

    const skipBack = (e) => { e.stopPropagation(); videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); };
    const skipFwd = (e) => { e.stopPropagation(); videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); };
    
    const scrubTo = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = Math.round(pct * duration);
    };

    const toggleFullscreen = (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen();
        else document.exitFullscreen();
    };

    const togglePiP = (e) => {
        e.stopPropagation();
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else if (document.pictureInPictureEnabled) videoRef.current.requestPictureInPicture();
    };

    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && activePanel === 'none') setShowControls(false);
        }, 3000);
    };

    const closeAll = () => setActivePanel('none');

    const togglePanel = (panelName, e) => {
        e.stopPropagation();
        setActivePanel(activePanel === panelName ? 'none' : panelName);
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
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                :root {
                    --bg: #000;
                    --panel-bg: rgba(26, 29, 33, 0.75);
                    --panel-border: rgba(255, 255, 255, 0.08);
                    --text-primary: #fff;
                    --text-secondary: #8b8f97;
                    --accent-blue: #1a98ff;
                    --hover-bg: rgba(255,255,255,0.08);
                    --active-bg: rgba(255,255,255,0.12);
                    --scrubber-bar: #fff;
                    --scrubber-track: rgba(255,255,255,0.3);
                    --dot-color: rgba(255,255,255,0.5);
                }
                #player {
                    position: absolute; inset: 0; width: 100vw; height: 100vh;
                    background: var(--bg); color: var(--text-primary);
                    font-family: 'Amazon Ember', 'Arial', sans-serif;
                    overflow: hidden; user-select: none; z-index: 9999;
                    display: flex; flex-direction: column;
                }
                
                #video-area {
                    flex: 1; position: absolute; inset: 0; z-index: 1; cursor: pointer;
                }
                video { width: 100%; height: 100%; object-fit: contain; }

                .fade-transition { transition: opacity 0.3s ease; }
                .hidden-controls { opacity: 0; pointer-events: none; }
                .visible-controls { opacity: 1; pointer-events: auto; }

                /* TOP BAR */
                #topbar {
                    position: absolute; top: 0; left: 0; right: 0;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 14px 20px; z-index: 10;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
                }
                #topbar-left { display: flex; align-items: center; gap: 14px; }
                #close-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; transition: background 0.15s; }
                #close-btn:hover { background: var(--hover-bg); }
                #close-btn svg { width: 20px; height: 20px; }
                #title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }

                #topbar-right { display: flex; align-items: center; gap: 4px; }
                .icon-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
                .icon-btn:hover { background: var(--hover-bg); }
                .icon-btn.active { background: var(--active-bg); }
                .icon-btn svg { width: 22px; height: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }

                /* BOTTOM CONTROLS */
                #controls {
                    position: absolute; bottom: 0; left: 0; right: 0;
                    padding: 40px 0 28px 0; z-index: 10;
                    background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                }
                #scrubber-container { padding: 0 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
                #time-current, #time-total { font-size: 13px; font-weight: 400; color: #fff; min-width: 45px; letter-spacing: 0.02em; }
                #time-total { text-align: right; }
                #scrubber-track { flex: 1; position: relative; height: 3px; background: var(--scrubber-track); border-radius: 2px; cursor: pointer; }
                #scrubber-track:hover { height: 5px; margin-top: -1px; }
                #scrubber-filled { height: 100%; background: var(--scrubber-bar); border-radius: 2px; position: relative; pointer-events: none;}
                #scrubber-thumb { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 10px; height: 10px; background: #fff; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5); }
                .chapter-dot { position: absolute; top: 50%; transform: translateY(-50%); width: 4px; height: 4px; background: var(--dot-color); border-radius: 50%; pointer-events: none;}

                #playback-controls { display: flex; align-items: center; justify-content: center; gap: 20px; }
                .ctrl-btn { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.15s, transform 0.1s; padding: 6px; }
                .ctrl-btn:hover { background: var(--hover-bg); }
                .ctrl-btn:active { transform: scale(0.9); }
                #skip-back-btn svg, #skip-fwd-btn svg { width: 36px; height: 36px; }
                #play-pause-btn { width: 56px; height: 56px; background: rgba(255,255,255,0.95) !important; border-radius: 50%; }
                #play-pause-btn:hover { background: rgba(255,255,255,1) !important; }
                #play-pause-btn svg { color: #000; width: 24px; height: 24px; }

                /* PANELS */
                .panel-base { position: absolute; top: 60px; right: 16px; width: 320px; background: var(--panel-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid var(--panel-border); border-radius: 8px; overflow: hidden; z-index: 100; display: none; animation: slideDown 0.18s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
                .panel-base.open { display: block; }
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
                .settings-row-value { font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; text-transform: capitalize;}
                .settings-row-value svg { width: 14px; height: 14px; color: var(--text-secondary); }

                .radio-option { display: flex; align-items: flex-start; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .radio-option:hover { background: var(--hover-bg); }
                .radio-circle { width: 20px; height: 20px; border: 2px solid var(--text-secondary); border-radius: 50%; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s; }
                .radio-circle.selected { border-color: var(--accent-blue); background: var(--accent-blue); }
                .radio-circle.selected::after { content: ''; width: 8px; height: 8px; background: #fff; border-radius: 50%; }
                .radio-label { font-size: 15px; font-weight: 500; text-transform: capitalize; }

                .quality-option { display: flex; align-items: flex-start; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .quality-option:hover { background: var(--hover-bg); }
                .quality-option.selected { background: rgba(255,255,255,0.95); border-radius: 6px; margin: 4px; }
                .quality-option.selected .radio-label { color: #000; }
                .quality-option.selected .radio-circle.selected { border-color: #000; background: #000; }

                .divider { height: 1px; background: var(--panel-border); margin: 0; }
                .extra-setting { display: flex; align-items: center; padding: 14px 20px; gap: 14px; border-top: 1px solid var(--panel-border); cursor:pointer;}
                .extra-setting svg { width: 20px; height: 20px; color: var(--text-secondary); flex-shrink: 0; }
                .extra-setting-label { flex: 1; font-size: 14px; color: var(--text-primary); }
                .extra-setting-value { font-size: 13px; color: var(--text-secondary); }

                .toggle { width: 36px; height: 20px; background: var(--text-secondary); border-radius: 10px; position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
                .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
                .toggle.on { background: var(--accent-blue); }
                .toggle.on::after { transform: translateX(16px); }

                #volume-popup { min-width: 220px; padding: 16px 20px; }
                #volume-popup label { font-size: 14px; color: var(--text-secondary); display: block; margin-bottom: 12px; }
                #volume-slider { width: 100%; -webkit-appearance: none; height: 4px; background: var(--scrubber-track); border-radius: 2px; outline: none; cursor: pointer; }
                #volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #fff; border-radius: 50%; cursor: pointer; }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            {toastMessage && (
                <div style={{
                    position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(229, 9, 20, 0.95)', color: '#fff', padding: '12px 24px', 
                    borderRadius: '8px', zIndex: 10000, fontSize: '14px', fontWeight: 'bold', 
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)', transition: 'opacity 0.3s'
                }}>
                    {toastMessage}
                </div>
            )}

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

            <div id="video-area" onClick={togglePlay}>
                <video 
                    ref={videoRef}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    playsInline
                />
            </div>

            <div id="topbar" className={`fade-transition ${showControls || activePanel !== 'none' ? 'visible-controls' : 'hidden-controls'}`}> 
                <div id="topbar-left">
                    <button id="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                    <span id="title">{title}</span>
                </div>
                <div id="topbar-right">
                    <button className={`icon-btn ${activePanel === 'subtitles' ? 'active' : ''}`} onClick={(e) => togglePanel('subtitles', e)} title="Subtitles">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="15" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/>
                        </svg>
                    </button>
                    <button className={`icon-btn ${activePanel === 'volume' ? 'active' : ''}`} onClick={(e) => togglePanel('volume', e)} title="Volume">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {volume === 0 || isMuted ? <><line x1="1" y1="1" x2="23" y2="23"/><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>}
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={togglePiP} title="Picture in Picture">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none"/>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={toggleFullscreen} title="Fullscreen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {document.fullscreenElement ? <><polyline points="8 3 8 8 3 8"/><polyline points="16 3 16 8 21 8"/><polyline points="8 21 8 16 3 16"/><polyline points="16 21 16 16 21 16"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>} 
                        </svg>
                    </button>
                    <button className={`icon-btn ${activePanel === 'settings' ? 'active' : ''}`} onClick={(e) => togglePanel('settings', e)} title="More">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div id="controls" className={`fade-transition ${showControls || activePanel !== 'none' ? 'visible-controls' : 'hidden-controls'}`}> 
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
                    <button className="ctrl-btn" id="skip-back-btn" onClick={skipBack} title="Back 10 seconds">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.5 3c4.69 0 8.5 3.81 8.5 8.5H23l-4 4-4-4h3c0-3.58-2.92-6.5-6.5-6.5S5 7.92 5 11.5 7.92 18 11.5 18c1.56 0 2.99-.55 4.11-1.47l1.42 1.42C15.13 19.37 13.41 20 11.5 20 6.81 20 3 16.19 3 11.5S6.81 3 11.5 3z"/>
                            <text x="11.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                    <button className="ctrl-btn" id="play-pause-btn" onClick={(e) => togglePlay(e)} title="Play/Pause">
                        {!isPlaying ? (
                            <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
                        ) : (
                            <svg id="icon-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
                        )}
                    </button>
                    <button className="ctrl-btn" id="skip-fwd-btn" onClick={skipFwd} title="Forward 10 seconds">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.5 3C7.81 3 4 6.81 4 11.5H1l4 4 4-4H6c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5c-1.56 0-2.99-.55-4.11-1.47l-1.42 1.42C8.87 19.37 10.59 20 12.5 20c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3z"/>
                            <text x="12.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* SETTINGS MAIN PANEL */}
            <div id="settings-main" className={`panel-base ${activePanel === 'settings' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24M19.78 19.78l-4.24-4.24m-3.08-3.08l-4.24-4.24"/>
                    </svg>
                    Settings
                </div>
                <div className="settings-row" onClick={() => setActivePanel('quality')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/>
                    </svg>
                    <span className="settings-row-label">Quality</span>
                    <span className="settings-row-value">{currentQualityLabel} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                </div>
                <div className="settings-row" onClick={() => setActivePanel('audio')}> 
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="4" height="12" rx="1"/><rect x="8" y="3" width="4" height="18" rx="1"/><rect x="14" y="8" width="4" height="10" rx="1"/>
                    </svg>
                    <span className="settings-row-label">Audio</span>
                    <span className="settings-row-value">{currentAudioLabel} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                </div>
                <div className="settings-row" onClick={() => setActivePanel('subtitles')}> 
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="15" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/>
                    </svg>
                    <span className="settings-row-label">Subtitles</span>
                    <span className="settings-row-value">{currentSubtitles} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                </div>
            </div>

            {/* AUDIO SUB-PANEL */}
            <div id="audio-sub" className={`panel-base ${activePanel === 'audio' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}> 
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    Audio
                </div>
                <div style={{maxHeight:'250px', overflowY:'auto'}}>
                    {displayAudioOptions.map((opt, idx) => {
                        const isActive = opt.isNative ? currentNativeAudio === opt.id : currentUrlLanguage === opt.id;
                        return (
                            <div key={idx} className="radio-option" onClick={() => selectAudio(opt)}>
                                <div className={`radio-circle ${isActive ? 'selected' : ''}`}></div>
                                <div>
                                    <div className="radio-label">{opt.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* QUALITY SUB-PANEL */}
            <div id="quality-sub" className={`panel-base ${activePanel === 'quality' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}> 
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    Quality
                </div>
                <div style={{maxHeight:'250px', overflowY:'auto'}}>
                    {qualityOptions.map((q, idx) => {
                        const isActive = hasNativeQuality ? currentNativeQuality === q.id : currentUrlQuality === q.id;
                        return (
                            <div key={idx} className={`quality-option ${isActive ? 'selected' : ''}`} onClick={() => selectQuality(q.id)}>
                                <div className={`radio-circle ${isActive ? 'selected' : ''}`}></div>
                                <div className="radio-label">{q.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SUBTITLES SUB-PANEL */}
            <div id="subtitles-sub" className={`panel-base ${activePanel === 'subtitles' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}> 
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    Subtitles
                </div>
                <div style={{maxHeight:'250px', overflowY:'auto'}}>
                    {['Off', 'English', 'Spanish', 'French'].map((sub, idx) => {
                        const isActive = currentSubtitles === sub;
                        return (
                            <div key={idx} className="radio-option" onClick={() => { setCurrentSubtitles(sub); setActivePanel('none'); }}>
                                <div className={`radio-circle ${isActive ? 'selected' : ''}`}></div>
                                <div className="radio-label">{sub}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* VOLUME POPUP */}
            <div id="volume-popup" className={`panel-base ${activePanel === 'volume' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <label>Volume</label>
                <input 
                    id="volume-slider"
                    type="range" 
                    min="0" 
                    max="100" 
                    value={isMuted ? 0 : volume * 100}
                    style={{background: `linear-gradient(to right, #fff ${isMuted ? 0 : volume*100}%, rgba(255,255,255,0.3) ${isMuted ? 0 : volume*100}%)`}}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value) / 100;
                        setVolume(val);
                        videoRef.current.volume = val;
                        setIsMuted(val === 0);
                    }}
                />
            </div>
        </div>
    );
};

export default PrimePlayer;