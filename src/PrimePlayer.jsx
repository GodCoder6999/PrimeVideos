import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import shaka from 'shaka-player/dist/shaka-player.ui'; // Import shaka

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimeout = useRef(null);

  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);

  // 1. Unified Fetching
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
          setTimeout(fetchData, 4000);
        }
      } catch (err) {
        if (isMounted) setIsFetching(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // 2. Shaka Headless Setup
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const initPlayer = async () => {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) return;

      const player = new shaka.Player(videoRef.current);
      playerRef.current = player;

      // Handle Errors
      player.addEventListener('error', (e) => console.error('Shaka Error', e.detail));

      try {
        await player.load(streamUrl);
        videoRef.current.play();
      } catch (e) {
        console.error('Load failed', e);
      }
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamUrl]);

  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const formatTime = (secs) => `${Math.floor(secs / 3600)}:${Math.floor((secs % 3600) / 60).toString().padStart(2, '0')}:${Math.floor(secs % 60).toString().padStart(2, '0')}`;

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => setUiVisible(false), 3000);
  };

  if (isFetching) return <div className="w-full h-screen bg-black flex items-center justify-center"><Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" /></div>;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden select-none" onMouseMove={resetTimer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .prime-font { font-family: 'Inter', sans-serif; }
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        .imdb-box { border: 1px solid #B3B3B3; padding: 0px 4px; border-radius: 3px; font-size: 11px; font-weight: 900; line-height: 1.2; color: #B3B3B3; }
        input[type="range"] { -webkit-appearance: none; background: rgba(179, 179, 179, 0.2); height: 2px; outline: none; width: 100%; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
      `}</style>

      {/* HEADLESS SHAKA VIDEO */}
      <video 
        ref={videoRef} 
        className="w-full h-full object-contain" 
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} 
        onLoadedMetadata={(e) => setDuration(e.target.duration)} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* YOUR CUSTOM UI OVERLAY */}
      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 prime-font ${uiVisible || !isPlaying ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button className="hover:text-white transition">X-Ray</button>
            <div className="imdb-box">IMDb</div>
            <button className="flex items-center hover:text-white transition">All <svg className="w-3 h-3 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-normal tracking-wide text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-xs font-normal text-white/70 mt-1">Season {season}, Ep. {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-16 pointer-events-auto">
          <button onClick={() => videoRef.current.currentTime -= 10} className="text-white hover:scale-110 transition relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>
          <button onClick={togglePlay} className="text-white hover:scale-105 transition">
            {isPlaying ? 
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : 
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}
          </button>
          <button onClick={() => videoRef.current.currentTime += 10} className="text-white hover:scale-110 transition relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>
        </div>

        <div className="w-full pointer-events-auto">
          <div className="relative w-full mb-3 flex items-center">
            <input 
              type="range" min="0" max="100" 
              value={(currentTime / (duration || 1)) * 100} 
              onChange={(e) => videoRef.current.currentTime = (e.target.value / 100) * duration} 
              className="z-10" 
            />
            <div className="absolute left-0 h-[2px] bg-[#B3B3B3] pointer-events-none" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
          </div>
          <div className="text-xs font-medium text-white/90">{formatTime(currentTime)} / {formatTime(duration)}</div>
        </div>
      </div>
    </div>
  );
};

export default PrimePlayer;
