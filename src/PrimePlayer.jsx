import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  Settings, RotateCcw, RotateCw, Loader2, List, X, ChevronDown, ChevronUp 
} from 'lucide-react';
import Hls from 'hls.js';

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [xrayOpen, setXrayOpen] = useState(true);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);

  // Fetch Stream and Cast simultaneously
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=cb1dc311039e6ae85db0aa200345cbc5`)
        ]);
        const sData = await sRes.json();
        const cData = await cRes.json();
        if (sData.success) {
            setStreamUrl(sData.streamUrl);
            setCast(cData.cast?.slice(0, 5) || []);
        } else if (sData.isDownloading) {
            setTimeout(fetchData, 4000); 
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [tmdbId, mediaType, season, episode]);

  // Video and Engine logic
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    
    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else {
      video.src = streamUrl;
    }

    const onReady = () => setIsReady(true);
    const onTime = () => setCurrentTime(video.currentTime);
    const onDur = () => setDuration(video.duration);

    video.addEventListener('canplaythrough', onReady);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onDur);

    return () => {
      video.removeEventListener('canplaythrough', onReady);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [streamUrl]);

  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const formatTime = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-white overflow-hidden" onMouseMove={() => setShowControls(true)}>
      {/* Loading Spinner - Stays until video is ready */}
      {!isReady && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black">
          <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" />
        </div>
      )}

      <video ref={videoRef} className={`w-full h-full ${isReady ? 'opacity-100' : 'opacity-0'}`} onClick={togglePlay} onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} />

      {/* Interface Overlay */}
      <div className={`absolute inset-0 flex flex-col justify-between p-6 transition-opacity duration-300 bg-gradient-to-t from-black/80 via-transparent to-black/80 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <ArrowLeft className="cursor-pointer" onClick={() => navigate(-1)} />
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              {mediaType === 'tv' && <p className="text-xs text-gray-400">S{season} E{episode}</p>}
            </div>
          </div>
          <div className="flex gap-6">
            <Settings className="cursor-pointer" />
            <Maximize className="cursor-pointer" onClick={() => containerRef.current.requestFullscreen()} />
            <X className="cursor-pointer" onClick={() => navigate(-1)} />
          </div>
        </div>

        {/* X-Ray Sidebar */}
        <div className={`absolute left-0 top-1/4 w-64 p-6 transition-transform ${xrayOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setXrayOpen(!xrayOpen)}>
                <span className="font-bold">X-Ray</span> {xrayOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
            </div>
            {xrayOpen && cast.map(a => (
                <div key={a.id} className="flex items-center gap-3 mb-3">
                    <img src={`https://image.tmdb.org/t/p/w200${a.profile_path}`} className="w-10 h-12 object-cover rounded" alt="" />
                    <div className="text-xs"><p className="font-bold">{a.name}</p><p className="text-gray-400">{a.character}</p></div>
                </div>
            ))}
        </div>

        {/* Playback Controls */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
          <RotateCcw onClick={() => videoRef.current.currentTime -= 10} className="cursor-pointer" />
          <div onClick={togglePlay} className="p-6 bg-white/10 rounded-full cursor-pointer border border-white/20">
            {isPlaying ? <Pause fill="white" size={40}/> : <Play fill="white" size={40} className="ml-1"/>}
          </div>
          <RotateCw onClick={() => videoRef.current.currentTime += 10} className="cursor-pointer" />
        </div>

        {/* Scrubber and Time */}
        <div className="w-full">
          <div className="relative w-full h-1 bg-gray-600 rounded-full mb-4 group cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              videoRef.current.currentTime = percent * duration;
          }}>
            <div className="absolute top-0 left-0 h-full bg-[#00A8E1]" style={{ width: `${(currentTime/duration)*100}%` }} />
          </div>
          <div className="flex justify-between items-center text-sm font-bold">
            <div>{formatTime(currentTime)} / {formatTime(duration)} <span className="ml-2 border px-1 text-[10px]">HD</span></div>
            <div className="cursor-pointer">Next Episode <List className="inline ml-2" size={16}/></div>
          </div>
        </div>
      </div>
    </div>
  );
}
