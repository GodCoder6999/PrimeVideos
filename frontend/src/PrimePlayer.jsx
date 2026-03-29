import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
};

const parseLanguages = (langStr) => {
    if (!langStr) return ['Unknown'];
    return langStr.split(/(?:\+|\||,|and|&|\/)/i).map(l => l.trim()).filter(Boolean);
};

// Normalize a raw HLS audio track name/language into a clean display label.
// Handles codes like "en", "eng", "hi", "hin", and freeform names.
const normalizeTrackLabel = (track) => {
    const name = (track.name || '').toLowerCase();
    const lang = (track.language || '').toLowerCase();

    if (name.includes('english') || lang === 'en' || lang === 'eng') return 'English';
    if (name.includes('hindi')   || lang === 'hi' || lang === 'hin') return 'Hindi';
    if (name.includes('tamil')   || lang === 'ta' || lang === 'tam') return 'Tamil';
    if (name.includes('telugu')  || lang === 'te' || lang === 'tel') return 'Telugu';
    if (name.includes('kannada') || lang === 'kn' || lang === 'kan') return 'Kannada';
    if (name.includes('malayalam') || lang === 'ml' || lang === 'mal') return 'Malayalam';
    if (name.includes('bengali') || lang === 'bn' || lang === 'ben') return 'Bengali';
    if (name.includes('french')  || lang === 'fr' || lang === 'fre') return 'French';
    if (name.includes('spanish') || lang === 'es' || lang === 'spa') return 'Spanish';
    if (name.includes('german')  || lang === 'de' || lang === 'ger') return 'German';

    // Fall back to the raw name or language code, Title-cased
    const raw = track.name || track.language || `Track ${track.id}`;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
};

// Returns true if a track looks like an English track.
const isEnglishTrack = (track) => {
    const name = (track.name || '').toLowerCase();
    const lang = (track.language || '').toLowerCase();
    return name.includes('english') || lang === 'en' || lang === 'eng' || lang === 'en-us' || lang === 'en-gb';
};

// ─────────────────────────────────────────────────────────────────────────────
// URL validation — only URLs with recognised streaming extensions are sent to
// the video element.  Token-only URLs (like vidsrc BUZZ/TOKEN paths) have no
// extension and cannot be played by a browser directly.
// ─────────────────────────────────────────────────────────────────────────────
const PLAYABLE_EXTENSIONS = /\.(m3u8|mp4|mkv|webm|avi|mov|ts|m4v|ogv)(\?|$)/i;

function isPlayableUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        // Decode in case the URL is already percent-encoded once.
        const decoded = decodeURIComponent(url);
        return PLAYABLE_EXTENSIONS.test(decoded);
    } catch (_) {
        return PLAYABLE_EXTENSIONS.test(url);
    }
}

