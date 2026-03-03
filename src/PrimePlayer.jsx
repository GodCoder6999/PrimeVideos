import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, RotateCcw, RotateCw, Maximize, 
  Volume2, VolumeX, Settings, Monitor, X, ChevronRight, Loader2 
} from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);

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
  const [showXRay, setShowXRay] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // 1. Parallel Fetching for Speed
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
          setCast(cData.cast?.slice(0, 6) || []);
          setIsFetching(false);
        } else if (sData.isDownloading) {
          setTimeout(fetchData, 3000); // Poll faster
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

  // 2. HLS Engine Optimization
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: 0 });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  // 3. Handlers
  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const skip = (amount) => videoRef.current.currentTime += amount;
  const toggleMute = () => { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); };
  const toggleFullScreen = () => document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    videoRef.current.currentTime = (x / rect.width) * duration;
  };

  if (isFetching) return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" />
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-white font-sans overflow-hidden select-none group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Interface Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

      {/* Header Info */}
      <div className="absolute top-10 left-12">
        <h1 className="text-3xl font-light tracking-wide">{title}</h1>
        {mediaType === 'tv' && <p className="text-gray-400 text-lg mt-1">Season {season}, Ep. {episode}</p>}
      </div>

      {/* Utility Controls */}
      <div className="absolute top-10 right-12 flex items-center gap-8 text-gray-200 z-50">
        <Monitor className="w-6 h-6 cursor-pointer hover:text-white" />
        <div className="relative">
          <Settings className="w-6 h-6 cursor-pointer hover:text-white" onClick={() => setShowQualityMenu(!showQualityMenu)} />
          {showQualityMenu && (
            <div className="absolute top-10 right-0 bg-[#19222d] border border-white/10 rounded w-40 overflow-hidden shadow-xl">
              {['Auto', '1080p', '720p', '480p'].map(q => (
                <div key={q} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm" onClick={() => setShowQualityMenu(false)}>{q}</div>
              ))}
            </div>
          )}
        </div>
        <div onClick={toggleMute}>{isMuted ? <VolumeX className="w-6 h-6 cursor-pointer" /> : <Volume2 className="w-6 h-6 cursor-pointer" />}</div>
        <Maximize className="w-6 h-6 cursor-pointer hover:text-white" onClick={toggleFullScreen} />
        <X className="w-9 h-9 cursor-pointer hover:text-white" onClick={() => navigate(-1)} />
      </div>

      {/* X-Ray Sidebar */}
      {showXRay && (
        <div className="absolute top-24 left-12 w-72 bg-black/30 backdrop-blur-xl border border-white/10 p-5 rounded-sm z-30 transition-all">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold flex items-center gap-2">X-Ray</h2>
            <button onClick={() => setShowXRay(false)} className="opacity-50 hover:opacity-100">
              <ChevronRight className="rotate-[-90deg]" />
            </button>
          </div>
          <div className="space-y-6 overflow-y-auto max-h-[60vh]">
            {cast.map(member => (
              <div key={member.id} className="flex items-center gap-4 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                <div className="w-14 h-14 bg-gray-800 rounded-sm overflow-hidden flex-shrink-0">
                  <img src={`https://image.tmdb.org/t/p/w200${member.profile_path}`} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex flex-col border-b border-white/5 pb-2 w-full">
                  <span className="text-sm font-semibold group-hover:text-blue-400">{member.name}</span>
                  <span className="text-xs text-gray-400 tracking-wide">{member.character}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Center Controls */}
      <div className="absolute inset-0 flex items-center justify-center gap-24 pointer-events-none">
        <button onClick={() => skip(-10)} className="group flex flex-col items-center pointer-events-auto">
          <RotateCcw size={56} strokeWidth={1} className="group-hover:scale-110 transition-transform" />
          <span className="absolute text-xs mt-[22px] font-bold">10</span>
        </button>

        <button onClick={togglePlay} className="hover:scale-110 transition-transform p-4 pointer-events-auto">
          {isPlaying ? <Pause size={72} fill="white" /> : <Play size={72} fill="white" />}
        </button>

        <button onClick={() => skip(10)} className="group flex flex-col items-center pointer-events-auto">
          <RotateCw size={56} strokeWidth={1} className="group-hover:scale-110 transition-transform" />
          <span className="absolute text-xs mt-[22px] font-bold">10</span>
        </button>
      </div>

      {/* Bottom Scrubber */}
      <div className="absolute bottom-12 inset-x-12 z-40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 font-mono">
            {formatTime(currentTime)} <span className="text-gray-500">/ {formatTime(duration)}</span>
            <span className="text-[10px] border border-white/40 px-1 py-0.5 rounded-sm">HD</span>
          </div>
          <div className="flex items-center text-lg font-medium cursor-pointer hover:text-blue-400 transition-colors">
            Next Episode <ChevronRight size={24} className="ml-1" />
          </div>
        </div>
        <div onClick={handleSeek} className="w-full h-[3px] bg-white/20 cursor-pointer relative group/bar hover:h-[6px] transition-all">
          <div className="h-full bg-white relative transition-all" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
            <div className="hidden group-hover/bar:block absolute right-[-6px] top-[-4px] w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrimePlayer;
