/**
 * PrimePlayer v4 — HLS + REELSTREAM Direct Play + Smart Iframe Fallback
 *
 * Resolution order:
 *  0. Backend /api/get-stream        → HLS.js  (unchanged)
 *  1. REELSTREAM 3-tier resolver     → direct <video> play  ← NEW
 *  2. Embed iframes (vidsrc, etc.)   → existing fallback    (unchanged)
 *
 * Only the INIT effect and a small 'direct' render block are new.
 * Everything else is identical to v3.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { resolveTitle as reelResolve, detectQuality, safeUrl } from './reelstreamResolver';

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const buildEmbeds = (tmdbId, imdbId, mediaType, season, episode) => {
  const tv = mediaType === 'tv';
  const s = season || 1;
  const e = episode || 1;
  const list = [];
  if (imdbId) {
    list.push({ name: 'VidSrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}` });
    list.push({ name: 'VidFast',    url: tv ? `https://vidfast.pro/tv/${imdbId}/${s}/${e}?autoPlay=true`            : `https://vidfast.pro/movie/${imdbId}?autoPlay=true` });
    list.push({ name: 'VidSrc.me',  url: tv ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${imdbId}` });
  }
  list.push({ name: 'Videasy',    url: tv ? `https://player.videasy.net/tv/${tmdbId}/${s}/${e}`           : `https://player.videasy.net/movie/${tmdbId}` });
  list.push({ name: 'AutoEmbed',  url: tv ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${s}-${e}`           : `https://autoembed.cc/movie/tmdb/${tmdbId}` });
  list.push({ name: 'EmbedSu',    url: tv ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`              : `https://embed.su/embed/movie/${tmdbId}` });
  list.push({ name: 'VidSrc.in',  url: tv ? `https://vidsrc.in/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` : `https://vidsrc.in/embed/movie?tmdb=${tmdbId}` });
  list.push({ name: '2Embed',     url: tv ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}`      : `https://www.2embed.cc/embed/${tmdbId}` });
  list.push({ name: 'MoviesAPI',  url: tv ? `https://moviesapi.club/tv/${tmdbId}-${s}-${e}`              : `https://moviesapi.club/movie/${tmdbId}` });
  list.push({ name: 'SuperEmbed', url: tv ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` });
  return list;
};

const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const saveProgress = (type, id, season, episode, watched, duration) => {
  try {
    const key = `${type === 'tv' ? 't' : 'm'}${id}`;
    const all = JSON.parse(localStorage.getItem('vidFastProgress') || '{}');
    all[key] = { id, type, season, episode, progress: { watched, duration }, last_updated: Date.now() };
    localStorage.setItem('vidFastProgress', JSON.stringify(all));
  } catch { /* */ }
};

const loadProgress = (type, id) => {
  try {
    const key = `${type === 'tv' ? 't' : 'm'}${id}`;
    return JSON.parse(localStorage.getItem('vidFastProgress') || '{}')[key]?.progress || null;
  } catch { return null; }
};

const qualityColor = (q) => {
  if (q === '4K')    return '#e8c84a';
  if (q === '1080p') return '#38bdf8';
  if (q === '720p')  return '#4ade80';
  if (q === '480p')  return '#fb923c';
  return '#6b6a72';
};

