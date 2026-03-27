// frontend/src/PrimePlayer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui'; // Use Shaka Player
import 'shaka-player/dist/controls.css'; // Required for Shaka internals, though UI is custom
import { useNavigate } from 'react-router-dom';

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── ICONS (Unchanged) ────────────────────────────────────────────────────────
const IC = {
  Sub: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="6" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Settings: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg>),
  VolHi: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolMid: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolX: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  FS: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ExitFS: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  PiP: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="10" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/></svg>),
  Close: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Check: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
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

export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();

  // Refs
  const vidRef       = useRef(null);
  const shakaRef     = useRef(null);
  const containerRef = useRef(null);
  const progressRef  = useRef(null);
  const volBarRef    = useRef(null);
  const ctrlTimer    = useRef(null);

  // Stream state
  const [loadState,  setLoadState]  = useState('loading'); 
  const [errorMsg,   setErrorMsg]   = useState('');

  // Playback
  const [playing,    setPlaying]    = useState(false);
  const [curTime,    setCurTime]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [buffering,  setBuffering]  = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [muted,      setMuted]      = useState(false);
  const [prevVol,    setPrevVol]    = useState(1);
  const [autoMuted,  setAutoMuted]  = useState(false);

  // DASH Tracks
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState('');
  const [subTracks,   setSubTracks]   = useState([]);
  const [activeSub,   setActiveSub]   = useState(-1);

  // UI
  const [showCtrl,   setShowCtrl]   = useState(true);
  const [isFS,       setIsFS]       = useState(false);
  const [seeking,    setSeeking]    = useState(false);
  const [dragVol,    setDragVol]    = useState(false);
  const [panel,      setPanel]      = useState(null); 
  const [skipFX,     setSkipFX]     = useState(null); 
  const [hoverT,     setHoverT]     = useState(null);
  const [hoverX,     setHoverX]     = useState(0);
  const [movieTitle, setMovieTitle] = useState(title);
  const [epTitle,    setEpTitle]    = useState('');

  // ── Shaka Player Init ────────────────────────────────────────────────────────
  useEffect(() => {
    // Install polyfills
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      setErrorMsg('Browser not supported for DASH playback.');
      setLoadState('error');
      return;
    }

    const video = vidRef.current;
    const player = new shaka.Player(video);
    shakaRef.current = player;

    // Listen for Shaka errors
    player.addEventListener('error', (event) => {
      console.error('Error code', event.detail.code, 'object', event.detail);
      setErrorMsg(`Player Error: ${event.detail.code}`);
      setLoadState('error');
    });

    // Load the DASH manifest from your custom Node server
    // Replace this URL with your actual server IP/Domain when you deploy it
    const dashUrl = 'http://localhost:3000/video/output.mpd';
    
    player.load(dashUrl).then(() => {
      setLoadState('ready');
      setBuffering(false);
      
      // Get all available audio and subtitle tracks from the MKV DASH conversion
      const tracks = player.getVariantTracks();
      const textTracks = player.getTextTracks();

      // Extract unique audio languages
      const uniqueLangs = [...new Set(tracks.map(t => t.language))].filter(Boolean);
      const formattedAudio = uniqueLangs.map(lang => ({
        id: lang,
        name: lang.toUpperCase()
      }));
      
      setAudioTracks(formattedAudio);

      // Find currently active audio
      const activeTrack = tracks.find(t => t.active);
      if (activeTrack) setActiveAudio(activeTrack.language);

      // Extract subtitles
      setSubTracks(textTracks.map((t, i) => ({
        id: t.id,
        language: t.language,
        name: t.label || t.language || `Sub ${i + 1}`
      })));

      video.play().catch(() => {
        video.muted = true;
        video.play().then(() => setAutoMuted(true));
      });

    }).catch(e => {
      setErrorMsg(`Failed to load manifest: ${e.message}`);
      setLoadState('error');
    });

    return () => {
      player.destroy();
    };
  }, []);

  // ── Track Switching Logic ────────────────────────────────────────────────────
  const handleAudioSwitch = (langCode) => {
    if (!shakaRef.current) return;
    shakaRef.current.selectAudioLanguage(langCode);
    setActiveAudio(langCode);
    setPanel(null); // Close panel
  };

  const handleSubSwitch = (trackId) => {
    if (!shakaRef.current) return;
    if (trackId === -1) {
      shakaRef.current.setTextTrackVisibility(false);
    } else {
      const track = shakaRef.current.getTextTracks().find(t => t.id === trackId);
      if (track) {
        shakaRef.current.selectTextTrack(track);
        shakaRef.current.setTextTrackVisibility(true);
      }
    }
    setActiveSub(trackId);
    setPanel(null);
  };

  // ── Video DOM events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current; if (!v) return;
    const evs = [
      ['play',           () => { setPlaying(true);  setBuffering(false); }],
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

  // ── Controls auto-hide ───────────────────────────────────────────────────────
  const resetCtrl = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);

  useEffect(() => { resetCtrl(); return () => clearTimeout(ctrlTimer.current); }, [resetCtrl]);
  useEffect(() => { if (panel) { setShowCtrl(true); clearTimeout(ctrlTimer.current); } else resetCtrl(); }, [panel, resetCtrl]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = vidRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
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

  // ── Progress bar ─────────────────────────────────────────────────────────────
  const barTimeAt = (e) => {
    const b = progressRef.current; if (!b || !duration) return 0;
    return Math.max(0, Math.min(1, (e.clientX - b.getBoundingClientRect().left) / b.offsetWidth)) * duration;
  };
  const onBarDown  = (e) => { setSeeking(true); const t = barTimeAt(e); if (vidRef.current) { vidRef.current.currentTime = t; setCurTime(t); } };
  const onBarMove  = (e) => {
    const t = barTimeAt(e);
    setHoverT(t);
    if (progressRef.current) setHoverX(e.clientX - progressRef.current.getBoundingClientRect().left);
    if (seeking && vidRef.current) { vidRef.current.currentTime = t; setCurTime(t); }
  };
  const onBarUp    = () => setSeeking(false);
  const onBarLeave = () => { setHoverT(null); if (seeking) setSeeking(false); };

  // ── Volume drag ──────────────────────────────────────────────────────────────
  const volFromY = (e) => {
    const s = volBarRef.current; if (!s) return volume;
    return 1 - Math.max(0, Math.min(1, (e.clientY - s.getBoundingClientRect().top) / s.offsetHeight));
  };
  useEffect(() => {
    if (!dragVol) return;
    const mv = (e) => changeVol(volFromY(e));
    const up = () => { setDragVol(false); setPanel(null); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [dragVol]);

  const pPct    = duration > 0 ? (curTime / duration) * 100 : 0;
  const bPct    = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolIcon = (muted || volume === 0) ? IC.VolX : volume < 0.5 ? IC.VolMid : IC.VolHi;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetCtrl}
      onClick={() => setPanel(null)}
      style={{
        position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
        fontFamily: "'Amazon Ember','Segoe UI',system-ui,sans-serif",
        userSelect: 'none',
        cursor: showCtrl ? 'default' : 'none',
      }}
    >
      <style>{`
        .pp *{box-sizing:border-box}
        .pp-btn{background:none;border:none;cursor:pointer;color:rgba(179,179,179,1);padding:0; display:flex;align-items:center;justify-content:center;transition:color .15s,transform .1s}
        .pp-btn:hover{color:#fff;transform:scale(1.08)}
        .pp-bar{position:relative;height:4px;background:rgba(179,179,179,.25); cursor:pointer;transition:height .12s;border-radius:2px}
        .pp-bar:hover{height:7px}
        .pp-buf{position:absolute;top:0;left:0;height:100%;background:rgba(200,200,200,.3); pointer-events:none;border-radius:2px}
        .pp-play{position:absolute;top:0;left:0;height:100%;background:#fff; pointer-events:none;border-radius:2px}
        .pp-thumb{position:absolute;top:50%;width:14px;height:14px;background:#fff; border-radius:50%;transform:translate(-50%,-50%) scale(0); pointer-events:none;transition:transform .12s;box-shadow:0 0 4px rgba(0,0,0,.5)}
        .pp-bar:hover .pp-thumb{transform:translate(-50%,-50%) scale(1)}
        .pp-panel{position:absolute;right:0;background:rgba(15,15,15,.97); border-radius:6px 0 0 6px;overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.9);animation:pp-in .15s ease-out}
        @keyframes pp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .pp-item{display:flex;align-items:center;gap:10px;padding:9px 14px; cursor:pointer;border-radius:4px;transition:background .1s}
        .pp-item:hover{background:rgba(255,255,255,.1)}
        .pp-vol-pop{position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%); background:rgba(15,15,15,.97);border-radius:6px;padding:14px 11px;width:36px; display:flex;flex-direction:column;align-items:center;gap:8px; box-shadow:0 6px 24px rgba(0,0,0,.9);animation:pp-in .12s ease-out;z-index:60}
        .pp-vtr{width:3px;height:100px;background:rgba(179,179,179,.2);border-radius:2px; position:relative;cursor:pointer}
        .pp-vfil{position:absolute;bottom:0;left:0;width:100%;background:rgba(179,179,179,.9); border-radius:2px;pointer-events:none}
        .pp-vknob{position:absolute;left:50%;width:11px;height:11px;background:#fff; border-radius:50%;transform:translate(-50%,50%);pointer-events:none}
        .pp-spin{width:44px;height:44px;border-radius:50%; border:2px solid rgba(160,160,160,.2);border-top-color:rgba(160,160,160,.8); animation:pp-sp .8s linear infinite}
        @keyframes pp-sp{to{transform:rotate(360deg)}}
      `}</style>

      {autoMuted && (
        <div className="pp-unmute" onClick={e => {
          e.stopPropagation();
          const v = vidRef.current;
          if (v) { v.muted = false; v.volume = prevVol > 0 ? prevVol : 1; setAutoMuted(false); }
        }} style={{ position: 'absolute', top: 20, right: 20, zIndex: 99, background: 'red', color: 'white', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>
          Tap to unmute
        </div>
      )}

      {/* ── VIDEO ─────────────────────────────────────────────────────────── */}
      <video
        ref={vidRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onClick={e => { e.stopPropagation(); togglePlay(); }}
      />

      {/* ── SPINNER ───────────────────────────────────────────────────────── */}
      {(loadState === 'loading' || buffering) && loadState !== 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
          <div className="pp-spin" />
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {loadState === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 18 }}>⚠️</div>
          <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Error Loading DASH Stream</div>
          <div style={{ color: '#666', fontSize: 13, textAlign: 'center', maxWidth: 360, marginBottom: 28 }}>{errorMsg}</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,.25)', color: '#fff', padding: '10px 30px', borderRadius: 6, cursor: 'pointer', display: 'flex', gap: 8 }}>
            <IC.Back /> Go Back
          </button>
        </div>
      )}

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}
      {loadState !== 'error' && (
        <div className="pp" style={{ position: 'absolute', inset: 0, opacity: showCtrl ? 1 : 0, transition: 'opacity .28s', pointerEvents: showCtrl ? 'auto' : 'none', zIndex: 15 }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:160, background:'linear-gradient(to bottom,rgba(0,0,0,.75),transparent)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:160, background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)', pointerEvents:'none' }} />

          {/* ── TOP BAR ──────────────────────────────────────────────────── */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '55%' }}>
              <span style={{ color: '#fff', fontSize: 19, fontWeight: 700 }}>{movieTitle || 'DASH Stream'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* Audio & Subtitles Menu */}
              <div style={{ position: 'relative' }}>
                <button className="pp-btn" onClick={e => { e.stopPropagation(); setPanel(panel === 'sub' ? null : 'sub'); }}><IC.Sub /></button>
                {panel === 'sub' && (
                  <div className="pp-panel" style={{ top: 42, width: 380 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex' }}>
                      {/* Subtitles */}
                      <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,.08)', padding: '16px 12px' }}>
                        <div style={{ color: '#aaa', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Subtitles</div>
                        <div className="pp-item" onClick={() => handleSubSwitch(-1)}>
                          <div style={{ width: 16 }}>{activeSub === -1 && <IC.Check />}</div>
                          <span style={{ color: activeSub === -1 ? '#fff' : 'rgba(255,255,255,.55)', fontSize: 14 }}>Off</span>
                        </div>
                        {subTracks.map(t => (
                          <div key={t.id} className="pp-item" onClick={() => handleSubSwitch(t.id)}>
                            <div style={{ width: 16 }}>{activeSub === t.id && <IC.Check />}</div>
                            <span style={{ color: activeSub === t.id ? '#fff' : 'rgba(255,255,255,.55)', fontSize: 14 }}>{t.name}</span>
                          </div>
                        ))}
                      </div>
                      {/* Audio */}
                      <div style={{ flex: 1, padding: '16px 12px' }}>
                        <div style={{ color: '#aaa', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Audio</div>
                        {audioTracks.length > 0 ? audioTracks.map(t => (
                          <div key={t.id} className="pp-item" onClick={() => handleAudioSwitch(t.id)}>
                            <div style={{ width: 16 }}>{activeAudio === t.id && <IC.Check />}</div>
                            <span style={{ color: activeAudio === t.id ? '#fff' : 'rgba(255,255,255,.55)', fontSize: 14 }}>{t.name}</span>
                          </div>
                        )) : (
                          <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 12, padding: '4px 14px', fontStyle: 'italic' }}>Default</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Volume */}
              <div style={{ position: 'relative' }} onMouseEnter={() => setPanel('vol')} onMouseLeave={() => { if (!dragVol) setPanel(null); }}>
                <button className="pp-btn" onClick={e => { e.stopPropagation(); toggleMute(); }}><VolIcon /></button>
                {panel === 'vol' && (
                  <div className="pp-vol-pop" onClick={e => e.stopPropagation()}>
                    <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 700 }}>{Math.round((muted ? 0 : volume) * 100)}</span>
                    <div ref={volBarRef} className="pp-vtr" onMouseDown={e => { e.stopPropagation(); setDragVol(true); changeVol(volFromY(e)); }}>
                      <div className="pp-vfil" style={{ height: `${(muted ? 0 : volume) * 100}%` }} />
                      <div className="pp-vknob" style={{ bottom: `${(muted ? 0 : volume) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <button className="pp-btn" onClick={e => { e.stopPropagation(); toggleFS(); }}>{isFS ? <IC.ExitFS /> : <IC.FS />}</button>
              <button className="pp-btn" onClick={e => { e.stopPropagation(); onClose?.(); }}><IC.Close /></button>
            </div>
          </div>

          {/* ── CENTER PLAY CONTROLS ──────────────────────────────────────── */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 80 }} onClick={e => e.stopPropagation()}>
            <button className="pp-btn" onClick={() => skip(-10)}><IC.Rw10 /></button>
            <button className="pp-btn" onClick={togglePlay}>{playing ? <IC.Pause /> : <IC.Play />}</button>
            <button className="pp-btn" onClick={() => skip(10)}><IC.Fw10 /></button>
          </div>

          {/* ── BOTTOM BAR ────────────────────────────────────────────────── */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 32px 24px' }}>
            <div ref={progressRef} className="pp-bar" style={{ marginBottom: 14 }} onMouseDown={onBarDown} onMouseMove={onBarMove} onMouseUp={onBarUp} onMouseLeave={onBarLeave} onClick={e => e.stopPropagation()}>
              <div className="pp-buf"  style={{ width: `${bPct}%` }} />
              <div className="pp-play" style={{ width: `${pPct}%` }} />
              <div className="pp-thumb" style={{ left: `${pPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}><span style={{ color: '#fff' }}>{fmt(curTime)}</span><span style={{ color: 'rgba(255,255,255,.4)' }}> / {fmt(duration)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
