import React, { useEffect, useRef, useState, useMemo } from 'react';

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
};

const detectQuality = (filename) => {
    const f = filename.toLowerCase();
    if (f.includes('2160p') || f.includes('4k')) return '4K';
    if (f.includes('1080p')) return '1080p';
    if (f.includes('720p')) return '720p';
    if (f.includes('480p')) return '480p';
    return 'Auto';
};

const detectLanguage = (filename) => {
    const f = filename.toLowerCase();
    if (f.includes('dual') || f.includes('multi')) return 'Dual Audio';
    if (f.includes('hin') || f.includes('hindi')) return 'Hindi';
    if (f.includes('eng') || f.includes('english')) return 'English';
    return 'Unknown'; // Defaults to whatever is embedded in the file
};

const parseLanguages = (langStr) => {
    if (!langStr) return ['Unknown'];
    if (langStr === 'Dual Audio') return ['Hindi', 'English']; // MP4/MKV usually default to Hindi on web
    return langStr.split(/(?:\+|\||,|and|&|\/)/i).map(l => l.trim()).filter(Boolean);
};

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose, title = "Prime Video" }) => {
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [sources, setSources] = useState([]);
    
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentUrlLanguage, setCurrentUrlLanguage] = useState('');
    const [currentUrlQuality, setCurrentUrlQuality] = useState('Auto');

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
        const scrapeDirectDirectory = async () => {
            setLoading(true);
            try {
                // 1. Fetch TMDB to get the exact Title and Year
                const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=cb1dc311039e6ae85db0aa200345cbc5`);
                const tmdbData = await tmdbRes.json();
                
                const exactTitle = tmdbData.title || tmdbData.name || title;
                const releaseYear = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
                
                const baseUrl = 'https://a.111477.xyz';
                let targetFolders = [];

                // 2. Build the precise directory URLs
                if (mediaType === 'tv') {
                    // Try different season folder formats
                    targetFolders = [
                        `${baseUrl}/tvs/${encodeURIComponent(exactTitle)}/Season ${season}/`,
                        `${baseUrl}/tvs/${encodeURIComponent(exactTitle)}/Season ${String(season).padStart(2, '0')}/`,
                        `${baseUrl}/tvs/${exactTitle.replace(/ /g, '%20')}/Season ${season}/`
                    ];
                } else {
                    targetFolders = [
                        `${baseUrl}/movies/${encodeURIComponent(exactTitle)}%20(${releaseYear})/`,
                        `${baseUrl}/movies/${exactTitle.replace(/ /g, '%20')}%20(${releaseYear})/`
                    ];
                }

                let foundFiles = [];

                // 3. Scrape the HTML directory list via Proxy (to bypass CORS)
                for (const folderUrl of targetFolders) {
                    try {
                        const proxyUrl = `/api/proxy?url=${encodeURIComponent(folderUrl)}`;
                        const res = await fetch(proxyUrl);
                        if (!res.ok) continue;
                        
                        const html = await res.text();
                        
                        // Extract all links ending in video extensions
                        const linkRegex = /href="([^"]+\.(mkv|mp4|avi|webm))"/gi;
                        let match;
                        
                        while ((match = linkRegex.exec(html)) !== null) {
                            const rawHref = match[1];
                            const filename = decodeURIComponent(rawHref);
                            
                            // TV Shows: Filter precisely for the requested episode
                            if (mediaType === 'tv') {
                                const epCode1 = `e${String(episode).padStart(2, '0')}`;
                                const epCode2 = `episode ${episode}`;
                                if (!filename.toLowerCase().includes(epCode1) && !filename.toLowerCase().includes(epCode2)) {
                                    continue;
                                }
                            }
                            
                            foundFiles.push({
                                name: filename,
                                url: folderUrl + rawHref, // Combine base path with filename
                                quality: detectQuality(filename),
                                language: detectLanguage(filename)
                            });
                        }
                        
                        if (foundFiles.length > 0) break; // Stop hunting if we found files
                    } catch (e) {
                        console.log("Directory read failed, trying next variant...");
                    }
                }

                if (foundFiles.length === 0) {
                    throw new Error(`Could not locate files for "${exactTitle}" in the server index.`);
                }

                // 4. Sort files by quality (highest first)
                const rank = { '4K': 4, '1080p': 3, '720p': 2, '480p': 1, 'Auto': 0 };
                foundFiles.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));

                setSources(foundFiles);
                
                // 5. Setup defaults
                const defaultSource = foundFiles[0];
                const isDual = defaultSource.language === 'Dual Audio';
                
                setCurrentUrlLanguage(isDual ? 'Hindi' : defaultSource.language);
                setCurrentUrlQuality(defaultSource.quality);
                
                // CRITICAL: Feed the RAW URL (no proxy) directly to the player
                loadStreamDirectly(defaultSource.url);

            } catch (err) {
                setError(err.message || "Failed to locate stream.");
                setLoading(false);
            }
        };

        if (tmdbId) scrapeDirectDirectory();

        return () => clearTimeout(controlsTimeoutRef.current);
    }, [tmdbId, mediaType, season, episode]);

    const loadStreamDirectly = (directUrl) => {
        const video = videoRef.current;
        if (!video) return;
        
        setError(null);
        setLoading(true);
        setCurrentUrl(directUrl);
        
        // We pass the raw URL. Open directories generally do not have CORS limits on direct media streaming.
        video.src = directUrl;
        
        const onMeta = () => {
            setLoading(false);
            video.removeEventListener('error', onErr);
            if (currentTime > 0) video.currentTime = currentTime;
            video.play().catch(() => {});
        };
        
        const onErr = () => {
            video.removeEventListener('loadedmetadata', onMeta);
            setError(`Playback Error: The browser failed to decode this file format (${directUrl.split('.').pop()}). Try another quality or browser.`);
            setLoading(false);
        };

        video.addEventListener('loadedmetadata', onMeta, { once: true });
        video.addEventListener('error', onErr, { once: true });
    };

    // --- Dynamic Options Maps ---
    const urlLanguages = useMemo(() => {
        const langs = new Set();
        sources.forEach(src => {
            if (src.language === 'Dual Audio') { langs.add('Hindi'); langs.add('English'); }
            else if (src.language !== 'Unknown') { langs.add(src.language); }
        });
        if (langs.size === 0) langs.add('Default');
        return Array.from(langs);
    }, [sources]);

    let displayAudioOptions = urlLanguages.map(l => ({ id: l, label: l }));
    const currentAudioLabel = currentUrlLanguage;

    const urlQualities = [...new Set(sources.map(s => s.quality))];
    const qualityOptions = urlQualities.map(q => ({ id: q, label: q === 'Auto' ? 'Best (Auto)' : `${q}` }));
    const currentQualityLabel = currentUrlQuality === 'Auto' ? 'Best' : currentUrlQuality;

    // --- Action Handlers ---
    const selectAudio = (opt) => {
        setActivePanel('none');
        
        // Browsers cannot dynamically switch tracks inside a single MKV file using JS.
        // We must find a completely separate video file in the directory that matches the selected language.
        const pureStreams = sources.filter(s => s.language.toLowerCase() === opt.id.toLowerCase());
        let targetStream = pureStreams.find(s => s.quality === currentUrlQuality) || pureStreams[0];
        
        // If no pure stream, try finding a dual audio file
        if (!targetStream) {
            const dualStreams = sources.filter(s => s.language === 'Dual Audio');
            targetStream = dualStreams.find(s => s.quality === currentUrlQuality) || dualStreams[0];
        }
        
        if (targetStream && targetStream.url !== currentUrl) {
            setCurrentUrlLanguage(opt.id);
            setCurrentUrlQuality(targetStream.quality);
            loadStreamDirectly(targetStream.url);
        } else {
            setCurrentUrlLanguage(opt.id); 
            showToast(`Browser Limitation: Browsers cannot switch embedded audio tracks inside a single file. Track 1 will continue playing.`);
        }
    };

    const selectQuality = (id) => {
        setActivePanel('none');
        let validStreams = sources.filter(s => s.quality === id);
        if (validStreams.length === 0) validStreams = sources;
        
        let match = validStreams.find(s => s.language === 'Dual Audio' || s.language === currentUrlLanguage) || validStreams[0];

        if (match && match.url !== currentUrl) {
            setLoading(true);
            setCurrentUrlQuality(match.quality);
            loadStreamDirectly(match.url);
        }
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
                
                #playback-controls { display: flex; align-items: center; justify-content: center; gap: 20px; }
                .ctrl-btn { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.15s, transform 0.1s; padding: 6px; }
                .ctrl-btn:hover { background: var(--hover-bg); }
                .ctrl-btn:active { transform: scale(0.9); }
                #skip-back-btn svg, #skip-fwd-btn svg { width: 36px; height: 36px; }
                #play-pause-btn { width: 56px; height: 56px; background: rgba(255,255,255,0.95) !important; border-radius: 50%; }
                #play-pause-btn:hover { background: rgba(255,255,255,1) !important; }
                #play-pause-btn svg { color: #000; width: 24px; height: 24px; }

                /* PANELS */
                .panel-base { position: absolute; top: 60px; right: 16px; width: 320px; background: var(--panel-bg); border-radius: 8px; overflow: hidden; z-index: 100; display: none; animation: slideDown 0.18s ease; }
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

                #volume-popup { min-width: 220px; padding: 16px 20px; }
                #volume-popup label { font-size: 14px; color: var(--text-secondary); display: block; margin-bottom: 12px; }
                #volume-slider { width: 100%; -webkit-appearance: none; height: 4px; background: var(--scrubber-track); border-radius: 2px; outline: none; cursor: pointer; }
                #volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #fff; border-radius: 50%; cursor: pointer; }
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
                    <p style={{color:'#fff', marginTop:'16px', fontSize:'14px', fontWeight:'bold', letterSpacing:'1px'}}>Locating Files...</p>
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
                {/* Raw MKV/MP4 links fed directly to the browser.
                    We use crossorigin="anonymous" to handle external server requests smoothly.
                */}
                <video 
                    ref={videoRef}
                    crossOrigin="anonymous"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    playsInline
                />
            </div>

            {/* TOP BAR UI */}
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
                            <path d="M12.5 3C7.81 3 4 6.81 4 11.5H1l4 4 4-4H6c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5c-1.56 0-2.99-.55-4.11-1.47l-1.42 1.42C8.87 19.37 10.59 20 12.5 20c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3z"/>
                            <text x="12.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
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
                            <path d="M11.5 3c4.69 0 8.5 3.81 8.5 8.5H23l-4 4-4-4h3c0-3.58-2.92-6.5-6.5-6.5S5 7.92 5 11.5 7.92 18 11.5 18c1.56 0 2.99-.55 4.11-1.47l1.42 1.42C15.13 19.37 13.41 20 11.5 20 6.81 20 3 16.19 3 11.5S6.81 3 11.5 3z"/>
                            <text x="11.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* SETTINGS PANEL */}
            <div id="settings-panel" className={`panel-base ${activePanel === 'settings' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">Settings</div>
                <div className="settings-row" onClick={() => setActivePanel('subtitles')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="15" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/>
                    </svg>
                    <span className="settings-row-label">Subtitles</span>
                    <span className="settings-row-value">{currentSubtitles} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                </div>
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
                        const isActive = currentUrlLanguage === opt.id;
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
                    Video Quality
                </div>
                <div style={{maxHeight:'350px', overflowY:'auto', paddingBottom:'8px'}}>
                    {qualityOptions.map((opt) => {
                        const isActive = currentUrlQuality === opt.id || (opt.id === 'Auto' && currentUrlQuality === 'Auto');
                        return (
                            <div key={opt.id} className={`quality-option ${isActive ? 'selected' : ''}`} onClick={() => selectQuality(opt.id)}>
                                <div className={`radio-circle ${isActive ? 'selected' : ''}`}></div>
                                <div>
                                    <div className="radio-label">{opt.label}</div>
                                </div>
                            </div>
                        )
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
                {['Off', 'English', 'Hindi'].map(sub => (
                    <div key={sub} className="radio-option" onClick={() => { setCurrentSubtitles(sub); setActivePanel('none'); }}>
                        <div className={`radio-circle ${currentSubtitles === sub ? 'selected' : ''}`}></div>
                        <div><div className="radio-label">{sub}</div></div>
                    </div>
                ))}
            </div>

            {/* VOLUME POPUP */}
            <div id="volume-popup" className={`panel-base ${activePanel === 'volume' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <label>Volume</label>
                <input 
                    type="range" id="volume-slider" min="0" max="100" 
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
