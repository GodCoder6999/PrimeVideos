// frontend/src/PrimePlayer.jsx
// Pure React rewrite — all panels rendered with JSX and direct onClick handlers.
// No innerHTML, no global window functions, no pointer-events hacks.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { useNavigate } from 'react-router-dom';

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

const fmt = s => {
  if (!s || isNaN(s)) return '0:00:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

const LANG_FLAG = {
  Hindi:'🇮🇳', Tamil:'🎭', Telugu:'🌟', Bengali:'🐯',
  Malayalam:'🌴', Kannada:'🏛️', Marathi:'🏔️', Punjabi:'🌾',
  English:'🇬🇧', 'Dual Audio':'🔀', 'Multi Audio':'🌐',
};
const flagFor = lang => {
  if (!lang) return '🎵';
  for (const [k, v] of Object.entries(LANG_FLAG)) if (lang.startsWith(k)) return v;
  return '🎵';
};

// ─── CSS injected once into <head> ────────────────────────────────────────────
const CSS = `
#us-player * { box-sizing: border-box; margin: 0; padding: 0; }
#us-player {
  position: fixed; inset: 0; z-index: 2147483647;
  background: #000; font-family: system-ui, sans-serif;
  user-select: none; overflow: hidden;
}
#us-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: contain;
  cursor: pointer; z-index: 1;
}
/* All control zones sit above the video */
.us-top, .us-center, .us-bottom {
  position: absolute; left: 0; right: 0;
  z-index: 10;
  pointer-events: none; /* zone itself transparent */
  transition: opacity .3s;
}
.us-top    { top: 0; }
.us-center { top: 50%; transform: translateY(-50%); display: flex; justify-content: center; }
.us-bottom { bottom: 0; }
/* But every interactive child re-enables pointer events */
.us-top *, .us-center *, .us-bottom * { pointer-events: auto; }

/* Gradients */
.us-grad-top {
  position: absolute; top: 0; left: 0; right: 0; height: 180px;
  background: linear-gradient(to bottom, rgba(0,0,0,.88), transparent);
  pointer-events: none; z-index: 9; transition: opacity .3s;
}
.us-grad-bot {
  position: absolute; bottom: 0; left: 0; right: 0; height: 220px;
  background: linear-gradient(to top, rgba(0,0,0,.92), transparent);
  pointer-events: none; z-index: 9; transition: opacity .3s;
}

/* Top bar layout */
.us-top-inner {
  display: flex; align-items: flex-start;
  justify-content: space-between; padding: 14px 20px;
}
.us-title-col { display: flex; flex-direction: column; gap: 4px; max-width: 55%; }
.us-title { color: #fff; font-size: 17px; font-weight: 700;
  text-shadow: 0 1px 8px rgba(0,0,0,.9); line-height: 1.2; }
.us-subtitle { color: rgba(255,255,255,.55); font-size: 13px; }
.us-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 3px; }
.us-pill {
  font-size: 11px; padding: 2px 8px; border-radius: 99px;
  background: rgba(255,255,255,.09); color: rgba(255,255,255,.6);
  border: 1px solid rgba(255,255,255,.1);
}
.us-pill.lang {
  background: rgba(0,168,225,.14); color: #00A8E1;
  border-color: rgba(0,168,225,.3); font-weight: 700;
}

/* Buttons */
.us-btns { display: flex; align-items: center; gap: 2px; }
.us-btn {
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: rgba(220,220,220,.9); padding: 8px; border-radius: 6px;
  font-size: inherit; font-family: inherit;
  transition: background .1s, color .12s;
  flex-shrink: 0; position: relative;
}
.us-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
.us-btn:active { transform: scale(.92); }
.us-btn.accent { color: #00A8E1; }
.us-dot {
  position: absolute; top: -4px; right: -4px;
  background: #00A8E1; color: #000; font-size: 9px; font-weight: 900;
  border-radius: 99px; padding: 1px 4px; min-width: 16px;
  text-align: center; line-height: 1.5; pointer-events: none;
}

/* Center transport */
.us-transport { display: flex; align-items: center; gap: 64px; }

/* Bottom bar */
.us-bottom-inner { padding: 0 20px 18px; }

/* Seek bar */
.us-seek {
  width: 100%; height: 5px; background: rgba(255,255,255,.18);
  border-radius: 3px; cursor: pointer; position: relative;
  margin-bottom: 12px; transition: height .12s;
}
.us-seek:hover { height: 8px; }
.us-seek-buf, .us-seek-play {
  position: absolute; top: 0; left: 0; height: 100%;
  border-radius: 3px; pointer-events: none;
}
.us-seek-buf  { background: rgba(255,255,255,.25); }
.us-seek-play { background: #fff; }
.us-seek-thumb {
  position: absolute; top: 50%; width: 13px; height: 13px;
  background: #fff; border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none; transition: transform .12s;
}
.us-seek:hover .us-seek-thumb { transform: translate(-50%, -50%) scale(1); }
.us-seek-tooltip {
  position: absolute; bottom: 16px;
  background: rgba(0,0,0,.9); color: #ccc;
  font-size: 11px; padding: 3px 8px; border-radius: 4px;
  white-space: nowrap; pointer-events: none;
  transform: translateX(-50%);
}
.us-time-row { display: flex; justify-content: space-between; align-items: center; }
.us-time { font-size: 13px; font-weight: 500; }
.us-time .cur { color: #fff; }
.us-time .dur { color: rgba(255,255,255,.35); }
.us-next-btn {
  background: none; border: none; cursor: pointer;
  color: #fff; font-size: 14px; font-weight: 600;
  display: flex; align-items: center; gap: 4px;
  transition: color .15s;
}
.us-next-btn:hover { color: #00A8E1; }

/* Dropdown panels */
.us-panel-wrap { position: relative; }
.us-panel {
  display: none; position: absolute;
  right: 0; bottom: calc(100% + 10px);
  background: #111; border: 1px solid rgba(255,255,255,.13);
  border-radius: 10px; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,.98);
  min-width: 220px; z-index: 9999;
  animation: usPanelIn .14s ease-out;
}
@keyframes usPanelIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.us-panel.open { display: block; }
.us-panel-sec + .us-panel-sec { border-top: 1px solid rgba(255,255,255,.07); }
.us-panel-lbl {
  padding: 8px 14px 3px;
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(255,255,255,.3);
}
.us-panel-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer; font-size: 14px;
  color: rgba(255,255,255,.65); transition: background .08s;
}
.us-panel-row:hover { background: rgba(255,255,255,.07); color: #fff; }
.us-panel-row.on { background: rgba(0,168,225,.14); color: #fff; font-weight: 600; }
.us-panel-badge {
  margin-left: auto; font-size: 10px; padding: 2px 7px;
  border-radius: 99px; background: rgba(255,255,255,.09);
  color: rgba(255,255,255,.45); white-space: nowrap;
}
.us-panel-row.on .us-panel-badge { background: rgba(0,168,225,.22); color: #00A8E1; }
.us-check { width: 13px; height: 13px; flex-shrink: 0; }
.us-check-space { width: 13px; flex-shrink: 0; }
.us-flag { font-size: 15px; width: 22px; text-align: center; }

/* Volume popup */
.us-vol-pop {
  display: none; position: absolute;
  bottom: calc(100% + 8px); left: 50%;
  transform: translateX(-50%);
  background: #111; border: 1px solid rgba(255,255,255,.13);
  border-radius: 8px; padding: 12px 10px; width: 36px;
  flex-direction: column; align-items: center; gap: 8px;
  box-shadow: 0 8px 30px rgba(0,0,0,.95); z-index: 9999;
}
.us-vol-pop.open { display: flex; }
.us-vol-label { color: rgba(255,255,255,.4); font-size: 11px; font-weight: 700; }
.us-vol-track {
  width: 3px; height: 96px; background: rgba(255,255,255,.15);
  border-radius: 2px; position: relative; cursor: pointer;
}
.us-vol-fill {
  position: absolute; bottom: 0; left: 0; width: 100%;
  background: rgba(255,255,255,.85); border-radius: 2px; pointer-events: none;
}
.us-vol-knob {
  position: absolute; left: 50%; width: 11px; height: 11px;
  background: #fff; border-radius: 50%;
  transform: translate(-50%, 50%); pointer-events: none;
}

/* Spinner */
.us-spinner {
  position: absolute; inset: 0; z-index: 8;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  pointer-events: none;
}
.us-spinner-ring {
  width: 44px; height: 44px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.1);
  border-top-color: rgba(255,255,255,.7);
  animation: usSpin .8s linear infinite;
}
@keyframes usSpin { to { transform: rotate(360deg); } }
.us-spinner-label { color: rgba(255,255,255,.4); font-size: 12px; }

/* Error */
.us-error {
  position: absolute; inset: 0; z-index: 20;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
  background: #000;
}
.us-error-icon  { font-size: 42px; }
.us-error-title { color: #f87171; font-size: 18px; font-weight: 700; }
.us-error-msg   { color: #555; font-size: 13px; text-align: center; max-width: 360px; line-height: 1.7; }
.us-error-back  {
  background: none; border: 1px solid rgba(255,255,255,.25);
  color: #fff; padding: 10px 28px; border-radius: 6px;
  cursor: pointer; font-weight: 700; font-size: 14px;
  margin-top: 8px;
}

/* Unmute banner */
.us-unmute {
  position: absolute; bottom: 110px; left: 50%;
  transform: translateX(-50%); z-index: 20;
  background: rgba(0,0,0,.88); border: 1px solid rgba(255,255,255,.2);
  color: #fff; padding: 10px 22px; border-radius: 999px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; white-space: nowrap; font-size: 14px; font-weight: 600;
}
.hidden { display: none !important; }
`;

function injectCSS() {
  if (document.getElementById('us-player-css')) return;
  const style = document.createElement('style');
  style.id = 'us-player-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ─── SVG icons as strings (safe to use with innerHTML) ────────────────────────
const SVG = {
  globe:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-linecap="round"/></svg>`,
  cog:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  volhi:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke-linecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke-linecap="round"/></svg>`,
  volmid:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke-linecap="round"/></svg>`,
  volx:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke-linecap="round"/></svg>`,
  pip:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><rect x="10" y="11" width="10" height="6" rx="1" fill="currentColor"/></svg>`,
  fsenter: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fsexit:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/></svg>`,
  rw:      `<svg width="40" height="40" viewBox="0 0 64 64" fill="none"><path d="M16 24A20 20 0 1 1 16 46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M25 15L15 24l10 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="38" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700" font-family="system-ui">10</text></svg>`,
  fw:      `<svg width="40" height="40" viewBox="0 0 64 64" fill="none"><path d="M48 24A20 20 0 1 0 48 46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M39 15l10 9-10 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="38" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700" font-family="system-ui">10</text></svg>`,
  play:    `<svg width="44" height="44" viewBox="0 0 64 64" fill="none"><path d="M22 14L52 32 22 50Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  pause:   `<svg width="44" height="44" viewBox="0 0 64 64" fill="none"><rect x="18" y="14" width="9" height="36" rx="3" fill="currentColor"/><rect x="37" y="14" width="9" height="36" rx="3" fill="currentColor"/></svg>`,
  check:   `<svg class="us-check" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="#00A8E1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// ─── The component ────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();

  // DOM refs
  const rootRef     = useRef(null);
  const videoRef    = useRef(null);
  const seekRef     = useRef(null);
  const volTrackRef = useRef(null);
  const hlsRef      = useRef(null);
  const ctrlTimer   = useRef(null);
  const resumedRef  = useRef(false);
  const cleanupRef  = useRef(null);
  const dragVolRef  = useRef(false);

  // Refs that mirror state for use inside async callbacks / HLS event handlers
  const streamsRef  = useRef([]);
  const curIdxRef   = useRef(0);

  // ── React state ─────────────────────────────────────────────────────────────
  const [ready,        setReady]        = useState(false);
  const [streams,      setStreams]      = useState([]);   // full stream list from API
  const [hlsTracks,    setHlsTracks]    = useState([]);   // HLS built-in audio tracks
  const [hlsActiveTrack, setHlsActiveTrack] = useState(0);
  const [curIdx,       setCurIdx]       = useState(0);    // currently playing stream index
  const [spinnerVisible, setSpinnerVisible] = useState(true);
  const [spinnerLabel,   setSpinnerLabel]   = useState('');
  const [errorMsg,     setErrorMsg]     = useState(null);
  const [langOpen,     setLangOpen]     = useState(false);
  const [allOpen,      setAllOpen]      = useState(false);
  const [volOpen,      setVolOpen]      = useState(false);
  const [titleText,    setTitleText]    = useState(title);
  const [subtitleText, setSubtitleText] = useState('');
  const [nextEpFn,     setNextEpFn]     = useState(null); // function | null
  const [playing,      setPlaying]      = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [volumePct,    setVolumePct]    = useState(100);  // 0-100 for display

  // ── Mount / unmount ──────────────────────────────────────────────────────────
  useEffect(() => {
    injectCSS();
    setReady(true);
    return () => {
      cleanupRef.current?.();
      hlsRef.current?.destroy();
      clearTimeout(ctrlTimer.current);
    };
  }, []);

  function getEl(id) { return document.getElementById(id); }

  // ── Controls show/hide ──────────────────────────────────────────────────────
  function showControls() {
    const top = getEl('us-top'), ctr = getEl('us-center'), bot = getEl('us-bottom');
    const gt  = getEl('us-grad-top'), gb = getEl('us-grad-bot');
    if (top) top.style.opacity = '1';
    if (ctr) ctr.style.opacity = '1';
    if (bot) bot.style.opacity = '1';
    if (gt)  gt.style.opacity  = '1';
    if (gb)  gb.style.opacity  = '1';
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(hideControls, 3500);
  }

  function hideControls() {
    if (langOpen || allOpen || volOpen) { showControls(); return; }
    const top = getEl('us-top'), ctr = getEl('us-center'), bot = getEl('us-bottom');
    const gt  = getEl('us-grad-top'), gb = getEl('us-grad-bot');
    if (top) top.style.opacity = '0';
    if (ctr) ctr.style.opacity = '0';
    if (bot) bot.style.opacity = '0';
    if (gt)  gt.style.opacity  = '0';
    if (gb)  gb.style.opacity  = '0';
  }

  function closeAllPanels() {
    setLangOpen(false);
    setAllOpen(false);
    setVolOpen(false);
  }

  // ── Seek bar ────────────────────────────────────────────────────────────────
  function onSeekClick(e) {
    e.stopPropagation();
    const bar = seekRef.current; if (!bar) return;
    const vid = videoRef.current; if (!vid || !vid.duration) return;
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    vid.currentTime = Math.max(0, Math.min(1, pct)) * vid.duration;
  }

  function onSeekHover(e) {
    const bar = seekRef.current; if (!bar) return;
    const vid = videoRef.current; if (!vid || !vid.duration) return;
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    const t   = Math.max(0, Math.min(1, pct)) * vid.duration;
    const tip = getEl('us-seek-tip');
    if (tip) {
      const x = Math.max(26, Math.min(e.clientX - bar.getBoundingClientRect().left, bar.offsetWidth - 26));
      tip.style.left   = x + 'px';
      tip.textContent  = fmt(t);
      tip.classList.remove('hidden');
    }
  }

  function onSeekLeave() {
    getEl('us-seek-tip')?.classList.add('hidden');
  }

  // ── Volume ──────────────────────────────────────────────────────────────────
  function setVolFromY(e) {
    const track = volTrackRef.current; if (!track) return;
    const rect  = track.getBoundingClientRect();
    const pct   = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const vid   = videoRef.current; if (!vid) return;
    vid.volume  = pct;
    vid.muted   = pct === 0;
    setMuted(pct === 0);
    setVolumePct(Math.round(pct * 100));
    updateVolSlider(pct, pct === 0);
  }

  function updateVolSlider(vol, isMuted) {
    const fill = getEl('us-vol-fill'), knob = getEl('us-vol-knob');
    const pct  = isMuted ? 0 : vol;
    if (fill) fill.style.height = (pct * 100) + '%';
    if (knob) knob.style.bottom = (pct * 100) + '%';
  }

  // ── Spinner / error helpers ──────────────────────────────────────────────────
  function showSpinner(label = '') {
    setSpinnerVisible(true);
    setSpinnerLabel(label);
    setErrorMsg(null);
  }

  function hideSpinner() {
    setSpinnerVisible(false);
  }

  function showError(msg) {
    setErrorMsg(msg);
    setSpinnerVisible(false);
  }

  // ── Core: load a stream by index ────────────────────────────────────────────
  function loadStream(idx) {
    const list = streamsRef.current;
    if (!list?.length)      { showError('No streams available.'); return; }
    if (idx >= list.length) { showError('All streams failed. Please go back and try again.'); return; }

    cleanupRef.current?.(); cleanupRef.current = null;
    hlsRef.current?.destroy(); hlsRef.current = null;

    const stream = list[idx];
    curIdxRef.current = idx;
    setCurIdx(idx);
    setHlsTracks([]);     // clear HLS tracks until new manifest parsed
    setErrorMsg(null);
    showSpinner(`${stream.source} · ${stream.quality} · ${stream.language}`);

    const vid = videoRef.current; if (!vid) return;
    vid.pause(); vid.removeAttribute('src'); vid.load();

    const tryNext = () => loadStream(idx + 1);

    function tryResume() {
      if (resumedRef.current) return;
      resumedRef.current = true;
      const key = mediaType === 'tv' ? `t${tmdbId}` : `m${tmdbId}`;
      try {
        const prog = JSON.parse(localStorage.getItem('vidFastProgress') || '{}')[key];
        if (prog?.progress?.watched && prog.progress.watched < prog.progress.duration * 0.95)
          vid.currentTime = prog.progress.watched;
      } catch (_) {}
    }

    if (stream.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(stream.url);
      hls.attachMedia(vid);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hideSpinner();
        vid.volume = 1; vid.muted = false;
        setMuted(false); setVolumePct(100);
        updateVolSlider(1, false);
        tryResume();
        vid.play().catch(() => { vid.muted = true; vid.play(); });

        const tracks = (hls.audioTracks || []).map((t, i) => ({
          language: t.lang || t.name, label: t.name || t.lang, idx: i,
        }));
        if (tracks.length) {
          setHlsTracks(tracks);
          setHlsActiveTrack(0);
        }
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        const tracks = (data.audioTracks || []).map((t, i) => ({
          language: t.lang || t.name, label: t.name || t.lang, idx: i,
        }));
        if (tracks.length) {
          setHlsTracks(tracks);
          setHlsActiveTrack(hls.audioTrack ?? 0);
        }
      });

      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) tryNext(); });
      return;
    }

    // MP4 / direct
    let stall = setTimeout(tryNext, 14000);
    const onOk = () => {
      clearTimeout(stall);
      hideSpinner();
      vid.volume = 1; vid.muted = false;
      setMuted(false); setVolumePct(100);
      updateVolSlider(1, false);
      tryResume();
      vid.play().catch(() => { vid.muted = true; vid.play(); });
    };
    const onErr = () => { clearTimeout(stall); tryNext(); };
    setTimeout(() => { vid.src = stream.url; vid.load(); }, 30);
    vid.addEventListener('canplay', onOk, { once: true });
    vid.addEventListener('error',   onErr, { once: true });
    cleanupRef.current = () => {
      clearTimeout(stall);
      vid.removeEventListener('canplay', onOk);
      vid.removeEventListener('error',   onErr);
    };
  }

  // ── Language / quality / stream selection handlers ───────────────────────────
  function selectLang(lang) {
    closeAllPanels(); showControls();
    const list = streamsRef.current; if (!list.length) return;
    const cur  = list[curIdxRef.current];
    let idx = list.findIndex(s => s.language === lang && s.quality === cur?.quality);
    if (idx === -1) idx = list.findIndex(s => s.language === lang);
    if (idx !== -1) loadStream(idx);
  }

  function selectStream(idx) {
    closeAllPanels(); showControls();
    loadStream(idx);
  }

  function switchHlsAudio(trackIdx) {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIdx;
      setHlsActiveTrack(trackIdx);
    }
    closeAllPanels(); showControls();
  }

  // ── Fetch streams on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    resumedRef.current = false;
    streamsRef.current = [];
    curIdxRef.current  = 0;
    setStreams([]);
    setHlsTracks([]);
    setCurIdx(0);

    // Fetch title from TMDB
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`)
      .then(r => r.json()).then(d => {
        if (!cancelled) setTitleText(d.title || d.name || title);
      }).catch(() => {});

    // Fetch episode info for TV
    if (mediaType === 'tv') {
      fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`)
        .then(r => r.json()).then(d => {
          if (cancelled) return;
          const ep = (d.episodes || []).find(e => e.episode_number == episode);
          setSubtitleText(`S${season} E${episode}${ep?.name ? ` — ${ep.name}` : ''}`);
          const nx = (d.episodes || []).find(e => e.episode_number == Number(episode) + 1);
          setNextEpFn(nx
            ? () => () => navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${Number(episode)+1}`, { replace: true })
            : null);
        }).catch(() => {});
    }

    // Fetch streams
    showSpinner('Finding streams…');
    fetch(`/api/multi-stream?${new URLSearchParams({ tmdbId, type: mediaType, season: String(season), episode: String(episode) })}`)
      .then(r => r.json()).then(data => {
        if (cancelled) return;
        if (!data.success || !data.streams?.length) { showError(data.error || 'No streams found.'); return; }
        streamsRef.current = data.streams;
        setStreams(data.streams);
        loadStream(0);
      }).catch(err => { if (!cancelled) showError('Fetch failed: ' + err.message); });

    return () => { cancelled = true; };
  }, [tmdbId, mediaType, season, episode, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const vid = videoRef.current; if (!vid) return;

    const onTimeUpdate = () => {
      if (!vid.duration) return;
      const pct   = (vid.currentTime / vid.duration) * 100;
      const play  = getEl('us-seek-play'), thumb = getEl('us-seek-thumb');
      if (play)  play.style.width = pct + '%';
      if (thumb) thumb.style.left = pct + '%';
      const timeCur = getEl('us-time-cur'), timeDur = getEl('us-time-dur');
      if (timeCur) timeCur.textContent = fmt(vid.currentTime);
      if (timeDur) timeDur.textContent = ' / ' + fmt(vid.duration);
    };

    const onProgress = () => {
      if (vid.buffered.length && vid.duration) {
        const buf = getEl('us-seek-buf');
        if (buf) buf.style.width = (vid.buffered.end(vid.buffered.length - 1) / vid.duration * 100) + '%';
      }
    };

    const onPlay  = () => { hideSpinner(); setPlaying(true);  };
    const onPause = () => { setPlaying(false); };
    const onVolCh = () => {
      setMuted(vid.muted);
      const v = vid.muted ? 0 : vid.volume;
      setVolumePct(Math.round(v * 100));
      updateVolSlider(vid.volume, vid.muted);
    };

    vid.addEventListener('timeupdate',   onTimeUpdate);
    vid.addEventListener('progress',     onProgress);
    vid.addEventListener('play',         onPlay);
    vid.addEventListener('playing',      onPlay);
    vid.addEventListener('pause',        onPause);
    vid.addEventListener('volumechange', onVolCh);

    return () => {
      vid.removeEventListener('timeupdate',   onTimeUpdate);
      vid.removeEventListener('progress',     onProgress);
      vid.removeEventListener('play',         onPlay);
      vid.removeEventListener('playing',      onPlay);
      vid.removeEventListener('pause',        onPause);
      vid.removeEventListener('volumechange', onVolCh);
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const vid = videoRef.current;
    const onKey = e => {
      if (!rootRef.current) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); vid?.paused ? vid.play() : vid?.pause(); break;
        case 'ArrowLeft':   e.preventDefault(); if (vid) vid.currentTime -= 10; break;
        case 'ArrowRight':  e.preventDefault(); if (vid) vid.currentTime += 10; break;
        case 'ArrowUp':     e.preventDefault(); if (vid) { vid.volume = Math.min(1, vid.volume + .1); vid.muted = false; } break;
        case 'ArrowDown':   e.preventDefault(); if (vid) vid.volume = Math.max(0, vid.volume - .1); break;
        case 'm':           if (vid) vid.muted = !vid.muted; break;
        case 'f':           document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); break;
        case 'Escape':      onClose?.(); break;
      }
      showControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Volume drag (global mouse events) ───────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const onMove = e => { if (dragVolRef.current) setVolFromY(e); };
    const onUp   = () => { dragVolRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived display values ───────────────────────────────────────────────────
  const currentStream  = streams[curIdx];
  const activeLang     = currentStream?.language;

  // Unique languages from stream list (for language panel when no HLS tracks)
  const uniqueLangs = [...new Set(streams.map(s => s.language))];

  // Quality options for the active language
  const qualityOptions = streams
    .map((s, i) => ({ ...s, idx: i }))
    .filter(s => s.language === activeLang);

  // Volume icon based on state
  const volIcon = (muted || volumePct === 0) ? SVG.volx : volumePct < 50 ? SVG.volmid : SVG.volhi;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!ready) return null;

  const playerHTML = (
    <div id="us-player" ref={rootRef} onMouseMove={showControls} onClick={closeAllPanels}>

      {/* VIDEO */}
      <video id="us-video" ref={videoRef} playsInline preload="metadata"
        onClick={e => {
          e.stopPropagation();
          closeAllPanels();
          const v = videoRef.current;
          if (v?.paused) v.play(); else v?.pause();
        }}
      />

      {/* SPINNER */}
      <div id="us-spinner" className={`us-spinner${spinnerVisible ? '' : ' hidden'}`}>
        <div className="us-spinner-ring" />
        <span className="us-spinner-label">{spinnerLabel}</span>
      </div>

      {/* ERROR */}
      {errorMsg && (
        <div className="us-error">
          <div className="us-error-icon">⚠️</div>
          <div className="us-error-title">No Playable Streams Found</div>
          <div className="us-error-msg">{errorMsg}</div>
          <button className="us-error-back" onClick={onClose}>← Go Back</button>
        </div>
      )}

      {/* GRADIENT OVERLAYS */}
      <div id="us-grad-top" className="us-grad-top" />
      <div id="us-grad-bot" className="us-grad-bot" />

      {/* ── TOP BAR ── */}
      <div id="us-top" className="us-top" onClick={e => e.stopPropagation()}>
        <div className="us-top-inner">

          {/* Title area */}
          <div className="us-title-col">
            <span className="us-title">{titleText}</span>
            {mediaType === 'tv' && subtitleText && (
              <span className="us-subtitle">{subtitleText}</span>
            )}
            {/* Stream pills */}
            {currentStream && (
              <div className="us-pills">
                {currentStream.language && (
                  <span className="us-pill lang">{flagFor(currentStream.language)} {currentStream.language}</span>
                )}
                {currentStream.quality && <span className="us-pill">{currentStream.quality}</span>}
                {currentStream.source  && <span className="us-pill">{currentStream.source}</span>}
              </div>
            )}
          </div>

          <div className="us-btns">

            {/* LANGUAGE / QUALITY PANEL */}
            <div className="us-panel-wrap">
              <button className="us-btn accent" title="Audio Language"
                onClick={e => { e.stopPropagation(); setLangOpen(o => !o); setAllOpen(false); setVolOpen(false); showControls(); }}>
                <span dangerouslySetInnerHTML={{ __html: SVG.globe }} />
                {streams.length > 0 && <span className="us-dot">{uniqueLangs.length}</span>}
              </button>

              <div className={`us-panel${langOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>

                {/* Language section: HLS tracks OR stream languages */}
                <div className="us-panel-sec">
                  <div className="us-panel-lbl">Audio Language</div>

                  {hlsTracks.length > 0 ? (
                    // HLS built-in audio tracks
                    hlsTracks.map((track, i) => (
                      <div key={i}
                        className={`us-panel-row${i === hlsActiveTrack ? ' on' : ''}`}
                        onClick={() => switchHlsAudio(i)}>
                        <span className="us-check-space">
                          {i === hlsActiveTrack && <span dangerouslySetInnerHTML={{ __html: SVG.check }} />}
                        </span>
                        <span className="us-flag">{flagFor(track.language)}</span>
                        <span style={{ flex: 1 }}>{track.label || track.language}</span>
                      </div>
                    ))
                  ) : (
                    // Stream-based language switching
                    uniqueLangs.map(lang => {
                      const qCount  = streams.filter(s => s.language === lang).length;
                      const isActive = lang === activeLang;
                      return (
                        <div key={lang}
                          className={`us-panel-row${isActive ? ' on' : ''}`}
                          onClick={() => selectLang(lang)}>
                          <span className="us-check-space">
                            {isActive && <span dangerouslySetInnerHTML={{ __html: SVG.check }} />}
                          </span>
                          <span className="us-flag">{flagFor(lang)}</span>
                          <span style={{ flex: 1 }}>{lang}</span>
                          <span className="us-panel-badge">{qCount} {qCount === 1 ? 'quality' : 'qualities'}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quality section (only for stream-based mode with multiple qualities) */}
                {hlsTracks.length === 0 && qualityOptions.length > 1 && (
                  <div className="us-panel-sec">
                    <div className="us-panel-lbl">Quality — {activeLang}</div>
                    {qualityOptions.map(s => (
                      <div key={s.idx}
                        className={`us-panel-row${curIdx === s.idx ? ' on' : ''}`}
                        onClick={() => selectStream(s.idx)}>
                        <span className="us-check-space">
                          {curIdx === s.idx && <span dangerouslySetInnerHTML={{ __html: SVG.check }} />}
                        </span>
                        <span className="us-flag" style={{ fontSize: 13 }}>🎬</span>
                        <span style={{ flex: 1 }}>{s.quality}</span>
                        <span className="us-panel-badge">{s.source.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ALL STREAMS PANEL */}
            <div className="us-panel-wrap">
              <button className="us-btn" title="All Streams"
                onClick={e => { e.stopPropagation(); setAllOpen(o => !o); setLangOpen(false); setVolOpen(false); showControls(); }}>
                <span dangerouslySetInnerHTML={{ __html: SVG.cog }} />
              </button>

              <div className={`us-panel${allOpen ? ' open' : ''}`}
                style={{ width: 300, maxHeight: '55vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>
                <div className="us-panel-sec">
                  <div className="us-panel-lbl">All Streams</div>
                  {streams.map((s, i) => (
                    <div key={i}
                      className={`us-panel-row${curIdx === i ? ' on' : ''}`}
                      onClick={() => selectStream(i)}>
                      <span className="us-check-space">
                        {curIdx === i && <span dangerouslySetInnerHTML={{ __html: SVG.check }} />}
                      </span>
                      <span className="us-flag">{flagFor(s.language)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{s.language} · {s.quality}</span>
                        <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.source} · {s.type?.toUpperCase()}{s.rawName ? ' · ' + s.rawName.slice(0, 30) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* VOLUME */}
            <div className="us-panel-wrap"
              onMouseEnter={() => { setVolOpen(true); showControls(); }}
              onMouseLeave={() => { if (!dragVolRef.current) setVolOpen(false); }}>
              <button className="us-btn" title="Volume"
                onClick={e => {
                  e.stopPropagation();
                  const v = videoRef.current; if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                  setVolumePct(v.muted ? 0 : Math.round(v.volume * 100));
                  updateVolSlider(v.volume, v.muted);
                }}>
                <span dangerouslySetInnerHTML={{ __html: volIcon }} />
              </button>

              <div className={`us-vol-pop${volOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
                <span className="us-vol-label">{volumePct}</span>
                <div ref={volTrackRef} className="us-vol-track"
                  onMouseDown={e => { e.stopPropagation(); dragVolRef.current = true; setVolFromY(e); }}>
                  <div id="us-vol-fill" className="us-vol-fill" style={{ height: volumePct + '%' }} />
                  <div id="us-vol-knob" className="us-vol-knob" style={{ bottom: volumePct + '%' }} />
                </div>
              </div>
            </div>

            {/* PIP */}
            <button className="us-btn" title="Picture in Picture"
              onClick={e => {
                e.stopPropagation();
                const v = videoRef.current; if (!v) return;
                document.pictureInPictureElement
                  ? document.exitPictureInPicture()
                  : v.requestPictureInPicture?.().catch(() => {});
              }}>
              <span dangerouslySetInnerHTML={{ __html: SVG.pip }} />
            </button>

            {/* FULLSCREEN */}
            <button className="us-btn" title="Fullscreen"
              onClick={e => {
                e.stopPropagation();
                document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen?.();
              }}>
              <span dangerouslySetInnerHTML={{ __html: SVG.fsenter }} />
            </button>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.15)', margin: '0 4px' }} />

            {/* CLOSE */}
            <button className="us-btn" title="Close"
              onClick={e => { e.stopPropagation(); onClose?.(); }}>
              <span dangerouslySetInnerHTML={{ __html: SVG.close }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── CENTER TRANSPORT ── */}
      <div id="us-center" className="us-center" onClick={e => e.stopPropagation()}>
        <div className="us-transport">
          <button className="us-btn" onClick={e => { e.stopPropagation(); const v = videoRef.current; if (v) v.currentTime -= 10; }}>
            <span dangerouslySetInnerHTML={{ __html: SVG.rw }} />
          </button>
          <button className="us-btn" style={{ padding: 10 }}
            onClick={e => {
              e.stopPropagation();
              const v = videoRef.current;
              if (v?.paused) v.play(); else v?.pause();
            }}>
            <span dangerouslySetInnerHTML={{ __html: playing ? SVG.pause : SVG.play }} />
          </button>
          <button className="us-btn" onClick={e => { e.stopPropagation(); const v = videoRef.current; if (v) v.currentTime += 10; }}>
            <span dangerouslySetInnerHTML={{ __html: SVG.fw }} />
          </button>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div id="us-bottom" className="us-bottom" onClick={e => e.stopPropagation()}>
        <div className="us-bottom-inner">
          {/* Seek bar */}
          <div id="us-seek" ref={seekRef} className="us-seek"
            onClick={onSeekClick}
            onMouseMove={onSeekHover}
            onMouseLeave={onSeekLeave}>
            <div id="us-seek-buf"   className="us-seek-buf"  style={{ width: 0 }} />
            <div id="us-seek-play"  className="us-seek-play" style={{ width: 0 }} />
            <div id="us-seek-thumb" className="us-seek-thumb" style={{ left: 0 }} />
            <div id="us-seek-tip"   className="us-seek-tooltip hidden" />
          </div>
          {/* Time / next episode row */}
          <div className="us-time-row">
            <div className="us-time">
              <span id="us-time-cur" className="cur">0:00:00</span>
              <span id="us-time-dur" className="dur"> / 0:00:00</span>
            </div>
            {mediaType === 'tv' && nextEpFn && (
              <button className="us-next-btn" onClick={() => nextEpFn()}>
                Next Episode →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(playerHTML, document.body);
}