const PrimePlayer = ({ tmdbId, mediaType = 'movie', season = 1, episode = 1, onClose, title = "Prime Video" }) => {
    const videoRef             = useRef(null);
    const playerContainerRef   = useRef(null);
    const hlsRef               = useRef(null);
    const controlsTimeoutRef   = useRef(null);
    // ── FIX 1: Use a ref for playback time so loadStream always gets the live value,
    //           not a stale React state snapshot from when the closure was created.
    const playbackTimeRef      = useRef(0);

    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);
    const [toastMessage, setToastMessage]     = useState(null);
    const [sources, setSources]               = useState([]);

    // ── FIX 2: currentUrl must actually be kept in sync so "already playing this
    //           URL" guards work correctly.  setCurrentUrl is called inside loadStream.
    const [currentUrl, setCurrentUrl]             = useState('');
    const [currentUrlLanguage, setCurrentUrlLanguage] = useState('');
    const [currentUrlQuality, setCurrentUrlQuality]   = useState('Auto');

    // Native HLS track state
    const [nativeQualities, setNativeQualities]       = useState([]);
    const [currentNativeQuality, setCurrentNativeQuality] = useState(-1);
    const [nativeAudioTracks, setNativeAudioTracks]   = useState([]);
    const [currentNativeAudio, setCurrentNativeAudio] = useState(0);

    // Playback UI state
    const [isPlaying, setIsPlaying]       = useState(false);
    const [currentTime, setCurrentTime]   = useState(0);
    const [duration, setDuration]         = useState(0);
    const [volume, setVolume]             = useState(0.8);
    const [isMuted, setIsMuted]           = useState(false);
    const [showControls, setShowControls] = useState(true);

    const [activePanel, setActivePanel]           = useState('none');
    const [currentSubtitles, setCurrentSubtitles] = useState('Off');

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 6000);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // loadStream
    //   rawUrl   — the unproxied source URL
    //   onFail   — optional callback invoked when the stream cannot be played,
    //              allowing the fetch waterfall to try the next source silently.
    // ─────────────────────────────────────────────────────────────────────────
    const loadStream = useCallback((rawUrl, onFail = null) => {
        const video = videoRef.current;
        if (!video) return;

        const savedTime = playbackTimeRef.current;

        setError(null);
        setLoading(true);
        setNativeAudioTracks([]);
        setNativeQualities([]);
        setCurrentNativeQuality(-1);
        setCurrentUrl(rawUrl);

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const proxiedUrl = rawUrl.includes('/api/proxy')
            ? rawUrl
            : `/api/proxy?url=${encodeURIComponent(rawUrl)}`;

        const handleFail = (reason) => {
            if (onFail) {
                // Silent retry — caller handles the next source.
                onFail(reason);
            } else {
                // Terminal failure — show a clean user-facing message.
                setError(reason || 'This stream is unavailable. Please try again later.');
                setLoading(false);
            }
        };

        if (Hls.isSupported() && rawUrl.includes('.m3u8')) {
            const hls = new Hls({
                maxMaxBufferLength: 60,
                manifestLoadingTimeOut: 10000,
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
                    .map((l, idx) => ({ id: idx, height: l.height || 0 }))
                    .filter(l => l.height > 0)
                    .sort((a, b) => b.height - a.height);
                setNativeQualities(levels);
                setCurrentNativeQuality(-1);

                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    setNativeAudioTracks([...hls.audioTracks]);
                    const engTrack    = hls.audioTracks.find(isEnglishTrack);
                    const targetTrack = engTrack ?? hls.audioTracks[0];
                    hls.audioTrack    = targetTrack.id;
                    setCurrentNativeAudio(targetTrack.id);
                    setCurrentUrlLanguage(normalizeTrackLabel(targetTrack));
                }

                if (savedTime > 2) video.currentTime = savedTime;
                video.play().catch(() => {});
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => {
                if (data?.audioTracks) setNativeAudioTracks([...data.audioTracks]);
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (e, data) => {
                if (data?.id !== undefined) {
                    setCurrentNativeAudio(data.id);
                    const switched = hls.audioTracks?.find(t => t.id === data.id);
                    if (switched) setCurrentUrlLanguage(normalizeTrackLabel(switched));
                }
            });

            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        // One auto-retry for transient network hiccups.
                        hls.startLoad();
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        hls.destroy();
                        handleFail('Stream unavailable — trying next source…');
                    }
                }
            });

        } else {
            // Plain MP4 / MKV / other direct video file.
            video.src = proxiedUrl;

            const onMeta = () => {
                setLoading(false);
                video.removeEventListener('error', onErr);
                if (savedTime > 2) video.currentTime = savedTime;
                video.play().catch(() => {});
            };

            const onErr = () => {
                video.removeEventListener('loadedmetadata', onMeta);
                handleFail('Stream unavailable — trying next source…');
            };

            video.addEventListener('loadedmetadata', onMeta, { once: true });
            video.addEventListener('error', onErr,         { once: true });
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Initial stream fetch — 3-tier waterfall with automatic fallback
    //
    // Tier 1: get-stream  (vidsrc / embed.su HLS)
    //   • Validates the returned URL has a playable extension before using it.
    //   • Token-only URLs (BUZZ/TOKEN, vidsrc iframe keys) are rejected here
    //     and the waterfall drops straight to Tier 2.
    //   • If loadStream fires but the video errors, onFail() triggers Tier 2.
    //
    // Tier 2: multi-stream  (Stremio-addon scrapers, MP4 sources)
    //   • Tries the best English source first.
    //   • If that errors, tries each remaining source in quality order.
    //
    // Tier 3: final error shown to user only if every source failed.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        // Tier 2 helper — tries multi-stream sources in order, auto-advancing
        // on failure until one plays or all are exhausted.
        const tryMultiStream = async () => {
            let mData;
            try {
                const mRes = await fetch(
                    `/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`
                );
                mData = await mRes.json();
            } catch (_) {
                mData = null;
            }

            if (cancelled) return;

            if (!mData?.success || !mData.streams?.length) {
                setError('No streams found for this title. Please try again later.');
                setLoading(false);
                return;
            }

            // Build ordered candidate list: prefer English-only, then by quality.
            const streams = [...mData.streams];
            setSources(streams);

            let idx = 0;

            const tryNext = () => {
                if (cancelled) return;
                if (idx >= streams.length) {
                    setError('All available streams failed to load. Please try again later.');
                    setLoading(false);
                    return;
                }
                const src = streams[idx++];
                const lang = parseLanguages(src.language)[0] || 'Unknown';
                setCurrentUrlLanguage(lang);
                setCurrentUrlQuality(src.quality || 'Auto');
                loadStream(src.url, tryNext); // onFail = tryNext (next candidate)
            };

            tryNext();
        };

        const fetchStreams = async () => {
            setLoading(true);
            setSources([]);
            setCurrentUrl('');
            setCurrentUrlLanguage('');
            setCurrentUrlQuality('Auto');
            playbackTimeRef.current = 0;

            // ── Tier 1: get-stream ───────────────────────────────────────────
            try {
                const fRes  = await fetch(
                    `/api/get-stream?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`
                );
                const fData = await fRes.json();

                if (!cancelled && fData.success && fData.streamUrl) {
                    const url = fData.streamUrl;

                    // CRITICAL FIX: reject token-style URLs that browsers cannot
                    // play — they have no recognised video extension.
                    if (!isPlayableUrl(url)) {
                        console.warn('[PrimePlayer] get-stream returned non-playable URL, skipping to multi-stream');
                        await tryMultiStream();
                        return;
                    }

                    setCurrentUrlLanguage('Loading…');
                    // Pass tryMultiStream as onFail so a video-level error
                    // automatically falls through to Tier 2.
                    loadStream(url, tryMultiStream);
                    return;
                }
            } catch (_) {
                // get-stream network error — fall through.
            }

            if (!cancelled) await tryMultiStream();
        };

        if (tmdbId) fetchStreams();

        return () => {
            cancelled = true;
            if (hlsRef.current) hlsRef.current.destroy();
            clearTimeout(controlsTimeoutRef.current);
        };
    }, [tmdbId, mediaType, season, episode, loadStream]);

    // ─────────────────────────────────────────────────────────────────────────
    // Derived audio / quality option lists
    // ─────────────────────────────────────────────────────────────────────────

    // Whether the active HLS stream exposes multiple switchable audio tracks.
    const hasNativeAudio = nativeAudioTracks.length >= 1; // show even 1 track (so user can see what's playing)

    // All unique languages across all URL-based sources.
    const urlLanguages = useMemo(() => {
        const langs = new Set();
        sources.forEach(src => parseLanguages(src.language).forEach(l => langs.add(l)));
        return Array.from(langs);
    }, [sources]);

    // What to show in the Audio panel.
    const displayAudioOptions = useMemo(() => {
        if (nativeAudioTracks.length >= 1) {
            // Use actual HLS manifest tracks — show every track, labelled properly.
            return nativeAudioTracks.map(t => ({
                id: t.id,
                label: normalizeTrackLabel(t),
                isNative: true,
            }));
        }
        // URL-based language switching (MP4 sources).
        return urlLanguages.map(l => ({ id: l, label: l, isNative: false }));
    }, [nativeAudioTracks, urlLanguages]);

    const currentAudioLabel = useMemo(() => {
        if (nativeAudioTracks.length >= 1) {
            const active = nativeAudioTracks.find(t => t.id === currentNativeAudio);
            return active ? normalizeTrackLabel(active) : 'Auto';
        }
        return currentUrlLanguage || 'Auto';
    }, [nativeAudioTracks, currentNativeAudio, currentUrlLanguage]);

    // Quality options.
    const hasNativeQuality = nativeQualities.length > 0;
    const urlQualities     = [...new Set(sources.map(s => s.quality))];

    const qualityOptions = hasNativeQuality
        ? [{ id: -1, label: 'Best (Auto)' }, ...nativeQualities.map(q => ({ id: q.id, label: `${q.height}p` }))]
        : urlQualities.map(q => ({ id: q, label: q === 'Auto' ? 'Best (Auto)' : q }));

    const currentQualityLabel = hasNativeQuality
        ? (currentNativeQuality === -1 ? 'Best' : `${nativeQualities.find(q => q.id === currentNativeQuality)?.height ?? '?'}p`)
        : (currentUrlQuality === 'Auto' ? 'Best' : currentUrlQuality);

    // ─────────────────────────────────────────────────────────────────────────
    // selectAudio — handles both HLS native tracks and URL-based language switch
    // ─────────────────────────────────────────────────────────────────────────
    const selectAudio = (opt) => {
        setActivePanel('none');

        if (opt.isNative) {
            // ── HLS native track switch ──────────────────────────────────────
            if (hlsRef.current) {
                hlsRef.current.audioTrack = opt.id;

                // Nudge currentTime so the browser flushes the audio buffer
                // and immediately plays the new track (hls.js quirk).
                if (videoRef.current && !videoRef.current.paused) {
                    videoRef.current.currentTime += 0.05;
                }
            }
            setCurrentNativeAudio(opt.id);
            // currentUrlLanguage updated by AUDIO_TRACK_SWITCHED event handler.
            return;
        }

        // ── URL-based language switch (MP4 sources) ──────────────────────────
        const requested = opt.id.toLowerCase();

        // 1. Look for a stream that is ONLY in the requested language at the
        //    current quality level.
        let target = sources.find(s => {
            const langs = parseLanguages(s.language).map(l => l.toLowerCase());
            return langs.length === 1 && langs[0] === requested && s.quality === currentUrlQuality;
        });

        // 2. Same language, any quality.
        if (!target) {
            target = sources.find(s => {
                const langs = parseLanguages(s.language).map(l => l.toLowerCase());
                return langs.length === 1 && langs[0] === requested;
            });
        }

        // 3. A stream that includes the language (e.g. "Hindi + English"),
        //    and is a different URL from what's currently playing.
        if (!target) {
            target = sources.find(s =>
                parseLanguages(s.language).map(l => l.toLowerCase()).includes(requested) &&
                s.url !== currentUrl
            );
        }

        if (target) {
            if (target.url === currentUrl) {
                // Already on the right stream; just update the UI label.
                setCurrentUrlLanguage(opt.id);
                if (target.language.includes('+') || target.language.toLowerCase().includes('dual')) {
                    showToast(`Already playing ${opt.id}. If audio sounds wrong, the stream is dual-audio — the browser picks the default track automatically.`);
                }
            } else {
                setCurrentUrlLanguage(opt.id);
                setCurrentUrlQuality(target.quality || 'Auto');
                loadStream(target.url);
            }
        } else {
            showToast(`No dedicated ${opt.id} stream found. The current stream may contain multiple languages — the browser selects the default track.`);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // selectQuality
    // ─────────────────────────────────────────────────────────────────────────
    const selectQuality = (id) => {
        setActivePanel('none');

        if (hasNativeQuality) {
            // HLS level switch — works even for "Auto" (-1)
            setCurrentNativeQuality(id);
            if (hlsRef.current) hlsRef.current.currentLevel = id;
            return;
        }

        // URL-based quality switch
        const currentLang = currentUrlLanguage.toLowerCase();
        let match = sources.find(s =>
            s.quality === id &&
            parseLanguages(s.language).map(l => l.toLowerCase()).includes(currentLang)
        );
        if (!match) match = sources.find(s => s.quality === id);

        if (match && match.url !== currentUrl) {
            setCurrentUrlLanguage(parseLanguages(match.language)[0] || 'Unknown');
            setCurrentUrlQuality(match.quality);
            loadStream(match.url);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Playback controls
    // ─────────────────────────────────────────────────────────────────────────
    const togglePlay = (e) => {
        if (e) e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.paused ? v.play() : v.pause();
    };

    const skipBack = (e) => {
        e.stopPropagation();
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    };

    const skipFwd = (e) => {
        e.stopPropagation();
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
    };

    const scrubTo = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const pct  = (e.clientX - rect.left) / rect.width;
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

    const closeAll   = () => setActivePanel('none');
    const togglePanel = (name, e) => {
        e.stopPropagation();
        setActivePanel(activePanel === name ? 'none' : name);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
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
                }
                #player {
                    position: absolute; inset: 0; width: 100vw; height: 100vh;
                    background: var(--bg); color: var(--text-primary);
                    font-family: 'Amazon Ember', 'Arial', sans-serif;
                    overflow: hidden; user-select: none; z-index: 9999;
                    display: flex; flex-direction: column;
                }
                #video-area { flex: 1; position: absolute; inset: 0; z-index: 1; cursor: pointer; }
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
                #time-current, #time-total { font-size: 13px; color: #fff; min-width: 45px; letter-spacing: 0.02em; }
                #time-total { text-align: right; }
                #scrubber-track { flex: 1; position: relative; height: 3px; background: var(--scrubber-track); border-radius: 2px; cursor: pointer; transition: height 0.1s; }
                #scrubber-track:hover { height: 5px; }
                #scrubber-filled { height: 100%; background: var(--scrubber-bar); border-radius: 2px; position: relative; pointer-events: none; }
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
                .panel-base { position: absolute; top: 60px; right: 16px; width: 320px; background: var(--panel-bg); border-radius: 8px; overflow: hidden; z-index: 100; display: none; animation: slideDown 0.18s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
                .panel-base.open { display: block; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

                .panel-header { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--panel-border); font-size: 16px; font-weight: 600; gap: 12px; }
                .panel-back-btn { background: none; border: none; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; padding: 2px; border-radius: 4px; }
                .panel-back-btn:hover { background: var(--hover-bg); }
                .panel-back-btn svg { width: 18px; height: 18px; }
                .panel-badge { font-size: 10px; font-weight: 700; background: var(--accent-blue); color: #fff; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; margin-left: auto; }

                .settings-row { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 16px; }
                .settings-row:last-child { border-bottom: none; }
                .settings-row:hover { background: var(--hover-bg); }
                .settings-row svg { width: 20px; height: 20px; flex-shrink: 0; }
                .settings-row-label { flex: 1; font-size: 15px; font-weight: 500; }
                .settings-row-value { font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; }
                .settings-row-value svg { width: 14px; height: 14px; color: var(--text-secondary); }

                .radio-option { display: flex; align-items: center; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .radio-option:last-child { border-bottom: none; }
                .radio-option:hover { background: var(--hover-bg); }
                .radio-option.active-track { background: rgba(26,152,255,0.12); }
                .radio-circle { width: 20px; height: 20px; border: 2px solid var(--text-secondary); border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s; }
                .radio-circle.selected { border-color: var(--accent-blue); background: var(--accent-blue); }
                .radio-circle.selected::after { content: ''; width: 8px; height: 8px; background: #fff; border-radius: 50%; }
                .radio-label { font-size: 15px; font-weight: 500; }
                .radio-sublabel { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

                .quality-option { display: flex; align-items: flex-start; padding: 14px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--panel-border); gap: 14px; }
                .quality-option:last-child { border-bottom: none; }
                .quality-option:hover { background: var(--hover-bg); }

                #volume-popup { padding: 16px 20px; }
                #volume-popup label { font-size: 14px; color: var(--text-secondary); display: block; margin-bottom: 12px; }
                #volume-slider { width: 100%; -webkit-appearance: none; height: 4px; border-radius: 2px; outline: none; cursor: pointer; }
                #volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #fff; border-radius: 50%; cursor: pointer; }

                /* Loading spinner */
                @keyframes spin { to { transform: rotate(360deg); } }
                .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin 0.8s linear infinite; }

                /* Toast */
                .toast { position: absolute; top: 80px; left: 50%; transform: translateX(-50%); background: rgba(26,152,255,0.95); color: #fff; padding: 12px 20px; border-radius: 8px; z-index: 10000; font-size: 13px; font-weight: 600; max-width: 480px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); line-height: 1.4; }
            `}</style>

            {/* Toast */}
            {toastMessage && <div className="toast">{toastMessage}</div>}

            {/* Loading */}
            {loading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                    <div className="spinner" />
                    <p style={{ color: '#fff', marginTop: 16, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', opacity: 0.7 }}>LOADING STREAM…</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ position: 'absolute', zIndex: 5, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: '#1a1d21', padding: 28, borderRadius: 12, textAlign: 'center', border: '1px solid #2e3239', maxWidth: 380 }}>
                    <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Playback Error</p>
                    <p style={{ color: '#8b8f97', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
                    <button onClick={onClose} style={{ background: '#1a98ff', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Close Player</button>
                </div>
            )}

            {/* Video */}
            <div id="video-area" onClick={togglePlay}>
                <video
                    ref={videoRef}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={() => {
                        const t = videoRef.current?.currentTime || 0;
                        setCurrentTime(t);
                        // ── FIX 1: Keep ref in sync for use inside loadStream.
                        playbackTimeRef.current = t;
                    }}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    playsInline
                />
            </div>

            {/* Top bar */}
            <div id="topbar" className={`fade-transition ${showControls || activePanel !== 'none' ? 'visible-controls' : 'hidden-controls'}`}>
                <div id="topbar-left">
                    <button id="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <span id="title">{title}</span>
                </div>
                <div id="topbar-right">
                    {/* Subtitles */}
                    <button className={`icon-btn ${activePanel === 'subtitles' ? 'active' : ''}`} onClick={(e) => togglePanel('subtitles', e)} title="Subtitles">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="15" rx="2" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="6" y1="16" x2="14" y2="16" />
                        </svg>
                    </button>
                    {/* Volume */}
                    <button className={`icon-btn ${activePanel === 'volume' ? 'active' : ''}`} onClick={(e) => togglePanel('volume', e)} title="Volume">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {volume === 0 || isMuted
                                ? <><line x1="1" y1="1" x2="23" y2="23" /><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /></>
                                : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>}
                        </svg>
                    </button>
                    {/* PiP */}
                    <button className="icon-btn" onClick={togglePiP} title="Picture in Picture">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
                        </svg>
                    </button>
                    {/* Fullscreen */}
                    <button className="icon-btn" onClick={toggleFullscreen} title="Fullscreen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {document.fullscreenElement
                                ? <><polyline points="8 3 8 8 3 8" /><polyline points="16 3 16 8 21 8" /><polyline points="8 21 8 16 3 16" /><polyline points="16 21 16 16 21 16" /></>
                                : <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>}
                        </svg>
                    </button>
                    {/* Settings */}
                    <button className={`icon-btn ${activePanel === 'settings' ? 'active' : ''}`} onClick={(e) => togglePanel('settings', e)} title="Settings">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Bottom controls */}
            <div id="controls" className={`fade-transition ${showControls || activePanel !== 'none' ? 'visible-controls' : 'hidden-controls'}`}>
                <div id="scrubber-container">
                    <span id="time-current">{formatTime(currentTime)}</span>
                    <div id="scrubber-track" onClick={scrubTo}>
                        <div id="scrubber-filled" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                            <div id="scrubber-thumb" />
                        </div>
                    </div>
                    <span id="time-total">{formatTime(duration)}</span>
                </div>

                <div id="playback-controls">
                    <button className="ctrl-btn" id="skip-back-btn" onClick={skipBack} title="Back 10s">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.5 3C7.81 3 4 6.81 4 11.5H1l4 4 4-4H6c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5c-1.56 0-2.99-.55-4.11-1.47l-1.42 1.42C8.87 19.37 10.59 20 12.5 20c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3z" />
                            <text x="12.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>

                    <button className="ctrl-btn" id="play-pause-btn" onClick={togglePlay} title="Play/Pause">
                        {!isPlaying
                            ? <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                            : <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>}
                    </button>

                    <button className="ctrl-btn" id="skip-fwd-btn" onClick={skipFwd} title="Forward 10s">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.5 3c4.69 0 8.5 3.81 8.5 8.5H23l-4 4-4-4h3c0-3.58-2.92-6.5-6.5-6.5S5 7.92 5 11.5 7.92 18 11.5 18c1.56 0 2.99-.55 4.11-1.47l1.42 1.42C15.13 19.37 13.41 20 11.5 20 6.81 20 3 16.19 3 11.5S6.81 3 11.5 3z" />
                            <text x="11.5" y="14.5" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Arial" fill="currentColor">10</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── SETTINGS panel ───────────────────────────────────────────── */}
            <div id="settings-panel" className={`panel-base ${activePanel === 'settings' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">Settings</div>

                <div className="settings-row" onClick={() => setActivePanel('subtitles')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="15" rx="2" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="6" y1="16" x2="14" y2="16" />
                    </svg>
                    <span className="settings-row-label">Subtitles</span>
                    <span className="settings-row-value">{currentSubtitles}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                </div>

                <div className="settings-row" onClick={() => setActivePanel('audio')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="4" height="12" rx="1" /><rect x="8" y="3" width="4" height="18" rx="1" /><rect x="14" y="8" width="4" height="10" rx="1" />
                    </svg>
                    <span className="settings-row-label">Audio Language</span>
                    <span className="settings-row-value">{currentAudioLabel}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                </div>

                <div className="settings-row" onClick={() => setActivePanel('quality')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" /><line x1="8" y1="20" x2="8" y2="22" /><line x1="16" y1="20" x2="16" y2="22" /><line x1="5" y1="22" x2="19" y2="22" />
                    </svg>
                    <span className="settings-row-label">Video Quality</span>
                    <span className="settings-row-value">{currentQualityLabel}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                </div>
            </div>

            {/* ── AUDIO panel ──────────────────────────────────────────────── */}
            <div id="audio-sub" className={`panel-base ${activePanel === 'audio' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    Audio Language
                    {nativeAudioTracks.length >= 1 && (
                        <span className="panel-badge">HLS</span>
                    )}
                </div>

                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {displayAudioOptions.length === 0 ? (
                        <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
                            Only one audio language is available in this stream.
                        </div>
                    ) : (
                        displayAudioOptions.map((opt, idx) => {
                            const isActive = opt.isNative
                                ? currentNativeAudio === opt.id
                                : currentUrlLanguage?.toLowerCase() === opt.id?.toLowerCase();

                            return (
                                <div
                                    key={`${opt.id}-${idx}`}
                                    className={`radio-option ${isActive ? 'active-track' : ''}`}
                                    onClick={() => selectAudio(opt)}
                                >
                                    <div className={`radio-circle ${isActive ? 'selected' : ''}`} />
                                    <div>
                                        <div className="radio-label">{opt.label}</div>
                                        {opt.isNative && (
                                            <div className="radio-sublabel">Native HLS track</div>
                                        )}
                                        {!opt.isNative && sources.find(s => parseLanguages(s.language).map(l => l.toLowerCase()).includes(opt.id?.toLowerCase()))?.source && (
                                            <div className="radio-sublabel">
                                                {sources.find(s => parseLanguages(s.language).map(l => l.toLowerCase()).includes(opt.id?.toLowerCase()))?.source}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── QUALITY panel ────────────────────────────────────────────── */}
            <div id="quality-sub" className={`panel-base ${activePanel === 'quality' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    Video Quality
                    {hasNativeQuality && <span className="panel-badge">HLS</span>}
                </div>

                <div style={{ maxHeight: 350, overflowY: 'auto', paddingBottom: 8 }}>
                    {qualityOptions.map((opt) => {
                        const isActive = hasNativeQuality
                            ? currentNativeQuality === opt.id
                            : currentUrlQuality === opt.id;

                        const gbPerHour = (() => {
                            if (opt.id === -1 || opt.label === 'Best (Auto)') return 'Variable';
                            const h = parseInt(opt.label);
                            if (h >= 2160) return '~6.8 GB/hr';
                            if (h >= 1080) return '~1.4 GB/hr';
                            if (h >= 720)  return '~0.8 GB/hr';
                            return '~0.4 GB/hr';
                        })();

                        return (
                            <div
                                key={`${opt.id}`}
                                className="quality-option"
                                style={isActive ? { background: 'rgba(26,152,255,0.12)' } : {}}
                                onClick={() => selectQuality(opt.id)}
                            >
                                <div className={`radio-circle ${isActive ? 'selected' : ''}`} />
                                <div>
                                    <div className="radio-label">{opt.label}</div>
                                    <div className="radio-sublabel">{gbPerHour}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SUBTITLES panel ──────────────────────────────────────────── */}
            <div id="subtitles-sub" className={`panel-base ${activePanel === 'subtitles' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <button className="panel-back-btn" onClick={() => setActivePanel('settings')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    Subtitles
                </div>
                {['Off', 'English', 'Hindi', 'Tamil', 'Telugu'].map(sub => (
                    <div
                        key={sub}
                        className={`radio-option ${currentSubtitles === sub ? 'active-track' : ''}`}
                        onClick={() => { setCurrentSubtitles(sub); setActivePanel('none'); }}
                    >
                        <div className={`radio-circle ${currentSubtitles === sub ? 'selected' : ''}`} />
                        <div><div className="radio-label">{sub}</div></div>
                    </div>
                ))}
            </div>

            {/* ── VOLUME popup ─────────────────────────────────────────────── */}
            <div id="volume-popup" className={`panel-base ${activePanel === 'volume' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                <label>Volume — {isMuted ? '0' : Math.round(volume * 100)}%</label>
                <input
                    type="range"
                    id="volume-slider"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : Math.round(volume * 100)}
                    style={{
                        background: `linear-gradient(to right, #fff ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.25) ${isMuted ? 0 : volume * 100}%)`
                    }}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value) / 100;
                        setVolume(val);
                        if (videoRef.current) videoRef.current.volume = val;
                        setIsMuted(val === 0);
                    }}
                />
            </div>
        </div>
    );
};

export default PrimePlayer;
