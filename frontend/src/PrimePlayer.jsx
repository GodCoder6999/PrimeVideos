import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const C = '#A3A3A3'; // The one true color for all controls
const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── ICONS — pixel-perfect match to Prime Video screenshots ─────────────────

// Subtitles icon (CC box)
const SubtitlesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke={C} strokeWidth="1.5"/>
    <line x1="5" y1="10.5" x2="11" y2="10.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="13" y1="10.5" x2="19" y2="10.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="5" y1="14.5" x2="9" y2="14.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="11" y1="14.5" x2="15" y2="14.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Settings / gear
const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke={C} strokeWidth="1.5"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={C} strokeWidth="1.5"/>
  </svg>
);

// Volume / speaker icon — matches screenshot icon 3 (speaker with waves)
const VolumeHighIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VolumeMidIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VolumeMuteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
    <line x1="23" y1="9" x2="17" y2="15" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="17" y1="9" x2="23" y2="15" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// PiP — mini screen-in-screen icon (image 2, 4th button)
const PiPIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke={C} strokeWidth="1.5"/>
    <rect x="12" y="12" width="8" height="6" rx="1" fill={C}/>
  </svg>
);

// Resize/fullscreen arrows (the double diagonal arrows icon, 5th in image 2)
const ResizeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="7" y1="17" x2="17" y2="7" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <polyline points="7 7 7 17 17 17" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ExitResizeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="15 3 21 3 21 9" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 21 3 21 3 15" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="3" x2="14" y2="10" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="21" x2="10" y2="14" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Close X (last button in image 2)
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="18" y1="6" x2="6" y2="18" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke={C} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Rewind 10 (image 3, left)
const Rewind10Icon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 6C13.163 6 6 13.163 6 22s7.163 16 16 16 16-7.163 16-16" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <polyline points="22,6 16,12 22,6 16,0" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="22" y="27" textAnchor="middle" fill={C} fontSize="10" fontWeight="500" fontFamily="'Amazon Ember', system-ui, sans-serif">10</text>
  </svg>
);

// Forward 10 (image 3, right)
const Forward10Icon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 6C30.837 6 38 13.163 38 22S30.837 38 22 38 6 30.837 6 22" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <polyline points="22,6 28,12 22,6 28,0" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="22" y="27" textAnchor="middle" fill={C} fontSize="10" fontWeight="500" fontFamily="'Amazon Ember', system-ui, sans-serif">10</text>
  </svg>
);

// Pause (image 3, center)
const PauseIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="8" width="9" height="28" rx="1.5" fill={C}/>
    <rect x="25" y="8" width="9" height="28" rx="1.5" fill={C}/>
  </svg>
);

// Play
const PlayIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="10,6 38,22 10,38" fill={C}/>
  </svg>
);