export default function PrimePlayer({ tmdbId, title, mediaType = 'movie', season = 1, episode = 1 }) {
  const [mode, setMode] = useState('loading'); // 'loading'|'hls'|'direct'|'iframe'
  const [hlsUrl, setHlsUrl] = useState(null);
  const [provider, setProvider] = useState('');
  const [imdbId, setImdbId] = useState(null);
  const [embeds, setEmbeds] = useState([]);
  const [embedIdx, setEmbedIdx] = useState(0);
  const [embedPhase, setEmbedPhase] = useState('loading');

  // NEW: direct play state
  const [directFiles, setDirectFiles] = useState([]);   // [{name,url,quality,source}] highest-first
  const [directIdx, setDirectIdx] = useState(0);
  const [directError, setDirectError] = useState(null);
  const [resolverStatus, setResolverStatus] = useState('');

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

  // ── INIT ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;
    setMode('loading'); setHlsUrl(null); setProvider(''); setImdbId(null);
    setEmbeds([]); setEmbedIdx(0); setEmbedPhase('loading'); setHlsError(null);
    setPlaying(false); setDirectFiles([]); setDirectIdx(0); setDirectError(null); setResolverStatus('');
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    (async () => {
      // Tier 0: backend HLS
      let backendImdbId = null;
      try {
        const res  = await fetch(`${BACKEND}/api/get-stream?${new URLSearchParams({ tmdbId, mediaType, season, episode })}`);
        const data = await res.json();
        backendImdbId = data.imdbId || null;
        if (data.success && data.streamUrl) {
          setHlsUrl(data.proxyUrl || `/api/proxy?url=${encodeURIComponent(data.streamUrl)}`);
          setProvider(data.provider || 'Direct');
          setImdbId(backendImdbId);
          setEmbeds(buildEmbeds(tmdbId, backendImdbId, mediaType, season, episode));
          setMode('hls');
          return;
        }
      } catch (e) { console.warn('[PrimePlayer] Backend:', e.message); }

      // Tier 1: REELSTREAM resolver → direct video files
      try {
        setResolverStatus('Searching index…');
        let resolveTitle_ = title || '';
        let resolveYear   = '';
        try {
          const d = await (await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`)).json();
          if (!resolveTitle_) resolveTitle_ = d.title || d.name || '';
          resolveYear = (d.release_date || d.first_air_date || '').slice(0, 4);
        } catch (_) { /* carry on */ }

        if (resolveTitle_) {
          const files = await reelResolve({ tmdbId, title: resolveTitle_, year: resolveYear, mediaType, season, episode });
          if (files?.length) {
            setDirectFiles([...files].reverse()); // highest quality first
            setDirectIdx(0);
            setResolverStatus('');
            setEmbeds(buildEmbeds(tmdbId, backendImdbId, mediaType, season, episode));
            setMode('direct');
            return;
          }
        }
      } catch (e) { console.warn('[PrimePlayer] Resolver:', e.message); setResolverStatus(''); }

      // Tier 2: iframe embeds
      let iid = backendImdbId;
      if (!iid) {
        try {
          const d = await (await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`)).json();
          iid = d.imdb_id || null;
        } catch (_) { /* */ }
      }
      setImdbId(iid);
      setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
      setMode('iframe');
    })();

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [tmdbId, mediaType, season, episode]);

  // ── HLS setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setHlsError(null);
    const vid = videoRef.current;
    const resumeAt = (loadProgress(mediaType, tmdbId)?.watched || 0) > 10 ? loadProgress(mediaType, tmdbId).watched : 0;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, backBufferLength: 60, maxBufferLength: 60 });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setQualities([{ id: -1, label: 'Auto' }, ...hls.levels.map((l, i) => ({ id: i, label: l.height ? `${l.height}p` : `L${i}` }))]);
        setCurrentQuality(-1);
        if (resumeAt > 0) vid.currentTime = resumeAt;
        vid.play().catch(() => {}); setPlaying(true);
      });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) {
          setHlsError(`Stream error (${d.details}). Switching to embed…`);
          setTimeout(() => { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }, 2500);
        }
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = hlsUrl;
      vid.addEventListener('loadedmetadata', () => { if (resumeAt > 0) vid.currentTime = resumeAt; vid.play().catch(() => {}); setPlaying(true); });
    } else {
      setHlsError('HLS not supported.'); setTimeout(() => setMode('iframe'), 1500);
    }
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ── Direct mode: load src on file/quality change ──────────────────────────
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current || !directFiles.length) return;
    const vid  = videoRef.current;
    const file = directFiles[directIdx];
    if (!file) return;
    const resumeAt = (loadProgress(mediaType, tmdbId)?.watched || 0) > 10 && directIdx === 0
      ? loadProgress(mediaType, tmdbId).watched : 0;
    vid.pause();
    vid.src = safeUrl(file.url);
    vid.load();
    setDirectError(null);
    const onMeta = () => { if (resumeAt > 0) vid.currentTime = resumeAt; vid.play().catch(() => {}); setPlaying(true); };
    vid.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => vid.removeEventListener('loadedmetadata', onMeta);
  }, [mode, directIdx, directFiles]);

  // Direct mode error handler: auto-retry lower quality, then fall back
  useEffect(() => {
    if (mode !== 'direct' || !videoRef.current) return;
    const vid = videoRef.current;
    const onErr = () => {
      const e = vid.error;
      if (!e || e.code === 1) return;
      if (directIdx < directFiles.length - 1) { setDirectIdx(i => i + 1); return; }
      setDirectError(
        e.code === 4 ? 'Codec not supported. Try a different quality or the embed player.' :
        e.code === 2 ? 'Network error — server may be blocking direct streaming.' :
        `Media error (code ${e.code}).`
      );
    };
    vid.addEventListener('error', onErr);
    return () => vid.removeEventListener('error', onErr);
  }, [mode, directIdx, directFiles]);

  // ── Video event listeners (shared HLS + Direct) ───────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || (mode !== 'hls' && mode !== 'direct')) return;
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime  = () => {
      setCurrentTime(vid.currentTime);
      if (Math.floor(vid.currentTime) % 5 === 0) saveProgress(mediaType, tmdbId, season, episode, vid.currentTime, vid.duration);
    };
    const onDur  = () => setDuration(vid.duration);
    const onProg = () => { if (vid.buffered.length) setBuffered(vid.buffered.end(vid.buffered.length - 1)); };
    const onFs   = () => setIsFullscreen(!!document.fullscreenElement);
    vid.addEventListener('play', onPlay); vid.addEventListener('pause', onPause);
    vid.addEventListener('timeupdate', onTime); vid.addEventListener('durationchange', onDur);
    vid.addEventListener('progress', onProg); document.addEventListener('fullscreenchange', onFs);
    return () => {
      vid.removeEventListener('play', onPlay); vid.removeEventListener('pause', onPause);
      vid.removeEventListener('timeupdate', onTime); vid.removeEventListener('durationchange', onDur);
      vid.removeEventListener('progress', onProg); document.removeEventListener('fullscreenchange', onFs);
    };
  }, [mode, tmdbId, mediaType, season, episode]);

  // ── Iframe timeout ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'iframe' || embedPhase !== 'loading') return;
    clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      if (embedIdx < embeds.length - 1) setEmbedIdx(i => i + 1); else setEmbedPhase('failed');
    }, 15000);
    return () => clearTimeout(iframeTimerRef.current);
  }, [mode, embedPhase, embedIdx, embeds.length]);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (playing) controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [playing]);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play(); };
  const handleSeek = (e) => {
    const v = videoRef.current; if (!v || !duration) return;
    const r = progressRef.current.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
  };
  const handleVolume = (e) => { const val = Number(e.target.value); setVolume(val); setMuted(val === 0); if (videoRef.current) videoRef.current.volume = val; };
  const toggleMute   = () => { const v = videoRef.current; if (!v) return; v.muted = !muted; setMuted(!muted); };
  const toggleFs     = () => { if (!isFullscreen) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); };
  const setQuality   = (id) => { if (!hlsRef.current) return; hlsRef.current.currentLevel = id; setCurrentQuality(id); setShowQuality(false); };
  const skip         = (s) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(duration || Infinity, v.currentTime + s)); };
  const switchSource = (i) => { clearTimeout(iframeTimerRef.current); setEmbedIdx(i); setEmbedPhase('loading'); setShowSources(false); };

  useEffect(() => {
    const onKey = (e) => {
      if (mode !== 'hls' && mode !== 'direct') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft':  skip(-10); break;
        case 'ArrowRight': skip(10);  break;
        case 'ArrowUp':   e.preventDefault(); { const v = Math.min(1, volume+0.1); setVolume(v); if (videoRef.current) videoRef.current.volume=v; break; }
        case 'ArrowDown': e.preventDefault(); { const v = Math.max(0, volume-0.1); setVolume(v); if (videoRef.current) videoRef.current.volume=v; break; }
        case 'f': toggleFs(); break;
        case 'm': toggleMute(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, playing, volume, muted, isFullscreen]);

  const pp  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bp  = duration > 0 ? (buffered   / duration) * 100 : 0;
  const cur = directFiles[directIdx];
  const cembed = embeds[embedIdx];

  // Shared controls bar used by both HLS and Direct modes
  const renderControls = (label, accent, badges = null) => (
    <div className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none"
      style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s ease' }}
      onClick={(e) => e.stopPropagation()}>
      {/* Top */}
      <div className="pointer-events-auto px-6 pt-4 pb-8" style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border"
            style={{ color: accent, background: `${accent}1a`, borderColor: `${accent}4d` }}>▶ {label}</span>
          {badges}
          {title && <span className="text-white text-sm font-semibold opacity-70 truncate max-w-xs hidden md:block">{title}</span>}
          {mediaType === 'tv' && <span className="text-gray-400 text-xs font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded">S{season}·E{episode}</span>}
        </div>
      </div>
      {/* Centre */}
      <div className="flex items-center justify-center pointer-events-auto flex-1" onClick={togglePlay}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background:'rgba(0,0,0,.4)', backdropFilter:'blur(4px)', border:'2px solid rgba(255,255,255,.2)', opacity: showControls ? 1 : 0 }}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </div>
      </div>
      {/* Bottom */}
      <div className="pointer-events-auto px-4 pb-4 pt-8" style={{ background:'linear-gradient(to top,rgba(0,0,0,.9),transparent)' }}>
        <div ref={progressRef} className="relative h-1.5 rounded-full mb-4 cursor-pointer group"
          style={{ background:'rgba(255,255,255,.2)' }} onClick={handleSeek}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width:`${bp}%`, background:'rgba(255,255,255,.3)' }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width:`${pp}%`, background: accent }} />
          <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left:`${pp}%`, transform:'translate(-50%,-50%)', background: accent, boxShadow:`0 0 6px ${accent}` }} />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={togglePlay} className="text-white hover:text-[#00A8E1] transition-colors">{playing ? <PauseIcon size={24}/> : <PlayIcon size={24}/>}</button>
          <button onClick={() => skip(-10)} className="text-white/70 hover:text-white text-xs font-bold">⏪ 10</button>
          <button onClick={() => skip(10)}  className="text-white/70 hover:text-white text-xs font-bold">10 ⏩</button>
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-white/70 hover:text-white">{muted||volume===0?'🔇':volume<.5?'🔉':'🔊'}</button>
            <input type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={handleVolume}
              className="w-20 h-1 accent-[#00A8E1] cursor-pointer" onClick={(e)=>e.stopPropagation()} />
          </div>
          <span className="text-white/70 text-xs font-mono">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
          <div className="flex-1" />

          {/* Direct quality picker */}
          {mode==='direct' && directFiles.length>1 && (
            <div className="relative">
              <button onClick={(e)=>{e.stopPropagation();setShowQuality(v=>!v);}}
                className="text-xs font-bold px-2 py-1 rounded border transition-colors"
                style={{ color:qualityColor(cur?.quality), borderColor:`${qualityColor(cur?.quality)}66` }}>
                {cur?.quality||'SD'}
              </button>
              {showQuality && (
                <div className="absolute bottom-full right-0 mb-2 w-28 rounded-xl overflow-hidden shadow-2xl"
                  style={{ background:'rgba(8,15,26,.97)', border:'1px solid rgba(255,255,255,.1)' }}
                  onClick={(e)=>e.stopPropagation()}>
                  {directFiles.map((f,i)=>(
                    <button key={i} onClick={()=>{setDirectIdx(i);setShowQuality(false);}}
               
