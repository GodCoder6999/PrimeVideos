import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  MessageSquare, Settings, RotateCcw, RotateCw, Loader2, List
} from 'lucide-react';
import Hls from 'hls.js';

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  
  // -- State --
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(true); // ONLY true during initial load
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const timelineRef = useRef(null);

  // --- 1. Fetch Stream (Silent Polling) ---
  useEffect(() => {
    let isMounted = true;

    const fetchStream = async () => {
      try {
        const res = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
          setIsFetching(false); // Stop loading ONLY when we have the URL
        } else if (data.isDownloading) {
          // Torbox is caching. Poll silently.
          setTimeout(fetchStream, 5000);
        } else {
          setError(data.error || data.message || "Video unavailable.");
          setIsFetching(false);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to connect to server.");
          setIsFetching(false);
        }
      }
    };

    if (tmdbId) {
      setIsFetching(true);
      fetchStream();
    }

    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // --- 2. Attach Video Player ---
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
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
    };
  }, [streamUrl]);

  // --- 3. Controls Logic ---
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

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    videoRef.current.volume = newVolume;
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    videoRef.current.muted = newMutedState;
    if (!newMutedState && volume === 0) {
      setVolume(1);
      videoRef.current.volume = 1;
    }
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
    }, 3000);
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

  // --- Render Error State ---
  if (error) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="text-xl mb-4 font-semibold text-red-500">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#00A8E1] rounded hover:bg-[#0081b8] transition font-bold">Go Back</button>
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
      {/* VIDEO ELEMENT */}
      <video 
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        playsInline
        onClick={togglePlay}
      />

      {/* INITIAL FETCHING SPINNER (No Text, Only shows before stream URL is found) */}
      {isFetching && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" />
        </div>
      )}

      {/* PRIME UI OVERLAY */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 z-40 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header */}
        <div className="w-full p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex justify-between items-start">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-white hover:scale-110 transition-transform p-2">
              <ArrowLeft size={30} />
            </button>
            <h1 className="text-white text-xl font-bold tracking-wide drop-shadow-md truncate max-w-xl">
              {title} {mediaType === 'tv' && <span className="text-gray-300 text-lg font-normal ml-2">Season {season} Ep {episode}</span>}
            </h1>
          </div>

          <div className="flex items-center gap-6 pr-4">
            <button className="text-white/90 hover:text-white transition-colors p-2">
              <MessageSquare size={26} className="fill-white/20" />
            </button>
            <button className="text-white/90 hover:text-white transition-colors p-2">
              <Settings size={26} className="fill-white/20" />
            </button>
            <button onClick={toggleFullScreen} className="text-white/90 hover:text-white transition-colors p-2">
              <Maximize size={26} />
            </button>
          </div>
        </div>

        {/* Center Massive Play Button (Appears when paused) */}
        {!isPlaying && !isFetching && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <button 
              onClick={togglePlay}
              className="w-24 h-24 rounded-full bg-black/40 border-2 border-white/40 flex items-center justify-center hover:bg-black/60 hover:scale-105 transition-all backdrop-blur-sm"
            >
              <Play className="w-10 h-10 text-white fill-white ml-2" />
            </button>
          </div>
        )}

        {/* Bottom Controls Area */}
        <div className="w-full pt-24 pb-6 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col pointer-events-auto">
          
          {/* Progress Bar (Full Width Above Controls) */}
          <div className="w-full group mb-5 relative flex items-center">
            <div 
              ref={timelineRef}
              className="w-full h-1.5 bg-gray-500/50 rounded cursor-pointer relative"
              onClick={handleTimelineClick}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-[#00A8E1] rounded"
                style={{ width: `${progressPercent}%` }}
              />
              <div 
                className="absolute top-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none"
                style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>

          {/* Bottom Bar Buttons */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-6">
              <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                {isPlaying ? <Pause size={30} className="fill-white" /> : <Play size={30} className="fill-white" />}
              </button>
              
              <button onClick={() => skipTime(-10)} className="text-white hover:scale-110 transition-transform">
                <RotateCcw size={28} />
              </button>
              
              <button onClick={() => skipTime(10)} className="text-white hover:scale-110 transition-transform">
                <RotateCw size={28} />
              </button>

              {/* Volume Group */}
              <div className="flex items-center gap-2 group ml-2 relative">
                <button onClick={toggleMute} className="text-white hover:scale-110 transition-transform">
                  {isMuted || volume === 0 ? <VolumeX size={28} /> : <Volume2 size={28} />}
                </button>
                {/* Expandable Volume Slider */}
                <input 
                  type="range" 
                  min="0" max="1" step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 transition-all duration-300 ease-out origin-left cursor-pointer accent-[#00A8E1]"
                />
              </div>

              {/* Timestamps */}
              <div className="text-white text-base font-medium tracking-wide ml-2">
                {formatTime(currentTime)} <span className="text-gray-400 mx-1">/</span> {formatTime(duration)}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-4">
              {mediaType === 'tv' && (
                <button className="flex items-center gap-2 text-white font-bold text-sm bg-white/10 px-4 py-2 rounded-md hover:bg-white/20 transition-colors backdrop-blur-sm">
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