// Checkmark for panels
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// X-Ray chevrons
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="9 18 15 12 9 6" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="18 15 12 9 6 15" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="6 9 12 15 18 9" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ─── EMBED LIST ───────────────────────────────────────────────────────────────
const buildEmbeds = (tid, iid, mType, s, e) => {
  const tv = mType === 'tv';
  const list = [];
  if (iid) {
    list.push({ name: 'VidSrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${iid}` });
    list.push({ name: 'VidFast',    url: tv ? `https://vidfast.pro/tv/${iid}/${s}/${e}?autoPlay=true` : `https://vidfast.pro/movie/${iid}?autoPlay=true` });
    list.push({ name: 'VidSrc.me',  url: tv ? `https://vidsrc.me/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${iid}` });
  }
  list.push({ name: 'Videasy',    url: tv ? `https://player.videasy.net/tv/${tid}/${s}/${e}` : `https://player.videasy.net/movie/${tid}` });
  list.push({ name: 'AutoEmbed',  url: tv ? `https://autoembed.cc/tv/tmdb/${tid}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${tid}` });
  list.push({ name: 'EmbedSu',    url: tv ? `https://embed.su/embed/tv/${tid}/${s}/${e}` : `https://embed.su/embed/movie/${tid}` });
  list.push({ name: 'VidSrc.in',  url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tid}` });
  list.push({ name: '2Embed',     url: tv ? `https://www.2embed.cc/embedtv/${tid}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${tid}` });
  list.push({ name: 'SuperEmbed', url: tv ? `https://multiembed.mov/?video_id=${tid}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${tid}&tmdb=1` });
  return list;
};

// ─── MAIN PLAYER ─────────────────────────────────────────────────────────────
export default function PrimePlayer({
  tmdbId,
  title = '',
  mediaType = 'movie',
  season = 1,
  episode = 1,
  onClose,
}) {
  const containerRef    = useRef(null);
  const videoRef        = useRef(null);
  const hlsRef          = useRef(null);
  const iframeRef       = useRef(null);
  const progressBarRef  = useRef(null);
  const controlsTimerRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const iframeTimerRef  = useRef(null);

  // Playback
  const [playing, setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);
  const [buffered, setBuffered]   = useState(0);
  const [volume, setVolume]       = useState(1);
  const [muted, setMuted]         = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking]     = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState(null);

  // Stream
  const [mode, setMode]           = useState('loading'); // 'loading'|'hls'|'direct'|'iframe'
  const [hlsUrl, setHlsUrl]       = useState(null);
  const [provider, setProvider]   = useState('');
  const [directFiles, setDirectFiles] = useState([]);
  const [directIdx, setDirectIdx] = useState(0);
  const [embeds, setEmbeds]       = useState([]);
  const [embedIdx, setEmbedIdx]   = useState(0);
  const [embedPhase, setEmbedPhase] = useState('loading');
  const [imdbId, setImdbId]       = useState(null);
  const [movieTitle, setMovieTitle] = useState(title);

  // UI
  const [activePanel, setActivePanel] = useState(null);
  const [quality, setQuality]     = useState('Best');
  const [subtitleTrack, setSubtitleTrack] = useState('Off');
  const [audioTrack, setAudioTrack] = useState('हिन्दी');

  // X-Ray
  const [xrayOpen, setXrayOpen]   = useState(false);
  const [xrayExpanded, setXrayExpanded] = useState(false);
  const [xrayCast, setXrayCast]   = useState([]);
  const [xrayTab, setXrayTab]     = useState('scene');
  const [expandedCastId, setExpandedCastId] = useState(null);

  // Progress hover
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX]       = useState(0);

  // ── MAIN INIT ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    setMode('loading');
    setHlsUrl(null);
    setProvider('');
    setDirectFiles([]);
    setDirectIdx(0);
    setBuffering(false);
    setEmbeds([]);
    setEmbedIdx(0);
    setEmbedPhase('loading');
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Pre-populate embeds immediately with tmdb id
    setEmbeds(buildEmbeds(tmdbId, null, mediaType, season, episode));

    let _cancelled = false;

    (async () => {
      // Fetch TMDB metadata + IMDB id in background
      try {
        const r = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits`,
          { signal: AbortSignal.timeout(8000) }
        );
        const d = await r.json();
        if (_cancelled) return;
        const iid = d.imdb_id || d.external_ids?.imdb_id || null;
        setImdbId(iid);
        setMovieTitle(d.title || d.name || title);
        setXrayCast((d.credits?.cast || []).slice(0, 12).map(p => ({
          id: p.id, name: p.name, character: p.character,
          profile: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        })));
        if (iid) setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
      } catch (_) {}

      if (_cancelled) return;

      // Try /api/multi-stream for direct HLS extraction
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 9000);
        const res  = await fetch(
          `/api/multi-stream?${new URLSearchParams({ tmdbId, type: mediaType, season, episode })}`,
          { signal: ctrl.signal }
        ).finally(() => clearTimeout(tid));

        const data = await res.json();
        if (!_cancelled && data?.success && data.streams?.length) {
          const stream = data.streams[0];
          if (stream.url.includes('.m3u8')) {
            setHlsUrl(stream.url);
            setProvider(stream.provider || 'VidSrc');
            setBuffering(true);
            setMode('hls');
            return;
          }
          if (stream.url.includes('.mp4') || stream.url.includes('.mkv')) {
            setDirectFiles([{ url: stream.url, quality: stream.quality || 'Auto', provider: stream.provider }]);
            setDirectIdx(0);
            setBuffering(true);
            setMode('direct');
            return;
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[PrimePlayer] VidSrc extraction failed:', e.message);
      }

      if (_cancelled) return;

      // Fallback to iframe embed
      setMode('iframe');
    })();

    return () => {
      _cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode]);

  // ── HLS SETUP ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const vid = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, backBufferLength: 60 });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        vid.play().catch(() => {});
        setPlaying(true);
        setBuffering(false);
      });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) {
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setTimeout(() => { if (!hlsRef.current) return; setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }, 1000);
          }
        }
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = hlsUrl;
      vid.addEventListener('loadedmetadata', () => { vid.play().catch(() => {}); setPlaying(true); }, { once: true });
    } else {
      setMode('iframe');
    }
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ── DIRECT MODE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current || !directFiles.length) return;
    const vid = videoRef.current;
    const file = directFiles[directIdx];
    if (!file?.url) return;
    setCurrentTime(0); setDuration(0); setBuffered(0); setPlaying(false);
    vid.pause();
    vid.src = file.url;
    vid.load();
    const onMeta = () => vid.play().catch(() => {});
    vid.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => vid.removeEventListener('loadedmetadata', onMeta);
  }, [mode, directIdx, directFiles]);

  // ── DIRECT ERROR HANDLER ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current) return;
    const vid = videoRef.current;
    const fallback = (reason) => {
      console.warn('[PrimePlayer] Direct error:', reason);
      if (directIdx < directFiles.length - 1) { setDirectIdx(i => i + 1); return; }
      setTimeout(() => { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }, 800);
    };
    const onErr = () => { const e = vid.error; if (!e || e.code === MediaError.MEDIA_ERR_ABORTED) return; fallback(`MediaError ${e.code}`); };
    let stallTimer = null;
    const onWaiting = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => { if (!vid.paused && vid.readyState < 3) fallback('stall'); }, 15000); };
    const onPlaying = () => clearTimeout(stallTimer);
    vid.addEventListener('error', onErr);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('playing', onPlaying);
    return () => { clearTimeout(stallTimer); vid.removeEventListener('error', onErr); vid.removeEventListener('waiting', onWaiting); vid.removeEventListener('playing', onPlaying); };
  }, [mode, directIdx, directFiles]);

  // ── IFRAME TIMEOUT ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'iframe' || embedPhase !== 'loading') return;
    clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      if (embedIdx < embeds.length - 1) setEmbedIdx(i => i + 1);
      else setEmbedPhase('failed');
    }, 15000);
    return () => clearTimeout(iframeTimerRef.current);
  }, [mode, embedPhase, embedIdx, embeds.length]);

  // ── VIDEO EVENTS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay    = () => { setPlaying(true); setBuffering(false); };
    const onPause   = () => setPlaying(false);
    const onTime    = () => setCurrentTime(v.currentTime);
    const onDur     = () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); };
    const onProg    = () => { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); };
    const onWait    = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCan     = () => setBuffering(false);
    const onStall   = () => setBuffering(true);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress',       onProg);
    v.addEventListener('waiting',        onWait);
    v.addEventListener('playing',        onPlaying);
    v.addEventListener('canplay',        onCan);
    v.addEventListener('stalled',        onStall);
    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress',       onProg);
      v.removeEventListener('waiting',        onWait);
      v.removeEventListener('playing',        onPlaying);
      v.removeEventListener('canplay',        onCan);
      v.removeEventListener('stalled',        onStall);
    };
  }, []);

  // ── CONTROLS AUTO-HIDE ───────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!activePanel && !xrayOpen && !xrayExpanded) setShowControls(false);
    }, 3500);
  }, [activePanel, xrayOpen, xrayExpanded]);

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, []);

  useEffect(() => {
    if (activePanel || xrayOpen || xrayExpanded) {
      setShowControls(true);
      clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  }, [activePanel, xrayOpen, xrayExpanded]);

  // ── FULLSCREEN ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── KEYBOARD ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); skip(-10); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === 'm') toggleMute();
      else if (e.key === 'Escape') { setActivePanel(null); setXrayOpen(false); setXrayExpanded(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, muted]);

  // ── ACTIONS ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || mode === 'iframe') return;
    playing ? v.pause() : v.play();
  };

  const skip = (sec) => {
    const v = videoRef.current;
    if (!v || mode === 'iframe') return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    setSkipFeedback(sec < 0 ? 'back' : 'forward');
    setTimeout(() => setSkipFeedback(null), 700);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const changeVolume = (val) => {
    const v = videoRef.current;
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    setMuted(clamped === 0);
    if (v) { v.volume = clamped; v.muted = clamped === 0; }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (_) {}
  };

  // ── PROGRESS BAR ────────────────────────────────────────────────────────
  const getSeekTime = (e) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const onProgressMouseMove = (e) => {
    const t = getSeekTime(e);
    const bar = progressBarRef.current;
    if (bar) setHoverX(e.clientX - bar.getBoundingClientRect().left);
    setHoverTime(t);
    if (seeking) {
      const v = videoRef.current;
      if (v) v.currentTime = t;
      setCurrentTime(t);
    }
  };
  const onProgressMouseDown = (e) => {
    setSeeking(true);
    const t = getSeekTime(e);
    const v = videoRef.current;
    if (v) v.currentTime = t;
    setCurrentTime(t);
  };
  const onProgressMouseUp   = () => setSeeking(false);
  const onProgressMouseLeave = () => { setHoverTime(null); if (seeking) setSeeking(false); };

  // ── VOLUME DRAG ──────────────────────────────────────────────────────────
  const getVolumeFromY = (e) => {
    const slider = volumeSliderRef.current;
    if (!slider) return volume;
    const rect = slider.getBoundingClientRect();
    return 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  };

  useEffect(() => {
    if (!isDraggingVolume) return;
    const onMove = (e) => changeVolume(getVolumeFromY(e));
    const onUp   = () => setIsDraggingVolume(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingVolume]);

  // ── DERIVED ─────────────────────────────────────────────────────────────
  const progressPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct  = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolumeIcon   = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeMidIcon : VolumeHighIcon;
  const isVideoMode  = mode === 'hls' || mode === 'direct';
  const curEmbed     = embeds[embedIdx];
  const chapterMarkers = duration > 0 ? [0.16, 0.33, 0.5, 0.66, 0.83].map(p => p * duration) : [];

  // ── BTN HELPER ──────────────────────────────────────────────────────────
  const Btn = ({ onClick, title, children, style = {} }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: C, padding: '5px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', borderRadius: '3px',
        transition: 'opacity .15s', flexShrink: 0, ...style
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  );

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={() => setActivePanel(null)}
      style={{
        position: 'fixed', inset: 0, background: '#000',
        fontFamily: "'Amazon Ember', 'Segoe UI', system-ui, sans-serif",
        userSelect: 'none',
        cursor: showControls ? 'default' : 'none',
        zIndex: 9999,
      }}
    >
      <style>{`
        .pp-spin {
          width: 48px; height: 48px; border-radius: 50%;
          border: 2px solid rgba(163,163,163,.25);
          border-top-color: #A3A3A3;
          animation: ppSpin .8s linear infinite;
        }
        @keyframes ppSpin { to { transform: rotate(360deg); } }

        .pp-progress {
          position: relative; height: 3px; cursor: pointer;
          background: rgba(163,163,163,.25); flex-shrink: 0;
          transition: height .12s ease;
        }
        .pp-progress:hover { height: 5px; }
        .pp-progress:hover .pp-thumb { opacity: 1 !important; transform: translate(-50%,-50%) scale(1) !important; }

        .pp-panel {
          position: absolute; top: 44px; right: 0;
          background: #111; border-radius: 4px 0 0 4px;
          box-shadow: 0 8px 32px rgba(0,0,0,.9);
          animation: ppPanel .12s ease-out;
          z-index: 50;
        }
        @keyframes ppPanel {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .pp-volume-popup {
          position: absolute; bottom: 42px; left: 50%; transform: translateX(-50%);
          background: #111; border-radius: 6px; padding: 14px 10px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,.9);
          animation: ppPanel .12s ease-out;
          z-index: 50;
        }

        .pp-xray-panel {
          position: absolute; top: 0; right: 0; bottom: 0; width: 340px;
          background: #080808;
          border-left: 1px solid rgba(163,163,163,.08);
          display: flex; flex-direction: column;
          animation: ppSlideIn .18s ease-out;
          z-index: 20;
        }
        @keyframes ppSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        .pp-skip-flash {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          color: #A3A3A3; font-size: 20px; font-weight: 400;
          pointer-events: none;
          animation: ppSkip .5s ease-out forwards;
        }
        @keyframes ppSkip {
          0%   { opacity: .9; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* ── VIDEO ELEMENT ─────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', display: 'block',
          visibility: isVideoMode ? 'visible' : 'hidden',
        }}
        playsInline
        preload="metadata"
        onClick={(e) => { e.stopPropagation(); if (isVideoMode) togglePlay(); }}
      />

      {/* ── IFRAME MODE ───────────────────────────────────────────────── */}
      {mode === 'iframe' && (
        <>
          {/* Spinner while loading embed */}
          {embedPhase === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 6, pointerEvents: 'none' }}>
              <div className="pp-spin" />
            </div>
          )}

          {/* All sources failed */}
          {embedPhase === 'failed' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 6 }}>
              <div style={{ color: '#f87171', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All sources failed</div>
              <div style={{ color: C, fontSize: 13, marginBottom: 20, opacity: .7 }}>This title may not be available right now.</div>
              <button onClick={() => { setEmbedIdx(0); setEmbedPhase('loading'); }}
                style={{ background: 'none', border: `1px solid rgba(163,163,163,.4)`, color: C, padding: '8px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
                Retry
              </button>
            </div>
          )}

          {/* Iframe */}
          {curEmbed && embedPhase !== 'failed' && (
            <iframe
              ref={iframeRef}
              key={`${embedIdx}-${tmdbId}-${season}-${episode}`}
              src={curEmbed.url}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: embedPhase === 'playing' ? 1 : 0, transition: 'opacity .4s' }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => {
                clearTimeout(iframeTimerRef.current);
                iframeTimerRef.current = setTimeout(() => setEmbedPhase('playing'), 1500);
              }}
              title={movieTitle}
            />
          )}

          {/* Source switcher */}
          {embedPhase === 'playing' && embedIdx < embeds.length - 1 && showControls && (
            <div style={{ position: 'absolute', bottom: 72, right: 16, zIndex: 20 }}>
              <button
                onClick={(e) => { e.stopPropagation(); clearTimeout(iframeTimerRef.current); setEmbedIdx(i => i + 1); setEmbedPhase('loading'); }}
                style={{ background: 'rgba(0,0,0,.7)', border: `1px solid rgba(163,163,163,.2)`, color: C, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(8px)' }}
              >
                Not playing? Try next source →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── LOADING / BUFFERING SPINNER ───────────────────────────────── */}
      {(mode === 'loading' || (isVideoMode && buffering)) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: mode === 'loading' ? '#000' : 'transparent', zIndex: 8, pointerEvents: 'none' }}>
          <div className="pp-spin" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CONTROLS OVERLAY
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: showControls ? 1 : 0,
        transition: 'opacity .3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
        zIndex: 10,
      }}>
        {/* Top gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(to bottom, rgba(0,0,0,.7) 0%, transparent 100%)', pointerEvents: 'none' }} />
        {/* Bottom gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 100%)', pointerEvents: 'none' }} />

        {/* ══ TOP BAR — matches Image 1 (left) + Image 2 (right) ══════ */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', zIndex: 20,
        }}>

          {/* LEFT: X-Ray | IMDb | All > — exactly as in Image 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* X-Ray button — text + optional chevron */}
            <Btn
              onClick={(e) => { e.stopPropagation(); setXrayOpen(v => !v); setXrayExpanded(false); setActivePanel(null); }}
              style={{ gap: 4, padding: '4px 8px' }}
            >
              <span style={{ fontSize: 14, fontWeight: 400, color: C, letterSpacing: .3 }}>X-Ray</span>
            </Btn>

            {/* IMDb badge — yellow pill, exactly as in screenshot */}
            <div style={{
              background: '#f5c518', color: '#000', fontSize: 12, fontWeight: 800,
              padding: '2px 6px', borderRadius: 4, letterSpacing: .5,
              display: 'flex', alignItems: 'center', margin: '0 2px',
            }}>IMDb</div>

            {/* All > */}
            <Btn
              onClick={(e) => { e.stopPropagation(); setXrayExpanded(true); setXrayOpen(false); setActivePanel(null); }}
              style={{ gap: 2, padding: '4px 8px' }}
            >
              <span style={{ fontSize: 14, color: C }}>All</span>
              <ChevronRightIcon />
            </Btn>
          </div>

          {/* CENTER: title */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: 16, fontWeight: 400, letterSpacing: .1,
            whiteSpace: 'nowrap', maxWidth: '40vw', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {movieTitle}
          </div>

          {/* RIGHT: exactly as Image 2 — subtitles, settings, volume, PiP, resize/fullscreen, separator, close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

            {/* 1. Subtitles */}
            <div style={{ position: 'relative' }}>
              <Btn onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'subtitles' ? null : 'subtitles'); }} title="Subtitles & Audio">
                <SubtitlesIcon />
              </Btn>
              {activePanel === 'subtitles' && (
                <div className="pp-panel" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex' }}>
                    {/* Subtitles col */}
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,.12)', padding: '20px 16px' }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Subtitles</div>
                      {['Off', 'English', 'English CC', 'العربية'].map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }} onClick={() => setSubtitleTrack(s)}>
                          <div style={{ width: 20 }}>{subtitleTrack === s && <CheckIcon />}</div>
                          <span style={{ color: subtitleTrack === s ? '#fff' : 'rgba(255,255,255,.7)', fontSize: 15 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    {/* Audio col */}
                    <div style={{ flex: 1, padding: '20px 16px' }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Audio</div>
                      {['English', 'हिन्दी', 'हिन्दी ऑडियो विवरण'].map(a => (
                        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }} onClick={() => setAudioTrack(a)}>
                          <div style={{ width: 20 }}>{audioTrack === a && <CheckIcon />}</div>
                          <span style={{ color: audioTrack === a ? '#fff' : 'rgba(255,255,255,.7)', fontSize: 15 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Settings */}
            <div style={{ position: 'relative' }}>
              <Btn onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'quality' ? null : 'quality'); }} title="Video Quality">
                <SettingsIcon />
              </Btn>
              {activePanel === 'quality' && (
                <div className="pp-panel" style={{ width: 300 }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px 20px 12px' }}>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Video Quality</div>
                    {[
                      { label: 'Good',   sub: 'Uses about 0.38 GB per hour' },
                      { label: 'Better', sub: 'Uses about 1.40 GB per hour' },
                      { label: 'Best',   sub: 'Uses about 6.84 GB per hour' },
                    ].map(q => (
                      <div key={q.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', cursor: 'pointer' }} onClick={() => { setQuality(q.label); setActivePanel(null); }}>
                        <div style={{ width: 24 }}>{quality === q.label && <CheckIcon />}</div>
                        <div>
                          <div style={{ color: quality === q.label ? '#fff' : 'rgba(255,255,255,.85)', fontSize: 15, fontWeight: quality === q.label ? 700 : 400 }}>{q.label}</div>
                          <div style={{ color: 'rgba(163,163,163,.6)', fontSize: 12, marginTop: 1 }}>{q.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Volume */}
            <div style={{ position: 'relative' }}>
              <Btn onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'volume' ? null : 'volume'); }} title="Volume">
                <VolumeIcon />
              </Btn>
              {activePanel === 'volume' && (
                <div className="pp-volume-popup" onClick={e => e.stopPropagation()}>
                  <div
                    ref={volumeSliderRef}
                    style={{ width: 3, height: 120, background: 'rgba(163,163,163,.25)', borderRadius: 2, position: 'relative', cursor: 'pointer' }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingVolume(true); changeVolume(getVolumeFromY(e)); }}
                  >
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${(muted ? 0 : volume) * 100}%`, background: C, borderRadius: 2 }} />
                    <div style={{ position: 'absolute', left: '50%', bottom: `${(muted ? 0 : volume) * 100}%`, width: 11, height: 11, background: C, borderRadius: '50%', transform: 'translate(-50%, 50%)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* 4. PiP */}
            <Btn onClick={(e) => { e.stopPropagation(); togglePiP(); }} title="Picture in Picture">
              <PiPIcon />
            </Btn>

            {/* 5. Resize / Fullscreen (diagonal arrows as in screenshot) */}
            <Btn onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <ExitResizeIcon /> : <ResizeIcon />}
            </Btn>

            {/* 6. Vertical separator — exactly as in Image 2 */}
            <div style={{ width: 1, height: 22, background: C, opacity: .45, margin: '0 6px', flexShrink: 0 }} />

            {/* 7. Close */}
            <Btn onClick={(e) => { e.stopPropagation(); onClose?.(); }} title="Close">
              <CloseIcon />
            </Btn>
          </div>
        </div>

        {/* ══ X-RAY COMPACT OVERLAY ════════════════════════════════════ */}
        {xrayOpen && xrayCast.length > 0 && (
          <div style={{
            position: 'absolute', top: 50, left: 14,
            background: 'rgba(0,0,0,.92)', borderRadius: 4,
            padding: '8px 0', minWidth: 250, maxHeight: '55vh',
            overflowY: 'auto', scrollbarWidth: 'none',
            animation: 'ppPanel .12s ease-out',
            zIndex: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '0 16px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C, fontSize: 14 }}>X-Ray</span>
                <div style={{ background: '#f5c518', color: '#000', fontSize: 10, fontWeight: 800, padding: '1px 4px', borderRadius: 3 }}>IMDb</div>
                <Btn onClick={() => { setXrayExpanded(true); setXrayOpen(false); }} style={{ fontSize: 13, gap: 2, padding: '2px 4px' }}>
                  All <ChevronRightIcon />
                </Btn>
              </div>
            </div>
            {xrayCast.slice(0, 3).map(person => (
              <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', cursor: 'pointer' }} onClick={() => { setXrayExpanded(true); setXrayOpen(false); }}>
                {person.profile ? (
                  <img src={person.profile} alt={person.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#1a1a1a', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontSize: 20, fontWeight: 700 }}>{person.name.charAt(0)}</div>
                )}
                <div>
                  <div style={{ color: C, fontSize: 14 }}>{person.name}</div>
                  <div style={{ color: 'rgba(163,163,163,.55)', fontSize: 12, marginTop: 2 }}>{person.character}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ CENTER CONTROLS — matches Image 3 exactly ════════════════
            Layout: [rewind10]   [pause/play]   [forward10]
            All icons #A3A3A3, decent spacing
        */}
        {isVideoMode && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 52,
            zIndex: 15,
          }} onClick={e => e.stopPropagation()}>

            {/* Rewind 10 */}
            <div style={{ position: 'relative' }}>
              <Btn onClick={() => skip(-10)} title="Rewind 10s" style={{ padding: 0 }}>
                <Rewind10Icon />
              </Btn>
              {skipFeedback === 'back' && (
                <div className="pp-skip-flash" style={{ fontSize: 18 }}>-10</div>
              )}
            </div>

            {/* Play / Pause */}
            <Btn onClick={togglePlay} title={playing ? 'Pause' : 'Play'} style={{ padding: 0 }}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Btn>

            {/* Forward 10 */}
            <div style={{ position: 'relative' }}>
              <Btn onClick={() => skip(10)} title="Forward 10s" style={{ padding: 0 }}>
                <Forward10Icon />
              </Btn>
              {skipFeedback === 'forward' && (
                <div className="pp-skip-flash" style={{ fontSize: 18 }}>+10</div>
              )}
            </div>
          </div>
        )}

        {/* ══ BOTTOM BAR — matches Image 4 ══════════════════════════════
            Progress bar + time display (0:00:47 / 2:58:07)
        */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 0 24px', zIndex: 20 }}>

          {/* Progress track */}
          <div
            ref={progressBarRef}
            className="pp-progress"
            style={{ marginBottom: 10 }}
            onMouseDown={isVideoMode ? onProgressMouseDown : undefined}
            onMouseMove={isVideoMode ? onProgressMouseMove : undefined}
            onMouseUp={isVideoMode ? onProgressMouseUp : undefined}
            onMouseLeave={isVideoMode ? onProgressMouseLeave : undefined}
            onClick={e => e.stopPropagation()}
          >
            {/* Buffered */}
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${bufferedPct}%`, background: 'rgba(163,163,163,.28)', pointerEvents: 'none' }} />
            {/* Played */}
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${progressPct}%`, background: C, pointerEvents: 'none' }} />
            {/* Chapter dots */}
            {chapterMarkers.map((t, i) => (
              <div key={i} style={{ position: 'absolute', top: '50%', left: `${(t / duration) * 100}%`, width: 3, height: 3, background: 'rgba(0,0,0,.6)', borderRadius: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 2 }} />
            ))}
            {/* Thumb */}
            <div className="pp-thumb" style={{ position: 'absolute', top: '50%', left: `${progressPct}%`, width: 13, height: 13, background: C, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.7)', opacity: 0, pointerEvents: 'none', transition: 'opacity .12s, transform .12s' }} />
            {/* Hover tooltip */}
            {hoverTime !== null && (
              <div style={{
                position: 'absolute', bottom: 18,
                left: Math.max(20, Math.min(hoverX, (progressBarRef.current?.offsetWidth || 0) - 20)),
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,.85)', color: C,
                fontSize: 11, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none',
              }}>
                {fmtTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Time display — exactly as Image 4: "0:00:47 / 2:58:07" */}
          <div style={{ color: C, fontSize: 13, fontWeight: 400, letterSpacing: .2, paddingLeft: 18, lineHeight: 1 }}>
            {fmtTime(currentTime)}
            {duration > 0 && (
              <span style={{ color: C, opacity: .7 }}>{' / '}{fmtTime(duration)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          X-RAY SIDE PANEL (expanded)
          ═══════════════════════════════════════════════════════════════ */}
      {xrayExpanded && (
        <div className="pp-xray-panel" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(163,163,163,.08)', flexShrink: 0 }}>
            <span style={{ color: C, fontSize: 17 }}>X-Ray</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 1, height: 20, background: 'rgba(163,163,163,.25)' }} />
              <Btn onClick={() => setXrayExpanded(false)}><CloseIcon /></Btn>
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid rgba(163,163,163,.08)', flexShrink: 0 }}>
            {['scene', 'cast'].map(tab => (
              <button key={tab} onClick={() => setXrayTab(tab)} style={{
                flex: 1, padding: '14px 0', background: 'none', border: 'none',
                color: xrayTab === tab ? '#fff' : 'rgba(255,255,255,.5)',
                fontSize: 15, fontWeight: xrayTab === tab ? 600 : 400, cursor: 'pointer',
                borderBottom: xrayTab === tab ? '2px solid #fff' : '2px solid transparent',
                marginBottom: -1, transition: 'all .15s',
              }}>
                {tab === 'scene' ? 'In Scene' : 'Cast'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', scrollbarWidth: 'none' }}>
            {xrayCast.map(person => (
              <div key={person.id}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', cursor: 'pointer', background: expandedCastId === person.id ? 'rgba(255,255,255,.05)' : 'transparent', transition: 'background .15s' }}
                  onClick={() => setExpandedCastId(expandedCastId === person.id ? null : person.id)}
                >
                  {person.profile ? (
                    <img src={person.profile} alt={person.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, background: '#1a1a1a', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontSize: 22, fontWeight: 700 }}>{person.name.charAt(0)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C, fontSize: 14, marginBottom: 3 }}>{person.name}</div>
                    <div style={{ color: 'rgba(163,163,163,.55)', fontSize: 12 }}>Portrays: <span style={{ color: 'rgba(163,163,163,.7)' }}>{person.character}</span></div>
                  </div>
                  <div style={{ color: C, flexShrink: 0 }}>
                    {expandedCastId === person.id ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </div>
                </div>
                {expandedCastId === person.id && (
                  <div style={{ padding: '10px 16px 14px 102px', background: 'rgba(255,255,255,.03)', animation: 'ppPanel .15s ease-out' }}>
                    <div style={{ color: 'rgba(163,163,163,.7)', fontSize: 12, lineHeight: 1.6 }}>Known for their roles in various acclaimed productions. View full biography on IMDb.</div>
                    <button style={{ marginTop: 10, background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#f5c518', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 4, cursor: 'pointer' }}>View on IMDb</button>
                  </div>
                )}
              </div>
            ))}
            {xrayCast.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(163,163,163,.5)', fontSize: 13 }}>Loading cast information...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
