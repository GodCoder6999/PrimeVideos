import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, RotateCcw, RotateCw, Maximize, 
  Volume2, VolumeX, Settings, Monitor, X, ChevronRight, Loader2, MessageSquare
} from 'lucide-react';
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

  // -- Track State --
  const [audioTracks, setAudioTracks] = useState([]);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [currentSub, setCurrentSub] = useState(-1);

  // -- UI State --
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showXRay, setShowXRay] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  // 1. Fetch Stream & Cast
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsFetching(true);
      setError(null);
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
          setCast(cData.cast?.slice(0, 8) || []);
          setIsFetching(false);
        } else if (sData.isDownloading) {
          setTimeout(fetchData, 3000);
        } else {
          setError(sData.error || "Failed to find stream.");
          setIsFetching(false);
        }
      } catch (err) {
        if (isMounted) setIsFetching(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // 2. Save Progress Logic
  useEffect(() => {
    if (!videoRef.current || isFetching) return;
    const saveProgress = () => {
      const video = videoRef.current;
      const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
      const key = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
      allProgress[key] = {
        id: tmdbId,
        type: mediaType,
        last_updated: Date.now(),
        progress: { watched: video.currentTime, duration: video.duration },
        last_season_watched: season,
        last_episode_watched: episode
      };
      localStorage.setItem('vidFastProgress', JSON.stringify(allProgress));
    };
    const interval = setInterval(saveProgress, 5000);
    return () => { saveProgress(); clearInterval(interval); };
  }, [tmdbId, mediaType, season, episode, isFetching]);

  // 3. HLS Setup with Language Extraction & Auto-Resume
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const resumePlayback = () => {
      const saved = JSON.parse(localStorage.getItem('vidFastProgress'))?.[`${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`];
      if (saved && saved.progress?.watched) {
        video.currentTime = saved.progress.watched;
      }
      video.play().catch(() => {});
    };

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setAudioTracks(hls.audioTracks);
        setSubtitleTracks(hls.subtitleTracks);
        resumePlayback();
      });
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = resumePlayback;
    }

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  // 4. Handlers
  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const skip = (val) => videoRef.current.currentTime += val;
  const toggleMute = () => { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); };
  const toggleFullScreen = () => !document.fullscreenElement ? containerRef.current.requestFullscreen() : document.exitFullscreen();
  
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleNextEpisode = () => {
    if (mediaType === 'tv') {
      navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${parseInt(episode) + 1}`);
    }
  };

  const changeAudio = (index) => { if (hlsRef.current) { hlsRef.current.audioTrack = index; setCurrentAudio(index); }};
  const changeSubtitle = (index) => { if (hlsRef.current) { hlsRef.current.subtitleTrack = index; setCurrentSub(index); }};

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    videoRef.current.currentTime = (x / rect.width) * duration;
  };

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => {
        setUiVisible(false);
        setShowSubMenu(false);
    }, 3000);
  };

  // --- RENDERS ---
  if (error) return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
      <p className="text-xl mb-4 font-bold text-red-500">{error}</p>
      <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#00A8E1] rounded font-bold">Go Back</button>
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-white font-sans overflow-hidden select-none group" onMouseMove={resetTimer} onClick={resetTimer}>
      
      {/* SILENT LOADER */}
      {isFetching && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
           <Loader2 className="w-16 h-16 animate-spin text-[#00A8E1]" />
         </div>
      )}

      {/* VIDEO BACKGROUND */}
      <video 
        ref={videoRef} 
        className="w-full h-full object-contain bg-black" 
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} 
        onLoadedMetadata={(e) => setDuration(e.target.duration)} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onClick={togglePlay} 
      />

      {/* UI OVERLAY */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${uiVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Gradient Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 pointer-events-none" />

        {/* Top Header */}
        <div className="absolute top-8 left-12 z-20">
          <h1 className="text-3xl font-light tracking-wide drop-shadow-md">{title}</h1>
          {mediaType === 'tv' && <p className="text-gray-400 text-lg mt-1 font-medium">Season {season}, Ep. {episode}</p>}
        </div>

        {/* Top Right Utilities */}
        <div className="absolute top-10 right-12 flex items-center gap-8 text-gray-200 z-50">
          {/* X-Ray Toggle */}
          <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white font-bold tracking-widest uppercase text-sm flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-md hover:bg-white/20 transition border border-white/10">
            X-Ray {showXRay ? <ChevronRight className="w-4 h-4" /> : ''}
          </button>
          
          <Monitor className="w-6 h-6 cursor-pointer hover:text-white transition" />
          
          {/* Subtitles & Audio Menu Toggle */}
          <div className="relative">
            <MessageSquare className="w-6 h-6 cursor-pointer hover:text-white transition" onClick={() => setShowSubMenu(!showSubMenu)} />
            
            {showSubMenu && (
              <div className="absolute top-10 right-0 w-[400px] bg-[#19212b]/95 backdrop-blur-xl border border-white/10 p-6 z-50 rounded-xl shadow-2xl">
                <div className="grid grid-cols-2 gap-8 text-sm">
                  <div>
                    <h3 className="text-gray-400 uppercase text-[10px] font-bold mb-4 tracking-widest border-b border-white/10 pb-2">Subtitles</h3>
                    <ul className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide">
                      <li onClick={() => changeSubtitle(-1)} className={`cursor-pointer transition-colors ${currentSub === -1 ? 'text-[#00A8E1] font-bold' : 'hover:text-white'}`}>Off</li>
                      {subtitleTracks.map((t, i) => (
                        <li key={i} onClick={() => changeSubtitle(i)} className={`cursor-pointer transition-colors ${currentSub === i ? 'text-[#00A8E1] font-bold' : 'hover:text-white'}`}>{t.name || t.lang || `Track ${i+1}`}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-gray-400 uppercase text-[10px] font-bold mb-4 tracking-widest border-b border-white/10 pb-2">Audio</h3>
                    <ul className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide">
                      {audioTracks.map((t, i) => (
                        <li key={i} onClick={() => changeAudio(i)} className={`cursor-pointer transition-colors ${currentAudio === i ? 'text-[#00A8E1] font-bold' : 'hover:text-white'}`}>{t.name || t.lang || `Track ${i+1}`}</li>
                      ))}
                      {audioTracks.length === 0 && <li className="text-gray-500 italic">Default Audio</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div onClick={toggleMute} className="cursor-pointer hover:text-white transition">
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </div>
          <Maximize className="w-6 h-6 cursor-pointer hover:text-white transition" onClick={toggleFullScreen} />
          <X className="w-9 h-9 cursor-pointer hover:text-white transition" onClick={() => navigate(-1)} />
        </div>

        {/* X-Ray Sidebar */}
        <div className={`absolute top-28 left-12 w-80 bg-black/40 backdrop-blur-2xl border border-white/10 p-5 rounded-xl z-30 transition-all duration-300 ${showXRay ? 'translate-x-0 opacity-100' : '-translate-x-[150%] opacity-0 pointer-events-none'}`}>
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">X-Ray</h2>
            <span className="text-[10px] font-bold text-[#00A8E1] cursor-pointer uppercase tracking-widest">View All</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[50vh] scrollbar-hide pr-2">
            {cast.length > 0 ? cast.map(member => (
              <div key={member.id} className="flex items-center gap-4 group cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors">
                <div className="w-12 h-14 bg-gray-800 rounded overflow-hidden flex-shrink-0 border border-white/5">
                  {member.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w200${member.profile_path}`} className="w-full h-full object-cover" alt={member.name} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-t from-gray-900 to-gray-700" />
                  )}
                </div>
                <div className="flex flex-col w-full">
                  <span className="text-sm font-bold group-hover:text-[#00A8E1] transition-colors">{member.name}</span>
                  <span className="text-xs text-gray-400 tracking-wide line-clamp-1">{member.character}</span>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-sm">No cast information available.</p>
            )}
          </div>
        </div>

        {/* Center Playback Controls */}
        <div className="absolute inset-0 flex items-center justify-center gap-24 pointer-events-none z-20">
          <button onClick={() => skip(-10)} className="group flex flex-col items-center pointer-events-auto text-white/80 hover:text-white transition">
            <RotateCcw size={64} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
            <span className="absolute text-xs mt-[26px] font-bold">10</span>
          </button>

          <button onClick={togglePlay} className="hover:scale-110 transition-transform p-4 pointer-events-auto bg-black/20 rounded-full backdrop-blur-sm border border-white/10">
            {isPlaying ? <Pause size={80} fill="white" /> : <Play size={80} fill="white" className="ml-2" />}
          </button>

          <button onClick={() => skip(10)} className="group flex flex-col items-center pointer-events-auto text-white/80 hover:text-white transition">
            <RotateCw size={64} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
            <span className="absolute text-xs mt-[26px] font-bold">10</span>
          </button>
        </div>

        {/* Bottom Scrubber Area */}
        <div className="absolute bottom-10 inset-x-12 z-40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 font-mono text-lg">
              <span className="font-bold">{formatTime(currentTime)}</span>
              <span className="text-gray-400">/ {formatTime(duration)}</span>
              <span className="text-[10px] font-bold border border-white/40 px-1.5 py-0.5 rounded-sm text-gray-300 ml-2 uppercase tracking-widest bg-white/10">HD</span>
            </div>
            
            {mediaType === 'tv' && (
              <div onClick={handleNextEpisode} className="flex items-center text-lg font-bold cursor-pointer hover:text-[#00A8E1] transition-colors group bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:border-[#00A8E1]/50 backdrop-blur-md">
                Next Episode <ChevronRight size={24} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
          
          {/* Dynamic Scrubber */}
          <div onClick={handleSeek} className="w-full h-[4px] bg-white/20 rounded-full cursor-pointer relative group/bar hover:h-[8px] transition-all">
            <div className="h-full bg-[#00A8E1] rounded-full relative transition-all shadow-[0_0_10px_#00A8E1]" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
              <div className="hidden group-hover/bar:block absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrimePlayer;
