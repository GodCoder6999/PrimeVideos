/**
 * PrimePlayer v3 — Custom HLS Player + Smart Iframe Fallback
 * 
 * Flow:
 *  1. Ask backend /api/get-stream for a direct m3u8 URL
 *  2. If found → play with HLS.js in our own <video> element (full control)
 *  3. If not found → cycle through embed iframes (no sandbox)
 * 
 * Features:
 *  - Full custom controls (play/pause, seek, volume, fullscreen, quality)
 *  - Progress tracking saved to localStorage
 *  - Source switcher UI
 *  - Auto-retry with next source on error
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ─── Build embed fallback list ────────────────────────────────────────────
const buildEmbeds = (tmdbId, imdbId, mediaType, season, episode) => {
  const tv = mediaType === 'tv';
  const s = season || 1;
  const e = episode || 1;
  const list = [];

  if (imdbId) {
    list.push({ name: 'VidSrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}` });
    list.push({ name: 'VidFast', url: tv ? `https://vidfast.pro/tv/${imdbId}/${s}/${e}?autoPlay=true` : `https://vidfast.pro/movie/${imdbId}?autoPlay=true` });
    list.push({ name: 'VidSrc.me', url: tv ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${imdbId}` });
  }

  list.push({ name: 'Videasy', url: tv ? `https://player.videasy.net/tv/${tmdbId}/${s}/${e}` : `https://player.videasy.net/movie/${tmdbId}` });
  list.push({ name: 'AutoEmbed', url: tv ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${tmdbId}` });
  list.push({ name: 'EmbedSu', url: tv ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` : `https://embed.su/embed/movie/${tmdbId}` });
  list.push({ name: 'VidSrc.in', url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tmdbId}` });
  list.push({ name: '2Embed', url: tv ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${tmdbId}` });
  list.push({ name: 'MoviesAPI', url: tv ? `https://moviesapi.club/tv/${tmdbId}-${s}-${e}` : `https://moviesapi.club/movie/${tmdbId}` });
  list.push({ name: 'SuperEmbed', url: tv ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` });

  return list;
};

// ─── Format seconds → MM:SS ───────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ─── Save / load progress ─────────────────────────────────────────────────
const saveProgress = (type, id, season, episode, watched, duration) => {
  try {
    const key = `${type === 'tv' ? 't' : 'm'}${id}`;
    const all = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
    all[key] = {
      id, type, season, episode,
      progress: { watched, duration },
      last_updated: Date.now(),
    };
    localStorage.setItem('vidFastProgress', JSON.stringify(all));
  } catch { /* */ }
};

const loadProgress = (type, id) => {
  try {
    const key = `${type === 'tv' ? 't' : 'm'}${id}`;
    const all = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
    return all[key]?.progress || null;
  } catch { return null; }
};

