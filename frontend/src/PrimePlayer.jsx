import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

// ─── ICONS ─────────────────────────────────────────────────────────────────
const SubtitlesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="5" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="5" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const VolumeHighIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const VolumeMidIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const VolumeMuteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/>
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const PiPIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="12" y="12" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/>
  </svg>
);
const FullscreenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 21 3 21 3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="3" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="21" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ExitFullscreenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <polyline points="4 14 10 14 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="20 10 14 10 14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="10" y1="14" x2="3" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="21" y1="3" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const Rewind10Icon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
    <path d="M26 8C16.06 8 8 16.06 8 26s8.06 18 18 18 18-8.06 18-18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M26 8 L20 14 L26 8 L20 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="26" y="30" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600" fontFamily="system-ui">10</text>
  </svg>
);
const Forward10Icon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
    <path d="M26 8C35.94 8 44 16.06 44 26s-8.06 18-18 18S8 35.94 8 26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M26 8 L32 14 L26 8 L32 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="26" y="30" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600" fontFamily="system-ui">10</text>
  </svg>
);
const PlayIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
    <polygon points="16,10 42,26 16,42" fill="currentColor"/>
  </svg>
);
const PauseIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
    <rect x="12" y="10" width="10" height="32" rx="2" fill="currentColor"/>
    <rect x="30" y="10" width="10" height="32" rx="2" fill="currentColor"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const XRayExpandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 21 3 21 3 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="3" x2="14" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="3" y1="21" x2="10" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── MAIN PLAYER ───────────────────────────────────────────────────────────
