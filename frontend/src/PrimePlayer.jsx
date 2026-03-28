// frontend/src/PrimePlayer.jsx
// Simple, fully functional video player with working language and quality switchers.
// Uses React state + inline styles — no CSS injection, no DOM manipulation, no pointer-events issues.

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { useNavigate } from 'react-router-dom';

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const PROGRESS_KEY = 'vidFastProgress';

// Format seconds → H:MM:SS or M:SS
const fmt = s => {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const LANG_FLAG = {
  Hindi: '🇮🇳', Tamil: '🎭', Telugu: '🌟', Bengali: '🐯',
  Malayalam: '🌴', Kannada: '🏛️', Marathi: '🏔️', Punjabi: '🌾',
  English: '🇬🇧', 'Dual Audio': '🔀', 'Multi Audio': '🌐',
};
const flagFor = lang => {
  if (!lang) return '🎵';
  for (const [k, v] of Object.entries(LANG_FLAG)) {
    if (lang.startsWith(k)) return v;
  }
  return '🎵';
};

function saveProgress(tmdbId, mediaType, season, episode, currentTime, duration) {
  if (!currentTime || currentTime < 5) return;
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const key = `${mediaType}_${tmdbId}_${season}_${episode}`;
    data[key] = { tmdbId, mediaType, season, episode, currentTime, duration, last_updated: Date.now() };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch (_) {}
}

function loadProgress(tmdbId, mediaType, season, episode) {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return data[`${mediaType}_${tmdbId}_${season}_${episode}`]?.currentTime || 0;
  } catch (_) { return 0; }
}

// ── Inline style definitions ────────────────────────────────────────────────
const S = {
  container: {
    position: 'fixed', inset: 0, zIndex: 2147483647,
    background: '#000', fontFamily: 'system-ui, -apple-system, sans-serif',
    userSelect: 'none', overflow: 'hidden',
  },
  video: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'contain', zIndex: 1, cursor: 'pointer', display: 'block',
  },
  gradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 180,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
    zIndex: 2, pointerEvents: 'none',
  },
  gradBot: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
    zIndex: 2, pointerEvents: 'none',
  },
  spinner: {
    position: 'absolute', inset: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  errorOverlay: {
    position: 'absolute', inset: 0, zIndex: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.8)',
  },
  errorBox: {
    background: '#1a1a1a', borderRadius: 12, padding: '32px 40px',
    textAlign: 'center', maxWidth: 400, border: '1px solid rgba(255,255,255,0.1)',
  },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 },
  errorMsg: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 },
  errorBtn: {
    background: '#00A8E1', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  controls: {
    position: 'absolute', inset: 0, zIndex: 5, transition: 'opacity 0.3s',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', padding: '14px 20px', gap: 12,
  },
  topLeft: {
    display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1,
  },
  topRight: {
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(220,220,220,0.9)', padding: 8, borderRadius: 6,
    flexShrink: 0, outline: 'none',
  },
  titleText: {
    color: '#fff', fontSize: 17, fontWeight: 700,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)', lineHeight: 1.2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320,
  },
  subtitleText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 },
  pillBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(0,168,225,0.18)', color: '#00A8E1',
    border: '1px solid rgba(0,168,225,0.4)', borderRadius: 99,
    padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    outline: 'none', whiteSpace: 'nowrap',
  },
  menuWrapper: {
    position: 'relative', zIndex: 30,
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    background: 'rgba(18,18,22,0.97)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, minWidth: 180, overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
    zIndex: 9999,
  },
  dropdownHeader: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    padding: '10px 16px 6px',
  },
  dropdownItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.85)', padding: '10px 16px', fontSize: 14,
    textAlign: 'left', outline: 'none',
  },
  dropdownItemActive: {
    background: 'rgba(0,168,225,0.18)', color: '#00A8E1',
  },
  checkmark: { color: '#00A8E1', fontWeight: 700, marginLeft: 'auto' },
  centerZone: {
    position: 'absolute', inset: 0, zIndex: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 32,
  },
  skipBtn: {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.8)', gap: 4, padding: 8, borderRadius: 8,
    outline: 'none',
  },
  playBtnCenter: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
    borderRadius: '50%', width: 72, height: 72, color: '#fff',
    outline: 'none', backdropFilter: 'blur(4px)',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    padding: '0 20px 16px',
  },
  progressTrack: {
    position: 'relative', width: '100%', height: 4, background: 'rgba(255,255,255,0.25)',
    borderRadius: 4, cursor: 'pointer', marginBottom: 12,
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, height: '100%',
    background: '#00A8E1', borderRadius: 4, pointerEvents: 'none',
  },
  progressThumb: {
    position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
    width: 12, height: 12, borderRadius: '50%', background: '#fff',
    pointerEvents: 'none',
  },
  controlsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  leftControls: {
    display: 'flex', alignItems: 'center', gap: 4,
  },
  rightControls: {
    display: 'flex', alignItems: 'center', gap: 4,
  },
  volumeTrack: {
    width: 80, height: 4, background: 'rgba(255,255,255,0.25)',
    borderRadius: 4, cursor: 'pointer', position: 'relative', marginLeft: 4,
  },
  volumeFill: {
    position: 'absolute', left: 0, top: 0, height: '100%',
    background: '#fff', borderRadius: 4, pointerEvents: 'none',
  },
  timeText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, marginLeft: 8,
    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
  },
};