// ══════════════════════════════════════════════════════════════════════════
export default function PrimePlayer({ tmdbId, title, mediaType = 'movie', season = 1, episode = 1 }) {
  // Mode: 'loading' | 'hls' | 'iframe' | 'failed'
  const [mode, setMode] = useState('loading');
  const [hlsUrl, setHlsUrl] = useState(null);
  const [provider, setProvider] = useState('');
  const [imdbId, setImdbId] = useState(null);
  const [embeds, setEmbeds] = useState([]);
  const [embedIdx, setEmbedIdx] = useState(0);
  const [embedPhase, setEmbedPhase] = useState('loading'); // 'loading' | 'playing' | 'failed'

  // Player UI state
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQuality, setShowQuality] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [hlsError, setHlsError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const progressRef = useRef(null);
  const iframeTimerRef = useRef(null);

  // ── INIT ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    setMode('loading');
    setHlsUrl(null);
    setProvider('');
    setImdbId(null);
    setEmbeds([]);
    setEmbedIdx(0);
    setEmbedPhase('loading');
    setHlsError(null);
    setPlaying(false);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    (async () => {
      try {
        const params = new URLSearchParams({ tmdbId, mediaType, season, episode });
        const res = await fetch(`${BACKEND}/api/get-stream?${params}`);
        const data = await res.json();

        if (data.success && data.streamUrl) {
          setHlsUrl(data.proxyUrl || `/api/proxy?url=${encodeURIComponent(data.streamUrl)}`);
          setProvider(data.provider || 'Direct');
          setImdbId(data.imdbId || null);

          // Build embeds for fallback
          setEmbeds(buildEmbeds(tmdbId, data.imdbId, mediaType, season, episode));
          setMode('hls');
          return;
        }

        // Backend failed — use embeds
        setImdbId(data.imdbId || null);
        setEmbeds(buildEmbeds(tmdbId, data.imdbId, mediaType, season, episode));
        setMode('iframe');

      } catch (err) {
        console.warn('[PrimePlayer] Backend unreachable:', err.message);

        // Resolve IMDB directly and fall through to embeds
        let iid = null;
        try {
          const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
          const d = await r.json();
          iid = d.imdb_id || null;
        } catch { /* */ }

        setImdbId(iid);
        setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
        setMode('iframe');
      }
    })();

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode]);

  // ── HLS SETUP ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setHlsError(null);

    const vid = videoRef.current;

    // Restore saved position
    const saved = loadProgress(mediaType, tmdbId);
    const resumeAt = saved?.watched > 10 ? saved.watched : 0;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 60,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        // Populate quality levels
        const levels = hls.levels.map((l, i) => ({
          id: i,
          label: l.height ? `${l.height}p` : `Level ${i}`,
          bitrate: l.bitrate,
        }));
        setQualities([{ id: -1, label: 'Auto' }, ...levels]);
        setCurrentQuality(-1);

        if (resumeAt > 0) {
          vid.currentTime = resumeAt;
        }

        vid.play().catch(() => {});
        setPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS Fatal]', data.type, data.details);
          setHlsError(`Stream error (${data.details}). Switching to embed fallback…`);
          setTimeout(() => {
            setMode('iframe');
            setEmbedIdx(0);
            setEmbedPhase('loading');
          }, 2500);
        }
      });

    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = hlsUrl;
      vid.addEventListener('loadedmetadata', () => {
        if (resumeAt > 0) vid.currentTime = resumeAt;
        vid.play().catch(() => {});
        setPlaying(true);
      });
    } else {
      setHlsError('HLS not supported. Switching to embed…');
      setTimeout(() => setMode('iframe'), 1500);
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ── VIDEO EVENT LISTENERS ──────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || mode !== 'hls') return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      // Save progress every 5 seconds
      if (Math.floor(vid.currentTime) % 5 === 0) {
        saveProgress(mediaType, tmdbId, season, episode, vid.currentTime, vid.duration);
      }
    };
    const onDurationChange = () => setDuration(vid.duration);
    const onProgress = () => {
      if (vid.buffered.length > 0) {
        setBuffered(vid.buffered.end(vid.buffered.length - 1));
      }
    };
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('durationchange', onDurationChange);
    vid.addEventListener('progress', onProgress);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('durationchange', onDurationChange);
      vid.removeEventListener('progress', onProgress);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [mode, tmdbId, mediaType, season, episode]);

  // ── IFRAME AUTO-TIMEOUT ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'iframe' || embedPhase !== 'loading') return;

    clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      if (embedIdx < embeds.length - 1) {
        setEmbedIdx(i => i + 1);
      } else {
        setEmbedPhase('failed');
      }
    }, 15000);

    return () => clearTimeout(iframeTimerRef.current);
  }, [mode, embedPhase, embedIdx, embeds.length]);

  // ── CONTROLS AUTO-HIDE ─────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // ── PLAYER CONTROLS ────────────────────────────────────────────────────
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    playing ? vid.pause() : vid.play();
  };

  const handleSeek = (e) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = pct * duration;
  };

  const handleVolume = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !muted;
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const setQuality = (id) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = id;
    setCurrentQuality(id);
    setShowQuality(false);
  };

  const skip = (seconds) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(duration, vid.currentTime + seconds));
  };

  const handleIframeLoad = () => {
    clearTimeout(iframeTimerRef.current);
    setEmbedPhase('playing');
  };

  const switchSource = (idx) => {
    clearTimeout(iframeTimerRef.current);
    setEmbedIdx(idx);
    setEmbedPhase('loading');
    setShowSources(false);
  };

  const retryHls = () => {
    setHlsError(null);
    setMode('hls');
  };

  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (mode !== 'hls') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': skip(-10); break;
        case 'ArrowRight': skip(10); break;
        case 'ArrowUp': e.preventDefault(); {
          const v = Math.min(1, volume + 0.1);
          setVolume(v);
          if (videoRef.current) videoRef.current.volume = v;
          break;
        }
        case 'ArrowDown': e.preventDefault(); {
          const v = Math.max(0, volume - 0.1);
          setVolume(v);
          if (videoRef.current) videoRef.current.volume = v;
          break;
        }
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, playing, volume, muted, isFullscreen]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const currentEmbed = embeds[embedIdx];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none"
      style={{ minHeight: '100vh', fontFamily: "'Amazon Ember', 'Inter', sans-serif" }}
      onMouseMove={resetControlsTimer}
      onClick={() => { if (mode === 'hls') togglePlay(); }}
    >

      {/* ── LOADING OVERLAY ─────────────────────────────────────────────── */}
      {mode === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#060d18]">
          <LoadingSpinner />
          <p className="text-white font-bold text-sm mt-4 animate-pulse">Finding stream…</p>
        </div>
      )}

      {/* ── HLS ERROR OVERLAY ───────────────────────────────────────────── */}
      {hlsError && mode === 'hls' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-4">
            <span className="text-yellow-400 text-2xl">⚠</span>
          </div>
          <p className="text-white font-bold mb-2">Stream Error</p>
          <p className="text-gray-400 text-sm text-center max-w-xs mb-4">{hlsError}</p>
          <div className="flex gap-3">
            <button onClick={retryHls} className="px-4 py-2 bg-[#00A8E1] text-white text-sm font-bold rounded-lg">
              Retry
            </button>
            <button onClick={() => { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }} className="px-4 py-2 bg-white/10 text-white text-sm font-bold rounded-lg border border-white/20">
              Use Embed
            </button>
          </div>
        </div>
      )}

      {/* ── HLS VIDEO ELEMENT ───────────────────────────────────────────── */}
      {(mode === 'hls' || (mode === 'iframe' && hlsUrl)) && (
        <video
          ref={videoRef}
          className="w-full"
          style={{
            minHeight: '100vh',
            display: mode === 'hls' ? 'block' : 'none',
            background: '#000',
          }}
          playsInline
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* ── CUSTOM CONTROLS (HLS mode only) ─────────────────────────────── */}
      {mode === 'hls' && !hlsError && (
        <div
          className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none"
          style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s ease' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top bar */}
          <div
            className="pointer-events-auto px-6 pt-4 pb-8"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border"
                style={{ color: '#00A8E1', background: 'rgba(0,168,225,0.1)', borderColor: 'rgba(0,168,225,0.3)' }}>
                ▶ Direct HLS
              </span>
              {provider && (
                <span className="text-[10px] font-bold text-white/60 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                  {provider}
                </span>
              )}
              {title && <span className="text-white text-sm font-semibold opacity-70 truncate max-w-xs hidden md:block">{title}</span>}
              {mediaType === 'tv' && (
                <span className="text-gray-400 text-xs font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded ml-1">
                  S{season}·E{episode}
                </span>
              )}
            </div>
          </div>

          {/* Center: big play/pause tap target */}
          <div className="flex items-center justify-center pointer-events-auto flex-1" onClick={togglePlay}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
              style={{
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
                border: '2px solid rgba(255,255,255,0.2)',
                opacity: showControls ? 1 : 0,
              }}
            >
              {playing
                ? <PauseIcon />
                : <PlayIcon />
              }
            </div>
          </div>

          {/* Bottom controls */}
          <div
            className="pointer-events-auto px-4 pb-4 pt-8"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}
          >
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="relative h-1.5 rounded-full mb-4 cursor-pointer group"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              onClick={handleSeek}
            >
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.3)' }}
              />
              {/* Played */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: '#00A8E1' }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  left: `${progressPct}%`,
                  transform: 'translate(-50%, -50%)',
                  background: '#00A8E1',
                  boxShadow: '0 0 6px rgba(0,168,225,0.8)',
                }}
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="text-white hover:text-[#00A8E1] transition-colors">
                {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>

              {/* Skip back */}
              <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors text-xs font-bold">
                ⏪ 10
              </button>

              {/* Skip forward */}
              <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors text-xs font-bold">
                10 ⏩
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                  {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={muted ? 0 : volume}
                  onChange={handleVolume}
                  className="w-20 h-1 accent-[#00A8E1] cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Time */}
              <span className="text-white/70 text-xs font-mono">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Quality selector */}
              {qualities.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQuality(v => !v); }}
                    className="text-white/70 hover:text-white text-xs font-bold px-2 py-1 rounded border border-white/20 hover:border-white/50 transition-colors"
                  >
                    {qualities.find(q => q.id === currentQuality)?.label || 'Auto'}
                  </button>
                  {showQuality && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-28 rounded-xl overflow-hidden shadow-2xl"
                      style={{ background: 'rgba(8,15,26,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {qualities.map(q => (
                        <button
                          key={q.id}
                          onClick={() => setQuality(q.id)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold transition-colors border-b last:border-0"
                          style={{
                            color: q.id === currentQuality ? '#00A8E1' : '#d1d5db',
                            background: q.id === currentQuality ? 'rgba(0,168,225,0.1)' : 'transparent',
                            borderColor: 'rgba(255,255,255,0.05)',
                          }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Source switcher */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSources(v => !v); }}
                  className="text-white/70 hover:text-white text-xs font-bold px-2 py-1 rounded border border-white/20 hover:border-white/50 transition-colors"
                >
                  📡 Source
                </button>
                {showSources && (
                  <div
                    className="absolute bottom-full right-0 mb-2 w-44 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto"
                    style={{ background: 'rgba(8,15,26,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      Embed Sources
                    </div>
                    {embeds.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => { setMode('iframe'); setEmbedIdx(i); setEmbedPhase('loading'); setShowSources(false); }}
                        className="w-full text-left px-3 py-2.5 text-xs font-semibold transition-colors border-b last:border-0 flex items-center gap-2"
                        style={{ color: '#d1d5db', background: 'transparent', borderColor: 'rgba(255,255,255,0.05)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                        {src.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="text-white/70 hover:text-white transition-colors"
              >
                {isFullscreen ? '⤓' : '⤢'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IFRAME MODE ──────────────────────────────────────────────────── */}
      {mode === 'iframe' && (
        <>
          {/* Loading overlay for iframe */}
          {embedPhase === 'loading' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#060d18] pointer-events-none">
              <LoadingSpinner />
              <p className="text-white font-bold text-sm mt-4 mb-1">Loading player…</p>
              <p className="text-gray-500 text-xs">{currentEmbed?.name || '…'}</p>
            </div>
          )}

          {/* Failed overlay */}
          {embedPhase === 'failed' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#060d18]">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5">
                <span className="text-red-400 text-3xl">✕</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">All sources failed</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-xs text-center">
                This title may not be available or all providers are blocked in your region.
              </p>
              <button
                onClick={() => { setEmbedIdx(0); setEmbedPhase('loading'); }}
                className="px-6 py-2.5 bg-[#00A8E1] text-white font-bold text-sm rounded-xl"
              >
                Retry All Sources
              </button>
            </div>
          )}

          {/* Top bar for iframe mode */}
          <div
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)' }}
          >
            <div className="flex items-center gap-3 pointer-events-auto">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border"
                style={{ color: '#00A8E1', background: 'rgba(0,168,225,0.1)', borderColor: 'rgba(0,168,225,0.3)' }}>
                ▶ Embed
              </span>
              {title && <span className="text-white text-sm font-semibold opacity-70 truncate max-w-xs hidden md:block">{title}</span>}
            </div>

            {/* Source picker for iframe */}
            <div className="relative pointer-events-auto">
              <button
                onClick={() => setShowSources(v => !v)}
                className="flex items-center gap-2 text-white text-[11px] font-bold px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                📡 {embeds.length > 0 ? `${embedIdx + 1}/${embeds.length}` : 'Sources'}
              </button>

              {showSources && embeds.length > 0 && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl z-[999] max-h-72 overflow-y-auto"
                  style={{ background: 'rgba(8,15,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)' }}
                >
                  <div className="px-4 py-2.5 border-b text-[9px] font-black text-gray-500 uppercase tracking-widest"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    Video Sources
                  </div>
                  {embeds.map((src, i) => (
                    <button key={i} onClick={() => switchSource(i)}
                      className="w-full text-left px-4 py-3 text-[13px] font-semibold transition-all flex items-center gap-3 border-b last:border-0"
                      style={{
                        color: i === embedIdx ? '#00A8E1' : '#d1d5db',
                        background: i === embedIdx ? 'rgba(0,168,225,0.1)' : 'transparent',
                        borderColor: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: i === embedIdx ? '#00A8E1' : '#374151' }} />
                      {src.name}
                      {i === embedIdx && <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: '#00A8E1', color: 'white' }}>NOW</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* The iframe — NO sandbox */}
          {currentEmbed && embedPhase !== 'failed' && (
            <iframe
              key={`${embedIdx}-${tmdbId}-${season}-${episode}`}
              src={currentEmbed.url}
              className="w-full border-0"
              style={{
                minHeight: '100vh',
                display: 'block',
                opacity: embedPhase === 'playing' ? 1 : 0,
                transition: 'opacity 0.4s ease',
              }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="no-referrer"
              scrolling="no"
              onLoad={handleIframeLoad}
              title={title || 'Player'}
            />
          )}

          {/* "Not playing?" button */}
          {embedPhase === 'playing' && embedIdx < embeds.length - 1 && (
            <div className="absolute bottom-5 right-5 z-50 pointer-events-auto">
              <button
                onClick={() => switchSource(embedIdx + 1)}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl backdrop-blur-md"
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Not playing? <span style={{ color: '#00A8E1' }}>Try next →</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Click-away */}
      {(showQuality || showSources) && (
        <div className="fixed inset-0 z-[998]"
          onClick={() => { setShowQuality(false); setShowSources(false); }} />
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function PlayIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div className="relative w-14 h-14">
      <div className="absolute inset-0 rounded-full" style={{ border: '3px solid rgba(255,255,255,0.05)' }} />
      <div className="absolute inset-0 rounded-full animate-spin"
        style={{ border: '3px solid transparent', borderTopColor: '#00A8E1' }} />
      <div className="absolute inset-2 rounded-full animate-spin"
        style={{ border: '2px solid transparent', borderTopColor: 'rgba(255,255,255,0.2)', animationDuration: '1.4s', animationDirection: 'reverse' }} />
    </div>
  );
}