export default function PrimePlayer({
  tmdbId,
  title = '',
  mediaType = 'movie',
  season = 1,
  episode = 1,
  onClose,
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef     = useRef(null);
  const videoRef         = useRef(null);
  const hlsRef           = useRef(null);
  const iframeRef        = useRef(null);
  const progressBarRef   = useRef(null);
  const controlsTimerRef = useRef(null);
  const volumeSliderRef  = useRef(null);

  // ── Playback state ──────────────────────────────────────────────────────
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [buffered, setBuffered]     = useState(0);
  const [volume, setVolume]         = useState(1);
  const [muted, setMuted]           = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  // NEW ── browser forced muted-autoplay; show "tap to unmute" banner
  const [autoMuted, setAutoMuted]   = useState(false);

  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [showControls, setShowControls]       = useState(true);
  const [seeking, setSeeking]                 = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // ── Stream & quality state ───────────────────────────────────────────────
  const [mode, setMode]                               = useState('loading');
  const [hlsUrl, setHlsUrl]                           = useState(null);
  const [provider, setProvider]                       = useState('');
  const [availableQualities, setAvailableQualities]   = useState([]);
  const [selectedQuality, setSelectedQuality]         = useState(-1);
  const [directFiles, setDirectFiles]                 = useState([]);
  const [directIdx, setDirectIdx]                     = useState(0);
  const [directError, setDirectError]                 = useState(null);
  const [buffering, setBuffering]                     = useState(false);
  const [embeds, setEmbeds]                           = useState([]);
  const [embedIdx, setEmbedIdx]                       = useState(0);
  const [embedPhase, setEmbedPhase]                   = useState('loading');
  const [imdbId, setImdbId]                           = useState(null);
  const iframeTimerRef = useRef(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activePanel, setActivePanel]       = useState(null);
  const [subtitleTrack, setSubtitleTrack]   = useState('Off');
  const [audioTrack, setAudioTrack]         = useState('English');
  const [xrayOpen, setXrayOpen]             = useState(false);
  const [xrayExpanded, setXrayExpanded]     = useState(false);
  const [xrayCast, setXrayCast]             = useState([]);
  const [xrayTab, setXrayTab]               = useState('scene');
  const [expandedCastId, setExpandedCastId] = useState(null);
  const [movieTitle, setMovieTitle]         = useState(title);
  const [hoverTime, setHoverTime]           = useState(null);
  const [hoverX, setHoverX]                 = useState(0);
  const [skipFeedback, setSkipFeedback]     = useState(null);

  const chapterMarkers = duration > 0 ? [0.16, 0.33, 0.5, 0.66, 0.83].map(p => p * duration) : [];
  const isVideoMode    = mode === 'hls' || mode === 'direct';

  // ── Keep React state in sync with the DOM (volume/muted) ─────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setMuted(v.muted);
      setVolume(v.volume);
      if (!v.muted && v.volume > 0) setAutoMuted(false); // user restored audio
    };
    v.addEventListener('volumechange', sync);
    return () => v.removeEventListener('volumechange', sync);
  }, []);

  // ─── EMBED LIST ──────────────────────────────────────────────────────────
  const buildEmbeds = (tid, iid, mType, s, e) => {
    const tv = mType === 'tv';
    const list = [];
    if (iid) {
      list.push({ name: 'VidSrc',    url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${iid}` });
      list.push({ name: 'VidSrc.me', url: tv ? `https://vidsrc.me/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${iid}` });
    }
    list.push({ name: 'VidSrc',    url: tv ? `https://vidsrc.xyz/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tid}` });
    list.push({ name: 'VidSrc.in', url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tid}` });
    list.push({ name: 'Videasy',   url: tv ? `https://player.videasy.net/tv/${tid}/${s}/${e}` : `https://player.videasy.net/movie/${tid}` });
    list.push({ name: 'AutoEmbed', url: tv ? `https://autoembed.cc/tv/tmdb/${tid}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${tid}` });
    return list;
  };

  // ─── MAIN INIT ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    setMode('loading');
    setHlsUrl(null);
    setProvider('');
    setDirectFiles([]);
    setDirectIdx(0);
    setAvailableQualities([]);
    setSelectedQuality(-1);
    setDirectError(null);
    setBuffering(false);
    setEmbeds([]);
    setEmbedIdx(0);
    setEmbedPhase('loading');
    setPlaying(false);
    setAutoMuted(false);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    let _cancelled = false;

    const ctrl0 = new AbortController();
    const t0 = setTimeout(() => ctrl0.abort(), 8000);
    fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits`,
      { signal: ctrl0.signal }
    ).finally(() => clearTimeout(t0))
      .then(r => r.json())
      .then(d => {
        if (_cancelled) return;
        const iid = d.imdb_id || d.external_ids?.imdb_id || null;
        setImdbId(iid);
        setMovieTitle(d.title || d.name || title);
        setXrayCast((d.credits?.cast || []).slice(0, 12).map(p => ({
          id: p.id, name: p.name, character: p.character,
          profile: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        })));
        setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
      }).catch(() => {});

    setEmbeds(buildEmbeds(tmdbId, null, mediaType, season, episode));

    (async () => {
      let streams = [];
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 13000);
        const r = await fetch(
          `/api/multi-stream?${new URLSearchParams({ tmdbId, type: mediaType, season, episode })}`,
          { signal: ctrl.signal }
        ).finally(() => clearTimeout(tid));

        if (r.ok) {
          const data = await r.json();
          if (data?.success && Array.isArray(data.streams)) {
            let fetched = data.streams.filter(s => s?.url && s.url.startsWith('http'));
            // Rank: 1080p > 720p > Auto > 4K  (4K uses AC3 which most browsers can't play)
            fetched.sort((a, b) => {
              const rank = q => {
                const s = (q || '').toLowerCase();
                if (s.includes('1080')) return 4;
                if (s.includes('720'))  return 3;
                if (s.includes('auto')) return 2;
                if (s.includes('4k') || s.includes('2160')) return 1;
                return 0;
              };
              return rank(b.quality) - rank(a.quality);
            });
            streams = fetched;
          }
        }
      } catch (e) { console.warn('[PrimePlayer] multi-stream:', e.message); }

      if (_cancelled) return;

      if (streams.length > 0) {
        const first  = streams[0];
        const rawUrl = first.url;

        // ── HLS / m3u8 path ──
        if (rawUrl.includes('.m3u8') || rawUrl.includes('mpegurl') || rawUrl.includes('playlist')) {
          if (!_cancelled) {
            setHlsUrl(`/api/proxy?url=${encodeURIComponent(rawUrl)}`);
            setProvider(first.provider || 'Stream');
            setBuffering(true);
            setMode('hls');
          }
          return;
        }

        // ── Direct MP4 path — include proxied variants as fallbacks ──
        const files = [];
        streams.forEach(s => {
          if (!s.url) return;
          files.push({ url: s.url,                                          quality: s.quality || 'Auto', provider: s.provider || 'Stream' });
          files.push({ url: `/api/proxy?url=${encodeURIComponent(s.url)}`, quality: s.quality || 'Auto', provider: (s.provider || 'Stream') + '↑' });
        });

        if (!_cancelled) {
          setDirectFiles(files);
          setDirectIdx(0);
          setAvailableQualities(files.map((f, i) => ({ label: f.quality || `Source ${i + 1}`, value: i })));
          setSelectedQuality(0);
          setBuffering(true);
          setMode('direct');
        }
        return;
      }

      if (!_cancelled) setMode('iframe');
    })();

    return () => {
      _cancelled = true;
      ctrl0.abort();
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode]);

  // ─── QUALITY CHANGE ──────────────────────────────────────────────────────
  const handleQualityChange = (val) => {
    setSelectedQuality(val);
    if (mode === 'hls' && hlsRef.current) {
      if (val === -1) {
        hlsRef.current.currentLevel = -1;
        const cap = hlsRef.current.levels.findIndex(l => l.height && l.height <= 1080 && l.height >= 720);
        if (cap !== -1) hlsRef.current.autoLevelCapping = cap;
      } else {
        hlsRef.current.currentLevel = val;
      }
    } else if (mode === 'direct') {
      setDirectIdx(val);
    }
    setActivePanel(null);
  };

  // ─── HLS SETUP ───────────────────────────────────────────────────────────
  // IMPORTANT: This is essentially the original HLS setup. The ONLY change is
  // in the play() call: we now handle the NotAllowedError (autoplay blocked)
  // by retrying with muted=true and showing a banner. Everything else is identical.
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const vid = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true, backBufferLength: 60, maxBufferLength: 30, lowLatencyMode: false,
        fragLoadingTimeOut: 30000, manifestLoadingTimeOut: 20000, levelLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 500, xhrSetup: (xhr) => { xhr.withCredentials = false; },
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false);

        // Build quality menu
        const levels = hls.levels;
        let max1080Index = -1;
        const qualities = [];
        for (let i = levels.length - 1; i >= 0; i--) {
          const h = levels[i].height;
          if (h) {
            if (h <= 1080 && max1080Index === -1) max1080Index = i;
            qualities.push({
              label: h === 2160 ? '4K (2160p)' : h === 1080 ? '1080p Full HD' : h === 720 ? '720p HD' : `${h}p`,
              value: i, height: h,
            });
          }
        }
        qualities.unshift({ label: 'Auto (Max 1080p)', value: -1 });
        setAvailableQualities(qualities);
        setSelectedQuality(-1);

        // Cap ABR at 1080p — 4K streams often carry AC3 audio which Chrome/Firefox can't decode
        if (max1080Index !== -1) hls.autoLevelCapping = max1080Index;

        // Explicitly select audio track 0 so HLS.js always loads audio segments
        if (hls.audioTracks && hls.audioTracks.length > 0) hls.audioTrack = 0;

        // ── AUDIO FIX START ──────────────────────────────────────────────────
        // Always force volume=1, muted=false on the DOM element directly.
        // React state updates are async and may not have flushed yet.
        vid.volume = 1;
        vid.muted  = false;

        // Try unmuted play. If the browser's autoplay policy blocks it
        // (NotAllowedError), fall back to muted play and show a "tap to unmute"
        // banner. This replaces the original .catch(()=>{ setPlaying(false) })
        // which left the video completely silent with no recovery path.
        vid.play()
          .then(() => setPlaying(true))
          .catch(() => {
            vid.muted = true;
            vid.play()
              .then(() => { setPlaying(true); setAutoMuted(true); })
              .catch(() => { setPlaying(false); setBuffering(false); });
          });
        // ── AUDIO FIX END ────────────────────────────────────────────────────
      });

      let _netRetries = 0, _mediaRetries = 0;
      hls.on(Hls.Events.ERROR, (_, d) => {
        // Audio track errors — try rotating to next track before bailing
        if (d.details === Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR || d.details === Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT) {
          if (hls.audioTracks && hls.audioTracks.length > 1) {
            hls.audioTrack = (hls.audioTrack + 1) % hls.audioTracks.length;
          } else if (d.fatal) {
            hls.destroy();
            setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading');
          }
          return;
        }
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (_netRetries < 4) { _netRetries++; setTimeout(() => hls.startLoad(), 1000 * _netRetries); }
          else { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (_mediaRetries < 2) { _mediaRetries++; hls.recoverMediaError(); }
          else { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }
        } else {
          setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading');
        }
      });

    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari — native HLS
      vid.src    = hlsUrl;
      vid.volume = 1;
      vid.muted  = false;
      vid.addEventListener('loadedmetadata', () => {
        setBuffering(false);
        vid.play()
          .then(() => setPlaying(true))
          .catch(() => {
            vid.muted = true;
            vid.play()
              .then(() => { setPlaying(true); setAutoMuted(true); })
              .catch(() => setPlaying(false));
          });
      }, { once: true });
    } else {
      setMode('iframe');
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [hlsUrl, mode]);

  // ─── DIRECT MODE ────────────────────────────────────────────────────────
  // Identical to original, plus the same unmuted→muted autoplay fallback.
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current || !directFiles.length) return;
    const file = directFiles[directIdx];
    if (!file?.url) return;

    const vid = videoRef.current;
    setCurrentTime(0); setDuration(0); setBuffered(0);
    setPlaying(false); setBuffering(true); setDirectError(null); setAutoMuted(false);

    vid.pause();
    vid.removeAttribute('src');
    vid.load();

    const loadTimer = setTimeout(() => {
      if (!videoRef.current) return;
      vid.volume = 1;   // ── AUDIO FIX: always start at full volume
      vid.muted  = false;
      vid.src    = file.url;
      vid.load();
    }, 80);

    let cancelled = false;
    let stallTimer = null;

    const tryNext = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(stallTimer);
      if (directIdx < directFiles.length - 1) setDirectIdx(i => i + 1);
      else { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }
    };

    const onCanPlay = () => {
      if (cancelled) return;
      setBuffering(false);
      clearTimeout(stallTimer);
      vid.volume = 1;   // ── AUDIO FIX: re-affirm before play
      vid.muted  = false;
      vid.play()
        .then(() => { if (!cancelled) setPlaying(true); })
        .catch(() => {
          vid.muted = true;
          vid.play()
            .then(() => { if (!cancelled) { setPlaying(true); setAutoMuted(true); } })
            .catch(() => { if (!cancelled) { setPlaying(false); setBuffering(false); } });
        });
    };

    const onError = () => { const e = vid.error; if (!e || e.code === 1) return; tryNext(); };

    stallTimer = setTimeout(() => tryNext(), 10000);
    const onProgress = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => { if (vid.readyState < 3 && !vid.paused) tryNext(); }, 10000);
    };

    vid.addEventListener('canplay',  onCanPlay,  { once: true });
    vid.addEventListener('error',    onError,    { once: true });
    vid.addEventListener('progress', onProgress);

    return () => {
      cancelled = true;
      clearTimeout(loadTimer); clearTimeout(stallTimer);
      vid.removeEventListener('canplay',  onCanPlay);
      vid.removeEventListener('error',    onError);
      vid.removeEventListener('progress', onProgress);
    };
  }, [mode, directIdx, directFiles]);

  // ─── IFRAME TIMEOUT ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'iframe' || embedPhase !== 'loading') return;
    clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      if (embedIdx < embeds.length - 1) setEmbedIdx(i => i + 1);
      else setEmbedPhase('failed');
    }, 15000);
    return () => clearTimeout(iframeTimerRef.current);
  }, [mode, embedPhase, embedIdx, embeds.length]);

  // ─── CONTROLS HIDE ───────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => { if (!activePanel && !xrayOpen) setShowControls(false); }, 3500);
  }, [activePanel, xrayOpen]);

  useEffect(() => { resetControlsTimer(); return () => clearTimeout(controlsTimerRef.current); }, [resetControlsTimer]);
  useEffect(() => {
    if (activePanel || xrayOpen) { setShowControls(true); clearTimeout(controlsTimerRef.current); }
    else resetControlsTimer();
  }, [activePanel, xrayOpen, resetControlsTimer]);

  // ─── KEYBOARD ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft')      { e.preventDefault(); skip(-10); }
      else if (e.key === 'ArrowRight')     { e.preventDefault(); skip(10); }
      else if (e.key === 'f')              toggleFullscreen();
      else if (e.key === 'm')              toggleMute();
      else if (e.key === 'Escape')         { setActivePanel(null); setXrayOpen(false); setXrayExpanded(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, muted, volume]);

  // ─── FULLSCREEN ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  // ─── VIDEO EVENTS ────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay    = () => { setPlaying(true);  setBuffering(false); };
    const onPause   = () => setPlaying(false);
    const onTime    = () => setCurrentTime(v.currentTime);
    const onDur     = () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); };
    const onProg    = () => { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onStalled = () => setBuffering(true);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress',       onProg);
    v.addEventListener('waiting',        onWaiting);
    v.addEventListener('playing',        onPlaying);
    v.addEventListener('canplay',        onCanPlay);
    v.addEventListener('stalled',        onStalled);
    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress',       onProg);
      v.removeEventListener('waiting',        onWaiting);
      v.removeEventListener('playing',        onPlaying);
      v.removeEventListener('canplay',        onCanPlay);
      v.removeEventListener('stalled',        onStalled);
    };
  }, []);

  // ─── ACTIONS ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); }
    else {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => { v.muted = true; v.play().then(() => { setPlaying(true); setAutoMuted(true); }).catch(console.error); });
    }
  };

  const skip = (sec) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    setSkipFeedback(sec < 0 ? 'back' : 'forward');
    setTimeout(() => setSkipFeedback(null), 600);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) { v.muted = false; v.volume = prevVolume > 0 ? prevVolume : 1; setAutoMuted(false); }
    else { setPrevVolume(v.volume); v.muted = true; }
  };

  // Called from "tap to unmute" banner
  const unmuteFromBanner = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = false;
    v.volume = prevVolume > 0 ? prevVolume : 1;
    setAutoMuted(false);
  };

  const changeVolume = (val) => {
    const v = videoRef.current;
    if (!v) return;
    if (val > 0) { setPrevVolume(val); v.muted = false; v.volume = val; setAutoMuted(false); }
    else { v.muted = true; v.volume = 0; }
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

  // ─── PROGRESS BAR ────────────────────────────────────────────────────────
  const getSeekTime = (e) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };
  const onProgressMouseMove  = (e) => {
    const t = getSeekTime(e);
    if (progressBarRef.current) setHoverX(e.clientX - progressBarRef.current.getBoundingClientRect().left);
    setHoverTime(t);
    if (seeking && videoRef.current) { videoRef.current.currentTime = t; setCurrentTime(t); }
  };
  const onProgressMouseDown  = (e) => { setSeeking(true); const t = getSeekTime(e); if (videoRef.current) { videoRef.current.currentTime = t; setCurrentTime(t); } };
  const onProgressMouseUp    = () => setSeeking(false);
  const onProgressMouseLeave = () => { setHoverTime(null); if (seeking) setSeeking(false); };

  const getVolumeFromMouseY = (e) => {
    const s = volumeSliderRef.current;
    if (!s) return volume;
    const r = s.getBoundingClientRect();
    return 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  };
  useEffect(() => {
    if (!isDraggingVolume) return;
    const onMove = (e) => changeVolume(getVolumeFromMouseY(e));
    const onUp   = () => { setIsDraggingVolume(false); setActivePanel(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingVolume]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered  / duration) * 100 : 0;
  const VolumeIcon  = (muted || volume === 0) ? VolumeMuteIcon : volume < 0.5 ? VolumeMidIcon : VolumeHighIcon;
  const curEmbed    = embeds[embedIdx];

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="prime-player"
      onMouseMove={resetControlsTimer}
      onClick={() => setActivePanel(null)}
      style={{
        position: 'fixed', inset: 0, background: '#000',
        fontFamily: "'Amazon Ember','Segoe UI',system-ui,sans-serif",
        userSelect: 'none', cursor: showControls ? 'default' : 'none', zIndex: 9999,
      }}
    >
      <style>{`
        :root{--c:#AAAAAA;--c-track:rgba(170,170,170,0.22);}
        .prime-player *{box-sizing:border-box;}
        .prime-btn{background:none;border:none;cursor:pointer;color:var(--c);padding:6px;border-radius:2px;display:flex;align-items:center;justify-content:center;transition:opacity .1s;}
        .prime-btn:hover{opacity:.75;}
        .progress-track{position:relative;height:3px;background:var(--c-track);cursor:pointer;transition:height .12s;}
        .progress-track:hover{height:5px;}
        .progress-track:hover .progress-thumb{opacity:1;transform:translate(-50%,-50%) scale(1);}
        .progress-buffered{position:absolute;top:0;left:0;height:100%;background:rgba(170,170,170,.28);pointer-events:none;}
        .progress-played{position:absolute;top:0;left:0;height:100%;background:var(--c);pointer-events:none;}
        .progress-thumb{position:absolute;top:50%;width:12px;height:12px;background:var(--c);border-radius:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;pointer-events:none;transition:opacity .12s,transform .12s;}
        .chapter-dot{position:absolute;top:50%;width:3px;height:3px;background:rgba(0,0,0,.6);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2;}
        .panel{position:absolute;top:48px;right:0;background:#111;border-radius:3px 0 0 3px;min-width:280px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.9);animation:panelIn .1s ease-out;}
        @keyframes panelIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
        .volume-popup{position:absolute;bottom:46px;left:50%;transform:translateX(-50%);background:#111;border-radius:4px;padding:14px 11px;width:40px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.9);animation:panelIn .1s ease-out;}
        .volume-track{width:3px;height:120px;background:var(--c-track);border-radius:2px;position:relative;cursor:pointer;}
        .volume-fill{position:absolute;bottom:0;left:0;width:100%;background:var(--c);border-radius:2px;pointer-events:none;}
        .volume-knob{position:absolute;left:50%;width:11px;height:11px;background:var(--c);border-radius:50%;transform:translate(-50%,50%);pointer-events:none;}
        .xray-overlay{position:absolute;top:52px;left:14px;background:rgba(0,0,0,.9);border-radius:3px;padding:8px 0;min-width:250px;max-height:55vh;overflow-y:auto;scrollbar-width:none;animation:panelIn .12s ease-out;}
        .xray-overlay::-webkit-scrollbar{display:none;}
        .xray-panel{position:absolute;top:0;right:0;bottom:0;width:340px;background:#080808;border-left:1px solid rgba(170,170,170,.08);display:flex;flex-direction:column;animation:slideIn .18s ease-out;z-index:10;}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .skip-flash{position:absolute;top:50%;transform:translateY(-50%);pointer-events:none;animation:skipFlash .4s ease-out forwards;}
        @keyframes skipFlash{0%{opacity:.8}100%{opacity:0}}
        .spin{width:48px;height:48px;border-radius:50%;border:2px solid rgba(170,170,170,.2);border-top-color:#AAAAAA;animation:spin .85s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .quality-item:hover{background:rgba(255,255,255,.08);}
        .unmute-banner{
          position:absolute;bottom:90px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.3);
          color:#fff;padding:11px 24px;border-radius:999px;
          display:flex;align-items:center;gap:10px;cursor:pointer;
          z-index:30;backdrop-filter:blur(10px);
          animation:panelIn .25s ease-out;white-space:nowrap;
          box-shadow:0 4px 20px rgba(0,0,0,.6);
          font-size:14px;font-weight:600;letter-spacing:.3px;
        }
        .unmute-banner:hover{background:rgba(20,20,20,.95);}
      `}</style>

      {/* ── TAP TO UNMUTE BANNER ─────────────────────────────────────────── */}
      {/* Shown only when browser's autoplay policy forced muted playback.   */}
      {/* Clicking anywhere on the video or this banner will restore audio.  */}
      {autoMuted && isVideoMode && (
        <div className="unmute-banner" onClick={(e) => { e.stopPropagation(); unmuteFromBanner(); }}>
          <VolumeMuteIcon />
          <span>Tap to unmute</span>
        </div>
      )}

      {/* ── VIDEO ELEMENT ─────────────────────────────────────────────────── */}
      {/* Always mounted. visibility: hidden when in iframe mode so the DOM   */}
      {/* element persists (HLS.js requires it to stay attached).             */}
      <video
        ref={videoRef}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', display: 'block',
          visibility: isVideoMode ? 'visible' : 'hidden',
        }}
        playsInline
        preload="metadata"
        onClick={(e) => {
          e.stopPropagation();
          if (autoMuted) { unmuteFromBanner(); return; } // first click unmutes
          if (isVideoMode) togglePlay();
        }}
      />

      {/* ── IFRAME MODE ───────────────────────────────────────────────────── */}
      {mode === 'iframe' && (
        <>
          {embedPhase === 'loading' && (
            <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#000',zIndex:6,pointerEvents:'none' }}>
              <div className="spin" />
            </div>
          )}
          {embedPhase === 'failed' && (
            <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#000',zIndex:6 }}>
              <div style={{ color:'#f87171',fontSize:16,fontWeight:600,marginBottom:8 }}>All sources failed</div>
              <div style={{ color:'#AAAAAA',fontSize:13,marginBottom:20 }}>This title may not be available right now.</div>
              <button onClick={() => { setEmbedIdx(0); setEmbedPhase('loading'); }}
                style={{ background:'none',border:'1px solid rgba(170,170,170,.4)',color:'#AAAAAA',padding:'8px 24px',borderRadius:6,cursor:'pointer',fontWeight:700 }}>
                Retry
              </button>
            </div>
          )}
          {curEmbed && embedPhase !== 'failed' && (
            <iframe
              ref={iframeRef}
              key={`${embedIdx}-${tmdbId}-${season}-${episode}`}
              src={curEmbed.url}
              style={{ width:'100%',height:'100%',border:'none',display:'block',opacity:embedPhase==='playing'?1:0,transition:'opacity .4s' }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => { clearTimeout(iframeTimerRef.current); iframeTimerRef.current = setTimeout(() => setEmbedPhase('playing'), 1500); }}
              title={movieTitle}
            />
          )}
          {embedPhase === 'playing' && embedIdx < embeds.length - 1 && showControls && (
            <div style={{ position:'absolute',bottom:72,right:16,zIndex:20 }}>
              <button
                onClick={(e) => { e.stopPropagation(); clearTimeout(iframeTimerRef.current); setEmbedIdx(i=>i+1); setEmbedPhase('loading'); }}
                style={{ background:'rgba(0,0,0,.7)',border:'1px solid rgba(170,170,170,.2)',color:'#AAAAAA',padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,backdropFilter:'blur(8px)' }}
              >
                Not playing? Try next source →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── BUFFERING / LOADING SPINNER ───────────────────────────────────── */}
      {(mode === 'loading' || (isVideoMode && buffering)) && (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:mode==='loading'?'#000':'transparent',zIndex:8,pointerEvents:'none' }}>
          <div className="spin" />
        </div>
      )}

      {/* ═══════════════════════ CONTROLS OVERLAY ═══════════════════════════ */}
      <div style={{
        position:'absolute',inset:0,
        opacity:showControls?1:0,transition:'opacity .3s',
        pointerEvents:mode==='iframe'?'none':(showControls?'auto':'none'),
        zIndex:5,
      }}>
        <div style={{ position:'absolute',top:0,left:0,right:0,height:80,background:'linear-gradient(to bottom,rgba(0,0,0,.65),transparent)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:0,left:0,right:0,height:120,background:'linear-gradient(to top,rgba(0,0,0,.75),transparent)',pointerEvents:'none' }} />

        {/* ── TOP BAR ── */}
        <div style={{ position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',zIndex:10,pointerEvents:'auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <button className="prime-btn" onClick={(e) => { e.stopPropagation(); setXrayOpen(v=>!v); setXrayExpanded(false); setActivePanel(null); }} style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 8px' }}>
              <span style={{ fontSize:14,fontWeight:400,letterSpacing:.3 }}>X-Ray</span>
              {xrayOpen ? <ChevronUpIcon /> : null}
            </button>
            <div style={{ background:'#f5c518',color:'#000',fontSize:11,fontWeight:800,padding:'2px 5px',borderRadius:3,letterSpacing:.5 }}>IMDb</div>
            <button className="prime-btn" style={{ fontSize:14,display:'flex',alignItems:'center',gap:3 }} onClick={(e) => { e.stopPropagation(); setXrayExpanded(true); setXrayOpen(false); setActivePanel(null); }}>
              All <ChevronRightIcon />
            </button>
          </div>

          <div style={{ position:'absolute',left:'50%',transform:'translateX(-50%)',color:'#fff',fontSize:17,fontWeight:400,letterSpacing:.1,whiteSpace:'nowrap' }}>
            {movieTitle}
          </div>

          <div style={{ display:'flex',alignItems:'center',gap:2 }}>
            {/* Subtitles */}
            <div style={{ position:'relative' }}>
              <button className={`prime-btn ${activePanel==='subtitles'?'active':''}`} onClick={(e)=>{e.stopPropagation();setActivePanel(activePanel==='subtitles'?null:'subtitles');}} title="Subtitles & Audio"><SubtitlesIcon /></button>
              {activePanel==='subtitles' && (
                <div className="panel" style={{ right:0,width:420 }} onClick={e=>e.stopPropagation()}>
                  <div style={{ display:'flex' }}>
                    <div style={{ flex:1,borderRight:'1px solid rgba(255,255,255,.15)',padding:'20px 16px' }}>
                      <div style={{ color:'#fff',fontSize:16,fontWeight:700,marginBottom:16 }}>Subtitles</div>
                      {['Off','English','English CC','العربية'].map(s=>(
                        <div key={s} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer' }} onClick={()=>setSubtitleTrack(s)}>
                          <div style={{ width:20 }}>{subtitleTrack===s&&<CheckIcon />}</div>
                          <span style={{ color:subtitleTrack===s?'#fff':'rgba(255,255,255,.7)',fontSize:15 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex:1,padding:'20px 16px' }}>
                      <div style={{ color:'#fff',fontSize:16,fontWeight:700,marginBottom:16 }}>Audio</div>
                      {['English','हिन्दी','Tamil','Telugu'].map(a=>(
                        <div key={a} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer' }} onClick={()=>setAudioTrack(a)}>
                          <div style={{ width:20 }}>{audioTrack===a&&<CheckIcon />}</div>
                          <span style={{ color:audioTrack===a?'#fff':'rgba(255,255,255,.7)',fontSize:15 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quality */}
            <div style={{ position:'relative' }}>
              <button className={`prime-btn ${activePanel==='quality'?'active':''}`} onClick={(e)=>{e.stopPropagation();setActivePanel(activePanel==='quality'?null:'quality');}} title="Video Quality"><SettingsIcon /></button>
              {activePanel==='quality' && (
                <div className="panel" style={{ right:0,width:300 }} onClick={e=>e.stopPropagation()}>
                  <div style={{ padding:'20px 20px 12px' }}>
                    <div style={{ color:'#fff',fontSize:17,fontWeight:700,marginBottom:14 }}>Video Quality</div>
                    {availableQualities.length > 0 ? availableQualities.map(q=>(
                      <div key={q.value} className="quality-item" style={{ display:'flex',alignItems:'center',gap:14,padding:'11px 4px',cursor:'pointer',borderRadius:4 }} onClick={()=>handleQualityChange(q.value)}>
                        <div style={{ width:24 }}>{selectedQuality===q.value&&<CheckIcon />}</div>
                        <span style={{ color:selectedQuality===q.value?'#fff':'rgba(255,255,255,.85)',fontSize:15,fontWeight:selectedQuality===q.value?700:400 }}>{q.label}</span>
                      </div>
                    )) : <div style={{ color:'#AAAAAA',fontSize:13,fontStyle:'italic' }}>Loading qualities…</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Volume */}
            <div style={{ position:'relative' }} onMouseEnter={()=>setActivePanel('volume')} onMouseLeave={()=>{ if(!isDraggingVolume) setActivePanel(null); }}>
              <button className="prime-btn" onClick={(e)=>{e.stopPropagation();toggleMute();}} title="Volume"><VolumeIcon /></button>
              {activePanel==='volume' && (
                <div className="volume-popup" onClick={e=>e.stopPropagation()}>
                  <div ref={volumeSliderRef} className="volume-track" onMouseDown={(e)=>{e.stopPropagation();setIsDraggingVolume(true);changeVolume(getVolumeFromMouseY(e));}}>
                    <div className="volume-fill" style={{ height:`${(muted?0:volume)*100}%` }} />
                    <div className="volume-knob" style={{ bottom:`${(muted?0:volume)*100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <button className="prime-btn" onClick={(e)=>{e.stopPropagation();togglePiP();}} title="Picture in Picture"><PiPIcon /></button>
            <button className="prime-btn" onClick={(e)=>{e.stopPropagation();toggleFullscreen();}} title="Fullscreen">
              {isFullscreen?<ExitFullscreenIcon />:<FullscreenIcon />}
            </button>

            {(mode==='hls'||mode==='direct') && provider && (
              <div style={{ fontSize:9,fontWeight:800,letterSpacing:.8,padding:'2px 7px',borderRadius:4,border:'1px solid rgba(170,170,170,.4)',color:'#AAAAAA',textTransform:'uppercase',margin:'0 4px' }}>
                {provider}
              </div>
            )}

            <div style={{ width:1,height:22,background:'#AAAAAA',margin:'0 6px',opacity:.4 }} />
            <button className="prime-btn" onClick={(e)=>{e.stopPropagation();onClose?.();}} title="Close"><CloseIcon /></button>
          </div>
        </div>

        {/* X-Ray mini overlay */}
        {xrayOpen && xrayCast.length > 0 && (
          <div className="xray-overlay" onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'0 16px 10px',borderBottom:'1px solid rgba(255,255,255,.1)',marginBottom:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ color:'#AAAAAA',fontSize:14 }}>X-Ray</span>
                <div style={{ background:'#f5c518',color:'#000',fontSize:10,fontWeight:800,padding:'2px 4px',borderRadius:3 }}>IMDb</div>
                <button style={{ marginLeft:4,background:'none',border:'none',color:'#AAAAAA',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:13 }} onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}}>All <ChevronRightIcon /></button>
              </div>
            </div>
            {xrayCast.slice(0,3).map(p=>(
              <div key={p.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'8px 16px',cursor:'pointer' }} onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}}>
                {p.profile?<img src={p.profile} alt={p.name} style={{ width:64,height:64,objectFit:'cover',borderRadius:4,flexShrink:0 }} />
                  :<div style={{ width:64,height:64,background:'#111',borderRadius:4,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.3)',fontSize:20,fontWeight:700 }}>{p.name.charAt(0)}</div>}
                <div>
                  <div style={{ color:'#AAAAAA',fontSize:14 }}>{p.name}</div>
                  <div style={{ color:'rgba(170,170,170,.6)',fontSize:12,marginTop:2 }}>{p.character}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Center play/skip — video mode only */}
        {isVideoMode && (
          <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',alignItems:'center',gap:48,zIndex:8 }} onClick={e=>e.stopPropagation()}>
            <button className="prime-btn" style={{ color:'#AAAAAA',padding:0,position:'relative' }} onClick={()=>skip(-10)}>
              <Rewind10Icon />
              {skipFeedback==='back'&&<div className="skip-flash" style={{ left:'50%',transform:'translate(-50%,-50%)',color:'#AAAAAA',fontSize:22 }}>-10</div>}
            </button>
            <button className="prime-btn" style={{ color:'#AAAAAA',padding:0 }} onClick={togglePlay}>
              {playing?<PauseIcon />:<PlayIcon />}
            </button>
            <button className="prime-btn" style={{ color:'#AAAAAA',padding:0,position:'relative' }} onClick={()=>skip(10)}>
              <Forward10Icon />
              {skipFeedback==='forward'&&<div className="skip-flash" style={{ left:'50%',transform:'translate(-50%,-50%)',color:'#AAAAAA',fontSize:22 }}>+10</div>}
            </button>
          </div>
        )}

        {/* Progress bar — video mode only */}
        {isVideoMode && (
          <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 0 28px',zIndex:10 }}>
            <div ref={progressBarRef} className="progress-track" style={{ marginBottom:12 }}
              onMouseDown={onProgressMouseDown} onMouseMove={onProgressMouseMove}
              onMouseUp={onProgressMouseUp} onMouseLeave={onProgressMouseLeave}
              onClick={e=>e.stopPropagation()}>
              <div className="progress-buffered" style={{ width:`${bufferedPct}%` }} />
              <div className="progress-played"   style={{ width:`${progressPct}%` }} />
              {chapterMarkers.map((t,i)=><div key={i} className="chapter-dot" style={{ left:`${(t/duration)*100}%` }} />)}
              <div className="progress-thumb"    style={{ left:`${progressPct}%` }} />
              {hoverTime!==null && (
                <div style={{ position:'absolute',bottom:16,left:Math.max(24,Math.min(hoverX,(progressBarRef.current?.offsetWidth||0)-24)),transform:'translateX(-50%)',background:'rgba(0,0,0,.85)',color:'#AAAAAA',fontSize:11,padding:'3px 8px',borderRadius:4,whiteSpace:'nowrap',pointerEvents:'none' }}>
                  {fmtTime(hoverTime)}
                </div>
              )}
            </div>
            <div style={{ color:'#AAAAAA',fontSize:13,paddingLeft:20 }}>
              {fmtTime(currentTime)}
              {duration>0&&<span>{' / '}{fmtTime(duration)}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ X-RAY EXPANDED PANEL ═══════════════════════════ */}
      {xrayExpanded && (
        <div className="xray-panel" onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0 }}>
            <span style={{ color:'#AAAAAA',fontSize:17,fontWeight:400 }}>X-Ray</span>
            <div style={{ display:'flex',alignItems:'center',gap:12 }}>
              <button className="prime-btn"><XRayExpandIcon /></button>
              <div style={{ width:1,height:22,background:'rgba(255,255,255,.2)' }} />
              <button className="prime-btn" onClick={()=>setXrayExpanded(false)}><CloseIcon /></button>
            </div>
          </div>
          <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0 }}>
            {['scene','cast'].map(tab=>(
              <button key={tab} onClick={()=>setXrayTab(tab)} style={{ flex:1,padding:'14px 0',background:'none',border:'none',color:xrayTab===tab?'#fff':'rgba(255,255,255,.5)',fontSize:15,fontWeight:xrayTab===tab?600:400,cursor:'pointer',borderBottom:xrayTab===tab?'2px solid #fff':'2px solid transparent',marginBottom:-1 }}>
                {tab==='scene'?'In Scene':'Cast'}
              </button>
            ))}
          </div>
          <div style={{ flex:1,overflowY:'auto',padding:'12px 0',scrollbarWidth:'none' }}>
            {xrayCast.map(person=>(
              <div key={person.id} style={{ marginBottom:2 }}>
                <div style={{ display:'flex',alignItems:'center',gap:14,padding:'12px 16px',cursor:'pointer',background:expandedCastId===person.id?'rgba(255,255,255,.06)':'transparent' }} onClick={()=>setExpandedCastId(expandedCastId===person.id?null:person.id)}>
                  <div style={{ position:'relative',flexShrink:0 }}>
                    {person.profile?<img src={person.profile} alt={person.name} style={{ width:72,height:72,objectFit:'cover',borderRadius:6,display:'block' }} />
                      :<div style={{ width:72,height:72,background:'#111',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.3)',fontSize:22,fontWeight:700 }}>{person.name.charAt(0)}</div>}
                    <div style={{ position:'absolute',bottom:4,left:4,background:'#f5c518',color:'#000',fontSize:8,fontWeight:800,padding:'1px 3px',borderRadius:2 }}>IMDb</div>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ color:'#AAAAAA',fontSize:14,marginBottom:3 }}>{person.name}</div>
                    <div style={{ color:'rgba(170,170,170,.65)',fontSize:12 }}>Portrays: {person.character}</div>
                  </div>
                  <div style={{ color:'#AAAAAA' }}>{expandedCastId===person.id?<ChevronUpIcon />:<ChevronDownIcon />}</div>
                </div>
                {expandedCastId===person.id&&(
                  <div style={{ padding:'12px 16px 16px 102px',background:'rgba(255,255,255,.03)' }}>
                    <div style={{ color:'rgba(170,170,170,.7)',fontSize:12,lineHeight:1.6 }}>Known for various acclaimed productions.</div>
                    <button style={{ marginTop:10,background:'none',border:'1px solid rgba(255,255,255,.2)',color:'#f5c518',fontSize:12,fontWeight:600,padding:'5px 12px',borderRadius:4,cursor:'pointer' }}>View on IMDb</button>
                  </div>
                )}
              </div>
            ))}
            {xrayCast.length===0&&<div style={{ padding:'40px 20px',textAlign:'center',color:'rgba(170,170,170,.5)',fontSize:13 }}>Loading cast…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
