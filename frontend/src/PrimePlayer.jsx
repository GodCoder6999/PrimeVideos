// frontend/src/PrimePlayer.jsx
// Sovereign player: no iframes, HLS.js only, multi-audio from manifest, MKV/MP4 direct.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { useNavigate } from 'react-router-dom';

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IC = {
  Sub: () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="6" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Settings: () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg>),
  VolHi:  () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolMid: () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  VolX:   () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  FS:     () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ExitFS: () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  PiP:    () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="10" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/></svg>),
  Close:  () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Check:  () => (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ChevR:  () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Rw10:   () => (<svg width="80" height="80" viewBox="0 0 64 64" fill="none"><path d="M16 24A20 20 0 1 1 16 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M25 15 L15 24 L25 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="32" dy="0.35em" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" fontFamily="system-ui">10</text></svg>),
  Fw10:   () => (<svg width="80" height="80" viewBox="0 0 64 64" fill="none"><path d="M48 24A20 20 0 1 0 48 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M39 15 L49 24 L39 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="32" dy="0.35em" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" fontFamily="system-ui">10</text></svg>),
  Play:   () => (<svg width="80" height="80" viewBox="0 0 64 64" fill="none"><path d="M24 16 L48 32 L24 48 Z" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/></svg>),
  Pause:  () => (<svg width="80" height="80" viewBox="0 0 64 64" fill="none"><rect x="20" y="16" width="7" height="32" rx="3" fill="currentColor"/><rect x="37" y="16" width="7" height="32" rx="3" fill="currentColor"/></svg>),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

// Normalise raw language codes from HLS.js audio track metadata
const normLang = (raw) => {
  if (!raw) return null;
  const map = {
    hin:'Hindi',hi:'Hindi',hindi:'Hindi',
    eng:'English',en:'English',english:'English',
    tam:'Tamil',ta:'Tamil',tamil:'Tamil',
    tel:'Telugu',te:'Telugu',telugu:'Telugu',
    mal:'Malayalam',ml:'Malayalam',malayalam:'Malayalam',
    kan:'Kannada',kn:'Kannada',kannada:'Kannada',
    ben:'Bengali',bn:'Bengali',bengali:'Bengali',
    mul:'Multi',multi:'Multi',und:'Unknown',
  };
  return map[raw.toLowerCase().trim()] || (raw.charAt(0).toUpperCase() + raw.slice(1));
};

const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── PLAYER ───────────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();

  // refs
  const vidRef         = useRef(null);
  const hlsRef         = useRef(null);
  const containerRef   = useRef(null);
  const progressRef    = useRef(null);
  const volSliderRef   = useRef(null);
  const ctrlTimerRef   = useRef(null);
  const streamsRef     = useRef([]); // full ordered stream list for fallback chain
  const streamIdxRef   = useRef(0);  // current position in fallback chain
  const resumedRef     = useRef(false);

  // stream state
  const [loadState,    setLoadState]    = useState('loading'); // loading | playing | error
  const [errorMsg,     setErrorMsg]     = useState('');
  const [streams,      setStreams]       = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);

  // playback state
  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [buffered,     setBuffered]     = useState(0);
  const [buffering,    setBuffering]    = useState(false);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [prevVol,      setPrevVol]      = useState(1);
  const [autoMuted,    setAutoMuted]    = useState(false);

  // audio/subtitle tracks — only populated for HLS streams
  const [audioTracks,  setAudioTracks]  = useState([]); // [{id, name}]
  const [activeAudio,  setActiveAudio]  = useState(0);
  const [subTracks,    setSubTracks]    = useState([]); // [{id, name}]
  const [activeSub,    setActiveSub]    = useState(-1);

  // ui
  const [showCtrl,     setShowCtrl]     = useState(true);
  const [isFS,         setIsFS]         = useState(false);
  const [seeking,      setSeeking]      = useState(false);
  const [draggingVol,  setDraggingVol]  = useState(false);
  const [panel,        setPanel]        = useState(null);
  const [skipFX,       setSkipFX]       = useState(null);
  const [hoverT,       setHoverT]       = useState(null);
  const [hoverX,       setHoverX]       = useState(0);
  const [movieTitle,   setMovieTitle]   = useState(title);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [nextEpData,   setNextEpData]   = useState(null);

  const chapters = duration > 0 ? [0.16,0.33,0.5,0.66,0.83].map(p => p * duration) : [];

  // ── TV episode metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType !== 'tv') return;
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`)
      .then(r => r.json()).then(d => {
        const ep = (d.episodes || []).find(e => e.episode_number == episode);
        if (ep) setEpisodeTitle(ep.name);
        const next = (d.episodes || []).find(e => e.episode_number == Number(episode) + 1);
        if (next) { setNextEpData({ season, episode: Number(episode) + 1 }); }
        else {
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`)
            .then(r => r.json()).then(tv => {
              const ns = (tv.seasons || []).find(s => s.season_number == Number(season) + 1);
              setNextEpData(ns && ns.episode_count > 0 ? { season: Number(season) + 1, episode: 1 } : null);
            });
        }
      }).catch(() => {});
  }, [tmdbId, mediaType, season, episode]);

  // ── Progress save/restore ──────────────────────────────────────────────────
  useEffect(() => { resumedRef.current = false; }, [tmdbId, season, episode]);

  const saveProgress = useCallback((time, dur) => {
    if (!tmdbId || !dur || time < 5) return;
    const key = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
    const all = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
    all[key] = { ...(all[key] || {}), id:tmdbId, type:mediaType,
      progress:{watched:time,duration:dur}, last_season_watched:season,
      last_episode_watched:episode, last_updated:Date.now(),
      ...(movieTitle ? {title:movieTitle} : {}) };
    localStorage.setItem('vidFastProgress', JSON.stringify(all));
  }, [tmdbId, mediaType, season, episode, movieTitle]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (playing && vidRef.current && duration > 0)
        saveProgress(vidRef.current.currentTime, duration);
    }, 5000);
    return () => clearInterval(iv);
  }, [playing, duration, saveProgress]);

  const attemptResume = useCallback((vid) => {
    if (resumedRef.current) return;
    const key  = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
    const prog = (JSON.parse(localStorage.getItem('vidFastProgress') || '{}'))[key];
    const sameEp = mediaType === 'tv'
      ? prog?.last_season_watched == season && prog?.last_episode_watched == episode
      : true;
    if (prog?.progress?.watched > 0 && sameEp && prog.progress.watched < prog.progress.duration * 0.95)
      vid.currentTime = prog.progress.watched;
    resumedRef.current = true;
  }, [tmdbId, mediaType, season, episode]);

  // ── Volume sync from DOM ───────────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current; if (!v) return;
    const fn = () => { setMuted(v.muted); setVolume(v.volume); if (!v.muted && v.volume > 0) setAutoMuted(false); };
    v.addEventListener('volumechange', fn);
    return () => v.removeEventListener('volumechange', fn);
  }, []);

  // ── Core: load a specific stream from the chain ────────────────────────────
  const loadStreamAt = useCallback((idx) => {
    const list = streamsRef.current;
    if (!list || idx >= list.length) {
      // Chain exhausted — show error UI
      setLoadState('error');
      setErrorMsg('No playable streams found for this title.');
      return;
    }

    const stream = list[idx];
    streamIdxRef.current = idx;
    setCurrentIdx(idx);
    setBuffering(true);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setAudioTracks([]);
    setActiveAudio(0);
    setSubTracks([]);
    setActiveSub(-1);

    // Destroy existing HLS instance
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const vid = vidRef.current;
    if (!vid) return;
    vid.pause();
    vid.removeAttribute('src');
    vid.load();

    const tryNext = (reason) => {
      console.warn(`[Player] stream ${idx} failed (${reason}), trying next`);
      loadStreamAt(idx + 1);
    };

    if (stream.type === 'hls') {
      // ── HLS via HLS.js ────────────────────────────────────────────────────
      if (!Hls.isSupported() && !vid.canPlayType('application/vnd.apple.mpegurl')) {
        return tryNext('HLS not supported');
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          backBufferLength: 60,
          maxBufferLength: 30,
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
          manifestLoadingMaxRetry: 2,
          xhrSetup: (xhr) => { xhr.withCredentials = false; },
        });
        hlsRef.current = hls;
        hls.loadSource(stream.url);
        hls.attachMedia(vid);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setBuffering(false);
          setLoadState('playing');

          // Cap ABR at 1080p (avoids AC3 in 4K)
          const cap = hls.levels.map((l,i) => ({h:l.height||0,i}))
            .filter(x => x.h > 0 && x.h <= 1080).sort((a,b) => b.h - a.h)[0];
          if (cap) hls.autoLevelCapping = cap.i;

          // ── MULTI-AUDIO from manifest (EXT-X-MEDIA tags rewritten by proxy) ──
          if (hls.audioTracks && hls.audioTracks.length > 0) {
            const tracks = hls.audioTracks.map((t, i) => ({
              id:   i,
              name: normLang(t.name) || normLang(t.lang) || normLang(t.language) || `Track ${i+1}`,
            }));
            setAudioTracks(tracks);
            // Prefer Hindi track if present
            const hindiIdx = tracks.findIndex(t => t.name === 'Hindi');
            const def = hindiIdx >= 0 ? hindiIdx : 0;
            hls.audioTrack = def;
            setActiveAudio(def);
          }

          // Subtitle tracks
          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            setSubTracks(hls.subtitleTracks.map((t, i) => ({
              id:   i,
              name: normLang(t.name || t.lang) || `Sub ${i+1}`,
            })));
            hls.subtitleTrack = -1;
            setActiveSub(-1);
          }

          vid.volume = 1; vid.muted = false;
          attemptResume(vid);
          vid.play()
            .then(() => setPlaying(true))
            .catch(() => {
              vid.muted = true;
              vid.play().then(() => { setPlaying(true); setAutoMuted(true); })
                .catch(() => { setBuffering(false); });
            });
        });

        // Auto-fallback on fatal HLS error
        let netR = 0, medR = 0;
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && netR < 2) {
            netR++;
            setTimeout(() => hls.startLoad(), 1500 * netR);
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && medR < 2) {
            medR++;
            hls.recoverMediaError();
          } else {
            hls.destroy();
            tryNext('fatal HLS error: ' + d.details);
          }
        });

      } else {
        // Safari native HLS
        vid.src = stream.url;
        vid.volume = 1; vid.muted = false;
        vid.addEventListener('loadedmetadata', () => {
          setBuffering(false); setLoadState('playing');
          attemptResume(vid);
          vid.play().then(() => setPlaying(true))
            .catch(() => { vid.muted = true; vid.play().then(() => { setPlaying(true); setAutoMuted(true); }); });
        }, { once: true });
        vid.addEventListener('error', () => tryNext('native HLS error'), { once: true });
      }

    } else {
      // ── Direct MP4 / MKV ─────────────────────────────────────────────────
      const loadTimer = setTimeout(() => {
        if (!vidRef.current) return;
        vid.volume = 1; vid.muted = false;
        vid.src = stream.url;
        vid.load();
      }, 50);

      let stallTimer = null;
      const onCanPlay = () => {
        clearTimeout(stallTimer);
        setBuffering(false); setLoadState('playing');
        attemptResume(vid);
        vid.play().then(() => setPlaying(true))
          .catch(() => { vid.muted = true; vid.play().then(() => { setPlaying(true); setAutoMuted(true); }); });
      };
      const onError = () => { clearTimeout(stallTimer); tryNext('video error code=' + vid.error?.code); };
      stallTimer = setTimeout(() => tryNext('stall timeout'), 12000);
      const onProgress = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => { if (vid.readyState < 3 && !vid.paused) tryNext('stall after progress'); }, 12000);
      };

      vid.addEventListener('canplay',  onCanPlay,  { once: true });
      vid.addEventListener('error',    onError,    { once: true });
      vid.addEventListener('progress', onProgress);

      const cleanup = () => {
        clearTimeout(loadTimer); clearTimeout(stallTimer);
        vid.removeEventListener('canplay',  onCanPlay);
        vid.removeEventListener('error',    onError);
        vid.removeEventListener('progress', onProgress);
      };
      vidRef._cleanup = cleanup;
    }
  }, [attemptResume]);

  // ── MAIN INIT (UPDATED FOR /api/multi-stream) ─────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    // Reset state for new media
    setLoadState('loading'); setErrorMsg('');
    setStreams([]); setCurrentIdx(0);
    setPlaying(false); setBuffering(false); setAutoMuted(false);
    setCurrentTime(0); setDuration(0); setBuffered(0);
    setAudioTracks([]); setSubTracks([]);
    streamsRef.current = []; streamIdxRef.current = 0;
    resumedRef.current = false;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    let cancelled = false;

    // 1. Fetch TMDB metadata (Title) in parallel
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setMovieTitle(d.title || d.name || title);
      })
      .catch(() => {});

    // 2. Fetch from the new multi-stream aggregator
    const fetchUrl = `/api/multi-stream?tmdbId=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`;
    
    fetch(fetchUrl)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        
        if (!data || !data.success || !data.streams || data.streams.length === 0) {
          setLoadState('error');
          setErrorMsg(data?.error || 'Extraction failed. No playable streams found.');
          return;
        }

        // 3. Map the returned streams.
        // Note: multi-stream.js handles wrapping the URL with our proxy automatically.
        const mappedStreams = data.streams.map(s => ({
          url: s.url,
          type: s.type || (s.url.includes('.m3u8') ? 'hls' : 'mp4'),
          quality: s.quality || 'Auto',
          provider: s.source || 'Aggregator',
          language: 'Multi'
        }));
        
        streamsRef.current = mappedStreams;
        setStreams(mappedStreams);
        
        // Start playback with the highest ranked stream
        loadStreamAt(0); 
      })
      .catch(err => {
        if (cancelled) return;
        setLoadState('error');
        setErrorMsg('Failed to fetch and extract streams.');
      });

    return () => {
      cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode, loadStreamAt, title]);

  // ── VIDEO DOM EVENTS ───────────────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current; if (!v) return;
    const h = [
      ['play',           () => { setPlaying(true);  setBuffering(false); }],
      ['pause',          () => setPlaying(false)],
      ['timeupdate',     () => setCurrentTime(v.currentTime)],
      ['durationchange', () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); }],
      ['progress',       () => { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); }],
      ['waiting',        () => setBuffering(true)],
      ['playing',        () => setBuffering(false)],
      ['canplay',        () => setBuffering(false)],
      ['stalled',        () => setBuffering(true)],
    ];
    h.forEach(([ev, fn]) => v.addEventListener(ev, fn));
    return () => h.forEach(([ev, fn]) => v.removeEventListener(ev, fn));
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const resetCtrl = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(ctrlTimerRef.current);
    ctrlTimerRef.current = setTimeout(() => { if (!panel) setShowCtrl(false); }, 3500);
  }, [panel]);
  useEffect(() => { resetCtrl(); return () => clearTimeout(ctrlTimerRef.current); }, [resetCtrl]);
  useEffect(() => { if (panel) { setShowCtrl(true); clearTimeout(ctrlTimerRef.current); } else resetCtrl(); }, [panel, resetCtrl]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); skip(-10); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
      else if (e.key === 'f') toggleFS();
      else if (e.key === 'm') toggleMute();
      else if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [playing, muted, volume]);

  useEffect(() => {
    const fn = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = vidRef.current; if (!v) return;
    if (playing) v.pause();
    else v.play().then(() => setPlaying(true))
      .catch(() => { v.muted = true; v.play().then(() => { setPlaying(true); setAutoMuted(true); }); });
  };
  const skip = sec => {
    const v = vidRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    setSkipFX(sec < 0 ? 'b' : 'f'); setTimeout(() => setSkipFX(null), 600);
  };
  const toggleMute = () => {
    const v = vidRef.current; if (!v) return;
    if (v.muted || v.volume === 0) { v.muted = false; v.volume = prevVol > 0 ? prevVol : 1; setAutoMuted(false); }
    else { setPrevVol(v.volume); v.muted = true; }
  };
  const changeVol = val => {
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
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); } catch (_) {}
  };

  // ── Progress bar ───────────────────────────────────────────────────────────
  const seekTime = e => {
    const b = progressRef.current; if (!b || !duration) return 0;
    return Math.max(0, Math.min(1, (e.clientX - b.getBoundingClientRect().left) / b.offsetWidth)) * duration;
  };
  const onBarDown  = e => { setSeeking(true); const t = seekTime(e); if (vidRef.current) { vidRef.current.currentTime = t; setCurrentTime(t); } };
  const onBarMove  = e => {
    const t = seekTime(e); setHoverT(t);
    if (progressRef.current) setHoverX(e.clientX - progressRef.current.getBoundingClientRect().left);
    if (seeking && vidRef.current) { vidRef.current.currentTime = t; setCurrentTime(t); }
  };
  const onBarUp    = () => setSeeking(false);
  const onBarLeave = () => { setHoverT(null); if (seeking) setSeeking(false); };

  const volFromY = e => {
    const s = volSliderRef.current; if (!s) return volume;
    return 1 - Math.max(0, Math.min(1, (e.clientY - s.getBoundingClientRect().top) / s.offsetHeight));
  };
  useEffect(() => {
    if (!draggingVol) return;
    const mv = e => changeVol(volFromY(e));
    const up = () => { setDraggingVol(false); setPanel(null); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [draggingVol]);

  const pPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bPct = duration > 0 ? (buffered   / duration) * 100 : 0;
  const VolI = (muted || volume === 0) ? IC.VolX : volume < 0.5 ? IC.VolMid : IC.VolHi;

  const curStream = streams[currentIdx] || null;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef}
      onMouseMove={resetCtrl}
      onClick={() => setPanel(null)}
      style={{ position:'fixed', inset:0, background:'#000',
               fontFamily:"'Amazon Ember','Segoe UI',system-ui,sans-serif",
               userSelect:'none', cursor: showCtrl ? 'default' : 'none', zIndex:9999 }}>

      <style>{`
        :root { --c: #B3B3B3; --ct: rgba(179,179,179,0.28); }
        .pb * { box-sizing: border-box; }
        .pbtn { background:none; border:none; cursor:pointer; color:var(--c); padding:0;
                display:flex; align-items:center; justify-content:center; transition:color .15s; }
        .pbtn:hover { color:#FFF; }
        .pbar  { position:relative; height:4px; background:var(--ct); cursor:pointer; transition:height .1s; }
        .pbar:hover { height:6px; }
        .pbuf  { position:absolute; top:0; left:0; height:100%; background:rgba(179,179,179,.35); pointer-events:none; }
        .ppld  { position:absolute; top:0; left:0; height:100%; background:#FFF; pointer-events:none; }
        .pthumb { position:absolute; top:50%; width:14px; height:14px; background:#FFF;
                  border-radius:50%; transform:translate(-50%,-50%) scale(0); pointer-events:none; transition:transform .1s; }
        .pbar:hover .pthumb { transform:translate(-50%,-50%) scale(1); }
        .cdot  { position:absolute; top:0; width:2px; height:100%; background:#000; pointer-events:none; z-index:2; }
        .panel { position:absolute; top:46px; right:0; background:#111;
                 border-radius:3px 0 0 3px; min-width:240px; overflow:hidden;
                 box-shadow:0 6px 24px rgba(0,0,0,.9); animation:pi .1s ease-out; }
        @keyframes pi { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        .volpop { position:absolute; top:100%; margin-top:8px; left:50%; transform:translateX(-50%);
                  background:#111; border-radius:4px; padding:14px 11px; width:38px;
                  display:flex; flex-direction:column; align-items:center; gap:10px;
                  box-shadow:0 6px 20px rgba(0,0,0,.9); animation:pi .1s ease-out; z-index:50; }
        .voltr  { width:3px; height:110px; background:var(--ct); border-radius:2px; position:relative; cursor:pointer; }
        .volfil { position:absolute; bottom:0; left:0; width:100%; background:var(--c); border-radius:2px; pointer-events:none; }
        .volknob{ position:absolute; left:50%; width:11px; height:11px; background:var(--c);
                  border-radius:50%; transform:translate(-50%,50%); pointer-events:none; }
        .qi:hover { background:rgba(255,255,255,.08); }
        .skfx  { position:absolute; top:50%; transform:translateY(-50%); pointer-events:none;
                 animation:sf .4s ease-out forwards; }
        @keyframes sf { 0%{opacity:.8} 100%{opacity:0} }
        .spin  { width:48px; height:48px; border-radius:50%;
                 border:2px solid rgba(170,170,170,.2); border-top-color:#AAA;
                 animation:sp .85s linear infinite; }
        @keyframes sp { to{transform:rotate(360deg)} }
        .unmute { position:absolute; bottom:90px; left:50%; transform:translateX(-50%);
                  background:rgba(0,0,0,.88); border:1px solid rgba(255,255,255,.3); color:#fff;
                  padding:10px 24px; border-radius:999px; display:flex; align-items:center;
                  gap:10px; cursor:pointer; z-index:30; backdrop-filter:blur(10px);
                  animation:pi .25s ease-out; white-space:nowrap; font-size:14px; font-weight:600; }
        .unmute:hover { background:rgba(20,20,20,.95); }
      `}</style>

      {/* ── TAP TO UNMUTE ── */}
      {autoMuted && (
        <div className="unmute" onClick={e => { e.stopPropagation(); const v=vidRef.current; if(v){v.muted=false;v.volume=prevVol>0?prevVol:1;setAutoMuted(false);} }}>
          <IC.VolX /><span>Tap to unmute</span>
        </div>
      )}

      {/* ── VIDEO ELEMENT ── */}
      <video ref={vidRef} playsInline preload="metadata"
        style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }}
        onClick={e => {
          e.stopPropagation();
          if (autoMuted) { const v=vidRef.current; if(v){v.muted=false;v.volume=prevVol>0?prevVol:1;setAutoMuted(false);} return; }
          togglePlay();
        }}
      />

      {/* ── LOADING SPINNER ── */}
      {(loadState === 'loading' || buffering) && loadState !== 'error' && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                      background: loadState==='loading' ? '#000' : 'transparent', zIndex:8, pointerEvents:'none' }}>
          <div className="spin" />
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {loadState === 'error' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center', background:'#000', zIndex:9 }}>
          <div style={{ fontSize:28, marginBottom:16 }}>⚠️</div>
          <div style={{ color:'#f87171', fontSize:17, fontWeight:700, marginBottom:8 }}>No Playable Streams Found</div>
          <div style={{ color:'#888', fontSize:13, marginBottom:24, textAlign:'center', maxWidth:360, lineHeight:1.6 }}>
            {errorMsg || 'Streams are not available for this title right now.'}
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'1px solid rgba(255,255,255,.3)', color:'#fff',
                     padding:'10px 28px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:14 }}>
            ← Go Back
          </button>
        </div>
      )}

      {/* ── CONTROLS ── */}
      {loadState !== 'error' && (
        <div className="pb" style={{ position:'absolute', inset:0,
                                      opacity: showCtrl ? 1 : 0, transition:'opacity .3s',
                                      pointerEvents: showCtrl ? 'auto' : 'none', zIndex:5 }}>
          {/* Gradients */}
          <div style={{ position:'absolute',top:0,left:0,right:0,height:140,
                        background:'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)',pointerEvents:'none'}} />
          <div style={{ position:'absolute',bottom:0,left:0,right:0,height:140,
                        background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)',pointerEvents:'none'}} />

          {/* TOP BAR */}
          <div style={{ position:'absolute',top:0,left:0,right:0,
                        display:'flex',alignItems:'center',justifyContent:'space-between',
                        padding:'28px 36px',zIndex:10,pointerEvents:'auto' }}>

            {/* Title */}
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ color:'#FFF', fontSize:20, fontWeight:600, textShadow:'0 1px 3px rgba(0,0,0,.8)' }}>
                {movieTitle}
              </span>
              {mediaType === 'tv' && (
                <span style={{ color:'#CCC', fontSize:14 }}>
                  Season {season}, Ep. {episode}{episodeTitle ? ` — ${episodeTitle}` : ''}
                </span>
              )}
              {curStream && (
                <span style={{ color:'#888', fontSize:11, marginTop:2 }}>
                  {curStream.provider} · {curStream.quality} · {curStream.language}
                  {streams.length > 1 && ` · Source ${currentIdx+1}/${streams.length}`}
                </span>
              )}
            </div>

            {/* Right controls */}
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>

              {/* Subtitles & Audio */}
              <div style={{ position:'relative' }}>
                <button className="pbtn" title="Audio & Subtitles"
                  onClick={e=>{e.stopPropagation();setPanel(panel==='sub'?null:'sub');}}>
                  <IC.Sub />
                </button>
                {panel === 'sub' && (
                  <div className="panel" style={{ width:400 }} onClick={e=>e.stopPropagation()}>
                    <div style={{ display:'flex' }}>
                      {/* Subtitles */}
                      <div style={{ flex:1, borderRight:'1px solid rgba(255,255,255,.12)', padding:'18px 14px' }}>
                        <div style={{ color:'#fff', fontSize:15, fontWeight:700, marginBottom:14 }}>Subtitles</div>
                        <div className="qi" style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 4px',cursor:'pointer',borderRadius:4 }}
                          onClick={()=>{setActiveSub(-1);if(hlsRef.current)hlsRef.current.subtitleTrack=-1;}}>
                          <div style={{width:18}}>{activeSub===-1&&<IC.Check/>}</div>
                          <span style={{color:activeSub===-1?'#fff':'rgba(255,255,255,.6)',fontSize:14}}>Off</span>
                        </div>
                        {subTracks.map(t=>(
                          <div key={t.id} className="qi" style={{display:'flex',alignItems:'center',gap:10,padding:'7px 4px',cursor:'pointer',borderRadius:4}}
                            onClick={()=>{setActiveSub(t.id);if(hlsRef.current)hlsRef.current.subtitleTrack=t.id;}}>
                            <div style={{width:18}}>{activeSub===t.id&&<IC.Check/>}</div>
                            <span style={{color:activeSub===t.id?'#fff':'rgba(255,255,255,.6)',fontSize:14}}>{t.name}</span>
                          </div>
                        ))}
                        {subTracks.length===0&&<div style={{color:'rgba(255,255,255,.3)',fontSize:12,fontStyle:'italic'}}>None available</div>}
                      </div>

                      {/* Audio */}
                      <div style={{ flex:1, padding:'18px 14px' }}>
                        <div style={{ color:'#fff', fontSize:15, fontWeight:700, marginBottom:14 }}>Audio</div>
                        {audioTracks.length > 0 ? audioTracks.map(t=>(
                          <div key={t.id} className="qi" style={{display:'flex',alignItems:'center',gap:10,padding:'7px 4px',cursor:'pointer',borderRadius:4}}
                            onClick={()=>{
                              if(hlsRef.current) hlsRef.current.audioTrack = t.id;
                              setActiveAudio(t.id);
                            }}>
                            <div style={{width:18}}>{activeAudio===t.id&&<IC.Check/>}</div>
                            <span style={{color:activeAudio===t.id?'#fff':'rgba(255,255,255,.6)',fontSize:14}}>{t.name}</span>
                          </div>
                        )) : (
                          <div style={{color:'rgba(255,255,255,.3)',fontSize:12,fontStyle:'italic'}}>
                            {curStream?.type === 'mkv' || curStream?.type === 'mp4'
                              ? 'Default audio (MKV/MP4)'
                              : 'Loading…'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quality / source */}
              <div style={{ position:'relative' }}>
                <button className="pbtn" title="Quality / Source"
                  onClick={e=>{e.stopPropagation();setPanel(panel==='q'?null:'q');}}>
                  <IC.Settings />
                </button>
                {panel === 'q' && (
                  <div className="panel" style={{ width:260, maxHeight:'60vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
                    <div style={{ padding:'18px 18px 12px' }}>
                      <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:12 }}>Quality / Source</div>
                      {streams.map((s,i)=>(
                        <div key={i} className="qi" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 4px',cursor:'pointer',borderRadius:4}}
                          onClick={()=>{ setPanel(null); loadStreamAt(i); }}>
                          <div style={{width:20,flexShrink:0}}>{currentIdx===i&&<IC.Check/>}</div>
                          <div>
                            <div style={{color:currentIdx===i?'#fff':'rgba(255,255,255,.8)',fontSize:14,fontWeight:currentIdx===i?700:400}}>
                              {s.quality}
                            </div>
                            <div style={{color:'rgba(255,255,255,.4)',fontSize:11,marginTop:1}}>
                              {s.language} · {s.type?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Volume */}
              <div style={{ position:'relative' }}
                onMouseEnter={()=>setPanel('vol')} onMouseLeave={()=>{if(!draggingVol)setPanel(null);}}>
                <button className="pbtn" onClick={e=>{e.stopPropagation();toggleMute();}}><VolI/></button>
                {panel==='vol'&&(
                  <div className="volpop" onClick={e=>e.stopPropagation()}>
                    <div ref={volSliderRef} className="voltr"
                      onMouseDown={e=>{e.stopPropagation();setDraggingVol(true);changeVol(volFromY(e));}}>
                      <div className="volfil" style={{height:`${(muted?0:volume)*100}%`}}/>
                      <div className="volknob" style={{bottom:`${(muted?0:volume)*100}%`}}/>
                    </div>
                  </div>
                )}
              </div>

              <button className="pbtn" title="PiP" onClick={e=>{e.stopPropagation();togglePiP();}}><IC.PiP/></button>
              <button className="pbtn" title="Fullscreen" onClick={e=>{e.stopPropagation();toggleFS();}}>
                {isFS ? <IC.ExitFS/> : <IC.FS/>}
              </button>
              <div style={{width:1,height:22,background:'#B3B3B3',opacity:.4}}/>
              <button className="pbtn" title="Close" onClick={e=>{e.stopPropagation();onClose?.();}}><IC.Close/></button>
            </div>
          </div>

          {/* CENTER CONTROLS */}
          <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                        display:'flex',alignItems:'center',gap:100,zIndex:8 }} onClick={e=>e.stopPropagation()}>
            <button className="pbtn" style={{position:'relative'}} onClick={()=>skip(-10)}>
              <IC.Rw10/>
              {skipFX==='b'&&<div className="skfx" style={{left:'50%',transform:'translate(-50%,-50%)',color:'#FFF',fontSize:22}}>-10</div>}
            </button>
            <button className="pbtn" onClick={togglePlay}>{playing?<IC.Pause/>:<IC.Play/>}</button>
            <button className="pbtn" style={{position:'relative'}} onClick={()=>skip(10)}>
              <IC.Fw10/>
              {skipFX==='f'&&<div className="skfx" style={{left:'50%',transform:'translate(-50%,-50%)',color:'#FFF',fontSize:22}}>+10</div>}
            </button>
          </div>

          {/* BOTTOM BAR */}
          <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 36px 28px',zIndex:10 }}>
            <div ref={progressRef} className="pbar" style={{marginBottom:12}}
              onMouseDown={onBarDown} onMouseMove={onBarMove} onMouseUp={onBarUp} onMouseLeave={onBarLeave}
              onClick={e=>e.stopPropagation()}>
              <div className="pbuf" style={{width:`${bPct}%`}}/>
              <div className="ppld" style={{width:`${pPct}%`}}/>
              {chapters.map((t,i)=><div key={i} className="cdot" style={{left:`${(t/duration)*100}%`}}/>)}
              <div className="pthumb" style={{left:`${pPct}%`}}/>
              {hoverT!==null&&(
                <div style={{position:'absolute',bottom:16,
                             left:Math.max(24,Math.min(hoverX,(progressRef.current?.offsetWidth||0)-24)),
                             transform:'translateX(-50%)',background:'rgba(0,0,0,.85)',
                             color:'#CCC',fontSize:11,padding:'3px 8px',borderRadius:4,
                             whiteSpace:'nowrap',pointerEvents:'none'}}>
                  {fmt(hoverT)}
                </div>
              )}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
              <div style={{fontSize:14,fontWeight:500}}>
                <span style={{color:'#FFF'}}>{fmt(currentTime)}</span>
                <span style={{color:'#888'}}> / {fmt(duration)}</span>
              </div>
              {mediaType==='tv'&&nextEpData&&(
                <button onClick={e=>{e.stopPropagation();navigate(`/watch/tv/${tmdbId}?season=${nextEpData.season}&episode=${nextEpData.episode}`,{replace:true});}}
                  style={{color:'#FFF',fontSize:14,fontWeight:600,background:'none',border:'none',cursor:'pointer',
                          display:'flex',alignItems:'center',gap:4,padding:0}}
                  onMouseEnter={e=>e.currentTarget.style.color='#00A8E1'}
                  onMouseLeave={e=>e.currentTarget.style.color='#FFF'}>
                  Next Episode <IC.ChevR/>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
