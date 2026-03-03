import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimeout = useRef(null);

  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showXRay, setShowXRay] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  
  // Audio Tracks state
  const [audioTracks, setAudioTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);

  // 1. Fetch Stream & Cast (Preserved)
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
        }
      } catch (err) { if (isMounted) setIsFetching(false); }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  // 2. HLS Engine + Resume Logic + Audio Track Fetching
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const initPlayer = () => {
      // Load saved progress
      const progressKey = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
      const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
      const savedTime = allProgress[progressKey]?.progress?.watched || 0;
      
      if (savedTime > 0) video.currentTime = savedTime;
      video.play().catch(() => {});
    };

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setAudioTracks(hls.audioTracks);
        initPlayer();
      });

      // Update tracks if they change during playback
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (e, data) => {
        setAudioTracks(data.audioTracks);
      });
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = initPlayer;
    }

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  // 3. Save Progress (Every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.currentTime === 0) return;
      
      const progressKey = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
      const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
      
      allProgress[progressKey] = {
        id: tmdbId,
        type: mediaType,
        last_updated: Date.now(),
        last_season_watched: season,
        last_episode_watched: episode,
        progress: {
          watched: videoRef.current.currentTime,
          duration: videoRef.current.duration
        }
      };
      localStorage.setItem('vidFastProgress', JSON.stringify(allProgress));
    }, 5000);

    return () => clearInterval(interval);
  }, [currentTime, tmdbId, season, episode]);

  // 4. Handlers
  const handleNextEpisode = () => {
    if (mediaType === 'tv') {
      navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${parseInt(episode) + 1}`);
      window.location.reload(); // Refresh to trigger new stream fetch
    }
  };

  const changeAudio = (index) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = index;
      setCurrentAudio(index);
    }
    setShowSubMenu(false);
  };

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => setUiVisible(false), 3000);
  };

  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Remove Loader: return black screen while fetching
  if (isFetching) return <div className="w-full h-screen bg-black" />;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden select-none" onMouseMove={resetTimer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        .imdb-box { border: 1px solid #B3B3B3; padding: 0px 4px; border-radius: 3px; font-size: 11px; font-weight: 900; }
        input[type="range"] { -webkit-appearance: none; background: rgba(179,179,179,0.2); height: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
      `}</style>

      <video ref={videoRef} className="w-full h-full object-contain" 
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white">X-Ray</button>
            <div className="imdb-box">IMDb</div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-normal text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-xs text-white/70 mt-1">S{season}, Ep. {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => setShowSubMenu(!showSubMenu)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/></svg>
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center justify-center space-x-16">
          <button onClick={() => videoRef.current.currentTime -= 10} className="text-white relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
          <button onClick={togglePlay} className="text-white">{isPlaying ? <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}</button>
          <button onClick={() => videoRef.current.currentTime += 10} className="text-white relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
        </div>

        {/* SCRUBBER */}
        <div className="w-full">
          <input type="range" min="0" max="100" value={(currentTime / (duration || 1)) * 100} onChange={handleSeek} className="w-full cursor-pointer mb-2" />
          <div className="flex justify-between text-xs font-medium">
            <div className="text-white/90">{formatTime(currentTime)} / {formatTime(duration)}</div>
            {mediaType === 'tv' && <button onClick={handleNextEpisode} className="flex items-center text-white/90 hover:text-white group">Next Episode <svg className="w-4 h-4 ml-2 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>}
          </div>
        </div>
      </div>

      {/* DYNAMIC AUDIO MENU */}
      {showSubMenu && (
        <div className="absolute top-20 right-24 w-[250px] bg-[#19212b]/95 border border-white/10 p-6 z-50 rounded shadow-xl">
          <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Audio Tracks</h3>
          <ul className="space-y-3 text-sm">
            {audioTracks.length > 0 ? audioTracks.map((track, i) => (
              <li key={i} onClick={() => changeAudio(i)} className={`cursor-pointer ${currentAudio === i ? 'text-sky-400 font-bold' : 'text-white'}`}>
                {track.name || `Track ${i + 1}`} {track.lang && `(${track.lang})`}
              </li>
            )) : <li className="text-white opacity-50 italic">No alternative tracks</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
