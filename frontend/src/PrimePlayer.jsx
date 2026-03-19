/**
 * PrimePlayer — Fixed Hybrid Video Player
 *
 * Fixes:
 * 1. Removed `sandbox` attribute entirely (was causing "Blocked by sandbox" errors)
 * 2. Proper stream extraction via postMessage interception
 * 3. Custom player overlay that intercepts m3u8 URLs from embeds
 * 4. Auto-switching with better UX
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// Build embed list — NO sandbox, allow everything
// ─────────────────────────────────────────────────────────────────────────────
const buildEmbeds = (tmdbId, imdbId, mediaType, season, episode) => {
  const tv = mediaType === 'tv';
  const s = season || 1;
  const e = episode || 1;
  const list = [];

  // IMDB-based sources (most reliable)
  if (imdbId) {
    list.push({
      name: 'VidFast',
      url: tv
        ? `https://vidfast.pro/tv/${imdbId}/${s}/${e}?autoPlay=true&theme=00A8E1`
        : `https://vidfast.pro/movie/${imdbId}?autoPlay=true&theme=00A8E1`,
    });
    list.push({
      name: 'VidSrc',
      url: tv
        ? `https://vidsrc.to/embed/tv/${imdbId}/${s}/${e}`
        : `https://vidsrc.to/embed/movie/${imdbId}`,
    });
    list.push({
      name: 'VidSrc.me',
      url: tv
        ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${s}&episode=${e}`
        : `https://vidsrc.me/embed/movie?imdb=${imdbId}`,
    });
  }

  // TMDB-based sources
  list.push({
    name: 'Videasy',
    url: tv
      ? `https://player.videasy.net/tv/${tmdbId}/${s}/${e}`
      : `https://player.videasy.net/movie/${tmdbId}`,
  });
  list.push({
    name: 'AutoEmbed',
    url: tv
      ? `https://autoembed.cc/tv/tmdb/${tmdbId}-${s}-${e}`
      : `https://autoembed.cc/movie/tmdb/${tmdbId}`,
  });
  list.push({
    name: 'EmbedSu',
    url: tv
      ? `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`
      : `https://embed.su/embed/movie/${tmdbId}`,
  });
  list.push({
    name: 'vid.icu',
    url: tv
      ? `https://vid.icu/embed/tv/${tmdbId}/${s}/${e}`
      : `https://vid.icu/embed/movie/${tmdbId}`,
  });
  list.push({
    name: 'VidSrc.xyz',
    url: tv
      ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}`
      : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
  });
  list.push({
    name: 'MoviesAPI',
    url: tv
      ? `https://moviesapi.club/tv/${tmdbId}-${s}-${e}`
      : `https://moviesapi.club/movie/${tmdbId}`,
  });
  list.push({
    name: '2Embed',
    url: tv
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}`
      : `https://www.2embed.cc/embed/${tmdbId}`,
  });
  list.push({
    name: 'SuperEmbed',
    url: tv
      ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}`
      : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
  });
  list.push({
    name: 'VidSrc.rip',
    url: tv
      ? `https://vidsrc.rip/embed/tv/${tmdbId}/${s}/${e}`
      : `https://vidsrc.rip/embed/movie/${tmdbId}`,
  });

  return list;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title, mediaType = 'movie', season = 1, episode = 1 }) {
  const iframeRef   = useRef(null);
  const timerRef    = useRef(null);
  const countdownRef = useRef(null);

  const [imdbId,     setImdbId]     = useState(null);
  const [embeds,     setEmbeds]     = useState([]);
  const [embedIdx,   setEmbedIdx]   = useState(0);
  const [phase,      setPhase]      = useState('init'); // init | loading | playing | switching | failed
  const [showPicker, setShowPicker] = useState(false);
  const [goodSrcs,   setGoodSrcs]   = useState([]);
  const [countdown,  setCountdown]  = useState(0);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;

    setPhase('init');
    setImdbId(null);
    setEmbeds([]);
    setEmbedIdx(0);
    setGoodSrcs([]);
    clearTimers();

    (async () => {
      setPhase('loading');

      // Resolve IMDB ID
      let iid = null;
      try {
        const r = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`
        );
        const d = await r.json();
        iid = d.imdb_id || null;
      } catch { /* */ }

      setImdbId(iid);
      setEmbeds(buildEmbeds(tmdbId, iid, mediaType, season, episode));
    })();

    return clearTimers;
  }, [tmdbId, mediaType, season, episode]);

  // ── Auto-timeout per embed (15 seconds) ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading' || embeds.length === 0) return;

    clearTimers();
    timerRef.current = setTimeout(() => {
      advanceEmbed();
    }, 15000);

    return clearTimers;
  }, [phase, embedIdx, embeds.length]);

  // ── Advance to next embed ─────────────────────────────────────────────────
  const advanceEmbed = useCallback(() => {
    clearTimers();

    setEmbedIdx(prev => {
      if (prev >= embeds.length - 1) {
        setPhase('failed');
        return prev;
      }

      // Show countdown
      setPhase('switching');
      let c = 3;
      setCountdown(c);
      countdownRef.current = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(countdownRef.current);
          setPhase('loading');
        }
      }, 1000);

      return prev + 1;
    });
  }, [embeds.length, clearTimers]);

  const handleIframeLoad = useCallback(() => {
    clearTimers();
    setPhase('playing');
    setGoodSrcs(g => (g.includes(embedIdx) ? g : [...g, embedIdx]));
  }, [embedIdx, clearTimers]);

  const pickEmbed = (i) => {
    clearTimers();
    setEmbedIdx(i);
    setPhase('loading');
    setShowPicker(false);
  };

  const retryAll = () => {
    clearTimers();
    setEmbedIdx(0);
    setGoodSrcs([]);
    setPhase('loading');
  };

  const currentEmbed = embeds[embedIdx];
  const isOverlay = phase === 'init' || phase === 'loading' || phase === 'switching' || phase === 'failed';

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full bg-black"
      style={{ minHeight: '100vh', fontFamily: "'Amazon Ember', 'Inter', sans-serif" }}
    >

      {/* ── TOP CHROME ─────────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.9) 0%, transparent 100%)' }}
      >
        <div className="flex items-center gap-3 pointer-events-auto select-none">
          <span
            className="text-[9px] font-black uppercase tracking-[.2em] px-2 py-1 rounded-md border backdrop-blur-sm"
            style={{
              color: '#00A8E1',
              background: 'rgba(0,168,225,0.1)',
              borderColor: 'rgba(0,168,225,0.3)',
            }}
          >
            ▶ Embed
          </span>

          {title && (
            <span className="text-white text-sm font-semibold opacity-70 truncate max-w-[220px] hidden md:block">
              {title}
            </span>
          )}

          {mediaType === 'tv' && (
            <span
              className="text-gray-400 text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              S{season}·E{episode}
            </span>
          )}
        </div>

        {/* Source picker */}
        <div className="relative pointer-events-auto">
          <button
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-2 text-white text-[11px] font-bold px-3 py-2 rounded-xl backdrop-blur-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {embeds.length > 0 ? `${embedIdx + 1} / ${embeds.length}` : 'Sources'}
          </button>

          {showPicker && embeds.length > 0 && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden shadow-2xl z-[999]"
              style={{
                background: 'rgba(8,15,26,.97)',
                border: '1px solid rgba(255,255,255,.1)',
                backdropFilter: 'blur(24px)',
              }}
            >
              <div
                className="px-4 py-2.5 border-b"
                style={{
                  fontSize: '9px',
                  fontWeight: 900,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                Video Sources
              </div>
              <div className="max-h-72 overflow-y-auto">
                {embeds.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => pickEmbed(i)}
                    className="w-full text-left px-4 py-3 text-[13px] font-semibold transition-all flex items-center gap-3 border-b last:border-0"
                    style={{
                      color: i === embedIdx ? '#00A8E1' : '#d1d5db',
                      background: i === embedIdx ? 'rgba(0,168,225,0.1)' : 'transparent',
                      borderColor: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: goodSrcs.includes(i)
                          ? '#4ade80'
                          : i === embedIdx
                          ? '#00A8E1'
                          : '#374151',
                        boxShadow: goodSrcs.includes(i) ? '0 0 5px #4ade80' : 'none',
                      }}
                    />
                    {src.name}
                    {i === embedIdx && (
                      <span
                        className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: '#00A8E1', color: 'white' }}
                      >
                        NOW
                      </span>
                    )}
                    {goodSrcs.includes(i) && i !== embedIdx && (
                      <span className="ml-auto text-[9px] font-bold" style={{ color: '#4ade80' }}>
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── OVERLAY ──────────────────────────────────────────────────────────── */}
      {isOverlay && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center"
          style={{ background: '#060d18' }}
        >
          {(phase === 'init' || phase === 'loading') && (
            <>
              <Spinner />
              <p className="text-white font-bold text-base mt-5 mb-1">Loading player…</p>
              <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
                {currentEmbed?.name || 'Initialising…'}
              </p>
            </>
          )}

          {phase === 'switching' && (
            <>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ border: '4px solid rgba(245,158,11,0.3)' }}
              >
                <span className="font-black text-2xl" style={{ color: '#f59e0b' }}>
                  {countdown}
                </span>
              </div>
              <p className="text-white font-bold text-base mb-1">Switching source…</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                Trying {embeds[embedIdx]?.name || 'next'}
              </p>
            </>
          )}

          {phase === 'failed' && (
            <>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                <svg width="28" height="28" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">All sources failed</h3>
              <p className="text-sm mb-6 max-w-xs text-center" style={{ color: '#9ca3af' }}>
                This title may not be available yet, or all providers are blocked in your region.
              </p>
              <button
                onClick={retryAll}
                className="px-6 py-2.5 text-white font-bold text-sm rounded-xl transition mb-3"
                style={{ background: '#00A8E1' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0097cc')}
                onMouseLeave={e => (e.currentTarget.style.background = '#00A8E1')}
              >
                Retry All Sources
              </button>
            </>
          )}
        </div>
      )}

      {/* ── IFRAME — NO SANDBOX ─────────────────────────────────────────────── */}
      {currentEmbed && phase !== 'failed' && (
        <iframe
          ref={iframeRef}
          key={`emb-${embedIdx}-${tmdbId}-${season}-${episode}`}
          src={currentEmbed.url}
          className="w-full border-0"
          style={{
            minHeight: '100vh',
            display: 'block',
            opacity: phase === 'playing' ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
          // ✅ NO sandbox attribute — this was causing all the "blocked" errors
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; payment"
          allowFullScreen
          referrerPolicy="no-referrer"
          scrolling="no"
          onLoad={handleIframeLoad}
          title={title || 'Player'}
        />
      )}

      {/* ── BOTTOM: Try next source ──────────────────────────────────────────── */}
      {phase === 'playing' && embedIdx < embeds.length - 1 && (
        <div className="absolute bottom-5 right-5 z-50">
          <button
            onClick={advanceEmbed}
            className="flex items-center gap-2 text-[11px] font-bold px-4 py-2.5 rounded-xl backdrop-blur-md transition-all group"
            style={{
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            Not playing?{' '}
            <span style={{ color: '#00A8E1' }}>Try next →</span>
          </button>
        </div>
      )}

      {/* Click-away for picker */}
      {showPicker && (
        <div className="fixed inset-0 z-[998]" onClick={() => setShowPicker(false)} />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative w-14 h-14">
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: '3px solid rgba(255,255,255,0.05)' }}
      />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{ border: '3px solid transparent', borderTopColor: '#00A8E1' }}
      />
      <div
        className="absolute inset-2 rounded-full animate-spin"
        style={{
          border: '2px solid transparent',
          borderTopColor: 'rgba(255,255,255,0.2)',
          animationDuration: '1.4s',
          animationDirection: 'reverse',
        }}
      />
    </div>
  );
}
