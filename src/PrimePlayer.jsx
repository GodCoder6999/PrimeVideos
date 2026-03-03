import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  MessageSquare, Settings, RotateCcw, RotateCw, Loader2, 
  List, ChevronUp, ChevronDown, Monitor
} from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; // Replace with your key

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  
  // --- State Management ---
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const [xrayOpen, setXrayOpen] = useState(true);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // --- 1. Fetch High-Speed Stream & TMDB Cast ---
  useEffect(() => {
    const fetchAllData = async () => {
      setIsFetching(true);
      try {
        // Fetch Stream
        const streamRes = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
        const streamData = await streamRes.json();
        
        // Fetch Cast from TMDB
        const castRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`);
        const castData = await castRes.json();

        if (streamData.success) {
          setStreamUrl(streamData.streamUrl);
          setCast(castData.cast?.slice(0, 6) || []); // Get top 6 actors
          setIsFetching(false);
        } else if (streamData.isDownloading) {
          setTimeout(fetchAllData, 4000); // Silent retry
        }
      } catch (err) {
        console.error("Fetch error", err);
      }
    };
    fetchAllData();
  }, [tmdbId, mediaType, season, episode]);

  // --- 2. HLS Engine (Optimized for Fast Buffer) ---
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90 // Keep 90s in memory for instant rewinding
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
      video.src = streamUrl;
    }

    const syncTime = () => setCurrentTime(video.currentTime);
    const syncDuration = () => setDuration(video.duration);
    
    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('loadedmetadata', syncDuration);
    return () => {
      video.removeEventListener('timeupdate', syncTime);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [streamUrl]);

  // --- 3. Interaction Handlers ---
  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const skip = (amt) => videoRef.current.currentTime += amt;
  const toggleFullScreen = () => document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
  
  const changeQuality = (level) => {
    setCurrentQuality(level);
    setShowQualityMenu(false);
    // Note: Actual HLS level switching logic here if your API provides multi-bitrate m3u8
    if (hlsRef.current) {
        // 0 = low, 1 = mid, etc. Example:
        // hlsRef.current.currentLevel = level === 'Auto' ? -1 : 1;
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black text-white font-sans overflow-hidden select-none"
      onMouseMove={() => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => isPlaying && setShowControls(false), 3000);
      }}
    >
      <video ref={videoRef} className="w-full h-full" onClick={togglePlay} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

      {/* Silent Loading Spinner */}
      {isFetching && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <Loader2 className="w-12 h-12 animate-spin text-[#00A8E1]" />
        </div>
      )}

      {/* UI OVERLAY */}
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-500 bg-gradient-to-t from-black/80 via-transparent to-black/80 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Bar */}
        <div className="p-6 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <ArrowLeft className="cursor-pointer hover:scale-110 transition" onClick={() => navigate(-1)} size={32} />
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-gray-400">S{season} E{episode}</p>
            </div>
          </div>
          <div className="flex gap-6 relative">
            <Monitor className="cursor-pointer hover:text-[#00A8E1]" />
            <div className="relative">
                <Settings 
                    className={`cursor-pointer transition ${showQualityMenu ? 'text-[#00A8E1] rotate-45' : ''}`} 
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                />
                {showQualityMenu && (
                    <div className="absolute top-10 right-0 bg-[#19222d] border border-gray-700 rounded-md w-40 overflow-hidden shadow-xl z-50">
                        {['Auto', '1080p', '720p', 'Data Saver'].map(q => (
                            <div 
                                key={q}
                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-[#252e39] ${currentQuality === q ? 'text-[#00A8E1] font-bold' : ''}`}
                                onClick={() => changeQuality(q)}
                            >
                                {q}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <Maximize className="cursor-pointer hover:text-[#00A8E1]" onClick={toggleFullScreen} />
          </div>
        </div>

        {/* X-RAY PANEL (Left Side) */}
        <div className={`absolute left-0 top-1/4 bottom-1/4 w-72 p-6 transition-transform duration-300 ${xrayOpen ? 'translate-x-0' : '-translate-x-64'}`}>
            <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setXrayOpen(!xrayOpen)}>
                <span className="text-lg font-bold">X-Ray</span>
                {xrayOpen ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
            </div>
            {xrayOpen && (
                <div className="space-y-4 overflow-y-auto max-h-full pr-2">
                    {cast.map(actor => (
                        <div key={actor.id} className="flex items-center gap-3 group cursor-pointer">
                            <img 
                                src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} 
                                className="w-12 h-16 object-cover rounded border border-gray-700 group-hover:border-[#00A8E1]" 
                                alt={actor.name}
                            />
                            <div>
                                <p className="text-sm font-bold leading-tight">{actor.name}</p>
                                <p className="text-xs text-gray-400">{actor.character}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Center Controls */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
          <button onClick={() => skip(-10)} className="p-4 border-2 border-white/20 rounded-full hover:bg-white/10 transition relative">
            <RotateCcw size={35} />
            <span className="absolute text-[10px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-1">10</span>
          </button>
          
          <button onClick={togglePlay} className="p-6 bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-full hover:scale-110 transition">
            {isPlaying ? <Pause size={50} fill="white" /> : <Play size={50} fill="white" className="ml-2" />}
          </button>

          <button onClick={() => skip(10)} className="p-4 border-2 border-white/20 rounded-full hover:bg-white/10 transition relative">
            <RotateCw size={35} />
            <span className="absolute text-[10px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-1">10</span>
          </button>
        </div>

        {/* Bottom Bar */}
        <div className="p-8 space-y-4">
          <div className="relative w-full h-1.5 bg-gray-600 rounded-full group cursor-pointer">
            <div 
                className="absolute top-0 left-0 h-full bg-[#00A8E1] rounded-full" 
                style={{ width: `${(currentTime/duration)*100}%` }}
            />
            <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                style={{ left: `${(currentTime/duration)*100}%` }}
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div onClick={() => setIsMuted(!isMuted)} className="cursor-pointer">
                    {isMuted ? <VolumeX size={28} /> : <Volume2 size={28} />}
                </div>
                <span className="font-bold text-lg">{formatTime(currentTime)} / {formatTime(duration)}</span>
                <span className="text-xs font-bold border border-gray-500 px-1 rounded text-gray-400">HD</span>
            </div>
            <button className="text-sm font-bold flex items-center gap-2 hover:underline">
                Next Episode <List size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
