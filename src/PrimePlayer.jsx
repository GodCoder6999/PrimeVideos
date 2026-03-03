import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, X, ChevronRight, SkipForward, Loader, AlertTriangle, Clock } from 'lucide-react';
import Hls from 'hls.js';

// Mock X-Ray Data
const castMembers = [
  { id: 1, name: 'John Krasinski', character: 'Jack Ryan', image: 'https://csspicker.dev/api/image/?q=john+krasinski&image_type=photo' },
  { id: 2, name: 'Jonathan Potts', character: 'Dr. Roger Wade', image: 'https://csspicker.dev/api/image/?q=jonathan+potts&image_type=photo' },
  { id: 3, name: 'Victoria Sanchez', character: 'Layla Navarro', image: 'https://csspicker.dev/api/image/?q=victoria+sanchez&image_type=photo' },
  { id: 4, name: 'Wendell Pierce', character: 'James Greer', image: 'https://csspicker.dev/api/image/?q=wendell+pierce&image_type=photo' },
];

export default function PrimePlayer({ tmdbId, title, mediaType, season, episode }) {
  const navigate = useNavigate();
  
  // --- ENGINE STATE ---
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- PLAYER UI STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [xrayExpanded, setXrayExpanded] = useState(false);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // --- 1. FETCH STREAM FROM BACKEND ---
  useEffect(() => {
    const fetchStream = async () => {
        setLoading(true);
        setError(null);
        setIsDownloading(false);
        try {
            const res = await fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`);
            const data = await res.json();

            if (data.success && data.streamUrl) {
                setStreamUrl(data.streamUrl);
            } else if (data.isDownloading) {
                setIsDownloading(true);
                setError(data.message);
            } else {
                setError(data.error || data.message || "Stream not available.");
            }
        } catch (err) {
            setError("Failed to connect to streaming server.");
        } finally {
            setLoading(false);
        }
    };
    if (tmdbId) fetchStream();
  }, [tmdbId, mediaType, season, episode]);

  // --- 2. ATTACH VIDEO & SYNC STATE ---
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    // Sync HTML5 Video state to React state
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Attach HLS or Native MP4
    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(e => console.log(e)));
        return () => {
            hls.destroy();
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    } else {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => video.play().catch(e => console.log(e)));
    }
    
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [streamUrl]);

  // --- 3. CONTROLS LOGIC ---
  const togglePlay = () => {
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  const skipTime = (amount) => {
    videoRef.current.currentTime += amount;
  };

  const handleSeek = (e) => {
    const seekTime = (e.target.value / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const toggleMute = () => {
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Prevent memory leaks on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // --- RENDERS ---
  if (loading) return <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-[#00A8E1]"><Loader className="animate-spin mb-4" size={48} /><p className="font-bold tracking-widest text-sm uppercase">Locating Torrents...</p></div>;
  if (isDownloading) return <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-yellow-500"><Clock size={48} className="mb-4 animate-pulse" /><p className="font-bold text-lg">Server is caching this torrent.</p></div>;
  if (error) return <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-red-500"><AlertTriangle size={48} className="mb-4" /><p className="font-bold">{error}</p></div>;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden font-sans"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* THE ACTUAL VIDEO ELEMENT */}
      <video 
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
        playsInline
        onClick={togglePlay}
      />

      {/* Dark Overlay (Fades out when controls hide) */}
      <div className={`absolute inset-0 bg-black/40 pointer-events-none transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`} />

      {/* X-Ray Sidebar */}
      <div className={`absolute left-0 top-0 h-full bg-black/80 backdrop-blur-sm transition-all duration-300 z-20 ${xrayExpanded ? 'w-80' : 'w-64'} ${showControls || !isPlaying ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white font-semibold text-sm">X-Ray</span>
            <button 
              onClick={() => setXrayExpanded(!xrayExpanded)}
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              View All
              <ChevronRight className={`w-3 h-3 transition-transform ${xrayExpanded ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            {castMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 group cursor-pointer">
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 border border-gray-600 group-hover:border-gray-400 transition-colors">
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{member.name}</p>
                  <p className="text-gray-400 text-xs truncate">{member.character}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTROLS OVERLAY */}
      <div className={`absolute inset-0 transition-opacity duration-300 z-10 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Top Bar */}
        <div className="absolute top-0 left-64 right-0 p-4 flex items-start justify-between">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-all">
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleMute}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={toggleFullScreen} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-all">
              <Maximize className="w-5 h-5" />
            </button>
            <button onClick={() => navigate(-1)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Title */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-center w-full max-w-2xl px-4">
          <h1 className="text-white text-xl font-semibold mb-1 truncate drop-shadow-lg">{title || "Unknown Title"}</h1>
          {mediaType === 'tv' && (
            <p className="text-gray-300 text-sm drop-shadow-md">Season {season}, Ep. {episode}</p>
          )}
        </div>

        {/* Center Play Button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <button 
            onClick={togglePlay}
            className={`w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all ${showControls ? 'scale-100' : 'scale-90'}`}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 text-white fill-white" />
            ) : (
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            )}
          </button>
        </div>

        {/* Skip Buttons */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-48 pointer-events-auto">
          <button onClick={() => skipTime(-10)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <SkipForward className="w-6 h-6 text-white rotate-180" />
          </button>
          <button onClick={() => skipTime(10)} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <SkipForward className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 pointer-events-auto bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress Bar Container */}
          <div className="mb-4 px-4 relative">
            <div className="relative h-1.5 bg-gray-600 rounded-full group">
              {/* Blue Fill */}
              <div 
                className="absolute h-full bg-[#00A8E1] rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Thumb Hover */}
              <div 
                className="absolute w-3 h-3 bg-white rounded-full -translate-y-1/4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
              {/* Invisible Clickable Input */}
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progressPercent || 0} 
                onChange={handleSeek} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
          </div>

          {/* Bottom Bar Details */}
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-medium">{formatTime(currentTime)}</span>
              <span className="text-gray-400 text-sm">/</span>
              <span className="text-gray-400 text-sm">{formatTime(duration)}</span>
              {mediaType === 'movie' && (
                  <span className="text-gray-400 text-sm ml-2 border border-gray-500 px-1.5 py-0.5 text-xs rounded">HD</span>
              )}
            </div>

            {mediaType === 'tv' && (
                <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-md hover:bg-white/20">
                <span className="text-sm font-medium">Next Episode</span>
                <ChevronRight className="w-4 h-4" />
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
