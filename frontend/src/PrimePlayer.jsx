import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';

const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
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

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [sources, setSources] = useState([]);

    const [currentUrl, setCurrentUrl] = useState('');
    const [currentUrlLanguage, setCurrentUrlLanguage] = useState('English');
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

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // ── Stream loader ──────────────────────────────────────────────────────
    const loadStream = (rawUrl) => {
        const video = videoRef.current;
        if (!video) return;

        setError(null);
        setLoading(true);
        setCurrentUrl(rawUrl);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const isM3u8 = rawUrl.includes('.m3u8');
        const proxiedUrl = rawUrl.startsWith('/api/proxy')
            ? rawUrl
            : `/api/proxy?url=${encodeURIComponent(rawUrl)}`;

        if (isM3u8 && Hls.isSupported()) {
            const hls = new Hls({
                maxMaxBufferLength: 60,
                xhrSetup: (xhr, url) => {
                    if (!url.includes('/api/proxy')) {
                        xhr.open('GET', `/api/proxy?url=${encodeURIComponent(url)}`, true);
                    }
                },
            });
            hlsRef.current = hls;
            hls.loadSource(proxiedUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                const levels = hls.levels
                    .map((l, i) => ({ id: i, height: l.height || 0 }))
                    .sort((a, b) => b.height - a.height);
                setNativeQualities(levels);
                setCurrentNativeQuality(-1);

                const tracks = (hls.audioTracks && hls.audioTracks.length > 0)
                    ? hls.audioTracks
                    : [{ id: 0, name: 'English', language: 'en' }];
                setNativeAudioTracks(tracks);

                const engTrack = tracks.find(t =>
                    (t.language || '').toLowerCase().startsWith('en') ||
                    (t.name || '').toLowerCase().includes('english')
                );
                if (engTrack) {
                    hls.audioTrack = engTrack.id;
                    setCurrentNativeAudio(engTrack.id);
                }

                video.play().catch(() => {});
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                if (data.audioTracks?.length) setNativeAudioTracks(data.audioTracks);
            });
            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => setCurrentNativeAudio(data.id));

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                    else {
                        setError('Stream unavailable. Try another source.');
                        setLoading(false);
                    }
                }
            });
        } else if (isM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedUrl;
            video.addEventListener('loadedmetadata', () => {
                setLoading(false);
                video.play().catch(() => {});
            }, { once: true });
        } else {
            // MP4 / MKV
            video.src = proxiedUrl;
            const onMeta = () => {
                setLoading(false);
                setNativeAudioTracks([{ id: 0, name: 'Default', language: 'und' }]);
                setCurrentNativeAudio(0);
                video.play().catch(() => {});
            };
            const onErr = () => {
                setError('Could not play this stream. It may be offline or unsupported.');
                setLoading(false);
            };
            video.addEventListener('loadedmetadata', onMeta, { once: true });
            video.addEventListener('error', onErr, { once: true });
        }
    };

    // ── Fetch streams on mount ─────────────────────────────────────────────
    useEffect(() => {
        if (!tmdbId) return;

        const fetchStreams = async () => {
            setLoading(true);
            setError(null);
            setSources([]);
            setNativeQualities([]);
            setNativeAudioTracks([]);

            // Try each API in sequence, stop on first success
            const apis = [
                () => fetch(`/api/get-stream?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`)
                    .then(r => r.json())
                    .then(d => d.success && d.streamUrl ? d.streamUrl : null),
                () => fetch(`/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success && d.streams?.length) {
                            setSources(d.streams);
                            const best = d.streams.find(s => /english/i.test(s.language)) || d.streams[0];
                            setCurrentUrlLanguage(parseLanguages(best.language)[0] || 'English');
                            setCurrentUrlQuality(best.quality || 'Auto');
                            return best.url;
                        }
                        return null;
                    }),
                () => fetch(`/api/nuvio-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success && d.streams?.length) {
                            setSources(d.streams);
                            setCurrentUrlLanguage('Hindi + English');
                            setCurrentUrlQuality(d.streams[0].quality || 'Auto');
                            return d.streams[0].url;
                        }
                        return null;
                    }),
            ];

            for (const api of apis) {
                try {
                    const url = await api();
                    if (url) { loadStream(url); return; }
                } catch (_) { /* try next */ }
            }

            setError('No streams found for this title. It may not be available right now.');
            setLoading(false);
        };

        fetchStreams();

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
            clearTimeout(controlsTimeoutRef.current);
        };
    }, [tmdbId, mediaType, season, episode]);

    // ── Computed display values ────────────────────────────────────────────
    const hasNativeAudio = nativeAudioTracks.length > 0;
    const urlLanguages = useMemo(() => {
        const s = new Set();
        sources.forEach(src => parseLanguages(src.language).forEach(l => s.add(l)));
        return Array.from(s);
    }, [sources]);

    let displayAudioOptions = hasNativeAudio
        ? nativeAudioTracks.map(t => ({ id: t.id, label: t.name || t.language || `Track ${t.id}`, isNative: true }))
        : urlLanguages.map(l => ({ id: l, label: l, isNative: false }));
    if (!displayAudioOptions.length)
        displayAudioOptions = [{ id: 'default', label: 'Default', isNative: false }];

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
        ? (currentNativeQuality === -1 ? 'Good' : `${nativeQualities.find(q => q.id === currentNativeQuality)?.height || ''}p`)
        : (currentUrlQuality === 'Auto' ? 'Good' : currentUrlQuality);

    // ── Action handlers ────────────────────────────────────────────────────
    const selectAudio = (opt) => {
        setActivePanel('none');
        if (opt.isNative && hlsRef.current) {
            hlsRef.current.audioTrack = opt.id;
            setCurrentNativeAudio(opt.id);
            const video = videoRef.current;
            if (video && !video.paused) {
                const t = video.currentTime;
                video.pause();
                video.currentTime = Math.max(0, t - 0.05);
                setTimeout(() => video.play().catch(() => {}), 100);
            }
            showToast(`Audio: ${opt.label}`);
        } else if (!opt.isNative) {
            setCurrentUrlLanguage(opt.id);
            const match = sources.find(s =>
                parseLanguages(s.language).map(l => l.toLowerCase()).includes(opt.id.toLowerCase()) &&
                s.url !== currentUrl
            );
            if (match) { loadStream(match.url); showToast(`Audio: ${opt.label}`); }
            else showToast(`No separate ${opt.label} stream available`);
        }
    };

    const selectQuality = (id) => {
        setActivePanel('none');
        if (hasNativeQuality && hlsRef.current) {
            setCurrentNativeQuality(id);
            hlsRef.current.currentLevel = id;
            showToast(id === -1 ? 'Quality: Auto (Best)' : `Quality: ${nativeQualities.find(q => q.id === id)?.height}p`);
        } else {
            const match = sources.find(s => s.quality === id) || sources[0];
            if (match && match.url !== currentUrl) {
                setCurrentUrlLanguage(parseLanguages(match.language)[0] || 'Unknown');
                setCurrentUrlQuality(match.quality);
                loadStream(match.url);
            }
        }
    };

    const togglePlay = (e) => {
        if (e) e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
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
    const togglePanel = (name, e) => { e.stopPropagation(); setActivePanel(activePanel === name ? 'none' : name); };

    // ── Sub-panel back-nav ─────────────────────────────────────────────────
    // Settings -> sub panels use a slide stack
    const isPanelOpen = (name) => activePanel === name;

    // SVG icons matching Amazon Prime Video style
    const SubtitleIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
            <rect x="2" y="5" width="20" height="15" rx="2"/>
            <line x1="6" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="16" x2="14" y2="16"/>
        </svg>
    );
    const AudioIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
            <rect x="2" y="6" width="4" height="12" rx="1"/>
            <rect x="8" y="3" width="4" height="18" rx="1"/>
            <rect x="14" y="8" width="4" height="10" rx="1"/>
            <rect x="20" y="10" width="2" height="6" rx="1"/>
        </svg>
    );
    const QualityIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="8" y1="20" x2="8" y2="22"/>
            <line x1="16" y1="20" x2="16" y2="22"/>
            <line x1="5" y1="22" x2="19" y2="22"/>
        </svg>
    );
    const ChevronRight = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14,opacity:0.5}}>
            <polyline points="9 18 15 12 9 6"/>
        </svg>
    );
    const ChevronLeft = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
            <polyline points="15 18 9 12 15 6"/>
        </svg>
    );

    return (
        <div
            id="pp-root"
            ref={playerContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
            onClick={closeAll}
        >
            <style>{`
                #pp-root {
                    position: absolute; inset: 0; width: 100vw; height: 100vh;
                    background: #000; color: #fff;
                    font-family: 'Amazon Ember', Arial, sans-serif;
                    overflow: hidden; user-select: none; z-index: 9999;
                }
                #pp-video-area { position: absolute; inset: 0; z-index: 1; cursor: pointer; }
                #pp-root video { width: 100%; height: 100%; object-fit: contain; }

                /* Controls fade */
                .pp-fade { transition: opacity 0.25s ease; }
                .pp-hide { opacity: 0; pointer-events: none; }
                .pp-show { opacity: 1; pointer-events: auto; }

                /* Top bar */
                #pp-topbar {
                    position: absolute; top: 0; left: 0; right: 0; z-index: 20;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 20px;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
                }
                #pp-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
                #pp-topbar-left { display: flex; align-items: center; gap: 12px; }
                #pp-topbar-right { display: flex; align-items: center; gap: 2px; }

                .pp-icon-btn {
                    background: none; border: none; color: #fff; cursor: pointer;
                    padding: 8px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    transition: background 0.15s;
                }
                .pp-icon-btn:hover { background: rgba(255,255,255,0.12); }
                .pp-icon-btn.active { background: rgba(255,255,255,0.18); }
                .pp-icon-btn svg { width: 22px; height: 22px; }

                /* Bottom controls */
                #pp-controls {
                    position: absolute; bottom: 0; left: 0; right: 0; z-index: 20;
                    padding: 48px 0 28px 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
                }
                #pp-scrubber-row { display: flex; align-items: center; gap: 12px; padding: 0 20px; margin-bottom: 16px; }
                #pp-scrubber-track {
                    flex: 1; height: 3px; background: rgba(255,255,255,0.3);
                    border-radius: 2px; cursor: pointer; position: relative;
                    transition: height 0.15s;
                }
                #pp-scrubber-track:hover { height: 5px; }
                #pp-scrubber-fill { height: 100%; background: #fff; border-radius: 2px; position: relative; pointer-events: none; }
                #pp-scrubber-thumb {
                    position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
                    width: 10px; height: 10px; background: #fff; border-radius: 50%;
                }
                .pp-time { font-size: 13px; color: #fff; min-width: 42px; font-variant-numeric: tabular-nums; }
                .pp-time-right { text-align: right; }

                #pp-btn-row { display: flex; align-items: center; justify-content: center; gap: 24px; }
                .pp-ctrl-btn {
                    background: none; border: none; color: #fff; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 50%; padding: 6px;
                    transition: background 0.15s, transform 0.1s;
                }
                .pp-ctrl-btn:hover { background: rgba(255,255,255,0.1); }
                .pp-ctrl-btn:active { transform: scale(0.9); }
                .pp-ctrl-btn svg { width: 36px; height: 36px; }
                #pp-play-btn {
                    width: 56px; height: 56px; padding: 0;
                    background: rgba(255,255,255,0.95) !important;
                }
                #pp-play-btn:hover { background: #fff !important; }
                #pp-play-btn svg { width: 22px; height: 22px; color: #000; }

                /* ─── Settings panel stack ─────────────────────────────── */
                /* Overlay backdrop — only when a panel is open */
                #pp-panel-backdrop {
                    position: absolute; inset: 0; z-index: 30;
                    background: transparent;
                    display: none;
                }
                #pp-panel-backdrop.open { display: block; }

                /* Panel container — sits at top-right like Amazon Prime */
                .pp-panel {
                    position: absolute; top: 60px; right: 16px;
                    width: 300px;
                    background: rgba(18, 22, 28, 0.92);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    overflow: hidden;
                    z-index: 40;
                    display: none;
                    animation: pp-slide-down 0.16s ease;
                }
                .pp-panel.open { display: block; }
                @keyframes pp-slide-down {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* Panel header (title bar) */
                .pp-panel-header {
                    padding: 14px 20px 12px;
                    font-size: 16px; font-weight: 600;
                    text-align: center;
                    color: #fff;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    position: relative;
                }
                .pp-panel-back {
                    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; color: #fff; cursor: pointer;
                    display: flex; align-items: center; padding: 4px; border-radius: 4px;
                }
                .pp-panel-back:hover { background: rgba(255,255,255,0.1); }

                /* Settings rows */
                .pp-setting-row {
                    display: flex; align-items: center;
                    padding: 15px 20px; gap: 14px; cursor: pointer;
                    transition: background 0.12s;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    color: #fff;
                }
                .pp-setting-row:last-child { border-bottom: none; }
                .pp-setting-row:hover { background: rgba(255,255,255,0.07); }

                .pp-setting-label { flex: 1; font-size: 15px; font-weight: 500; }
                .pp-setting-value {
                    display: flex; align-items: center; gap: 5px;
                    font-size: 14px; color: rgba(255,255,255,0.5);
                }

                /* Divider line (between Audio and Video Quality in main settings) */
                .pp-divider { height: 1px; background: rgba(255,255,255,0.12); margin: 0; }

                /* Radio options in sub-panels */
                .pp-radio-row {
                    display: flex; align-items: center;
                    padding: 13px 20px; gap: 14px; cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    transition: background 0.12s;
                }
                .pp-radio-row:last-child { border-bottom: none; }
                .pp-radio-row:hover { background: rgba(255,255,255,0.07); }
                .pp-radio-dot {
                    width: 20px; height: 20px; border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.4);
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0; transition: border-color 0.15s;
                }
                .pp-radio-dot.selected { border-color: #1a98ff; background: #1a98ff; }
                .pp-radio-dot.selected::after {
                    content: ''; width: 8px; height: 8px;
                    background: #fff; border-radius: 50%;
                }
                .pp-radio-label { font-size: 15px; font-weight: 400; color: #fff; }

                /* Volume popup */
                #pp-vol-popup { padding: 16px 20px; }
                #pp-vol-popup label { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 10px; }
                #pp-vol-slider {
                    width: 100%; -webkit-appearance: none; height: 4px;
                    background: rgba(255,255,255,0.25); border-radius: 2px;
                    outline: none; cursor: pointer;
                }
                #pp-vol-slider::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 14px; height: 14px;
                    background: #fff; border-radius: 50%;
                }

                /* Toast */
                #pp-toast {
                    position: absolute; top: 72px; left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8); color: #fff;
                    padding: 10px 20px; border-radius: 6px;
                    font-size: 13px; font-weight: 600;
                    z-index: 100; pointer-events: none;
                    border: 1px solid rgba(255,255,255,0.15);
                    white-space: nowrap;
                }

                /* Loading spinner */
                @keyframes pp-spin { to { transform: rotate(360deg); } }
                .pp-spinner {
                    width: 40px; height: 40px;
                    border: 3px solid rgba(255,255,255,0.2);
                    border-top-color: #1a98ff;
                    border-radius: 50%;
                    animation: pp-spin 0.9s linear infinite;
                }
            `}</style>

            {/* Toast */}
            {toastMessage && <div id="pp-toast">{toastMessage}</div>}

            {/* Loading */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)'
                }}>
                    <div className="pp-spinner" />
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div style={{
                    position: 'absolute', zIndex: 50, left: '50%', top: '50%',
                    transform: 'translate(-50%,-50%)',
                    background: 'rgba(18,22,28,0.96)', padding: '28px 32px',
                    borderRadius: '10px', textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.12)',
                    maxWidth: '380px', width: '90vw'
                }}>
                    <div style={{fontSize: 32, marginBottom: 12}}>⚠</div>
                    <p style={{fontWeight: 700, fontSize: 17, marginBottom: 8}}>Playback Error</p>
                    <p style={{color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 20, lineHeight: 1.5}}>{error}</p>
                    <button onClick={onClose} style={{
                        background: '#1a98ff', color: '#fff', border: 'none',
                        padding: '10px 28px', borderRadius: '5px',
                        cursor: 'pointer', fontWeight: 700, fontSize: 14
                    }}>Close Player</button>
                </div>
            )}

            {/* Video */}
            <div id="pp-video-area" onClick={togglePlay}>
                <video
                    ref={videoRef}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    playsInline
                />
            </div>

            {/* Panel backdrop (click outside to close) */}
            <div
                id="pp-panel-backdrop"
                className={activePanel !== 'none' ? 'open' : ''}
                onClick={closeAll}
            />

            {/* ── Top bar ── */}
            <div id="pp-topbar" className={`pp-fade ${showControls || activePanel !== 'none' ? 'pp-show' : 'pp-hide'}`}>
                <div id="pp-topbar-left">
                    <button className="pp-icon-btn" onClick={onClose} style={{borderRadius: 4, padding: 4}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                    <span id="pp-title">{title}</span>
                </div>
                <div id="pp-topbar-right">
                    {/* Subtitles */}
                    <button className={`pp-icon-btn ${isPanelOpen('subtitles') ? 'active' : ''}`} onClick={e => togglePanel('subtitles', e)} title="Subtitles">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="15" rx="2"/>
                            <line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/>
                        </svg>
                    </button>
                    {/* Volume */}
                    <button className={`pp-icon-btn ${isPanelOpen('volume') ? 'active' : ''}`} onClick={e => togglePanel('volume', e)} title="Volume">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {isMuted || volume === 0
                                ? <><line x1="1" y1="1" x2="23" y2="23"/><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></>
                                : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                            }
                        </svg>
                    </button>
                    {/* PiP */}
                    <button className="pp-icon-btn" onClick={togglePiP} title="Picture in Picture">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none"/>
                        </svg>
                    </button>
                    {/* Fullscreen */}
                    <button className="pp-icon-btn" onClick={toggleFullscreen} title="Fullscreen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9"/>
                            <polyline points="9 21 3 21 3 15"/>
                            <line x1="21" y1="3" x2="14" y2="10"/>
                            <line x1="3" y1="21" x2="10" y2="14"/>
                        </svg>
                    </button>
                    {/* Settings (three dots) */}
                    <button className={`pp-icon-btn ${isPanelOpen('settings') ? 'active' : ''}`} onClick={e => togglePanel('settings', e)} title="Settings"
                        style={{background: isPanelOpen('settings') ? 'rgba(255,255,255,0.18)' : undefined, borderRadius: '50%'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.8"/>
                            <circle cx="12" cy="12" r="1.8"/>
                            <circle cx="12" cy="19" r="1.8"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Bottom controls ── */}
            <div id="pp-controls" className={`pp-fade ${showControls || activePanel !== 'none' ? 'pp-show' : 'pp-hide'}`}>
                <div id="pp-scrubber-row">
                    <span className="pp-time">{formatTime(currentTime)}</span>
                    <div id="pp-scrubber-track" onClick={scrubTo}>
                        <div id="pp-scrubber-fill" style={{width: `${(currentTime / (duration || 1)) * 100}%`}}>
                            <div id="pp-scrubber-thumb" />
                        </div>
                    </div>
                    <span className="pp-time pp-time-right">{formatTime(duration)}</span>
                </div>
                <div id="pp-btn-row">
                    <button className="pp-ctrl-btn" onClick={skipBack}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.5 3c4.69 0 8.5 3.81 8.5 8.5H23l-4 4-4-4h3c0-3.58-2.92-6.5-6.5-6.5S5 7.92 5 11.5 7.92 18 11.5 18c1.56 0 2.99-.55 4.11-1.47l1.42 1.42C15.13 19.37 13.41 20 11.5 20 6.81 20 3 16.19 3 11.5S6.81 3 11.5 3z"/>
                            <text x="11.5" y="14.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                    <button className="pp-ctrl-btn" id="pp-play-btn" onClick={togglePlay}>
                        {!isPlaying
                            ? <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
                            : <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
                        }
                    </button>
                    <button className="pp-ctrl-btn" onClick={skipFwd}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.5 3C7.81 3 4 6.81 4 11.5H1l4 4 4-4H6c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5c-1.56 0-2.99-.55-4.11-1.47l-1.42 1.42C8.87 19.37 10.59 20 12.5 20c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3z"/>
                            <text x="12.5" y="14.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                SETTINGS PANEL (Main) — matches screenshot
                Transparent dark bg, centered "Settings" title,
                icon + label + value + chevron rows, divider
            ════════════════════════════════════════════ */}
            <div className={`pp-panel ${isPanelOpen('settings') ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="pp-panel-header">Settings</div>

                {/* Subtitles row */}
                <div className="pp-setting-row" onClick={() => setActivePanel('subtitles')}>
                    <SubtitleIcon />
                    <span className="pp-setting-label">Subtitles</span>
                    <span className="pp-setting-value">{currentSubtitles} <ChevronRight /></span>
                </div>

                {/* Audio row */}
                <div className="pp-setting-row" onClick={() => setActivePanel('audio')}>
                    <AudioIcon />
                    <span className="pp-setting-label">Audio</span>
                    <span className="pp-setting-value">{currentAudioLabel} <ChevronRight /></span>
                </div>

                {/* Divider — matches the separator line in screenshot */}
                <div className="pp-divider" />

                {/* Video Quality row */}
                <div className="pp-setting-row" onClick={() => setActivePanel('quality')}>
                    <QualityIcon />
                    <span className="pp-setting-label">Video Quality</span>
                    <span className="pp-setting-value">{currentQualityLabel} <ChevronRight /></span>
                </div>
            </div>

            {/* ── Audio sub-panel ── */}
            <div className={`pp-panel ${isPanelOpen('audio') ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="pp-panel-header">
                    <button className="pp-panel-back" onClick={() => setActivePanel('settings')}>
                        <ChevronLeft />
                    </button>
                    Audio
                </div>
                <div style={{maxHeight: 280, overflowY: 'auto'}}>
                    {displayAudioOptions.map((opt, idx) => {
                        const isActive = opt.isNative ? currentNativeAudio === opt.id : currentUrlLanguage === opt.id;
                        return (
                            <div key={idx} className="pp-radio-row" onClick={() => selectAudio(opt)}>
                                <div className={`pp-radio-dot ${isActive ? 'selected' : ''}`} />
                                <span className="pp-radio-label">{opt.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Quality sub-panel ── */}
            <div className={`pp-panel ${isPanelOpen('quality') ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="pp-panel-header">
                    <button className="pp-panel-back" onClick={() => setActivePanel('settings')}>
                        <ChevronLeft />
                    </button>
                    Video Quality
                </div>
                <div style={{maxHeight: 280, overflowY: 'auto'}}>
                    {qualityOptions.map((q, idx) => {
                        const isActive = hasNativeQuality ? currentNativeQuality === q.id : currentUrlQuality === q.id;
                        return (
                            <div key={idx} className="pp-radio-row" onClick={() => selectQuality(q.id)}>
                                <div className={`pp-radio-dot ${isActive ? 'selected' : ''}`} />
                                <span className="pp-radio-label">{q.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Subtitles sub-panel ── */}
            <div className={`pp-panel ${isPanelOpen('subtitles') ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="pp-panel-header">
                    <button className="pp-panel-back" onClick={() => setActivePanel('settings')}>
                        <ChevronLeft />
                    </button>
                    Subtitles
                </div>
                <div style={{maxHeight: 280, overflowY: 'auto'}}>
                    {['Off', 'English', 'Hindi', 'Spanish', 'French'].map((sub, idx) => (
                        <div key={idx} className="pp-radio-row" onClick={() => { setCurrentSubtitles(sub); setActivePanel('none'); }}>
                            <div className={`pp-radio-dot ${currentSubtitles === sub ? 'selected' : ''}`} />
                            <span className="pp-radio-label">{sub}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Volume popup ── */}
            <div className={`pp-panel ${isPanelOpen('volume') ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div id="pp-vol-popup">
                    <label>Volume</label>
                    <input
                        id="pp-vol-slider" type="range" min="0" max="100"
                        value={isMuted ? 0 : Math.round(volume * 100)}
                        step="1"
                        style={{background: `linear-gradient(to right, #fff ${isMuted ? 0 : Math.round(volume*100)}%, rgba(255,255,255,0.25) ${isMuted ? 0 : Math.round(volume*100)}%)`}}
                        onChange={e => {
                            const val = parseFloat(e.target.value) / 100;
                            setVolume(val);
                            if (videoRef.current) videoRef.current.volume = val;
                            setIsMuted(val === 0);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PrimePlayer;