// ── SVG Icon helpers ─────────────────────────────────────────────────────────
const IconBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconPlay = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21" />
  </svg>
);
const IconPause = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const IconVolumeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18V20.5c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);
const IconVolumeOn = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);
const IconFullscreen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
);
const IconExitFullscreen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
);

function Spinner() {
  const [deg, setDeg] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDeg(d => (d + 10) % 360), 50);
    return () => clearInterval(id);
  }, []);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: `rotate(${deg}deg)` }}>
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
      <path d="M 26 4 A 22 22 0 0 1 48 26" fill="none" stroke="#00A8E1" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, mediaType, season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const [streams, setStreams] = useState([]);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState(null);
  const [currentStreamIdx, setCurrentStreamIdx] = useState(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const [titleInfo, setTitleInfo] = useState({ title: '', subtitle: '' });

  // Derived: unique languages and qualities per current language
  const languages = [...new Set(streams.map(s => s.language))];
  const currentStream = streams[currentStreamIdx] || null;
  const currentLang = currentStream?.language;
  const currentQuality = currentStream?.quality;
  const qualitiesForLang = streams
    .map((s, i) => ({ quality: s.quality, idx: i }))
    .filter(item => streams[item.idx]?.language === currentLang);

  // Fetch title info
  useEffect(() => {
    if (!tmdbId) return;
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => {
        setTitleInfo({
          title: d.title || d.name || '',
          subtitle: mediaType === 'tv'
            ? `Season ${season} · Episode ${episode}`
            : (d.release_date?.slice(0, 4) || ''),
        });
      })
      .catch(() => {});
  }, [tmdbId, mediaType, season, episode]);

  // Fetch streams
  useEffect(() => {
    if (!tmdbId) return;
    setStreamLoading(true);
    setStreamError(null);
    setStreams([]);
    setCurrentStreamIdx(0);

    fetch(`/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.streams?.length) {
          setStreamError(data.error || 'No streams found for this title.');
          setStreamLoading(false);
          return;
        }
        setStreams(data.streams);
        setStreamLoading(false);
      })
      .catch(e => {
        setStreamError(e.message || 'Failed to load streams.');
        setStreamLoading(false);
      });
  }, [tmdbId, mediaType, season, episode]);

  // Load stream when streams list is ready or selected index changes
  useEffect(() => {
    if (streamLoading || !streams.length) return;
    const stream = streams[currentStreamIdx];
    if (!stream || !videoRef.current) return;

    const video = videoRef.current;
    const savedTime = loadProgress(tmdbId, mediaType, season, episode);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.src = '';
    setBuffering(true);
    setPlaying(false);

    const startPlayback = () => {
      if (savedTime > 5) video.currentTime = savedTime;
      video.play().catch(() => {});
    };

    if (stream.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError('Stream failed to load. Please try another language or quality.');
          setBuffering(false);
        }
      });
      hlsRef.current = hls;
    } else if (stream.type === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.addEventListener('loadedmetadata', startPlayback, { once: true });
    } else {
      video.src = stream.url;
      video.addEventListener('canplay', startPlayback, { once: true });
    }
  }, [streams, currentStreamIdx, streamLoading, tmdbId, mediaType, season, episode]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlers = {
      play:           () => setPlaying(true),
      pause:          () => setPlaying(false),
      timeupdate:     () => setCurrentTime(video.currentTime),
      durationchange: () => setDuration(video.duration),
      waiting:        () => setBuffering(true),
      canplay:        () => setBuffering(false),
      playing:        () => setBuffering(false),
      volumechange:   () => { setVolume(video.volume); setMuted(video.muted); },
    };
    Object.entries(handlers).forEach(([ev, fn]) => video.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => video.removeEventListener(ev, fn));
  }, []);

  // Periodic progress save
  useEffect(() => {
    progressTimerRef.current = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && v.currentTime > 0) {
        saveProgress(tmdbId, mediaType, season, episode, v.currentTime, v.duration);
      }
    }, 5000);
    return () => clearInterval(progressTimerRef.current);
  }, [tmdbId, mediaType, season, episode]);

  // Fullscreen state sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      clearTimeout(hideTimerRef.current);
      clearInterval(progressTimerRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); video.paused ? video.play() : video.pause(); break;
        case 'ArrowLeft':  video.currentTime = Math.max(0, video.currentTime - 10); break;
        case 'ArrowRight': video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); break;
        case 'ArrowUp':    e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
        case 'ArrowDown':  e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
        case 'm':          video.muted = !video.muted; break;
        case 'f':          toggleFullscreen(); break;
        case 'Escape':     if (!document.fullscreenElement) handleClose(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3500);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClose = () => {
    const v = videoRef.current;
    if (v) saveProgress(tmdbId, mediaType, season, episode, v.currentTime, v.duration);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (onClose) onClose(); else navigate(-1);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (v) v.paused ? v.play() : v.pause();
  };

  const handleSeek = e => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const handleVolumeClick = e => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.volume = pct;
    v.muted = pct === 0;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const skipBy = secs => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
  };

  const selectLanguage = lang => {
    const opts = streams.map((s, i) => ({ ...s, idx: i })).filter(s => s.language === lang);
    if (!opts.length) return;
    const match = opts.find(s => s.quality === currentQuality) || opts[0];
    setCurrentStreamIdx(match.idx);
    setShowLangMenu(false);
    setShowQualityMenu(false);
  };

  const selectQuality = idx => {
    setCurrentStreamIdx(idx);
    setShowQualityMenu(false);
    setShowLangMenu(false);
  };

  const closeMenus = () => { setShowLangMenu(false); setShowQualityMenu(false); };

  // ── Computed ──────────────────────────────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePct   = muted ? 0 : volume * 100;

  // ── Render ─────────────────────────────────────────────────────────────────
  const player = (
    <div ref={containerRef} style={S.container} onMouseMove={resetHideTimer} onClick={closeMenus}>

      <video ref={videoRef} style={S.video} onClick={togglePlay} playsInline />

      <div style={S.gradTop} />
      <div style={S.gradBot} />

      {(streamLoading || buffering) && (
        <div style={S.spinner}><Spinner /></div>
      )}

      {streamError && !streamLoading && (
        <div style={S.errorOverlay}>
          <div style={S.errorBox}>
            <div style={S.errorIcon}>⚠️</div>
            <div style={S.errorTitle}>Stream Unavailable</div>
            <div style={S.errorMsg}>{streamError}</div>
            <button style={S.errorBtn} onClick={handleClose}>← Go Back</button>
          </div>
        </div>
      )}

      {!streamError && (
        <div style={{ ...S.controls, opacity: showControls ? 1 : 0 }}>

          {/* Top bar */}
          <div style={S.topBar}>
            <div style={S.topLeft}>
              <button style={S.iconBtn} onClick={e => { e.stopPropagation(); handleClose(); }} title="Go back">
                <IconBack />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={S.titleText}>{titleInfo.title}</div>
                {titleInfo.subtitle && <div style={S.subtitleText}>{titleInfo.subtitle}</div>}
              </div>
            </div>

            <div style={S.topRight}>
              {/* Language switcher */}
              {languages.length > 1 && (
                <div style={S.menuWrapper} onClick={e => e.stopPropagation()}>
                  <button
                    style={S.pillBtn}
                    onClick={() => { setShowLangMenu(v => !v); setShowQualityMenu(false); }}
                    title="Change audio language"
                  >
                    {flagFor(currentLang)} {currentLang || 'Language'}
                  </button>
                  {showLangMenu && (
                    <div style={S.dropdown}>
                      <div style={S.dropdownHeader}>Audio Language</div>
                      {languages.map(lang => (
                        <button
                          key={lang}
                          style={lang === currentLang
                            ? { ...S.dropdownItem, ...S.dropdownItemActive }
                            : S.dropdownItem}
                          onClick={() => selectLanguage(lang)}
                        >
                          <span>{flagFor(lang)}</span>
                          <span style={{ flex: 1 }}>{lang}</span>
                          {lang === currentLang && <span style={S.checkmark}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quality switcher */}
              {qualitiesForLang.length > 1 && (
                <div style={S.menuWrapper} onClick={e => e.stopPropagation()}>
                  <button
                    style={S.pillBtn}
                    onClick={() => { setShowQualityMenu(v => !v); setShowLangMenu(false); }}
                    title="Change video quality"
                  >
                    {currentQuality || 'Quality'}
                  </button>
                  {showQualityMenu && (
                    <div style={S.dropdown}>
                      <div style={S.dropdownHeader}>Video Quality</div>
                      {qualitiesForLang.map(({ quality, idx }) => (
                        <button
                          key={idx}
                          style={idx === currentStreamIdx
                            ? { ...S.dropdownItem, ...S.dropdownItemActive }
                            : S.dropdownItem}
                          onClick={() => selectQuality(idx)}
                        >
                          <span style={{ flex: 1 }}>{quality}</span>
                          {idx === currentStreamIdx && <span style={S.checkmark}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center transport */}
          <div style={S.centerZone} onClick={e => e.stopPropagation()}>
            <button style={S.skipBtn} onClick={() => skipBy(-10)} title="Rewind 10s">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
              </svg>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>10</span>
            </button>
            <button style={S.playBtnCenter} onClick={togglePlay}>
              {playing ? <IconPause size={32} /> : <IconPlay size={32} />}
            </button>
            <button style={S.skipBtn} onClick={() => skipBy(10)} title="Forward 10s">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 8c2.65 0 5.05.99 6.9 2.6L22 7v9h-9l3.62-3.62C15.23 11.22 13.46 10.5 11.5 10.5c-3.54 0-6.55 2.31-7.6 5.5L1.53 15.22C2.92 11.03 6.85 8 11.5 8z" />
              </svg>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>10</span>
            </button>
          </div>

          {/* Bottom bar */}
          <div style={S.bottomBar} onClick={e => e.stopPropagation()}>
            <div style={S.progressTrack} onClick={handleSeek}>
              <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
              <div style={{ ...S.progressThumb, left: `${progressPct}%` }} />
            </div>

            <div style={S.controlsRow}>
              <div style={S.leftControls}>
                <button style={S.iconBtn} onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                  {playing ? <IconPause /> : <IconPlay />}
                </button>
                <button style={S.iconBtn} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                  {(muted || volumePct === 0) ? <IconVolumeOff /> : <IconVolumeOn />}
                </button>
                <div style={S.volumeTrack} onClick={handleVolumeClick} title="Volume">
                  <div style={{ ...S.volumeFill, width: `${volumePct}%` }} />
                </div>
                <span style={S.timeText}>{fmt(currentTime)} / {fmt(duration)}</span>
              </div>

              <div style={S.rightControls}>
                {currentStream && (
                  <span style={{
                    fontSize: 12, color: 'rgba(255,255,255,0.4)',
                    marginRight: 8, maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {currentStream.source}
                  </span>
                )}
                <button style={S.iconBtn} onClick={toggleFullscreen} title="Fullscreen">
                  {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );

  return createPortal(player, document.body);
}
