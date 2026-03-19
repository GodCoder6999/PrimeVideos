/**
 * PrimePlayer — Hybrid video player
 *
 * Priority chain:
 *  1. Ask backend for a direct m3u8 URL → play with HLS.js (best quality, no ads)
 *  2. Fall back to iframe embeds from 10+ sources with auto-switching
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// ── CHANGE THIS to your deployed backend URL (Render / Railway / local) ──────
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// Embed source list — ordered by reliability
// ─────────────────────────────────────────────────────────────────────────────
const buildEmbeds = (tmdbId, imdbId, mediaType, season, episode) => {
  const tv = mediaType === 'tv';
  const s = season || 1;
  const e = episode || 1;
  const list = [];

  if (imdbId) {
    list.push({ name: 'VidSrc', url: tv ? `https://vidsrc.to/embed/tv/${imdbId}/${s}/${e}` : `https://vidsrc.to/embed/movie/${imdbId}` });
    list.push({ name: 'VidSrc.me', url: tv ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?imdb=${imdbId}` });
    list.push({ name: 'VidFast', url: tv ? `https://vidfast.pro/tv/${imdbId}/${s}/${e}?autoPlay=true` : `https://vidfast.pro/movie/${imdbId}?autoPlay=true` });
  }

  list.push({ name: 'AutoEmbed', url: tv ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${s}-${e}` : `https://autoembed.cc/movie/tmdb/${tmdbId}` });
  list.push({ name: 'vid.icu', url: tv ? `https://vid.icu/embed/tv/${tmdbId}/${s}/${e}` : `https://vid.icu/embed/movie/${tmdbId}` });
  list.push({ name: 'EmbedSu', url: tv ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` : `https://embed.su/embed/movie/${tmdbId}` });
  list.push({ name: 'Videasy', url: tv ? `https://player.videasy.net/tv/${tmdbId}/${s}/${e}` : `https://player.videasy.net/movie/${tmdbId}` });
  list.push({ name: 'VidSrc.xyz', url: tv ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}` });
  list.push({ name: 'MoviesAPI', url: tv ? `https://moviesapi.club/tv/${tmdbId}-${s}-${e}` : `https://moviesapi.club/movie/${tmdbId}` });
  list.push({ name: '2Embed', url: tv ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${tmdbId}` });
  list.push({ name: 'VidSrc.rip', url: tv ? `https://vidsrc.rip/embed/tv/${tmdbId}/${s}/${e}` : `https://vidsrc.rip/embed/movie/${tmdbId}` });
  list.push({ name: 'SuperEmbed', url: tv ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` });

  return list;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title, mediaType = 'movie', season = 1, episode = 1 }) {
  const videoRef  = useRef(null);
  const hlsRef    = useRef(null);
  const iframeRef = useRef(null);
  const timerRef  = useRef(null);

  // mode: 'hls' | 'iframe'
  const [mode,        setMode]        = useState('hls');
  const [hlsUrl,      setHlsUrl]      = useState(null);
  const [imdbId,      setImdbId]      = useState(null);
  const [embeds,      setEmbeds]      = useState([]);
  const [embedIdx,    setEmbedIdx]    = useState(0);
  const [phase,       setPhase]       = useState('init'); // init | loading | playing | switching | failed
  const [provider,    setProvider]    = useState('');
  const [showPicker,  setShowPicker]  = useState(false);
  const [goodSrcs,    setGoodSrcs]    = useState([]);
  const [countdown,   setCountdown]   = useState(0);
  const [hlsError,    setHlsError]    = useState(null);

  // ── INIT on mount / param change ──────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    setPhase('init');
    setMode('hls');
    setHlsUrl(null);
    setImdbId(null);
    setEmbeds([]);
    setEmbedIdx(0);
    setProvider('');
    setGoodSrcs([]);
    setHlsError(null);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    (async () => {
      setPhase('loading');

      // 1. Ask backend for direct m3u8
      try {
        const params = new URLSearchParams({ tmdbId, mediaType, season, episode });
        const res = await fetch(`${BACKEND}/api/get-stream?${params}`);
        const data = await res.json();

        if (data.success && data.streamUrl) {
          setHlsUrl(data.streamUrl);
          setProvider(data.provider || 'Direct');
          setImdbId(data.imdbId || null);
          setMode('hls');
          // Build embeds for fallback just in case
          const built = buildEmbeds(tmdbId, data.imdbId, mediaType, season, episode);
          setEmbeds(built);
          return;
        }

        // Backend returned embed URLs — use them
        setImdbId(data.imdbId || null);
        const built = buildEmbeds(tmdbId, data.imdbId, mediaType, season, episode);

        // If backend sent specific embeds, prepend them
        if (data.embeds) {
          const extra = Object.entries(data.embeds)
            .filter(([, url]) => url)
            .map(([name, url]) => ({ name, url }));
          setEmbeds([...extra, ...built]);
        } else {
          setEmbeds(built);
        }

        setMode('iframe');
        setPhase('loading');
      } catch (backendErr) {
        console.warn('[PrimePlayer] Backend unreachable, going straight to embeds:', backendErr.message);

        // Backend is down — resolve IMDB from TMDB directly and use embeds
        let iid = null;
        try {
          const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
          const d = await r.json();
          iid = d.imdb_id || null;
        } catch { /* */ }

        setImdbId(iid);
        setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
        setMode('iframe');
        setPhase('loading');
      }
    })();
  }, [tmdbId, mediaType, season, episode]);

  // ── HLS init whenever hlsUrl changes ─────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hls' || !hlsUrl || !videoRef.current) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setHlsError(null);

    const proxied = `${BACKEND}/api/proxy?url=${encodeURIComponent(hlsUrl)}`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(proxied);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPhase('playing');
        videoRef.current?.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS] Fatal error:', data);
          setHlsError('HLS stream failed. Switching to embed fallback…');
          setTimeout(() => fallbackToIframe(), 2000);
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = proxied;
      videoRef.current.addEventListener('loadedmetadata', () => {
        setPhase('playing');
        videoRef.current?.play().catch(() => {});
      });
    } else {
      setHlsError('HLS not supported in this browser. Switching to embed…');
      setTimeout(() => fallbackToIframe(), 1500);
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [hlsUrl, mode]);

  // ── Fallback: switch to iframe mode ──────────────────────────────────────
  const fallbackToIframe = useCallback(() => {
    setMode('iframe');
    setEmbedIdx(0);
    setPhase('loading');
  }, []);

  // ── Iframe auto-timeout (12s) ─────────────────────────────────────────────
  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => tryNextEmbed(), 12000);
  }, [embedIdx, embeds.length]);

  useEffect(() => {
    if (mode === 'iframe' && phase === 'loading') startTimer();
    return clearTimer;
  }, [mode, phase, embedIdx]);

  const tryNextEmbed = useCallback(() => {
    clearTimer();
    if (embedIdx < embeds.length - 1) {
      setPhase('switching');
      setCountdown(3);
      const iv = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(iv); setEmbedIdx(i => i + 1); setPhase('loading'); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      setPhase('failed');
    }
  }, [embedIdx, embeds.length]);

  const handleEmbedLoad = () => {
    clearTimer();
    setPhase('playing');
    if (!goodSrcs.includes(embedIdx)) setGoodSrcs(g => [...g, embedIdx]);
  };

  const pickEmbed = (i) => {
    clearTimer();
    setEmbedIdx(i);
    setPhase('loading');
    setShowPicker(false);
  };

  const currentEmbed = embeds[embedIdx];
  const showOverlay  = phase === 'init' || phase === 'loading' || phase === 'switching' || phase === 'failed' || hlsError;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full bg-black" style={{ minHeight: '100vh' }}>

      {/* ── TOP CHROME ── */}
      <div
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.9), transparent)' }}
      >
        <div className="flex items-center gap-3 pointer-events-auto select-none">
          {/* Mode badge */}
          <span className={`text-[9px] font-black uppercase tracking-[.2em] px-2 py-1 rounded-md border backdrop-blur-sm
            ${mode === 'hls' ? 'text-green-400 bg-green-400/10 border-green-400/30' : 'text-[#00A8E1] bg-[#00A8E1]/10 border-[#00A8E1]/30'}`}>
            {mode === 'hls' ? '▶ Direct' : '▶ Embed'}
          </span>
          {provider && (
            <span className="text-[10px] font-bold text-white/60 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
              {provider}
            </span>
          )}
          {title && (
            <span className="text-white text-sm font-semibold opacity-70 truncate max-w-[220px] hidden md:block">
              {title}
            </span>
          )}
          {mediaType === 'tv' && (
            <span className="text-gray-400 text-xs font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded">
              S{season}·E{episode}
            </span>
          )}
        </div>

        {/* Source picker — only in iframe mode */}
        {mode === 'iframe' && (
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-2 text-white text-[11px] font-bold bg-white/10 hover:bg-white/20 border border-white/15 hover:border-[#00A8E1]/60 px-3 py-2 rounded-xl backdrop-blur-sm transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {embedIdx + 1}/{embeds.length}
            </button>

            {showPicker && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden shadow-2xl z-[999]"
                style={{ background: 'rgba(8,15,26,.97)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(24px)' }}
              >
                <div className="px-4 py-2.5 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/8">
                  Video Sources
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {embeds.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => pickEmbed(i)}
                      className={`w-full text-left px-4 py-3 text-[13px] font-semibold transition-all flex items-center gap-3 border-b border-white/5 last:border-0
                        ${i === embedIdx ? 'text-[#00A8E1] bg-[#00A8E1]/10' : 'text-gray-300 hover:bg-white/8 hover:text-white'}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0
                        ${goodSrcs.includes(i) ? 'bg-green-400 shadow-[0_0_5px_#4ade80]'
                          : i === embedIdx ? 'bg-[#00A8E1] animate-pulse'
                          : 'bg-gray-700'}`}
                      />
                      {src.name}
                      {i === embedIdx && <span className="ml-auto text-[8px] font-black bg-[#00A8E1] text-white px-1.5 py-0.5 rounded">NOW</span>}
                      {goodSrcs.includes(i) && i !== embedIdx && <span className="ml-auto text-[9px] text-green-400 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── OVERLAY ── */}
      {showOverlay && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#060d18]">

          {(phase === 'init' || phase === 'loading') && !hlsError && (
            <>
              <Spinner />
              <p className="text-white font-bold text-base mt-5 mb-1">
                {mode === 'hls' ? 'Extracting stream…' : 'Loading player…'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {mode === 'hls' ? (provider || 'Contacting server…') : (currentEmbed?.name || '…')}
              </p>
            </>
          )}

          {phase === 'switching' && !hlsError && (
            <>
              <div className="w-16 h-16 rounded-full border-4 border-amber-400/30 flex items-center justify-center mb-4">
                <span className="text-amber-400 font-black text-2xl">{countdown}</span>
              </div>
              <p className="text-white font-bold text-base mb-1">Switching source…</p>
              <p className="text-gray-400 text-xs">Trying {embeds[embedIdx + 1]?.name || 'next'}</p>
            </>
          )}

          {hlsError && (
            <>
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-4">
                <svg width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-white font-bold text-base mb-2">Stream issue</p>
              <p className="text-gray-400 text-xs text-center max-w-xs">{hlsError}</p>
            </>
          )}

          {phase === 'failed' && !hlsError && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5">
                <svg width="28" height="28" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">All sources failed</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-xs text-center">
                This title may not be indexed yet, or all providers are blocked in your region.
              </p>
              <button
                onClick={() => { setEmbedIdx(0); setGoodSrcs([]); setPhase('loading'); }}
                className="px-6 py-2.5 bg-[#00A8E1] hover:bg-[#0097cc] text-white font-bold text-sm rounded-xl transition mb-3"
              >
                Retry All Sources
              </button>
            </>
          )}
        </div>
      )}

      {/* ── HLS VIDEO ELEMENT ── */}
      {mode === 'hls' && (
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          style={{ minHeight: '100vh', opacity: phase === 'playing' ? 1 : 0, transition: 'opacity .5s ease' }}
        />
      )}

      {/* ── IFRAME EMBED ── */}
      {mode === 'iframe' && currentEmbed && phase !== 'failed' && (
        <iframe
          ref={iframeRef}
          key={`emb-${embedIdx}-${tmdbId}-${season}-${episode}`}
          src={currentEmbed.url}
          className="w-full border-0"
          style={{ minHeight: '100vh', display: 'block', opacity: phase === 'playing' ? 1 : 0, transition: 'opacity .4s ease' }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
          onLoad={handleEmbedLoad}
          title={title || 'Player'}
        />
      )}

      {/* ── BOTTOM: Try next button ── */}
      {phase === 'playing' && mode === 'iframe' && embedIdx < embeds.length - 1 && (
        <div className="absolute bottom-5 right-5 z-50">
          <button
            onClick={tryNextEmbed}
            className="flex items-center gap-2 text-[11px] font-bold text-white/60 hover:text-white bg-black/50 hover:bg-black/70 border border-white/10 hover:border-white/30 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all group"
          >
            Not playing?
            <span className="text-[#00A8E1] group-hover:translate-x-0.5 transition-transform">Try next →</span>
          </button>
        </div>
      )}

      {/* Click-away for picker */}
      {showPicker && <div className="fixed inset-0 z-[998]" onClick={() => setShowPicker(false)} />}
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative w-14 h-14">
      <div className="absolute inset-0 rounded-full border-[3px] border-white/5" />
      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#00A8E1] animate-spin" />
      <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-white/20 animate-spin"
        style={{ animationDuration: '1.4s', animationDirection: 'reverse' }} />
    </div>
  );
}
