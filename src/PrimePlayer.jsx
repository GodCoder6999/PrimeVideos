import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimeout = useRef(null);

  // -- Engine & Data State --
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);

  // -- UI State --
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showXRay, setShowXRay] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  // 1. Existing Data Fetching (Preserved)
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
        ]);
        const sData = await sRes.json();
        const cData = await cRes.json();

        if (!isMounted) return;

        if (sData.success) {
          setStreamUrl(sData.streamUrl);
          setCast(cData.cast?.slice(0, 10) || []);
          setIsFetching(false);
        } else if (sData.isDownloading) {
          setTimeout(fetchData, 3000);
        } else {
          setError(sData.error);
          setIsFetching(false);
        }
      } catch (err) {
        if (isMounted) setIsFetching(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // 2. HLS Engine (Preserved)
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: 0 });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying) video.play().catch(() => {});
      });
    } else {
      video.src = streamUrl;
      if (isPlaying) video.play().catch(() => {});
    }

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  // 3. UI Auto-hide Logic
  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) {
      hideTimeout.current = setTimeout(() => setUiVisible(false), 3000);
    }
  };

  useEffect(() => {
    resetTimer();
    return () => clearTimeout(hideTimeout.current);
  }, [isPlaying]);

  // 4. Handlers
  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const skip = (amount) => {
    videoRef.current.currentTime += amount;
    resetTimer();
  };

  const toggleMute = () => {
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeek = (e) => {
    const percent = e.target.value;
    videoRef.current.currentTime = (percent / 100) * duration;
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isFetching) return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" />
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden select-none"
      onMouseMove={resetTimer}
      onClick={resetTimer}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .prime-font { font-family: 'Inter', sans-serif; }
        .v-gradient {
            background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%);
        }
        .imdb-box {
            border: 1px solid #B3B3B3;
            padding: 0px 4px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 900;
            line-height: 1.2;
            color: #B3B3B3;
        }
        input[type="range"] {
            -webkit-appearance: none;
            background: rgba(179, 179, 179, 0.2);
            height: 2px;
            outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
        }
        .menu-panel {
            background: rgba(25, 33, 43, 0.98);
            border: 1px solid rgba(255,255,255,0.1);
        }
      `}</style>

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* --- OVERLAY CONTROLS --- */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 prime-font ${uiVisible ? 'opacity-100' : 'opacity-0 cursor-none'}`}
      >
        {/* TOP BAR */}
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white transition">X-Ray</button>
            <div className="imdb-box">IMDb</div>
            <button onClick={() => setShowXRay(!showXRay)} className="flex items-center hover:text-white transition">
              All 
              <svg className={`w-3 h-3 ml-2 transition-transform ${showXRay ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
          
          <div className="text-center">
            <h1 className="text-xl font-normal tracking-wide text-white">{title}</h1>
            {mediaType === 'tv' && (
              <p className="text-xs font-normal text-white/70 mt-1">Season {season}, Ep. {episode}</p>
            )}
          </div>

          <div className="flex items-center space-x-6">
            {/* SUBTITLES ICON */}
            <svg onClick={() => { setShowSubMenu(!showSubMenu); setShowQualityMenu(false); }} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/>
            </svg>
            
            {/* SETTINGS ICON */}
            <svg onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSubMenu(false); }} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            
            {/* MUTE ICON */}
            <svg onClick={toggleMute} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              {!isMuted && (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </>
              )}
            </svg>

            {/* FULLSCREEN ICON */}
            <svg onClick={toggleFullScreen} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>

            <span className="text-gray-700 h-6">|</span>
            
            {/* CLOSE ICON */}
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/>
            </svg>
          </div>
        </div>

        {/* CENTER CONTROLS */}
        <div className="flex items-center justify-center space-x-16 pointer-events-none">
          <button onClick={() => skip(-10)} className="text-white hover:scale-110 transition cursor-pointer pointer-events-auto relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/>
            </svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>

          <button onClick={togglePlay} className="text-white hover:scale-105 transition cursor-pointer pointer-events-auto">
            {isPlaying ? (
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
          </button>

          <button onClick={() => skip(10)} className="text-white hover:scale-110 transition cursor-pointer pointer-events-auto relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
            </svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>
        </div>

        {/* BOTTOM PROGRESS BAR */}
        <div className="w-full">
          <div className="relative w-full mb-3 flex items-center">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={(currentTime / (duration || 1)) * 100} 
              onChange={handleSeek}
              className="w-full cursor-pointer z-10"
            />
            <div 
              className="absolute left-0 h-[2px] bg-gradient-to-r from-indigo-500 to-sky-400 pointer-events-none" 
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs font-medium">
            <div className="text-white/90">
              <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
            </div>
            {mediaType === 'tv' && (
              <button className="flex items-center text-white/90 hover:text-white transition group">
                Next Episode
                <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- MENUS --- */}
      {showQualityMenu && (
        <div className="absolute top-20 right-24 w-40 menu-panel p-2 z-50 rounded shadow-xl text-sm">
           <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-2 p-2 tracking-widest">Quality</h3>
           {['Auto', '1080p', '720p', '480p'].map(q => (
              <div key={q} className="px-4 py-2 hover:bg-white/10 cursor-pointer rounded transition" onClick={() => setShowQualityMenu(false)}>{q}</div>
           ))}
        </div>
      )}

      {showSubMenu && (
        <div className="absolute top-20 right-24 w-[400px] menu-panel p-6 z-50 rounded shadow-xl">
            <div className="grid grid-cols-2 gap-8 text-sm">
                <div>
                  <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Subtitles</h3>
                  <ul className="space-y-3">
                    <li className="text-sky-400 font-bold cursor-pointer">Off</li>
                    <li className="hover:text-white cursor-pointer">English</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Audio</h3>
                  <ul className="space-y-3">
                    <li className="hover:text-white cursor-pointer">English</li>
                    <li className="text-sky-400 font-bold cursor-pointer">Original</li>
                  </ul>
                </div>
            </div>
        </div>
      )}

      {/* --- X-RAY SIDEBAR --- */}
      {showXRay && (
        <div className="absolute top-20 left-8 w-72 menu-panel p-5 rounded z-30 transition-all max-h-[70vh] overflow-y-auto scrollbar-hide">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">X-Ray</h2>
            <button onClick={() => setShowXRay(false)} className="opacity-50 hover:opacity-100">
               <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Cast</h3>
          <div className="space-y-4">
            {cast.map(member => (
              <div key={member.id} className="flex items-center gap-4 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                <div className="w-12 h-12 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                  <img src={`https://image.tmdb.org/t/p/w200${member.profile_path}`} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex flex-col border-b border-white/5 pb-2 w-full">
                  <span className="text-sm font-semibold text-white group-hover:text-sky-400">{member.name}</span>
                  <span className="text-xs text-gray-400 tracking-wide line-clamp-1">{member.character}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
