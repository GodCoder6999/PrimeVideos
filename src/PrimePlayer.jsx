import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  MessageSquare, RotateCcw, RotateCw, Loader2, List, Settings
} from 'lucide-react';
import Hls from 'hls.js';

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  
  // -- Engine State --
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);
  
  // -- True Loading State --
  // Stays true until the video element itself fires 'canplay'
  const [isVideoReady, setIsVideoReady] = useState(false); 
  
  // -- Player UI State --
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const timelineRef = useRef(null);

  // 1. Fetch Stream & Handle Silent Polling for TorBox
  useEffect(() => {
    let isMounted = true;

    const fetchStream = async () => {
      try {
        const res = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
        } else if (data.isDownloading) {
          // Silently poll every 5 seconds until Torbox finishes caching. 
          // The user only sees the loading spinner.
          setTimeout(fetchStream, 5000);
        } else {
          setError(data.error || data.message || "Video unavailable.");
        }
      } catch (err) {
        if (isMounted) setError("Failed to connect to server.");
      }
    };

    if (tmdbId) fetchStream();

    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // 2. Attach HLS & Sync Video Events
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    // The True Loading Triggers
    const handleCanPlay = () => setIsVideoReady(true);
    const handleWaiting = () => setIsVideoReady(false); 
    const handlePlaying = () => setIsVideoReady(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', () => setError("Browser cannot decode this video format."));

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => console.log("Autoplay blocked"));
      });

      return () => {
        hls.destroy();
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    } else {
      video.src = streamUrl;
      video.play().catch(() => console.log("Autoplay blocked"));
    }
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [streamUrl]);

  // 3. UI Interactions
  const togglePlay = () => {
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  const skipTime = (amount) => {
    videoRef.current.currentTime += amount;
  };

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // -- Render Error --
  if (error) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white font-sans">
        <p className="text-xl mb-4 font-semibold">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#00A8E1] rounded hover:bg-[#0081b8] transition">Go Back</button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden font-sans select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* 1. THE VIDEO LAYER */}
      <video 
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        playsInline
        onClick={togglePlay}
      />

      {/* 2. TRUE LOADING OVERLAY (Shows if API is fetching OR Video is buffering) */}
      {!isVideoReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <Loader2 className="w-16 h-16 animate-spin text-[#00A8E1]" />
        </div>
      )}

      {/* 3. PRIME UI CONTROLS OVERLAY */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 z-40 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Gradient Banner */}
        <div className="w-full pt-6 pb-24 px-8 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex justify-between items-start">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="text-white/90 hover:text-white transition transform hover:scale-110">
              <ArrowLeft size={32} />
            </button>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-wide drop-shadow-md">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="text-white/80 hover:text-white transition flex flex-col items-center gap-1 group">
              <MessageSquare size={26} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Subtitles</span>
            </button>
            <button className="text-white/80 hover:text-white transition flex flex-col items-center gap-1 group">
              <Settings size={26} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Quality</span>
            </button>
            <button onClick={toggleFullScreen} className="text-white/80 hover:text-white transition ml-4 hover:scale-110">
              <Maximize size={28} />
            </button>
          </div>
        </div>

        {/* Center Massive Play Button (Only shows when paused) */}
        {!isPlaying && isVideoReady && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-black/40 border-2 border-white/20 backdrop-blur-sm flex items-center justify-center pointer-events-auto cursor-pointer hover:bg-black/60 hover:scale-105 transition-all" onClick={togglePlay}>
              <Play className="w-12 h-12 text-white fill-white ml-2" />
            </div>
          </div>
        )}

        {/* Bottom Gradient Banner */}
        <div className="w-full pt-24 pb-8 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          
          {/* Prime Video Scrubber */}
          <div className="w-full group mb-6 relative">
            <div 
              ref={timelineRef}
              className="w-full h-1.5 bg-white/30 rounded cursor-pointer relative"
              onClick={handleTimelineClick}
            >
              {/* Blue Fill */}
              <div 
                className="absolute top-0 left-0 h-full bg-[#00A8E1] rounded"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Scrubber Dot (Appears on hover) */}
              <div 
                className="absolute top-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none"
                style={{ 
                  left: `${progressPercent}%`, 
                  transform: 'translate(-50%, -50%)' 
                }}
              />
            </div>
          </div>

          {/* Bottom Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                {isPlaying ? <Pause size={32} className="fill-white" /> : <Play size={32} className="fill-white" />}
              </button>
              
              <button onClick={() => skipTime(-10)} className="text-white/90 hover:text-white hover:scale-110 transition-transform">
                <RotateCcw size={32} />
              </button>
              
              <button onClick={() => skipTime(10)} className="text-white/90 hover:text-white hover:scale-110 transition-transform">
                <RotateCw size={32} />
              </button>

              <div className="flex items-center gap-4 ml-2">
                <button onClick={toggleMute} className="text-white/90 hover:text-white transition-colors">
                  {isMuted ? <VolumeX size={28} /> : <Volume2 size={28} />}
                </button>
                <div className="text-white/90 text-lg font-medium tracking-wide">
                  {formatTime(currentTime)} <span className="text-white/50 mx-1">/</span> {formatTime(duration)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {mediaType === 'tv' && (
                <button className="flex items-center gap-2 text-white font-bold text-sm bg-white/10 px-4 py-2 rounded border border-white/20 hover:bg-white/20 transition">
                  <List size={20} /> Next Episode
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
