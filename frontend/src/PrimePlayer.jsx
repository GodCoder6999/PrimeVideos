// frontend/src/PrimePlayer.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { useNavigate } from 'react-router-dom';

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── SVG icon set ─────────────────────────────────────────────────────────────
const IC = {
  Settings: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg>),
  Globe: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolHi: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolMid: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolX: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  FS: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ExitFS: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  PiP: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="10" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/></svg>),
  Close: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Check: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="#00A8E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ChevR: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Rw10: () => (<svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M16 24A20 20 0 1 1 16 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M25 15 L15 24 L25 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="38" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="system-ui">10</text></svg>),
  Fw10: () => (<svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M48 24A20 20 0 1 0 48 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M39 15 L49 24 L39 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="38" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="system-ui">10</text></svg>),
  Play: () => (<svg width="52" height="52" viewBox="0 0 64 64" fill="none"><path d="M22 14 L52 32 L22 50 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>),
  Pause: () => (<svg width="52" height="52" viewBox="0 0 64 64" fill="none"><rect x="18" y="14" width="9" height="36" rx="3" fill="currentColor"/><rect x="37" y="14" width="9" height="36" rx="3" fill="currentColor"/></svg>),
  Back: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const LANG_FLAG = {
  'Hindi': '🇮🇳', 'Tamil': '🎭', 'Telugu': '🌟', 'Bengali': '🐯',
  'Malayalam': '🌴', 'Kannada': '🏛️', 'Marathi': '🏔️', 'Punjabi': '🌾',
  'English': '🇬🇧', 'Dual Audio': '🔀', 'Multi Audio': '🌐',
};

function langFlag(lang) {
  if (!lang) return '🎵';
  for (const [key, flag] of Object.entries(LANG_FLAG)) {
    if (lang.startsWith(key)) return flag;
  }
  return '🎵';
}

export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();

  const vidRef       = useRef(null);
  const hlsRef       = useRef(null);
  const containerRef = useRef(null);
  const progressRef  = useRef(null);
  const volBarRef    = useRef(null);
  const ctrlTimer    = useRef(null);
  // Single source of truth for streams — both ref (for async callbacks) and state (for rendering)
  const streamsRef   = useRef([]);
  const resumedRef   = useRef(false);
  const cleanupRef   = useRef(null);
  // Keep curIdx in a ref too so async loadStreamAt always sees the latest
  const curIdxRef    = useRef(0);

  const [loadState,  setLoadState]  = useState('loading');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [streams,    setStreams]     = useState([]);   // drives all UI rendering
  const [curIdx,     setCurIdx]     = useState(0);    // drives UI highlighting

  const [playing,    setPlaying]    = useState(false);
  const [curTime,    setCurTime]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [buffering,  setBuffering]  = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [muted,      setMuted]      = useState(false);
  const [prevVol,    setPrevVol]    = useState(1);
  const [autoMuted,  setAutoMuted]  = useState(false);

  const [showCtrl,   setShowCtrl]   = useState(true);
  const [isFS,       setIsFS]       = useState(false);
  const [seeking,    setSeeking]    = useState(false);
  const [dragVol,    setDragVol]    = useState(false);
  // panel: null | 'lang' | 'quality' | 'vol'
  const [panel,      setPanel]      = useState(null);
  const [skipFX,     setSkipFX]     = useState(null);
  const [hoverT,     setHoverT]     = useState(null);
  const [hoverX,     setHoverX]     = useState(0);
  const [movieTitle, setMovieTitle] = useState(title);
  const [epTitle,    setEpTitle]    = useState('');
  const [nextEp,     setNextEp]     = useState(null);

  // ── Derived: unique languages (in sorted order from API) ─────────────────
  const availableLanguages = useMemo(() => {
    const seen = new Set();
    return streams
      .filter(s => { if (seen.has(s.language)) return false; seen.add(s.language); return true; })
      .map(s => s.language);
  }, [streams]);

  // ── Derived: qualities for the currently active language ─────────────────
  const curStream = streams[curIdx] || null;

  const qualitiesForCurrentLang = useMemo(() => {
    if (!curStream) return [];
    return streams
      .map((s, i) => ({ ...s, idx: i }))
      .filter(s => s.language === curStream.language);
  }, [streams, curStream]);

  // ── TV episode metadata ───────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType !== 'tv') return;
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => {
        const ep = (d.episodes || []).find(e => e.episode_number == episode);
        if (ep) setEpTitle(ep.name || '');
        const nx = (d.episodes || []).find(e => e.episode_number == Number(episode) + 1);
        if (nx) setNextEp({ season, episode: Number(episode) + 1 });
      }).catch(() => {});
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => { resumedRef.current = false; }, [tmdbId, season, episode]);

  const attemptResume = useCallback((vid, explicitTime = null) => {
    if (explicitTime !== null) { vid.currentTime = explicitTime; return; }
    if (resumedRef.current) return;
    resumedRef.current = true;
    const key  = mediaType === 'tv' ? `t${tmdbId}` : `m${tmdbId}`;
    const prog = (JSON.parse(localStorage.getItem('vidFastProgress') || '{}'))[key];
    if (!prog?.progress?.watched) return;
    if (prog.progress.watched < prog.progress.duration * 0.95)
      vid.currentTime = prog.progress.watched;
  }, [tmdbId, mediaType]);

  useEffect(() => {
    const v = vidRef.current; if (!v) return;
    const fn = () => { setMuted(v.muted); setVolume(v.volume); if (!v.muted && v.volume > 0) setAutoMuted(false); };
    v.addEventListener('volumechange', fn);
    return () => v.removeEventListener('volumechange', fn);
  }, []);

  useEffect(() => {
    const fn = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  // ── Core stream loader ────────────────────────────────────────────────────
  // IMPORTANT: reads from streamsRef.current (not state) so it's always current
  // even when called from async contexts or stale closures.
  const loadStreamAt = useCallback((idx, resumeTime = null) => {
    const list = streamsRef.current;
    if (!list || list.length === 0) {
      setLoadState('error'); setErrorMsg('No streams available.'); return;
    }
    if (idx >= list.length) {
      setLoadState('error'); setErrorMsg('All available streams failed to load.'); return;
    }

    // Cleanup previous HLS / direct load
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const stream = list[idx];

    // Update both ref and state so UI reflects the change immediately
    curIdxRef.current = idx;
    setCurIdx(idx);

    setBuffering(true);
    setPlaying(false);
    if (resumeTime === null) { setCurTime(0); setDuration(0); setBuffered(0); }

    const vid = vidRef.current;
    if (!vid) return;
    vid.pause();
    vid.removeAttribute('src');
    vid.load();

    const tryNext = () => loadStreamAt(idx + 1);

    if (stream.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(stream.url);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false); setLoadState('ready');
        vid.volume = 1; vid.muted = false;
        attemptResume(vid, resumeTime);
        vid.play()
          .then(() => setPlaying(true))
          .catch(() => {
            vid.muted = true;
            vid.play().then(() => { setPlaying(true); setAutoMuted(true); });
          });
      });
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) tryNext(); });
      return;
    }

    // MP4 / direct URL fallback
    let stallTimer = null;
    const clearStall = () => clearTimeout(stallTimer);
    const resetStall = (ms) => { clearStall(); stallTimer = setTimeout(tryNext, ms); };
    resetStall(14000);

    const onCanPlay = () => {
      clearStall(); setBuffering(false); setLoadState('ready');
      attemptResume(vid, resumeTime);
      vid.play()
        .then(() => setPlaying(true))
        .catch(() => {
          vid.muted = true;
          vid.play().then(() => { setPlaying(true); setAutoMuted(true); });
        });
    };
    const onErr = () => { clearStall(); tryNext(); };

    setTimeout(() => { vid.volume = 1; vid.muted = false; vid.src = stream.url; vid.load(); }, 30);
    vid.addEventListener('canplay', onCanPlay, { once: true });
    vid.addEventListener('error',   onErr,     { once: true });
    cleanupRef.current = () => {
      clearStall();
      vid.removeEventListener('canplay', onCanPlay);
      vid.removeEventListener('error',   onErr);
    };
  }, [attemptResume]); // stable — reads streamsRef.current, not state

  // ── Switch language — finds best matching stream ──────────────────────────
  const switchLanguage = useCallback((lang) => {
    const list = streamsRef.current;
    if (!list || list.length === 0) return;
    const time = vidRef.current?.currentTime || 0;
    const currentQuality = list[curIdxRef.current]?.quality;

    // Try to preserve quality within the new language
    let targetIdx = list.findIndex(s => s.language === lang && s.quality === currentQuality);
    if (targetIdx === -1) targetIdx = list.findIndex(s => s.language === lang);
    if (targetIdx === -1) return;

    setPanel(null);
    loadStreamAt(targetIdx, time);
  }, [loadStreamAt]);

  // ── Switch quality within current language ────────────────────────────────
  const switchQuality = useCallback((idx) => {
    const time = vidRef.current?.currentTime || 0;
    setPanel(null);
    loadStreamAt(idx, time);
  }, [loadStreamAt]);

  // ── Fetch streams on mount / content change ───────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;
    let cancelled = false;

    setLoadState('loading'); setErrorMsg('');
    setStreams([]); setCurIdx(0); setPlaying(false);
    setBuffering(false); setAutoMuted(false);
    streamsRef.current = [];
    curIdxRef.current = 0;
    resumedRef.current = false;

    // Fetch movie title
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setMovieTitle(d.title || d.name || title); })
      .catch(() => {});

    const params = new URLSearchParams({
      tmdbId, type: mediaType, season: String(season), episode: String(episode),
    });

    fetch(`/api/multi-stream?${params}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.success || !Array.isArray(data.streams) || data.streams.length === 0) {
          setLoadState('error');
          setErrorMsg(data.error || 'No streams found for this title.');
          return;
        }
        // Populate ref first, then state — loadStreamAt reads ref
        streamsRef.current = data.streams;
        setStreams(data.streams);
        loadStreamAt(0);
      })
      .catch(err => {
        if (cancelled) return;
        setLoadState('error');
        setErrorMsg('Failed to fetch streams: ' + err.message);
      });

    return () => {
      cancelled = true;
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode, loadStreamAt]);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current; if (!v) return;
    const evs = [
      ['play',           () => { setPlaying(true); setBuffering(false); }],
      ['pause',          () => setPlaying(false)],
      ['timeupdate',     () => setCurTime(v.currentTime)],
      ['durationchange', () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); }],
      ['progress',       () => { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); }],
      ['waiting',        () => setBuffering(true)],
      ['playing',        () => setBuffering(false)],
      ['ended',          () => setPlaying(false)],
    ];
    evs.forEach(([ev, fn]) => v.addEventListener(ev, fn));
    return () => evs.forEach(([ev, fn]) => v.removeEventListener(ev, fn));
  }, []);

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetCtrl = useCallback(() => {
    setShowCtrl(true); clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);

  useEffect(() => { resetCtrl(); return () => clearTimeout(ctrlTimer.current); }, [resetCtrl]);

  useEffect(() => {
    if (panel) { setShowCtrl(true); clearTimeout(ctrlTimer.current); }
    else resetCtrl();
  }, [panel, resetCtrl]);

  const togglePlay = () => {
    const v = vidRef.current; if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {
        v.muted = true; v.play().then(() => { setPlaying(true); setAutoMuted(true); });
      });
    } else v.pause();
  };

  const skip = (sec) => {
    const v = vidRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    setSkipFX(sec < 0 ? 'b' : 'f');
    setTimeout(() => setSkipFX(null), 700);
  };

  const toggleMute = () => {
    const v = vidRef.current; if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false; v.volume = prevVol > 0 ? prevVol : 1; setAutoMuted(false);
    } else {
      setPrevVol(v.volume); v.muted = true;
    }
  };

  const changeVol = (val) => {
    const v = vidRef.current; if (!v) return;
    if (val > 0) { setPrevVol(val); v.muted = false; v.volume = val; setAutoMuted(false); }
    else { v.muted = true; v.volume = 0; }
  };

  const toggleFS = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const togglePiP = async () => {
    const v = vidRef.current; if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (_) {}
  };

  // Progress bar
  const barTimeAt  = (e) => { const b = progressRef.current; if (!b || !duration) return 0; return Math.max(0, Math.min(1, (e.clientX - b.getBoundingClientRect().left) / b.offsetWidth)) * duration; };
  const onBarDown  = (e) => { setSeeking(true); const t = barTimeAt(e); if (vidRef.current) { vidRef.current.currentTime = t; setCurTime(t); } };
  const onBarMove  = (e) => { const t = barTimeAt(e); setHoverT(t); if (progressRef.current) setHoverX(e.clientX - progressRef.current.getBoundingClientRect().left); if (seeking && vidRef.current) { vidRef.current.currentTime = t; setCurTime(t); } };
  const onBarUp    = () => setSeeking(false);
  const onBarLeave = () => { setHoverT(null); if (seeking) setSeeking(false); };

  // Volume drag
  const volFromY = (e) => { const s = volBarRef.current; if (!s) return volume; return 1 - Math.max(0, Math.min(1, (e.clientY - s.getBoundingClientRect().top) / s.offsetHeight)); };
  useEffect(() => {
    if (!dragVol) return;
    const mv = (e) => changeVol(volFromY(e));
    const up = () => { setDragVol(false); setPanel(null); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [dragVol]);

  const pPct    = duration > 0 ? (curTime / duration) * 100 : 0;
  const bPct    = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolIcon = (muted || volume === 0) ? IC.VolX : volume < 0.5 ? IC.VolMid : IC.VolHi;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onMouseMove={resetCtrl}
      onClick={() => setPanel(null)}
      style={{
        position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
        fontFamily: "'Amazon Ember','Segoe UI',system-ui,sans-serif",
        userSelect: 'none', cursor: showCtrl ? 'default' : 'none',
      }}
    >
      <style>{`
        .pp *{box-sizing:border-box}
        .pp-btn{background:none;border:none;cursor:pointer;color:rgba(179,179,179,1);padding:0;display:flex;align-items:center;justify-content:center;transition:color .15s,transform .1s}
        .pp-btn:hover{color:#fff;transform:scale(1.08)}
        .pp-bar{position:relative;height:4px;background:rgba(255,255,255,.2);cursor:pointer;transition:height .12s;border-radius:2px}
        .pp-bar:hover{height:7px}
        .pp-buf{position:absolute;top:0;left:0;height:100%;background:rgba(200,200,200,.3);pointer-events:none;border-radius:2px}
        .pp-play{position:absolute;top:0;left:0;height:100%;background:#fff;pointer-events:none;border-radius:2px}
        .pp-thumb{position:absolute;top:50%;width:14px;height:14px;background:#fff;border-radius:50%;transform:translate(-50%,-50%) scale(0);pointer-events:none;transition:transform .12s;box-shadow:0 0 4px rgba(0,0,0,.5)}
        .pp-bar:hover .pp-thumb{transform:translate(-50%,-50%) scale(1)}
        .pp-chap{position:absolute;top:0;width:2px;height:100%;background:rgba(0,0,0,.4);pointer-events:none;z-index:2}

        /* Dropdown panels */
        .pp-panel{position:absolute;right:0;bottom:calc(100% + 12px);background:rgba(10,10,10,.96);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.9);animation:pp-in .15s ease-out;min-width:220px;z-index:200}
        @keyframes pp-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .pp-section{padding:8px 0}
        .pp-section+.pp-section{border-top:1px solid rgba(255,255,255,.07)}
        .pp-section-label{padding:6px 14px 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.35)}
        .pp-item{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .1s;font-size:14px}
        .pp-item:hover{background:rgba(255,255,255,.08)}
        .pp-item.active{background:rgba(0,168,225,.12)}
        .pp-item.active .pp-item-label{color:#fff;font-weight:700}
        .pp-item .pp-item-label{color:rgba(255,255,255,.65)}
        .pp-item .pp-item-flag{font-size:16px;flex-shrink:0;width:22px;text-align:center}
        .pp-item .pp-item-badge{margin-left:auto;font-size:10px;padding:2px 6px;border-radius:99px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.5);white-space:nowrap}
        .pp-item.active .pp-item-badge{background:rgba(0,168,225,.2);color:#00A8E1}

        /* Volume popup */
        .pp-vol-pop{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);background:rgba(10,10,10,.96);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px 11px;width:36px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 6px 24px rgba(0,0,0,.9);animation:pp-in .12s ease-out;z-index:200}
        .pp-vtr{width:3px;height:100px;background:rgba(179,179,179,.2);border-radius:2px;position:relative;cursor:pointer}
        .pp-vfil{position:absolute;bottom:0;left:0;width:100%;background:rgba(179,179,179,.9);border-radius:2px;pointer-events:none}
        .pp-vknob{position:absolute;left:50%;width:11px;height:11px;background:#fff;border-radius:50%;transform:translate(-50%,50%);pointer-events:none}

        /* Spinner */
        .pp-spin{width:44px;height:44px;border-radius:50%;border:2px solid rgba(160,160,160,.2);border-top-color:rgba(160,160,160,.8);animation:pp-sp .8s linear infinite}
        @keyframes pp-sp{to{transform:rotate(360deg)}}

        /* Auto-mute banner */
        .pp-unmute{position:absolute;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);border:1px solid rgba(255,255,255,.25);color:#fff;padding:10px 24px;border-radius:999px;display:flex;align-items:center;gap:10px;cursor:pointer;z-index:40;backdrop-filter:blur(10px);white-space:nowrap;font-size:14px;font-weight:600;animation:pp-in .2s ease-out}
        .pp-unmute:hover{background:rgba(20,20,20,.95)}

        /* Skip flash */
        .pp-skfx{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;animation:pp-sf .55s ease-out forwards;font-size:18px;color:#fff;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.8)}
        @keyframes pp-sf{0%{opacity:.9;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-50%) scale(.85)}}

        /* Top-bar stream info badges */
        .pp-badge{font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
        .pp-badge.lang{background:rgba(0,168,225,.15);color:#00A8E1;border-color:rgba(0,168,225,.25);font-weight:700}

        /* Language button active indicator */
        .pp-lang-btn{position:relative}
        .pp-lang-btn .count{position:absolute;top:-5px;right:-5px;background:#00A8E1;color:#000;font-size:9px;font-weight:900;border-radius:99px;padding:1px 4px;line-height:1.4;min-width:16px;text-align:center}
      `}</style>

      {/* ── Auto-muted banner ─────────────────────────────────────────────── */}
      {autoMuted && (
        <div className="pp-unmute" onClick={e => {
          e.stopPropagation();
          const v = vidRef.current;
          if (v) { v.muted = false; v.volume = prevVol > 0 ? prevVol : 1; setAutoMuted(false); }
        }}>
          <IC.VolX /><span>Tap to unmute</span>
        </div>
      )}

      {/* ── Video element ─────────────────────────────────────────────────── */}
      <video
        ref={vidRef} playsInline preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onClick={e => {
          e.stopPropagation();
          if (autoMuted) {
            const v = vidRef.current;
            if (v) { v.muted = false; v.volume = prevVol > 0 ? prevVol : 1; setAutoMuted(false); }
            return;
          }
          togglePlay();
        }}
      />

      {/* ── Loading / buffering overlay ───────────────────────────────────── */}
      {(loadState === 'loading' || buffering) && loadState !== 'error' && (
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:loadState==='loading'?'#000':'transparent',zIndex:10,pointerEvents:'none',gap:12 }}>
          <div className="pp-spin" />
          {curStream && loadState === 'loading' && (
            <div style={{ color:'rgba(255,255,255,.35)',fontSize:12,textAlign:'center' }}>
              {curStream.source} · {curStream.quality} · {curStream.language}
            </div>
          )}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {loadState === 'error' && (
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#000',zIndex:20,gap:12 }}>
          <div style={{ fontSize:36 }}>⚠️</div>
          <div style={{ color:'#f87171',fontSize:18,fontWeight:700 }}>No Playable Streams Found</div>
          <div style={{ color:'#555',fontSize:13,textAlign:'center',maxWidth:360,lineHeight:1.65 }}>{errorMsg}</div>
          <button onClick={onClose} style={{ marginTop:8,background:'none',border:'1px solid rgba(255,255,255,.25)',color:'#fff',padding:'10px 30px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8 }}>
            <IC.Back /> Go Back
          </button>
        </div>
      )}

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}
      {loadState !== 'error' && (
        <div className="pp" style={{ position:'absolute',inset:0,opacity:showCtrl?1:0,transition:'opacity .28s',pointerEvents:showCtrl?'auto':'none',zIndex:15 }}>

          {/* Gradients */}
          <div style={{ position:'absolute',top:0,left:0,right:0,height:160,background:'linear-gradient(to bottom,rgba(0,0,0,.75),transparent)',pointerEvents:'none' }} />
          <div style={{ position:'absolute',bottom:0,left:0,right:0,height:180,background:'linear-gradient(to top,rgba(0,0,0,.85),transparent)',pointerEvents:'none' }} />

          {/* ── TOP BAR ──────────────────────────────────────────────────── */}
          <div style={{ position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'24px 32px',zIndex:20,pointerEvents:'auto' }}>

            {/* Title & stream badges */}
            <div style={{ display:'flex',flexDirection:'column',gap:5,maxWidth:'60%' }}>
              <span style={{ color:'#fff',fontSize:19,fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,.9)',lineHeight:1.2 }}>{movieTitle}</span>
              {mediaType === 'tv' && <span style={{ color:'#aaa',fontSize:13 }}>S{season} E{episode}{epTitle ? ` — ${epTitle}` : ''}</span>}
              {curStream && (
                <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:2 }}>
                  {curStream.language && <span className="pp-badge lang">{langFlag(curStream.language)} {curStream.language}</span>}
                  <span className="pp-badge">{curStream.quality}</span>
                  <span className="pp-badge">{curStream.source}</span>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div style={{ display:'flex',alignItems:'center',gap:20 }}>

              {/* ── LANGUAGE SWITCHER ──────────────────────────────────── */}
              <div style={{ position:'relative' }}>
                <button
                  className="pp-btn pp-lang-btn"
                  title="Audio Language"
                  onClick={e => { e.stopPropagation(); setPanel(panel === 'lang' ? null : 'lang'); }}
                  style={{ color: availableLanguages.length > 1 ? '#00A8E1' : 'rgba(179,179,179,1)' }}
                >
                  <IC.Globe />
                  {availableLanguages.length > 1 && (
                    <span className="count">{availableLanguages.length}</span>
                  )}
                </button>

                {panel === 'lang' && (
                  <div className="pp-panel" style={{ width:260 }} onClick={e => e.stopPropagation()}>

                    {/* Language list */}
                    <div className="pp-section">
                      <div className="pp-section-label">Audio Language</div>
                      {availableLanguages.length === 0 && (
                        <div style={{ padding:'8px 14px',color:'rgba(255,255,255,.3)',fontSize:13,fontStyle:'italic' }}>
                          No streams loaded yet
                        </div>
                      )}
                      {availableLanguages.map(lang => {
                        const isActive = curStream?.language === lang;
                        const qCount = streams.filter(s => s.language === lang).length;
                        return (
                          <div
                            key={lang}
                            className={`pp-item${isActive ? ' active' : ''}`}
                            onClick={() => switchLanguage(lang)}
                          >
                            <div style={{ width:16,flexShrink:0 }}>{isActive && <IC.Check />}</div>
                            <span className="pp-item-flag">{langFlag(lang)}</span>
                            <span className="pp-item-label">{lang}</span>
                            <span className="pp-item-badge">{qCount} {qCount === 1 ? 'quality' : 'qualities'}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quality list for current language */}
                    {qualitiesForCurrentLang.length > 1 && (
                      <div className="pp-section">
                        <div className="pp-section-label">Quality — {curStream?.language}</div>
                        {qualitiesForCurrentLang.map(s => (
                          <div
                            key={s.idx}
                            className={`pp-item${curIdx === s.idx ? ' active' : ''}`}
                            onClick={() => switchQuality(s.idx)}
                          >
                            <div style={{ width:16,flexShrink:0 }}>{curIdx === s.idx && <IC.Check />}</div>
                            <span className="pp-item-flag" style={{ fontSize:13 }}>🎬</span>
                            <span className="pp-item-label">{s.quality}</span>
                            <span className="pp-item-badge">{s.source.split(' ')[0]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── ALL STREAMS (Settings) ─────────────────────────────── */}
              <div style={{ position:'relative' }}>
                <button
                  className="pp-btn"
                  title="All Streams"
                  onClick={e => { e.stopPropagation(); setPanel(panel === 'quality' ? null : 'quality'); }}
                >
                  <IC.Settings />
                </button>
                {panel === 'quality' && (
                  <div className="pp-panel" style={{ width:300,maxHeight:'55vh',overflowY:'auto' }} onClick={e => e.stopPropagation()}>
                    <div className="pp-section">
                      <div className="pp-section-label">All Streams ({streams.length})</div>
                      {streams.map((s, i) => (
                        <div
                          key={i}
                          className={`pp-item${curIdx === i ? ' active' : ''}`}
                          onClick={() => {
                            const time = vidRef.current?.currentTime || 0;
                            setPanel(null);
                            loadStreamAt(i, time);
                          }}
                        >
                          <div style={{ width:16,flexShrink:0 }}>{curIdx === i && <IC.Check />}</div>
                          <span className="pp-item-flag">{langFlag(s.language)}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <span className="pp-item-label" style={{ display:'block' }}>
                              {s.language} · {s.quality}
                            </span>
                            <span style={{ color:'rgba(255,255,255,.3)',fontSize:11,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                              {s.source} · {s.type.toUpperCase()}{s.rawName ? ` · ${s.rawName.slice(0,35)}` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── VOLUME ───────────────────────────────────────────────── */}
              <div
                style={{ position:'relative' }}
                onMouseEnter={() => setPanel('vol')}
                onMouseLeave={() => { if (!dragVol) setPanel(null); }}
              >
                <button className="pp-btn" onClick={e => { e.stopPropagation(); toggleMute(); }}>
                  <VolIcon />
                </button>
                {panel === 'vol' && (
                  <div className="pp-vol-pop" onClick={e => e.stopPropagation()}>
                    <span style={{ color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:700 }}>
                      {Math.round((muted ? 0 : volume) * 100)}
                    </span>
                    <div
                      ref={volBarRef}
                      className="pp-vtr"
                      onMouseDown={e => { e.stopPropagation(); setDragVol(true); changeVol(volFromY(e)); }}
                    >
                      <div className="pp-vfil" style={{ height:`${(muted ? 0 : volume) * 100}%` }} />
                      <div className="pp-vknob" style={{ bottom:`${(muted ? 0 : volume) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <button className="pp-btn" title="Picture in Picture" onClick={e => { e.stopPropagation(); togglePiP(); }}><IC.PiP /></button>
              <button className="pp-btn" title={isFS ? 'Exit Fullscreen' : 'Fullscreen'} onClick={e => { e.stopPropagation(); toggleFS(); }}>
                {isFS ? <IC.ExitFS /> : <IC.FS />}
              </button>
              <div style={{ width:1,height:20,background:'rgba(255,255,255,.15)' }} />
              <button className="pp-btn" title="Close" onClick={e => { e.stopPropagation(); onClose?.(); }}><IC.Close /></button>
            </div>
          </div>

          {/* ── CENTER PLAY CONTROLS ──────────────────────────────────────── */}
          <div
            style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%, -50%)',display:'flex',alignItems:'center',gap:80,zIndex:20,pointerEvents:'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ position:'relative' }}>
              <button className="pp-btn" onClick={() => skip(-10)}><IC.Rw10 /></button>
              {skipFX === 'b' && <div className="pp-skfx">−10s</div>}
            </div>
            <button className="pp-btn" onClick={togglePlay}>{playing ? <IC.Pause /> : <IC.Play />}</button>
            <div style={{ position:'relative' }}>
              <button className="pp-btn" onClick={() => skip(10)}><IC.Fw10 /></button>
              {skipFX === 'f' && <div className="pp-skfx">+10s</div>}
            </div>
          </div>

          {/* ── BOTTOM BAR ───────────────────────────────────────────────── */}
          <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 32px 24px',zIndex:20,pointerEvents:'auto' }}>

            {/* Progress bar */}
            <div
              ref={progressRef}
              className="pp-bar"
              style={{ marginBottom:14 }}
              onMouseDown={onBarDown}
              onMouseMove={onBarMove}
              onMouseUp={onBarUp}
              onMouseLeave={onBarLeave}
              onClick={e => e.stopPropagation()}
            >
              <div className="pp-buf"  style={{ width:`${bPct}%` }} />
              <div className="pp-play" style={{ width:`${pPct}%` }} />
              {duration > 0 && [0.16, 0.33, 0.5, 0.66, 0.83].map((p, i) => (
                <div key={i} className="pp-chap" style={{ left:`${p*100}%` }} />
              ))}
              <div className="pp-thumb" style={{ left:`${pPct}%` }} />
              {hoverT !== null && progressRef.current && (
                <div style={{ position:'absolute',bottom:16,left:Math.max(22,Math.min(hoverX,progressRef.current.offsetWidth-22)),transform:'translateX(-50%)',background:'rgba(0,0,0,.88)',color:'#ccc',fontSize:11,padding:'3px 8px',borderRadius:4,whiteSpace:'nowrap',pointerEvents:'none' }}>
                  {fmt(hoverT)}
                </div>
              )}
            </div>

            {/* Time + next episode */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ fontSize:13,fontWeight:500 }}>
                <span style={{ color:'#fff' }}>{fmt(curTime)}</span>
                <span style={{ color:'rgba(255,255,255,.35)' }}> / {fmt(duration)}</span>
              </div>
              {mediaType === 'tv' && nextEp && (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/watch/tv/${tmdbId}?season=${nextEp.season}&episode=${nextEp.episode}`, { replace:true }); }}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:600,display:'flex',alignItems:'center',gap:4,padding:0,transition:'color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00A8E1'}
                  onMouseLeave={e => e.currentTarget.style.color = '#fff'}
                >
                  Next Episode <IC.ChevR />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
