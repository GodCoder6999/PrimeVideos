import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

// ─── COLOR ────────────────────────────────────────────────────────────────────
const C = '#A3A3A3';
const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ic = ({ children, ...p }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>{children}</svg>
);

const SubtitlesIcon = () => (
  <Ic><rect x="2" y="5" width="20" height="14" rx="2" stroke={C} strokeWidth="1.5"/>
  <line x1="5" y1="10.5" x2="11" y2="10.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <line x1="13" y1="10.5" x2="19" y2="10.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <line x1="5" y1="14.5" x2="9" y2="14.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <line x1="11" y1="14.5" x2="15" y2="14.5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/></Ic>
);
const SettingsIcon = () => (
  <Ic><circle cx="12" cy="12" r="3" stroke={C} strokeWidth="1.5"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={C} strokeWidth="1.5"/></Ic>
);
const VolumeHighIcon = () => (
  <Ic><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke={C} strokeWidth="1.5" strokeLinecap="round"/></Ic>
);
const VolumeMidIcon = () => (
  <Ic><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={C} strokeWidth="1.5" strokeLinecap="round"/></Ic>
);
const VolumeMuteIcon = () => (
  <Ic><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={C}/>
  <line x1="23" y1="9" x2="17" y2="15" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <line x1="17" y1="9" x2="23" y2="15" stroke={C} strokeWidth="1.5" strokeLinecap="round"/></Ic>
);
const PiPIcon = () => (
  <Ic><rect x="2" y="4" width="20" height="16" rx="2" stroke={C} strokeWidth="1.5"/>
  <rect x="12" y="12" width="8" height="6" rx="1" fill={C}/></Ic>
);
const ResizeIcon = () => (
  <Ic><line x1="7" y1="17" x2="17" y2="7" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <polyline points="7 7 7 17 17 17" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></Ic>
);
const ExitResizeIcon = () => (
  <Ic><polyline points="15 3 21 3 21 9" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  <polyline points="9 21 3 21 3 15" stroke={C} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  <line x1="21" y1="3" x2="14" y2="10" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
  <line x1="3" y1="21" x2="10" y2="14" stroke={C} strokeWidth="1.5" strokeLinecap="round"/></Ic>
);
const CloseIcon = () => (
  <Ic width="22" height="22" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke={C} strokeWidth="2" strokeLinecap="round"/>
  </Ic>
);
const Rewind10Icon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M22 6C13.163 6 6 13.163 6 22s7.163 16 16 16 16-7.163 16-16" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <polyline points="22,6 16,12 22,6 16,0" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="22" y="27" textAnchor="middle" fill={C} fontSize="10" fontWeight="500" fontFamily="system-ui">10</text>
  </svg>
);
const Forward10Icon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M22 6C30.837 6 38 13.163 38 22S30.837 38 22 38 6 30.837 6 22" stroke={C} strokeWidth="2" strokeLinecap="round"/>
    <polyline points="22,6 28,12 22,6 28,0" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="22" y="27" textAnchor="middle" fill={C} fontSize="10" fontWeight="500" fontFamily="system-ui">10</text>
  </svg>
);
const PauseIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect x="10" y="8" width="9" height="28" rx="1.5" fill={C}/>
    <rect x="25" y="8" width="9" height="28" rx="1.5" fill={C}/>
  </svg>
);
const PlayIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <polygon points="10,6 38,22 10,38" fill={C}/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="9 18 15 12 9 6" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="18 15 12 9 6 15" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="6 9 12 15 18 9" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

