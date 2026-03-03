import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

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
  const formatTime = (secs) => `${Math.floor(secs/3600)}:${Math.floor((secs%3600)/60).toString().padStart(2,'0')}:${Math.floor(secs%60).toString().padStart(2,'0')}`;
  
  const handleNextEpisode = () => {
    if (mediaType === 'tv') {
      navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${parseInt(episode) + 1}`);
      window.location.reload(); // Refresh to trigger new stream fetch
    }
  };

  const changeAudio = (index) => {
    if (hlsRef.current) { hlsRef.current.audioTrack = index; setCurrentAudio(index); }
  };

  const changeSubtitle = (index) => {
    if (hlsRef.current) { hlsRef.current.subtitleTrack = index; setCurrentSub(index); }
  };

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => setUiVisible(false), 3000);
  };

  if (isFetching) return <div className="w-full h-screen bg-black flex items-center justify-center"><Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" /></div>;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden select-none" onMouseMove={resetTimer} onClick={resetTimer}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .prime-font { font-family: 'Inter', sans-serif; }
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        .imdb-box { border: 1px solid #B3B3B3; padding: 0px 4px; border-radius: 3px; font-size: 11px; font-weight: 900; line-height: 1.2; }
        input[type="range"] { -webkit-appearance: none; background: rgba(179, 179, 179, 0.2); height: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
      `}</style>

      <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} onLoadedMetadata={(e) => setDuration(e.target.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onClick={togglePlay} />

      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 prime-font ${uiVisible ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white transition">X-Ray</button>
            <div className="imdb-box">IMDb</div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-normal tracking-wide text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-xs font-normal text-white/70 mt-1">Season {season}, Ep. {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => setShowSubMenu(!showSubMenu)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/></svg>
            <svg onClick={toggleMute} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M11 5L6 9H2v6h4l5 4V5z"/>{!isMuted && <><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>}</svg>
            <svg onClick={toggleFullScreen} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-16">
          <button onClick={() => skip(-10)} className="text-white hover:scale-110 transition relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
          <button onClick={togglePlay} className="text-white hover:scale-105 transition">{isPlaying ? <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}</button>
          <button onClick={() => skip(10)} className="text-white hover:scale-110 transition relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
        </div>

        <div className="w-full">
          <input type="range" min="0" max="100" value={(currentTime / (duration || 1)) * 100} onChange={(e) => videoRef.current.currentTime = (e.target.value / 100) * duration} className="w-full cursor-pointer z-10" />
          <div className="flex justify-between items-center text-xs font-medium mt-2">
            <div className="text-white/90">{formatTime(currentTime)} / {formatTime(duration)}</div>
            {mediaType === 'tv' && <button onClick={handleNextEpisode} className="flex items-center text-white/90 hover:text-white transition group">Next Episode <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>}
          </div>
        </div>
      </div>

      {showSubMenu && (
        <div className="absolute top-20 right-24 w-[400px] bg-[#19212b]/95 border border-white/10 p-6 z-50 rounded shadow-xl">
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div><h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Subtitles</h3><ul className="space-y-2"><li onClick={() => changeSubtitle(-1)} className={`cursor-pointer ${currentSub === -1 ? 'text-sky-400 font-bold' : ''}`}>Off</li>{subtitleTracks.map((t, i) => <li key={i} onClick={() => changeSubtitle(i)} className={`cursor-pointer ${currentSub === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang}</li>)}</ul></div>
            <div><h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Audio</h3><ul className="space-y-2">{audioTracks.map((t, i) => <li key={i} onClick={() => changeAudio(i)} className={`cursor-pointer ${currentAudio === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang}</li>)}</ul></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
