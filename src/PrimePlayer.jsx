import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  MessageSquare, Settings, RotateCcw, RotateCw, Loader2, 
  List, ChevronUp, ChevronDown, Monitor, X
} from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5"; // Using your provided key

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  
  // -- State --
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

  // --- 1. SUPERFAST DATA FETCHING (Parallel) ---
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch stream and cast in parallel to save time
        const [streamRes, castRes] = await Promise.all([
          fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
        ]);

        const streamData = await streamRes.json();
        const castData = await castRes.json();

        if (!isMounted) return;

        if (streamData.success && streamData.streamUrl) {
          setStreamUrl(streamData.streamUrl);
          setCast(castData.cast?.slice(0, 6) || []);
          setIsFetching(false);
        } else if (streamData.isDownloading) {
          // Poll faster (every 3s) for the cache to finish
          setTimeout(fetchData, 3000);
        }
      } catch (err) {
        if (isMounted) setIsFetching(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // --- 2. INSTANT-START HLS ENGINE ---
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        autoStartLoad: true,
        startLevel: 0, // Starts at lowest bitrate for instant play, then scales up
        maxBufferLength: 10, // Only wait for 10s of buffer to start
        maxMaxBufferLength: 20,
        backBufferLength: 60,
        manifestLoadingMaxRetry: 3,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    const syncTime = () => setCurrentTime(video.currentTime);
    const syncDuration = () => setDuration(video.duration);
    
    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('loadedmetadata', syncDuration);

    return () => {
      video.removeEventListener('timeupdate', syncTime);
      video.removeEventListener('loadedmetadata', syncDuration);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [streamUrl]);

  // --- 3. CONTROLS & QUALITY LOGIC ---
  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const skip = (amt) => videoRef.current.currentTime += amt;
  const toggleFullScreen = () => document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
  
  const changeQuality = (levelIndex, label) => {
    if (hlsRef.current) {
        // -1 for Auto, or the index of the level
        hlsRef.current.currentLevel = levelIndex;
        setCurrentQuality(label);
        setShowQualityMenu(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black text-white font-sans overflow-hidden select-none"
      onMouseMove={handleMouseMove}
    >
      <video ref={videoRef} className="w-full h-full" onClick={togglePlay} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} playsInline />

      {/* Silent Instant Loader */}
      {isFetching && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" />
        </div>
      )}

      {/* PRIME UI OVERLAY */}
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 bg-gradient-to-t from-black/80 via-transparent to-black/80 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Top Controls Bar */}
        <div className="p-6 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent">
          <div className="flex items-center gap-4">
            <ArrowLeft className="cursor-pointer hover:scale-110 transition p-2" onClick={() => navigate(-1)} size={32} />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
              {mediaType === 'tv' && <p className="text-sm text-gray-300 font-medium uppercase tracking-wider">Season {season} Episode {episode}</p>}
            </div>
          </div>

          <div className="flex gap-7 items-center pr-4">
            <MessageSquare className="cursor-pointer hover:text-[#00A8E1] transition" size={26} />
            <div className="relative">
                <Settings 
                    className={`cursor-pointer transition-transform duration-300 ${showQualityMenu ? 'text-[#00A8E1] rotate-90' : 'hover:scale-110'}`} 
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    size={26}
                />
                {showQualityMenu && (
                    <div className="absolute top-10 right-0 bg-[#1a242f]/95 border border-white/10 rounded-md w-44 overflow-hidden shadow-2xl backdrop-blur-md z-50">
                        {[
                          { label: 'Auto', id: -1 },
                          { label: '1080p (HD)', id: 1 },
                          { label: '720p', id: 0 },
                          { label: 'Data Saver', id: 0 }
                        ].map((q) => (
                            <div 
                                key={q.label}
                                className={`px-4 py-3 text-sm cursor-pointer hover:bg-white/10 ${currentQuality === q.label ? 'text-[#00A8E1] font-bold border-l-4 border-[#00A8E1]' : ''}`}
                                onClick={() => changeQuality(q.id, q.label)}
                            >
                                {q.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <Maximize className="cursor-pointer hover:text-[#00A8E1] transition" onClick={toggleFullScreen} size={26} />
            <X className="cursor-pointer hover:text-[#00A8E1] transition" onClick={() => navigate(-1)} size={26} />
          </div>
        </div>

        {/* X-RAY Panel */}
        <div className={`absolute left-0 top-1/4 bottom-1/4 w-72 p-6 transition-all duration-300 ${xrayOpen ? 'translate-x-0' : '-translate-x-64'}`}>
            <div className="flex items-center gap-2 mb-4 cursor-pointer hover:text-[#00A8E1]" onClick={() => setXrayOpen(!xrayOpen)}>
                <span className="text-xl font-bold uppercase tracking-widest text-sm">X-Ray</span>
                {xrayOpen ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
            </div>
            {xrayOpen && (
                <div className="space-y-4 overflow-y-auto max-h-full scrollbar-hide">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">In Scene</p>
                    {cast.map(actor => (
                        <div key={actor.id} className="flex items-center gap-3 group cursor-pointer">
                            <img 
                                src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} 
                                className="w-12 h-16 object-cover rounded border border-white/10 group-hover:border-[#00A8E1] transition shadow-lg" 
                                alt={actor.name}
                            />
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold truncate group-hover:text-[#00A8E1]">{actor.name}</p>
                                <p className="text-xs text-gray-400 truncate">{actor.character}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Center Playback Controls */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-14">
          <button onClick={() => skip(-10)} className="group relative flex items-center justify-center p-3 border-2 border-white/20 rounded-full hover:border-white transition">
            <RotateCcw size={36} className="group-hover:scale-110 transition" />
            <span className="absolute text-[10px] font-bold mt-1">10</span>
          </button>
          
          <button onClick={togglePlay} className="p-7 bg-white/5 backdrop-blur-sm border-2 border-white/40 rounded-full hover:scale-110 hover:bg-white/10 transition shadow-2xl">
            {isPlaying ? <Pause size={50} fill="white" /> : <Play size={50} fill="white" className="ml-2" />}
          </button>

          <button onClick={() => skip(10)} className="group relative flex items-center justify-center p-3 border-2 border-white/20 rounded-full hover:border-white transition">
            <RotateCw size={36} className="group-hover:scale-110 transition" />
            <span className="absolute text-[10px] font-bold mt-1">10</span>
          </button>
        </div>

        {/* Bottom Bar Area */}
        <div className="p-10 bg-gradient-to-t from-black/95 to-transparent">
          <div className="relative w-full h-1.5 bg-white/20 rounded-full group cursor-pointer mb-5">
            <div 
                className="absolute top-0 left-0 h-full bg-[#00A8E1] rounded-full shadow-[0_0_10px_#00A8E1]" 
                style={{ width: `${(currentTime/duration)*100}%` }}
            />
            <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-xl"
                style={{ left: `${(currentTime/duration)*100}%` }}
            />
            <input 
                type="range" min="0" max="100" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                    const newTime = (e.target.value / 100) * duration;
                    videoRef.current.currentTime = newTime;
                }}
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
                <div onClick={() => setIsMuted(!isMuted)} className="cursor-pointer hover:text-[#00A8E1] transition">
                    {isMuted ? <VolumeX size={30} /> : <Volume2 size={30} />}
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="font-bold text-xl tracking-tighter">{formatTime(currentTime)}</span>
                    <span className="text-gray-500 text-lg">/</span>
                    <span className="text-gray-400 font-medium text-lg">{formatTime(duration)}</span>
                </div>
                <span className="text-[10px] font-bold border-2 border-white/30 px-1.5 py-0.5 rounded text-white tracking-widest ml-2">HD</span>
            </div>
            
            <button className="text-sm font-bold flex items-center gap-3 hover:text-[#00A8E1] transition uppercase tracking-widest">
                Next Episode <List size={22} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