// Ordered embed list — fastest / most reliable first
const buildEmbeds = (tid, iid, mType, s, e) => {
  const tv = mType === 'tv';
  const list = [];
  if (iid) {
    list.push({ name: 'VidFast',   url: tv ? `https://vidfast.pro/tv/${iid}/${s}/${e}?autoPlay=true` : `https://vidfast.pro/movie/${iid}?autoPlay=true` });
    list.push({ name: 'VidSrc',    url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${iid}` });
  }
  list.push({ name: 'Videasy',     url: tv ? `https://player.videasy.net/tv/${tid}/${s}/${e}` : `https://player.videasy.net/movie/${tid}` });
  list.push({ name: 'AutoEmbed',   url: tv ? `https://autoembed.cc/tv/tmdb/${tid}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${tid}` });
  list.push({ name: 'EmbedSu',     url: tv ? `https://embed.su/embed/tv/${tid}/${s}/${e}` : `https://embed.su/embed/movie/${tid}` });
  list.push({ name: 'VidSrc.in',   url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tid}` });
  list.push({ name: '2Embed',      url: tv ? `https://www.2embed.cc/embedtv/${tid}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${tid}` });
  list.push({ name: 'SuperEmbed',  url: tv ? `https://multiembed.mov/?video_id=${tid}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${tid}&tmdb=1` });
  list.push({ name: 'NontonGo',    url: tv ? `https://www.NontonGo.net/embed/tv/${tid}/${s}/${e}` : `https://www.NontonGo.net/embed/movie/${tid}` });
  return list;
};

// ─── BTN COMPONENT ────────────────────────────────────────────────────────────
const Btn = ({ onClick, title, children, style = {} }) => (
  <button onClick={onClick} title={title} style={{
    background: 'none', border: 'none', cursor: 'pointer', color: C,
    padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '3px', transition: 'opacity .15s', flexShrink: 0, ...style,
  }}
    onMouseEnter={e => e.currentTarget.style.opacity = '0.65'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
  >{children}</button>
);

// ─── MAIN PLAYER ──────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {

  // Refs
  const containerRef   = useRef(null);
  const videoRef       = useRef(null);
  const hlsRef         = useRef(null);
  const iframeRef      = useRef(null);
  const progressRef    = useRef(null);
  const timerRef       = useRef(null);
  const iframeTimer    = useRef(null);
  const volSliderRef   = useRef(null);
  const cancelRef      = useRef(false);

  // Playback state
  const [playing,     setPlaying]     = useState(false);
  const [curTime,     setCurTime]     = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [buffered,    setBuffered]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [isFS,        setIsFS]        = useState(false);
  const [showCtrl,    setShowCtrl]    = useState(true);
  const [seeking,     setSeeking]     = useState(false);
  const [bufSpinner,  setBufSpinner]  = useState(false);
  const [skipFb,      setSkipFb]      = useState(null);
  const [dragVol,     setDragVol]     = useState(false);

  // Stream state
  // mode: 'loading' | 'hls' | 'mp4' | 'iframe' | 'error'
  const [mode,        setMode]        = useState('loading');
  const [hlsUrl,      setHlsUrl]      = useState(null);
  const [mp4Url,      setMp4Url]      = useState(null);
  const [streams,     setStreams]      = useState([]); // all resolved streams for quality picker
  const [streamIdx,   setStreamIdx]   = useState(0);
  const [provider,    setProvider]    = useState('');
  const [embeds,      setEmbeds]      = useState([]);
  const [embedIdx,    setEmbedIdx]    = useState(0);
  const [embedPhase,  setEmbedPhase]  = useState('loading'); // 'loading'|'playing'|'failed'
  const [statusMsg,   setStatusMsg]   = useState('Finding best stream…');
  const [imdbId,      setImdbId]      = useState(null);
  const [movieTitle,  setMovieTitle]  = useState(title);

  // UI panels
  const [panel,       setPanel]       = useState(null); // null|'subs'|'quality'|'volume'|'sources'
  const [quality,     setQuality]     = useState('Best');
  const [subTrack,    setSubTrack]    = useState('Off');
  const [audioTrack,  setAudioTrack]  = useState('English');

  // X-Ray
  const [xrayOpen,    setXrayOpen]    = useState(false);
  const [xrayExpanded,setXrayExpanded]= useState(false);
  const [cast,        setCast]        = useState([]);
  const [xrayTab,     setXrayTab]     = useState('cast');
  const [expandedActor, setExpandedActor] = useState(null);

  // Progress hover
  const [hoverTime,   setHoverTime]   = useState(null);
  const [hoverX,      setHoverX]      = useState(0);

  // ── INIT: fetch NuvioStreams then fall back to embeds ─────────────────────
  useEffect(() => {
    if (!tmdbId) return;
    cancelRef.current = false;

    // Reset everything
    setMode('loading');
    setHlsUrl(null);
    setMp4Url(null);
    setStreams([]);
    setStreamIdx(0);
    setProvider('');
    setEmbeds([]);
    setEmbedIdx(0);
    setEmbedPhase('loading');
    setBufSpinner(false);
    setPlaying(false);
    setCurTime(0);
    setDuration(0);
    setStatusMsg('Finding best stream…');
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Pre-populate embeds with TMDB id (imdb id added later)
    setEmbeds(buildEmbeds(tmdbId, null, mediaType, season, episode));

    const go = async () => {
      // 1. TMDB metadata + IMDB ID
      let iid = null;
      try {
        const r = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits`,
          { signal: AbortSignal.timeout(8000) }
        );
        const d = await r.json();
        if (cancelRef.current) return;
        iid = d.imdb_id || d.external_ids?.imdb_id || null;
        setImdbId(iid);
        setMovieTitle(d.title || d.name || title);
        setCast((d.credits?.cast || []).slice(0, 12).map(p => ({
          id: p.id, name: p.name, character: p.character,
          profile: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        })));
        if (iid) setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
      } catch (_) {}

      if (cancelRef.current) return;

      // 2. Call our /api/nuvio-stream (server-side, no CORS)
      setStatusMsg('Fetching NuvioStreams…');
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 12000);
        const res  = await fetch(
          `/api/nuvio-stream?${new URLSearchParams({ tmdbId, type: mediaType, season, episode })}`,
          { signal: ctrl.signal }
        ).finally(() => clearTimeout(tid));

        const data = await res.json();
        if (cancelRef.current) return;

        if (data?.success && data.streams?.length > 0) {
          setStreams(data.streams);
          const best = data.streams[0];
          setProvider(best.provider || 'NuvioStreams');

          if (best.type === 'hls' || best.url.includes('.m3u8')) {
            setHlsUrl(best.url);
            setBufSpinner(true);
            setMode('hls');
            return;
          } else {
            setMp4Url(best.url);
            setBufSpinner(true);
            setMode('mp4');
            return;
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[Player] NuvioStreams failed:', e.message);
      }

      if (cancelRef.current) return;

      // 3. Fall back to embed iframes
      setStatusMsg('Loading player…');
      setMode('iframe');
    };

    go();

    return () => {
      cancelRef.current = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode]);

  // ── HLS SETUP ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const vid = videoRef.current;

    const fallbackToEmbed = () => {
      if (cancelRef.current) return;
      setMode('iframe');
      setEmbedIdx(0);
      setEmbedPhase('loading');
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,          // auto quality selection
        abrEwmaDefaultEstimate: 5000000, // start at 5Mbps estimate
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        vid.play().catch(() => {});
        setPlaying(true);
        setBufSpinner(false);
      });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          // Try next stream in list
          const nextIdx = streamIdx + 1;
          if (nextIdx < streams.length) {
            const next = streams[nextIdx];
            setStreamIdx(nextIdx);
            setProvider(next.provider);
            if (next.type === 'hls') { setHlsUrl(next.url); }
            else { setMp4Url(next.url); setMode('mp4'); }
          } else {
            fallbackToEmbed();
          }
        }
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      vid.src = hlsUrl;
      vid.addEventListener('loadedmetadata', () => { vid.play().catch(() => {}); setPlaying(true); setBufSpinner(false); }, { once: true });
    } else {
      fallbackToEmbed();
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ── MP4 SETUP ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'mp4' || !mp4Url || !videoRef.current) return;
    const vid = videoRef.current;

    const fallbackToEmbed = () => {
      if (cancelRef.current) return;
      // Try next stream
      const nextIdx = streamIdx + 1;
      if (nextIdx < streams.length) {
        const next = streams[nextIdx];
        setStreamIdx(nextIdx);
        setProvider(next.provider);
        if (next.type === 'hls') { setHlsUrl(next.url); setMode('hls'); }
        else { setMp4Url(next.url); }
      } else {
        setMode('iframe');
        setEmbedIdx(0);
        setEmbedPhase('loading');
      }
    };

    vid.pause();
    vid.src = mp4Url;
    vid.load();

    const onMeta = () => { vid.play().catch(() => {}); setBufSpinner(false); };
    const onErr  = (e) => { const err = vid.error; if (!err || err.code === MediaError.MEDIA_ERR_ABORTED) return; fallbackToEmbed(); };
    let stall = null;
    const onWait = () => { clearTimeout(stall); stall = setTimeout(() => { if (!vid.paused && vid.readyState < 3) fallbackToEmbed(); }, 12000); };
    const onPlay = () => clearTimeout(stall);

    vid.addEventListener('loadedmetadata', onMeta, { once: true });
    vid.addEventListener('error', onErr);
    vid.addEventListener('waiting', onWait);
    vid.addEventListener('playing', onPlay);

    return () => {
      clearTimeout(stall);
      vid.removeEventListener('loadedmetadata', onMeta);
      vid.removeEventListener('error', onErr);
      vid.removeEventListener('waiting', onWait);
      vid.removeEventListener('playing', onPlay);
    };
  }, [mp4Url, mode]);

  // ── IFRAME TIMEOUT ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'iframe' || embedPhase !== 'loading') return;
    clearTimeout(iframeTimer.current);
    iframeTimer.current = setTimeout(() => {
      if (embedIdx < embeds.length - 1) setEmbedIdx(i => i + 1);
      else setEmbedPhase('failed');
    }, 15000);
    return () => clearTimeout(iframeTimer.current);
  }, [mode, embedPhase, embedIdx, embeds.length]);

  // ── VIDEO EVENTS ───────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay    = () => { setPlaying(true);  setBufSpinner(false); };
    const onPause   = () => setPlaying(false);
    const onTime    = () => setCurTime(v.currentTime);
    const onDur     = () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); };
    const onProg    = () => { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); };
    const onWait    = () => setBufSpinner(true);
    const onPlaying = () => setBufSpinner(false);
    const onCan     = () => setBufSpinner(false);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress',       onProg);
    v.addEventListener('waiting',        onWait);
    v.addEventListener('playing',        onPlaying);
    v.addEventListener('canplay',        onCan);
    v.addEventListener('stalled',        onWait);
    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress',       onProg);
      v.removeEventListener('waiting',        onWait);
      v.removeEventListener('playing',        onPlaying);
      v.removeEventListener('canplay',        onCan);
      v.removeEventListener('stalled',        onWait);
    };
  }, []);

  // ── CONTROLS AUTO-HIDE ─────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!panel && !xrayOpen && !xrayExpanded) setShowCtrl(false);
    }, 3500);
  }, [panel, xrayOpen, xrayExpanded]);

  useEffect(() => { resetTimer(); return () => clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    if (panel || xrayOpen || xrayExpanded) { setShowCtrl(true); clearTimeout(timerRef.current); }
    else resetTimer();
  }, [panel, xrayOpen, xrayExpanded]);

  // ── FULLSCREEN ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── KEYBOARD ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); skip(-10); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
      else if (e.key === 'f') toggleFS();
      else if (e.key === 'm') toggleMute();
      else if (e.key === 'Escape') { setPanel(null); setXrayOpen(false); setXrayExpanded(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, muted]);

  // ── ACTIONS ────────────────────────────────────────────────────────────────
  const isVideoMode = mode === 'hls' || mode === 'mp4';
  const togglePlay  = () => { const v = videoRef.current; if (!v || !isVideoMode) return; playing ? v.pause() : v.play(); };
  const skip = (sec) => {
    const v = videoRef.current;
    if (!v || !isVideoMode) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    setSkipFb(sec < 0 ? 'back' : 'fwd');
    setTimeout(() => setSkipFb(null), 650);
  };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !muted; setMuted(!muted); };
  const changeVol = (val) => {
    const v = videoRef.current;
    const c = Math.max(0, Math.min(1, val));
    setVolume(c); setMuted(c === 0);
    if (v) { v.volume = c; v.muted = c === 0; }
  };
  const toggleFS = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };
  const togglePiP = async () => {
    const v = videoRef.current; if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (_) {}
  };

  // Quality switch (for NuvioStreams multi-stream)
  const switchStream = (idx) => {
    const s = streams[idx];
    if (!s) return;
    setStreamIdx(idx);
    setProvider(s.provider);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (s.type === 'hls') { setHlsUrl(s.url); setMode('hls'); }
    else { setMp4Url(s.url); setMode('mp4'); }
    setPanel(null);
  };

  // ── PROGRESS BAR ───────────────────────────────────────────────────────────
  const getSeekTime = (e) => {
    const bar = progressRef.current;
    if (!bar || !duration) return 0;
    const r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
  };
  const onBarMove = (e) => {
    const t = getSeekTime(e);
    const bar = progressRef.current;
    if (bar) setHoverX(e.clientX - bar.getBoundingClientRect().left);
    setHoverTime(t);
    if (seeking) { const v = videoRef.current; if (v) v.currentTime = t; setCurTime(t); }
  };
  const onBarDown = (e) => {
    setSeeking(true);
    const t = getSeekTime(e);
    const v = videoRef.current;
    if (v) v.currentTime = t;
    setCurTime(t);
  };
  const onBarUp   = () => setSeeking(false);
  const onBarLeave = () => { setHoverTime(null); if (seeking) setSeeking(false); };

  // ── VOLUME DRAG ────────────────────────────────────────────────────────────
  const getVolFromY = (e) => {
    const s = volSliderRef.current; if (!s) return volume;
    const r = s.getBoundingClientRect();
    return 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  };
  useEffect(() => {
    if (!dragVol) return;
    const move = (e) => changeVol(getVolFromY(e));
    const up   = () => setDragVol(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragVol]);

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const progPct = duration > 0 ? (curTime / duration) * 100 : 0;
  const bufPct  = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeMidIcon : VolumeHighIcon;
  const curEmbed = embeds[embedIdx];
  const chapterMarks = duration > 0 ? [0.16, 0.33, 0.5, 0.66, 0.83].map(p => p * duration) : [];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onMouseMove={resetTimer}
      onClick={() => setPanel(null)}
      style={{
        position: 'fixed', inset: 0, background: '#000',
        fontFamily: "'Amazon Ember','Segoe UI',system-ui,sans-serif",
        userSelect: 'none',
        cursor: showCtrl ? 'default' : 'none',
        zIndex: 9999,
      }}
    >
      <style>{`
        .pp-spin { width:48px;height:48px;border-radius:50%;border:2px solid rgba(163,163,163,.2);border-top-color:#A3A3A3;animation:ppSpin .8s linear infinite; }
        @keyframes ppSpin{to{transform:rotate(360deg)}}
        .pp-bar{position:relative;height:3px;background:rgba(163,163,163,.22);cursor:pointer;transition:height .12s}
        .pp-bar:hover{height:5px}
        .pp-bar:hover .pp-thumb{opacity:1!important;transform:translate(-50%,-50%) scale(1)!important}
        .pp-panel{position:absolute;top:44px;right:0;background:#111;border-radius:4px 0 0 4px;box-shadow:0 8px 32px rgba(0,0,0,.9);animation:ppIn .12s ease-out;z-index:50}
        .pp-vol-pop{position:absolute;bottom:42px;left:50%;transform:translateX(-50%);background:#111;border-radius:6px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.9);animation:ppIn .12s ease-out;z-index:50}
        @keyframes ppIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .pp-xpanel{position:absolute;top:0;right:0;bottom:0;width:340px;background:#080808;border-left:1px solid rgba(163,163,163,.08);display:flex;flex-direction:column;animation:ppSlide .18s ease-out;z-index:20}
        @keyframes ppSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .pp-skip-flash{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#A3A3A3;font-size:20px;pointer-events:none;animation:ppSkip .55s ease-out forwards}
        @keyframes ppSkip{0%{opacity:.9}100%{opacity:0}}
        .pp-src-badge{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.6px;padding:2px 6px;border-radius:3px;border:1px solid rgba(163,163,163,.35);color:#A3A3A3;text-transform:uppercase}
      `}</style>

      {/* VIDEO ELEMENT — always visible; iframe overlays it via position:absolute */}
      <video
        ref={videoRef}
        style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }}
        playsInline preload="metadata"
        onClick={e => { e.stopPropagation(); togglePlay(); }}
      />

      {/* IFRAME MODE — absolute overlay on top of the video element */}
      {mode === 'iframe' && (
        <>
          {embedPhase === 'loading' && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#000', zIndex:6, pointerEvents:'none', gap:16 }}>
              <div className="pp-spin" />
              <div style={{ color:C, fontSize:12, opacity:.6 }}>{statusMsg}</div>
            </div>
          )}
          {embedPhase === 'failed' && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#000', zIndex:6, gap:12 }}>
              <div style={{ color:'#f87171', fontSize:16, fontWeight:600 }}>Playback unavailable</div>
              <div style={{ color:C, fontSize:13, opacity:.6, maxWidth:300, textAlign:'center' }}>Could not find a working stream for this title.</div>
              <button onClick={() => { setEmbedIdx(0); setEmbedPhase('loading'); }} style={{ marginTop:8, background:'none', border:`1px solid rgba(163,163,163,.4)`, color:C, padding:'8px 24px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>Retry</button>
            </div>
          )}
          {curEmbed && embedPhase !== 'failed' && (
            <iframe
              ref={iframeRef}
              key={`${embedIdx}-${tmdbId}-${season}-${episode}`}
              src={curEmbed.url}
              style={{
                position:'absolute', inset:0,
                width:'100%', height:'100%',
                border:'none', display:'block',
                zIndex:5,
                /* Always visible — no opacity:0 hiding that causes audio-only playback */
                opacity:1,
              }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen referrerPolicy="no-referrer"
              onLoad={() => {
                clearTimeout(iframeTimer.current);
                iframeTimer.current = setTimeout(() => setEmbedPhase('playing'), 800);
              }}
              title={movieTitle}
            />
          )}
          {embedPhase === 'playing' && embedIdx < embeds.length - 1 && showCtrl && (
            <div style={{ position:'absolute', bottom:72, right:16, zIndex:20 }}>
              <button onClick={e => { e.stopPropagation(); clearTimeout(iframeTimer.current); setEmbedIdx(i=>i+1); setEmbedPhase('loading'); }}
                style={{ background:'rgba(0,0,0,.72)', border:`1px solid rgba(163,163,163,.2)`, color:C, padding:'5px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, backdropFilter:'blur(8px)' }}>
                Not playing? Try next source →
              </button>
            </div>
          )}
        </>
      )}

      {/* GLOBAL SPINNER — black bg only during initial 'loading' state, transparent when buffering mid-playback */}
      {(mode === 'loading' || (isVideoMode && bufSpinner)) && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: mode === 'loading' ? '#000' : 'transparent', zIndex:8, pointerEvents:'none', gap:14 }}>
          <div className="pp-spin" />
          {mode === 'loading' && <div style={{ color:C, fontSize:12, opacity:.55 }}>{statusMsg}</div>}
        </div>
      )}

      {/* ═══ CONTROLS OVERLAY ═══ */}
      <div style={{ position:'absolute', inset:0, opacity: showCtrl?1:0, transition:'opacity .3s', pointerEvents: showCtrl?'auto':'none', zIndex:10 }}>

        {/* Gradients */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:90, background:'linear-gradient(to bottom,rgba(0,0,0,.7) 0%,transparent 100%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:120, background:'linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)', pointerEvents:'none' }}/>

        {/* ── TOP BAR ── */}
        <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', zIndex:20 }}>

          {/* LEFT: X-Ray | IMDb | All > */}
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            <Btn onClick={e=>{e.stopPropagation();setXrayOpen(v=>!v);setXrayExpanded(false);setPanel(null);}} style={{gap:4,padding:'4px 8px'}}>
              <span style={{fontSize:14,color:C}}>X-Ray</span>
            </Btn>
            <div style={{ background:'#f5c518', color:'#000', fontSize:12, fontWeight:800, padding:'2px 6px', borderRadius:4, letterSpacing:.5, margin:'0 2px' }}>IMDb</div>
            <Btn onClick={e=>{e.stopPropagation();setXrayExpanded(true);setXrayOpen(false);setPanel(null);}} style={{gap:2,padding:'4px 8px'}}>
              <span style={{fontSize:14,color:C}}>All</span><ChevronRight/>
            </Btn>
          </div>

          {/* CENTER: title */}
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', color:'#fff', fontSize:16, fontWeight:400, letterSpacing:.1, whiteSpace:'nowrap', maxWidth:'40vw', overflow:'hidden', textOverflow:'ellipsis' }}>{movieTitle}</div>

          {/* RIGHT: subtitles | settings | volume | pip | resize | | close */}
          <div style={{ display:'flex', alignItems:'center', gap:0 }}>

            {/* Provider badge — shows when NuvioStreams stream is playing */}
            {isVideoMode && provider && (
              <span className="pp-src-badge" style={{ marginRight:8 }}>{provider}</span>
            )}

            {/* 1. Subtitles */}
            <div style={{ position:'relative' }}>
              <Btn onClick={e=>{e.stopPropagation();setPanel(panel==='subs'?null:'subs');}} title="Subtitles"><SubtitlesIcon/></Btn>
              {panel==='subs' && (
                <div className="pp-panel" style={{ width:420 }} onClick={e=>e.stopPropagation()}>
                  <div style={{ display:'flex' }}>
                    <div style={{ flex:1, borderRight:'1px solid rgba(255,255,255,.1)', padding:'20px 16px' }}>
                      <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:14 }}>Subtitles</div>
                      {['Off','English','English CC','हिन्दी'].map(s=>(
                        <div key={s} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', cursor:'pointer' }} onClick={()=>setSubTrack(s)}>
                          <div style={{width:20}}>{subTrack===s&&<CheckIcon/>}</div>
                          <span style={{ color:subTrack===s?'#fff':'rgba(255,255,255,.7)', fontSize:15 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex:1, padding:'20px 16px' }}>
                      <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:14 }}>Audio</div>
                      {['English','हिन्दी','தமிழ்','తెలుగు'].map(a=>(
                        <div key={a} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', cursor:'pointer' }} onClick={()=>setAudioTrack(a)}>
                          <div style={{width:20}}>{audioTrack===a&&<CheckIcon/>}</div>
                          <span style={{ color:audioTrack===a?'#fff':'rgba(255,255,255,.7)', fontSize:15 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Settings / Quality */}
            <div style={{ position:'relative' }}>
              <Btn onClick={e=>{e.stopPropagation();setPanel(panel==='quality'?null:'quality');}} title="Quality"><SettingsIcon/></Btn>
              {panel==='quality' && (
                <div className="pp-panel" style={{ width:320 }} onClick={e=>e.stopPropagation()}>
                  <div style={{ padding:'20px 20px 12px' }}>
                    <div style={{ color:'#fff', fontSize:17, fontWeight:700, marginBottom:14 }}>Video Quality</div>

                    {/* NuvioStreams quality options if available */}
                    {streams.length > 1 ? (
                      <>
                        <div style={{ color:C, fontSize:11, opacity:.6, marginBottom:10, textTransform:'uppercase', letterSpacing:.5 }}>Available Streams</div>
                        {streams.map((st, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 4px', cursor:'pointer' }} onClick={()=>switchStream(i)}>
                            <div style={{width:24}}>{streamIdx===i&&<CheckIcon/>}</div>
                            <div>
                              <div style={{ color:streamIdx===i?'#fff':'rgba(255,255,255,.85)', fontSize:15, fontWeight:streamIdx===i?700:400 }}>{st.quality || 'Auto'}</div>
                              <div style={{ color:'rgba(163,163,163,.5)', fontSize:11, marginTop:1 }}>{st.provider}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      ['Good','Better','Best'].map(q=>(
                        <div key={q} style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 4px', cursor:'pointer' }} onClick={()=>{setQuality(q);setPanel(null);}}>
                          <div style={{width:24}}>{quality===q&&<CheckIcon/>}</div>
                          <div style={{ color:quality===q?'#fff':'rgba(255,255,255,.85)', fontSize:15, fontWeight:quality===q?700:400 }}>{q}</div>
                        </div>
                      ))
                    )}

                    {/* Always show source switcher at bottom */}
                    {mode === 'iframe' && embeds.length > 1 && (
                      <>
                        <div style={{ color:C, fontSize:11, opacity:.6, marginTop:16, marginBottom:10, textTransform:'uppercase', letterSpacing:.5 }}>Embed Sources</div>
                        {embeds.slice(0,6).map((em,i)=>(
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'8px 4px', cursor:'pointer' }} onClick={()=>{setEmbedIdx(i);setEmbedPhase('loading');setPanel(null);}}>
                            <div style={{width:24}}>{embedIdx===i&&<CheckIcon/>}</div>
                            <span style={{ color:embedIdx===i?'#fff':'rgba(255,255,255,.7)', fontSize:14 }}>{em.name}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Volume */}
            <div style={{ position:'relative' }}>
              <Btn onClick={e=>{e.stopPropagation();setPanel(panel==='volume'?null:'volume');}} title="Volume"><VolIcon/></Btn>
              {panel==='volume' && (
                <div className="pp-vol-pop" onClick={e=>e.stopPropagation()}>
                  <div ref={volSliderRef} style={{ width:3, height:120, background:'rgba(163,163,163,.22)', borderRadius:2, position:'relative', cursor:'pointer' }}
                    onMouseDown={e=>{e.stopPropagation();setDragVol(true);changeVol(getVolFromY(e));}}>
                    <div style={{ position:'absolute', bottom:0, left:0, width:'100%', height:`${(muted?0:volume)*100}%`, background:C, borderRadius:2 }}/>
                    <div style={{ position:'absolute', left:'50%', bottom:`${(muted?0:volume)*100}%`, width:11, height:11, background:C, borderRadius:'50%', transform:'translate(-50%,50%)' }}/>
                  </div>
                </div>
              )}
            </div>

            {/* 4. PiP */}
            <Btn onClick={e=>{e.stopPropagation();togglePiP();}} title="Picture in Picture"><PiPIcon/></Btn>

            {/* 5. Fullscreen */}
            <Btn onClick={e=>{e.stopPropagation();toggleFS();}} title={isFS?'Exit fullscreen':'Fullscreen'}>
              {isFS ? <ExitResizeIcon/> : <ResizeIcon/>}
            </Btn>

            {/* Separator */}
            <div style={{ width:1, height:22, background:C, opacity:.4, margin:'0 6px', flexShrink:0 }}/>

            {/* 6. Close */}
            <Btn onClick={e=>{e.stopPropagation();onClose?.();}} title="Close"><CloseIcon/></Btn>
          </div>
        </div>

        {/* X-RAY COMPACT */}
        {xrayOpen && cast.length > 0 && (
          <div style={{ position:'absolute', top:50, left:14, background:'rgba(0,0,0,.92)', borderRadius:4, padding:'8px 0', minWidth:250, maxHeight:'55vh', overflowY:'auto', scrollbarWidth:'none', animation:'ppIn .12s ease-out', zIndex:20 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'0 16px 10px', borderBottom:'1px solid rgba(255,255,255,.1)', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:C, fontSize:14 }}>X-Ray</span>
                <div style={{ background:'#f5c518', color:'#000', fontSize:10, fontWeight:800, padding:'1px 4px', borderRadius:3 }}>IMDb</div>
                <Btn onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}} style={{ fontSize:13, gap:2, padding:'2px 4px' }}>All<ChevronRight/></Btn>
              </div>
            </div>
            {cast.slice(0,3).map(p=>(
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 16px', cursor:'pointer' }} onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}}>
                {p.profile ? <img src={p.profile} alt={p.name} style={{ width:64, height:64, objectFit:'cover', borderRadius:4, flexShrink:0 }}/> : <div style={{ width:64, height:64, background:'#1a1a1a', borderRadius:4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.3)', fontSize:20, fontWeight:700 }}>{p.name.charAt(0)}</div>}
                <div><div style={{ color:C, fontSize:14 }}>{p.name}</div><div style={{ color:'rgba(163,163,163,.5)', fontSize:12, marginTop:2 }}>{p.character}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* CENTER CONTROLS */}
        {isVideoMode && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', display:'flex', alignItems:'center', gap:52, zIndex:15 }} onClick={e=>e.stopPropagation()}>
            <div style={{position:'relative'}}>
              <Btn onClick={()=>skip(-10)} style={{padding:0}}><Rewind10Icon/></Btn>
              {skipFb==='back'&&<div className="pp-skip-flash">-10</div>}
            </div>
            <Btn onClick={togglePlay} style={{padding:0}}>{playing?<PauseIcon/>:<PlayIcon/>}</Btn>
            <div style={{position:'relative'}}>
              <Btn onClick={()=>skip(10)} style={{padding:0}}><Forward10Icon/></Btn>
              {skipFb==='fwd'&&<div className="pp-skip-flash">+10</div>}
            </div>
          </div>
        )}

        {/* BOTTOM BAR */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 0 24px', zIndex:20 }}>
          {/* Progress */}
          <div ref={progressRef} className="pp-bar" style={{ marginBottom:10 }}
            onMouseDown={isVideoMode?onBarDown:undefined}
            onMouseMove={isVideoMode?onBarMove:undefined}
            onMouseUp={isVideoMode?onBarUp:undefined}
            onMouseLeave={isVideoMode?onBarLeave:undefined}
            onClick={e=>e.stopPropagation()}
          >
            <div style={{ position:'absolute', top:0, left:0, height:'100%', width:`${bufPct}%`, background:'rgba(163,163,163,.25)', pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:0, left:0, height:'100%', width:`${progPct}%`, background:C, pointerEvents:'none' }}/>
            {chapterMarks.map((t,i)=>(
              <div key={i} style={{ position:'absolute', top:'50%', left:`${(t/duration)*100}%`, width:3, height:3, background:'rgba(0,0,0,.6)', borderRadius:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', zIndex:2 }}/>
            ))}
            <div className="pp-thumb" style={{ position:'absolute', top:'50%', left:`${progPct}%`, width:13, height:13, background:C, borderRadius:'50%', transform:'translate(-50%,-50%) scale(.7)', opacity:0, pointerEvents:'none', transition:'opacity .12s,transform .12s' }}/>
            {hoverTime!==null&&(
              <div style={{ position:'absolute', bottom:18, left:Math.max(20,Math.min(hoverX,(progressRef.current?.offsetWidth||0)-20)), transform:'translateX(-50%)', background:'rgba(0,0,0,.85)', color:C, fontSize:11, padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap', pointerEvents:'none' }}>
                {fmt(hoverTime)}
              </div>
            )}
          </div>
          {/* Time */}
          <div style={{ color:C, fontSize:13, fontWeight:400, letterSpacing:.2, paddingLeft:18, lineHeight:1 }}>
            {fmt(curTime)}{duration>0&&<span style={{ color:C, opacity:.65 }}>{' / '}{fmt(duration)}</span>}
          </div>
        </div>
      </div>

      {/* X-RAY SIDE PANEL */}
      {xrayExpanded && (
        <div className="pp-xpanel" onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid rgba(163,163,163,.08)', flexShrink:0 }}>
            <span style={{ color:C, fontSize:17 }}>X-Ray</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:1, height:20, background:'rgba(163,163,163,.2)' }}/>
              <Btn onClick={()=>setXrayExpanded(false)}><CloseIcon/></Btn>
            </div>
          </div>
          <div style={{ display:'flex', borderBottom:'1px solid rgba(163,163,163,.08)', flexShrink:0 }}>
            {['cast','scene'].map(tab=>(
              <button key={tab} onClick={()=>setXrayTab(tab)} style={{ flex:1, padding:'14px 0', background:'none', border:'none', color:xrayTab===tab?'#fff':'rgba(255,255,255,.5)', fontSize:15, fontWeight:xrayTab===tab?600:400, cursor:'pointer', borderBottom:xrayTab===tab?'2px solid #fff':'2px solid transparent', marginBottom:-1, transition:'all .15s' }}>
                {tab==='cast'?'Cast':'In Scene'}
              </button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 0', scrollbarWidth:'none' }}>
            {cast.map(p=>(
              <div key={p.id}>
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', cursor:'pointer', background:expandedActor===p.id?'rgba(255,255,255,.05)':'transparent', transition:'background .15s' }} onClick={()=>setExpandedActor(expandedActor===p.id?null:p.id)}>
                  {p.profile?<img src={p.profile} alt={p.name} style={{ width:72, height:72, objectFit:'cover', borderRadius:6, flexShrink:0 }}/>:<div style={{ width:72, height:72, background:'#1a1a1a', borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.3)', fontSize:22, fontWeight:700 }}>{p.name.charAt(0)}</div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C, fontSize:14, marginBottom:3 }}>{p.name}</div>
                    <div style={{ color:'rgba(163,163,163,.5)', fontSize:12 }}>as <span style={{ color:'rgba(163,163,163,.7)' }}>{p.character}</span></div>
                  </div>
                  <div style={{ color:C }}>{expandedActor===p.id?<ChevronUp/>:<ChevronDown/>}</div>
                </div>
                {expandedActor===p.id&&(
                  <div style={{ padding:'10px 16px 14px 102px', background:'rgba(255,255,255,.02)' }}>
                    <div style={{ color:'rgba(163,163,163,.65)', fontSize:12, lineHeight:1.6 }}>View full biography and filmography on IMDb.</div>
                    <button style={{ marginTop:10, background:'none', border:'1px solid rgba(255,255,255,.2)', color:'#f5c518', fontSize:12, fontWeight:600, padding:'5px 12px', borderRadius:4, cursor:'pointer' }}>View on IMDb</button>
                  </div>
                )}
              </div>
            ))}
            {cast.length===0&&<div style={{ padding:'40px 20px', textAlign:'center', color:'rgba(163,163,163,.4)', fontSize:13 }}>Loading cast…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
