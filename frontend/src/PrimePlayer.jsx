import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  resolveTitle,
  detectQuality,
  selectBestFiles,
  fetchSubfolder,
  safeUrl,
} from './reelstreamResolver';

// ─── ICONS (inline SVGs matching Prime Video exactly) ──────────────────────
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
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const iframeRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const volumeSliderRef = useRef(null);

  // ── Playback state ──────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // ── Stream state ────────────────────────────────────────────────────────
  // mode: 'loading' | 'hls' | 'direct' | 'iframe'
  const [mode, setMode] = useState('loading');
  const [hlsUrl, setHlsUrl] = useState(null);
  const [provider, setProvider] = useState('');
  const [directFiles, setDirectFiles] = useState([]);   // [{name,url,quality}] sorted highest first
  const [directIdx, setDirectIdx] = useState(0);
  const [directError, setDirectError] = useState(null);
  const [resolverStatus, setResolverStatus] = useState('');
  const [embeds, setEmbeds] = useState([]);
  const [embedIdx, setEmbedIdx] = useState(0);
  const [embedPhase, setEmbedPhase] = useState('loading'); // 'loading'|'playing'|'failed'
  const [imdbId, setImdbId] = useState(null);
  const iframeTimerRef = useRef(null);

  // ── UI panel state ──────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState(null); // null | 'subtitles' | 'quality' | 'volume'
  const [quality, setQuality] = useState('Best');
  const [subtitleTrack, setSubtitleTrack] = useState('Off');
  const [audioTrack, setAudioTrack] = useState('हिन्दी');

  // ── X-Ray state ─────────────────────────────────────────────────────────
  const [xrayOpen, setXrayOpen] = useState(false);         // compact overlay on player
  const [xrayExpanded, setXrayExpanded] = useState(false); // full side panel
  const [xrayCast, setXrayCast] = useState([]);
  const [xrayTab, setXrayTab] = useState('scene');         // 'scene' | 'cast'
  const [expandedCastId, setExpandedCastId] = useState(null);
  const [movieTitle, setMovieTitle] = useState(title);

  // ── Seek preview ────────────────────────────────────────────────────────
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);

  // ── Skip feedback ────────────────────────────────────────────────────────
  const [skipFeedback, setSkipFeedback] = useState(null); // 'back' | 'forward'

  // ── Chapter markers (evenly spaced, like Prime) ─────────────────────────
  const chapterMarkers = duration > 0
    ? [0.16, 0.33, 0.5, 0.66, 0.83].map(p => p * duration)
    : [];

  // ─── EMBED LIST BUILDER ──────────────────────────────────────────────────
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

  // ─── MAIN INIT — 3-TIER RESOLUTION ──────────────────────────────────────
  // Tier 0: Backend /api/get-stream (HLS scraper)
  // Tier 1: REELSTREAM open-directory resolver → direct <video> play
  // Tier 2: Iframe embeds fallback
  useEffect(() => {
    if (!tmdbId) return;

    // Reset all state
    setMode('loading');
    setHlsUrl(null);
    setProvider('');
    setDirectFiles([]);
    setDirectIdx(0);
    setDirectError(null);
    setResolverStatus('');
    setEmbeds([]);
    setEmbedIdx(0);
    setEmbedPhase('loading');
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    (async () => {
      // ── Fetch metadata (IMDB ID + cast for X-Ray) ────────────────────────
      let iid = null;
      let titleStr = title;
      let yearStr = '';
      try {
        const r = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits`
        );
        const d = await r.json();
        iid = d.imdb_id || d.external_ids?.imdb_id || null;
        titleStr = d.title || d.name || title;
        yearStr = (d.release_date || d.first_air_date || '').slice(0, 4);
        setImdbId(iid);
        setMovieTitle(titleStr);
        const cast = (d.credits?.cast || []).slice(0, 12).map(p => ({
          id: p.id, name: p.name, character: p.character,
          profile: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        }));
        setXrayCast(cast);
      } catch (_) {}

      const embedList = buildEmbeds(tmdbId, iid, mediaType, season, episode);
      setEmbeds(embedList);

      // ── Tier 0: Backend HLS scraper ──────────────────────────────────────
      try {
        const params = new URLSearchParams({ tmdbId, mediaType, season, episode });
        const res = await fetch(`/api/get-stream?${params}`);
        const data = await res.json();
        if (data.success && data.streamUrl) {
          setHlsUrl(data.proxyUrl || `/api/proxy?url=${encodeURIComponent(data.streamUrl)}`);
          setProvider(data.provider || 'Direct HLS');
          setMode('hls');
          return;
        }
      } catch (_) {}

      // ── Tier 1: REELSTREAM open-directory index resolver ─────────────────
      try {
        setResolverStatus('Searching open directory index…');
        const result = await resolveTitle({
          tmdbId, mediaType, title: titleStr, year: yearStr, season, episode,
        });

        let videos = result.videos;

        // For TV: drill into season folder if needed
        if (!videos.length && result.folders.length && mediaType === 'tv') {
          const seasonNum = Number(season) || 1;
          const target = result.folders.find(f =>
            new RegExp(`season.?${seasonNum}|s${String(seasonNum).padStart(2,'0')}`, 'i').test(f.name)
          ) || result.folders[0];
          if (target) {
            const sub = await fetchSubfolder(target.url);
            videos = sub.videos || [];
            if (episode && videos.length) {
              const epNum = String(episode).padStart(2, '0');
              const filtered = videos.filter(v => new RegExp(`[Ee]${epNum}`, 'i').test(v.name));
              if (filtered.length) videos = filtered;
            }
          }
        }

        if (videos.length) {
          const bestFiles = selectBestFiles(videos);
          // Reverse so index 0 = highest quality
          const ordered = [...bestFiles].reverse().map(f => ({
            ...f,
            quality: f.quality || detectQuality(f.name) || 'SD',
            url: safeUrl(f.url),
          }));
          setDirectFiles(ordered);
          setDirectIdx(0);
          setResolverStatus('');
          setMode('direct');
          return;
        }
      } catch (e) {
        console.warn('[PrimePlayer] Resolver failed:', e.message);
        setResolverStatus('');
      }

      // ── Tier 2: Iframe embeds ─────────────────────────────────────────────
      setMode('iframe');
    })();

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [tmdbId, mediaType, season, episode]);

  // ─── HLS SETUP ──────────────────────────────────────────────────────────
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
      });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) {
          setTimeout(() => { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }, 2000);
        }
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = hlsUrl;
      vid.addEventListener('loadedmetadata', () => { vid.play().catch(() => {}); setPlaying(true); });
    } else {
      setMode('iframe');
    }
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ─── DIRECT MODE: load file when idx changes ─────────────────────────────
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current || !directFiles.length) return;
    const vid = videoRef.current;
    const file = directFiles[directIdx];
    if (!file) return;
    vid.pause();
    vid.src = safeUrl(file.url);
    vid.load();
    setDirectError(null);
    const onMeta = () => { vid.play().catch(() => {}); setPlaying(true); };
    vid.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => vid.removeEventListener('loadedmetadata', onMeta);
  }, [mode, directIdx, directFiles]);

  // ─── DIRECT MODE: error → try lower quality → give up → iframe ──────────
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current) return;
    const vid = videoRef.current;
    const onErr = () => {
      const e = vid.error;
      if (!e || e.code === 1) return;
      if (directIdx < directFiles.length - 1) { setDirectIdx(i => i + 1); return; }
      setDirectError('Could not play this file. Switching to embed player…');
      setTimeout(() => { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); setDirectError(null); }, 2500);
    };
    vid.addEventListener('error', onErr);
    return () => vid.removeEventListener('error', onErr);
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

  // ─── CONTROLS AUTO-HIDE ──────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!activePanel && !xrayOpen) setShowControls(false);
    }, 3500);
  }, [activePanel, xrayOpen]);

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, []);

  // Keep controls visible while a panel is open
  useEffect(() => {
    if (activePanel || xrayOpen) {
      setShowControls(true);
      clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  }, [activePanel, xrayOpen]);

  // ─── KEYBOARD ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); skip(-10); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'Escape':
          setActivePanel(null);
          setXrayOpen(false);
          setXrayExpanded(false);
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, muted, volume]);

  // ─── FULLSCREEN ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── VIDEO EVENTS ────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || (mode !== 'hls' && mode !== 'direct')) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); };
    const onLoaded = onDur;
    const onProg = () => {
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('progress', onProg);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('progress', onProg);
    };
  }, [mode]);

  // ─── ACTIONS ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play();
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
    v.muted = !muted;
    setMuted(!muted);
  };

  const changeVolume = (val) => {
    const v = videoRef.current;
    setVolume(val);
    setMuted(val === 0);
    if (v) { v.volume = val; v.muted = val === 0; }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch (_) {}
  };

  // ─── PROGRESS BAR ────────────────────────────────────────────────────────
  const getSeekTime = (e) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const onProgressMouseMove = (e) => {
    const t = getSeekTime(e);
    const bar = progressBarRef.current;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      setHoverX(e.clientX - rect.left);
    }
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

  const onProgressMouseUp = () => setSeeking(false);
  const onProgressMouseLeave = () => { setHoverTime(null); if (seeking) setSeeking(false); };

  // ─── VOLUME SLIDER (vertical, drag) ──────────────────────────────────────
  const getVolumeFromMouseY = (e) => {
    const slider = volumeSliderRef.current;
    if (!slider) return volume;
    const rect = slider.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return ratio;
  };

  useEffect(() => {
    if (!isDraggingVolume) return;
    const onMove = (e) => changeVolume(getVolumeFromMouseY(e));
    const onUp = () => setIsDraggingVolume(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingVolume]);

  // ─── DERIVED ─────────────────────────────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeMidIcon : VolumeHighIcon;

  const curEmbed = embeds[embedIdx];
  const curDirect = directFiles[directIdx];
  const isVideoMode = mode === 'hls' || mode === 'direct';

    // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="prime-player"
      onMouseMove={resetControlsTimer}
      onClick={() => { setActivePanel(null); }}
      style={{
        position: 'fixed', inset: 0,
        background: '#000',
        fontFamily: "'Amazon Ember', 'Segoe UI', system-ui, sans-serif",
        userSelect: 'none',
        cursor: showControls ? 'default' : 'none',
        zIndex: 9999,
      }}
    >
      <style>{`
        .prime-player * { box-sizing: border-box; }
        .prime-btn {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.85); padding: 6px;
          border-radius: 4px; display: flex; align-items: center; justify-content: center;
          transition: color 0.15s, background 0.15s;
        }
        .prime-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .prime-btn.active { color: #fff; }

        /* Progress bar */
        .progress-track {
          position: relative; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.3); cursor: pointer;
          transition: height 0.15s;
        }
        .progress-track:hover { height: 6px; }
        .progress-track:hover .progress-thumb { opacity: 1; }
        .progress-buffered {
          position: absolute; top: 0; left: 0; height: 100%;
          background: rgba(255,255,255,0.45); border-radius: 2px;
          pointer-events: none;
        }
        .progress-played {
          position: absolute; top: 0; left: 0; height: 100%;
          background: #00A8E1; border-radius: 2px; pointer-events: none;
        }
        .progress-thumb {
          position: absolute; top: 50%; width: 14px; height: 14px;
          background: #fff; border-radius: 50%; transform: translate(-50%, -50%);
          opacity: 0; pointer-events: none; transition: opacity 0.15s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .chapter-dot {
          position: absolute; top: 50%; width: 6px; height: 6px;
          background: rgba(255,255,255,0.6); border-radius: 50%;
          transform: translate(-50%, -50%); pointer-events: none;
        }

        /* Panel */
        .panel {
          position: absolute; top: 56px; right: 0;
          background: #3d3d3d; border-radius: 8px 0 0 8px;
          min-width: 280px; overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          animation: panelIn 0.15s ease-out;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Volume popup */
        .volume-popup {
          position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%);
          background: #3d3d3d; border-radius: 8px;
          padding: 16px 14px; width: 48px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          animation: panelIn 0.15s ease-out;
        }
        .volume-track {
          width: 4px; height: 160px; background: rgba(255,255,255,0.25);
          border-radius: 2px; position: relative; cursor: pointer;
        }
        .volume-fill {
          position: absolute; bottom: 0; left: 0; width: 100%;
          background: #fff; border-radius: 2px; pointer-events: none;
        }
        .volume-knob {
          position: absolute; left: 50%; width: 14px; height: 14px;
          background: #fff; border-radius: 50%; transform: translate(-50%, 50%);
          pointer-events: none; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }

        /* Xray overlay */
        .xray-overlay {
          position: absolute; top: 64px; left: 20px;
          background: rgba(0,0,0,0.85); border-radius: 8px;
          padding: 12px 0; min-width: 280px; max-height: 60vh;
          overflow-y: auto; scrollbar-width: none;
          animation: panelIn 0.2s ease-out;
        }
        .xray-overlay::-webkit-scrollbar { display: none; }

        /* Xray expanded panel */
        .xray-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 360px; background: #0f1923;
          border-left: 1px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column;
          animation: slideIn 0.25s ease-out;
          z-index: 10;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        /* Skip feedback */
        .skip-flash {
          position: absolute; top: 50%; transform: translateY(-50%);
          pointer-events: none; animation: skipFlash 0.5s ease-out forwards;
        }
        @keyframes skipFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Loading spinner */
        .spin {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #00A8E1;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── SHARED <video> ELEMENT — used for both HLS and Direct modes ── */}
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

      {/* ── DIRECT MODE: error overlay ── */}
      {mode === 'direct' && directError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', zIndex: 8 }}>
          <div style={{ color: '#f87171', fontSize: 15, marginBottom: 16, textAlign: 'center', maxWidth: 320 }}>{directError}</div>
          <div className="spin" />
        </div>
      )}

      {/* ── IFRAME MODE ── */}
      {mode === 'iframe' && (
        <>
          {/* Loading/failed overlays */}
          {embedPhase === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 6, pointerEvents: 'none' }}>
              <div className="spin" style={{ marginBottom: 16 }} />
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{curEmbed?.name || 'Loading…'}</div>
            </div>
          )}
          {embedPhase === 'failed' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 6 }}>
              <div style={{ color: '#f87171', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All sources failed</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>This title may not be available right now.</div>
              <button onClick={() => { setEmbedIdx(0); setEmbedPhase('loading'); }}
                style={{ background: '#00A8E1', border: 'none', color: '#fff', padding: '8px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
                Retry
              </button>
            </div>
          )}

          {curEmbed && embedPhase !== 'failed' && (
            <iframe
              ref={iframeRef}
              key={`${embedIdx}-${tmdbId}-${season}-${episode}`}
              src={curEmbed.url}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: embedPhase === 'playing' ? 1 : 0, transition: 'opacity 0.4s' }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => { clearTimeout(iframeTimerRef.current); setEmbedPhase('playing'); }}
              title={movieTitle}
            />
          )}

          {/* Source switcher nudge */}
          {embedPhase === 'playing' && embedIdx < embeds.length - 1 && showControls && (
            <div style={{ position: 'absolute', bottom: 72, right: 16, zIndex: 20 }}>
              <button
                onClick={(e) => { e.stopPropagation(); clearTimeout(iframeTimerRef.current); setEmbedIdx(i => i + 1); setEmbedPhase('loading'); }}
                style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(8px)' }}
              >
                Not playing? Try next source →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── GLOBAL LOADING (resolver searching) ── */}
      {mode === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 8 }}>
          <div className="spin" style={{ marginBottom: 16 }} />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, animation: 'pulse 1.5s infinite' }}>
            {resolverStatus || 'Finding stream…'}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CONTROLS OVERLAY — only shown when showControls is true
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
        zIndex: 5,
      }}>

        {/* Top gradient */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 100,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* ── TOP BAR ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', zIndex: 10,
        }}>
          {/* X-Ray */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="prime-btn"
              onClick={(e) => { e.stopPropagation(); setXrayOpen(v => !v); setXrayExpanded(false); setActivePanel(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', color: xrayOpen ? '#fff' : 'rgba(255,255,255,0.7)' }}
            >
              <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: 0.3 }}>X-Ray</span>
              {xrayOpen ? <ChevronUpIcon /> : null}
            </button>

            <div style={{
              background: '#f5c518', color: '#000', fontSize: 11, fontWeight: 800,
              padding: '2px 5px', borderRadius: 3, letterSpacing: 0.5,
            }}>IMDb</div>

            <button
              className="prime-btn"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 3 }}
              onClick={(e) => { e.stopPropagation(); setXrayExpanded(true); setXrayOpen(false); setActivePanel(null); }}
            >
              All <ChevronRightIcon />
            </button>
          </div>

          {/* Title */}
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 0.2 }}>
            {movieTitle}
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Subtitles */}
            <div style={{ position: 'relative' }}>
              <button
                className={`prime-btn ${activePanel === 'subtitles' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'subtitles' ? null : 'subtitles'); }}
                title="Subtitles & Audio"
              >
                <SubtitlesIcon />
              </button>

              {activePanel === 'subtitles' && (
                <div className="panel" style={{ right: 0, width: 420 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 0, padding: 0 }}>
                    {/* Subtitles column */}
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.15)', padding: '20px 16px' }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Subtitles</div>
                      {['Off', 'English', 'English CC', 'العربية'].map(s => (
                        <div key={s}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', borderRadius: 4 }}
                          onClick={() => setSubtitleTrack(s)}
                        >
                          <div style={{ width: 20, flexShrink: 0 }}>
                            {subtitleTrack === s && <CheckIcon />}
                          </div>
                          <span style={{ color: subtitleTrack === s ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 15 }}>
                            {s === 'English CC' ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                English
                                <span style={{ border: '1px solid rgba(255,255,255,0.5)', borderRadius: 3, padding: '1px 4px', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>CC</span>
                              </span>
                            ) : s}
                          </span>
                        </div>
                      ))}
                      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 12 }}>
                        <button style={{ background: 'none', border: 'none', color: '#00A8E1', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                          Subtitles Settings
                        </button>
                      </div>
                    </div>

                    {/* Audio column */}
                    <div style={{ flex: 1, padding: '20px 16px' }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Audio</div>
                      {['English', 'हिन्दी', 'हिन्दी ऑडियो विवरण', 'हिन्दी Dialogue'].map(a => (
                        <div key={a}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', borderRadius: 4 }}
                          onClick={() => setAudioTrack(a)}
                        >
                          <div style={{ width: 20, flexShrink: 0 }}>
                            {audioTrack === a && <CheckIcon />}
                          </div>
                          <div>
                            <span style={{ color: audioTrack === a ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 15 }}>{a}</span>
                            {a === 'हिन्दी ऑडियो विवरण' && (
                              <span style={{ marginLeft: 6, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>ऑडियो विवरण</span>
                            )}
                            {a === 'हिन्दी Dialogue' && (
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Boost: Medium</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings / Quality */}
            <div style={{ position: 'relative' }}>
              <button
                className={`prime-btn ${activePanel === 'quality' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'quality' ? null : 'quality'); }}
                title="Video Quality"
              >
                <SettingsIcon />
              </button>

              {activePanel === 'quality' && (
                <div className="panel" style={{ right: 0, width: 320 }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px 20px 8px' }}>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Video Quality</div>
                    {[
                      { label: 'Good', sub: 'Uses about 0.38 GB per hour' },
                      { label: 'Better', sub: 'Uses about 1.40 GB per hour' },
                      { label: 'Best', sub: 'Uses about 6.84 GB per hour' },
                    ].map(q => (
                      <div key={q.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', cursor: 'pointer', borderRadius: 4 }}
                        onClick={() => { setQuality(q.label); setActivePanel(null); }}
                      >
                        <div style={{ width: 24, flexShrink: 0 }}>
                          {quality === q.label && <CheckIcon />}
                        </div>
                        <div>
                          <div style={{ color: quality === q.label ? '#fff' : 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: quality === q.label ? 700 : 400 }}>{q.label}</div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>{q.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Volume */}
            <div style={{ position: 'relative' }}>
              <button
                className={`prime-btn ${activePanel === 'volume' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'volume' ? null : 'volume'); }}
                title="Volume"
              >
                <VolumeIcon />
              </button>

              {activePanel === 'volume' && (
                <div className="volume-popup" onClick={e => e.stopPropagation()}>
                  <div
                    ref={volumeSliderRef}
                    className="volume-track"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingVolume(true);
                      changeVolume(getVolumeFromMouseY(e));
                    }}
                  >
                    <div className="volume-fill" style={{ height: `${(muted ? 0 : volume) * 100}%` }} />
                    <div className="volume-knob" style={{ bottom: `${(muted ? 0 : volume) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* PiP */}
            <button className="prime-btn" onClick={(e) => { e.stopPropagation(); togglePiP(); }} title="Picture in Picture">
              <PiPIcon />
            </button>

            {/* Fullscreen */}
            <button className="prime-btn" onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title="Fullscreen">
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>

            {/* Source/Quality badge for video modes */}
            {(mode === 'hls' || mode === 'direct') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
                {/* Mode badge */}
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                  padding: '2px 7px', borderRadius: 4, border: '1px solid',
                  color: mode === 'direct' ? '#4ade80' : '#00A8E1',
                  borderColor: mode === 'direct' ? 'rgba(74,222,128,0.5)' : 'rgba(0,168,225,0.5)',
                  background: mode === 'direct' ? 'rgba(74,222,128,0.1)' : 'rgba(0,168,225,0.1)',
                  textTransform: 'uppercase',
                }}>
                  {mode === 'direct' ? (curDirect?.quality || 'Direct') : (provider || 'HLS')}
                </div>
                {/* Quality switcher for direct mode */}
                {mode === 'direct' && directFiles.length > 1 && (
                  <div style={{ position: 'relative' }}>
                    <button
                      className="prime-btn"
                      onClick={(e) => { e.stopPropagation(); setActivePanel(activePanel === 'directQuality' ? null : 'directQuality'); }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', color: 'rgba(255,255,255,0.7)' }}
                    >
                      Quality ▾
                    </button>
                    {activePanel === 'directQuality' && (
                      <div className="panel" style={{ right: 0, width: 200 }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '14px 16px 8px' }}>
                          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Quality</div>
                          {directFiles.map((f, i) => (
                            <div key={i}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', cursor: 'pointer' }}
                              onClick={() => { setDirectIdx(i); setActivePanel(null); }}
                            >
                              <div style={{ width: 20 }}>{directIdx === i && <CheckIcon />}</div>
                              <div>
                                <div style={{ color: directIdx === i ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: directIdx === i ? 700 : 400 }}>
                                  {f.quality || 'SD'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Separator */}
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.25)', margin: '0 8px' }} />

            {/* Close */}
            <button className="prime-btn" onClick={(e) => { e.stopPropagation(); onClose?.(); }} title="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── X-RAY COMPACT OVERLAY ── */}
        {xrayOpen && xrayCast.length > 0 && (
          <div className="xray-overlay" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '0 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>X-Ray</span>
                <div style={{ background: '#f5c518', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 4px', borderRadius: 3 }}>IMDb</div>
                <button
                  style={{ marginLeft: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 13 }}
                  onClick={() => { setXrayExpanded(true); setXrayOpen(false); }}
                >
                  All <ChevronRightIcon />
                </button>
              </div>
            </div>
            {xrayCast.slice(0, 3).map(person => (
              <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', cursor: 'pointer' }}
                onClick={() => { setXrayExpanded(true); setXrayOpen(false); }}>
                {person.profile ? (
                  <img src={person.profile} alt={person.name}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#1f2937', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 20, fontWeight: 700 }}>
                    {person.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{person.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>{person.character}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CENTER CONTROLS (video modes — iframe has its own controls) ── */}
        {isVideoMode && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 56,
            zIndex: 8,
          }}
            onClick={e => e.stopPropagation()}
          >
            {/* Rewind */}
            <button
              className="prime-btn"
              style={{ color: 'rgba(255,255,255,0.85)', padding: 0, position: 'relative' }}
              onClick={() => skip(-10)}
            >
              <Rewind10Icon />
              {skipFeedback === 'back' && (
                <div className="skip-flash" style={{ left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: 24, fontWeight: 700 }}>-10</div>
              )}
            </button>

            {/* Play/Pause */}
            <button className="prime-btn" style={{ color: 'rgba(255,255,255,0.9)', padding: 0 }} onClick={togglePlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Forward */}
            <button
              className="prime-btn"
              style={{ color: 'rgba(255,255,255,0.85)', padding: 0, position: 'relative' }}
              onClick={() => skip(10)}
            >
              <Forward10Icon />
              {skipFeedback === 'forward' && (
                <div className="skip-flash" style={{ left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: 24, fontWeight: 700 }}>+10</div>
              )}
            </button>
          </div>
        )}

        {/* ── BOTTOM BAR ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 20px 20px', zIndex: 10,
        }}>
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="progress-track"
            style={{ marginBottom: 10, cursor: isVideoMode ? 'pointer' : 'default' }}
            onMouseDown={isVideoMode ? onProgressMouseDown : undefined}
            onMouseMove={isVideoMode ? onProgressMouseMove : undefined}
            onMouseUp={isVideoMode ? onProgressMouseUp : undefined}
            onMouseLeave={isVideoMode ? onProgressMouseLeave : undefined}
            onClick={e => e.stopPropagation()}
          >
            {/* Buffered */}
            <div className="progress-buffered" style={{ width: `${bufferedPct}%` }} />
            {/* Played */}
            <div className="progress-played" style={{ width: `${progressPct}%` }} />
            {/* Chapter markers */}
            {chapterMarkers.map((t, i) => (
              <div key={i} className="chapter-dot" style={{ left: `${(t / duration) * 100}%` }} />
            ))}
            {/* Thumb */}
            <div className="progress-thumb" style={{ left: `${progressPct}%` }} />
            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div style={{
                position: 'absolute', bottom: 16,
                left: Math.max(24, Math.min(hoverX, (progressBarRef.current?.offsetWidth || 0) - 24)),
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)', color: '#fff',
                fontSize: 12, fontWeight: 600, padding: '3px 8px',
                borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none',
              }}>
                {fmtTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Time */}
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.3 }}>
            {fmtTime(currentTime)}
            {duration > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>
                {' / '}{fmtTime(duration)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          X-RAY EXPANDED SIDE PANEL (always rendered when expanded)
          ═══════════════════════════════════════════════════════════════════ */}
      {xrayExpanded && (
        <div className="xray-panel" onClick={e => e.stopPropagation()}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>X-Ray</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="prime-btn" title="Expand" onClick={() => {}}>
                <XRayExpandIcon />
              </button>
              <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.2)' }} />
              <button className="prime-btn" onClick={() => setXrayExpanded(false)}>
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            {['scene', 'cast'].map(tab => (
              <button key={tab}
                onClick={() => setXrayTab(tab)}
                style={{
                  flex: 1, padding: '14px 0', background: 'none', border: 'none',
                  color: xrayTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: 15, fontWeight: xrayTab === tab ? 600 : 400, cursor: 'pointer',
                  borderBottom: xrayTab === tab ? '2px solid #fff' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                }}
              >
                {tab === 'scene' ? 'In Scene' : 'Cast'}
              </button>
            ))}
          </div>

          {/* Cast list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', scrollbarWidth: 'none' }}>
            {xrayCast.map(person => (
              <div key={person.id} style={{ marginBottom: 2 }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', cursor: 'pointer',
                    background: expandedCastId === person.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => setExpandedCastId(expandedCastId === person.id ? null : person.id)}
                >
                  {/* Photo */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {person.profile ? (
                      <img src={person.profile} alt={person.name}
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                    ) : (
                      <div style={{ width: 72, height: 72, background: '#1f2937', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: 700 }}>
                        {person.name.charAt(0)}
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 4, left: 4,
                      background: '#f5c518', color: '#000', fontSize: 8, fontWeight: 800,
                      padding: '1px 3px', borderRadius: 2, letterSpacing: 0.5,
                    }}>IMDb</div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{person.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      Portrays: <span style={{ color: 'rgba(255,255,255,0.75)' }}>{person.character}</span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                    {expandedCastId === person.id ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </div>
                </div>

                {/* Expanded cast detail */}
                {expandedCastId === person.id && (
                  <div style={{
                    padding: '12px 16px 16px 102px',
                    background: 'rgba(255,255,255,0.03)',
                    animation: 'panelIn 0.15s ease-out',
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
                      Known for their roles in various acclaimed productions. View full biography on IMDb.
                    </div>
                    <button style={{
                      marginTop: 10, background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#f5c518', fontSize: 12, fontWeight: 600, padding: '5px 12px',
                      borderRadius: 4, cursor: 'pointer',
                    }}>
                      View on IMDb
                    </button>
                  </div>
                )}
              </div>
            ))}

            {xrayCast.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                Loading cast information...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
