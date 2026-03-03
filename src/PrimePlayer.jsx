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

  // 1. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
        ]);
        const sData = await sRes.json();
        const cData = await cRes.json();
        if (sData.success) {
          setStreamUrl(sData.streamUrl);
          setCast(cData.cast?.slice(0, 10) || []);
          setIsFetching(false);
        }
      } catch (err) { setIsFetching(false); }
    };
    fetchData();
  }, [tmdbId, mediaType, season, episode]);

  // 2. Save Progress to LocalStorage
  useEffect(() => {
    if (!videoRef.current || isFetching) return;
    const save = () => {
      const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
      allProgress[`${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`] = {
        id: tmdbId, type: mediaType, last_updated: Date.now(),
        progress: { watched: videoRef.current.currentTime, duration: videoRef.current.duration },
        last_season_watched: season, last_episode_watched: episode
      };
      localStorage.setItem('vidFastProgress', JSON.stringify(allProgress));
    };
    const interval = setInterval(save, 5000);
    return () => { save(); clearInterval(interval); };
  }, [tmdbId, mediaType, season, episode, isFetching]);

  // 3. HLS Setup with Audio/Sub Detection
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    const resumeTime = JSON.parse(localStorage.getItem('vidFastProgress'))?.[`${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`]?.progress?.watched || 0;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setAudioTracks(hls.audioTracks); // Populates the menu
        setSubtitleTracks(hls.subtitleTracks);
        video.currentTime = resumeTime;
        video.play().catch(() => {});
      });
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = () => { video.currentTime = resumeTime; video.play(); };
    }
    return () => hlsRef.current?.destroy();
  }, [streamUrl]);

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => setUiVisible(false), 3000);
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isFetching) return <div className="w-full h-screen bg-black flex items-center justify-center"><Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" /></div>;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden" onMouseMove={resetTimer}>
      <style>{`
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
        input[type="range"] { -webkit-appearance: none; background: rgba(179, 179, 179, 0.2); height: 2px; outline: none; }
      `}</style>

      <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} onLoadedMetadata={(e) => setDuration(e.target.duration)} />

      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        <div className="flex justify-between items-start">
          <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white font-medium">X-Ray</button>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-light tracking-wide text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-sm font-normal text-white/70 mt-2">Season {season}, Episode {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => setShowSubMenu(!showSubMenu)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/></svg>
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-16">
          <button onClick={() => videoRef.current.currentTime -= 10} className="relative text-white"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
          <button onClick={() => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause()} className="text-white">{isPlaying ? <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}</button>
          <button onClick={() => videoRef.current.currentTime += 10} className="relative text-white"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
        </div>

        <div className="w-full">
          <input type="range" min="0" max="100" value={(currentTime / (duration || 1)) * 100} onChange={(e) => videoRef.current.currentTime = (e.target.value / 100) * duration} className="w-full cursor-pointer" />
          <div className="flex justify-between items-center text-xs font-medium mt-2" style={{ color: '#B3B3B3' }}>
            <div>{formatTime(currentTime)} / {formatTime(duration)}</div>
            {mediaType === 'tv' && (
              <button onClick={() => { navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${parseInt(episode) + 1}`); window.location.reload(); }} className="flex items-center hover:text-white transition group">Next Episode <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
            )}
          </div>
        </div>
      </div>

      {showSubMenu && (
        <div className="absolute top-24 right-24 w-[400px] bg-[#19212b]/98 border border-white/10 p-6 z-50 rounded shadow-2xl">
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div><h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Subtitles</h3><ul className="space-y-2"><li onClick={() => { hlsRef.current.subtitleTrack = -1; setCurrentSub(-1); }} className={`cursor-pointer ${currentSub === -1 ? 'text-sky-400 font-bold' : ''}`}>Off</li>{subtitleTracks.map((t, i) => <li key={i} onClick={() => { hlsRef.current.subtitleTrack = i; setCurrentSub(i); }} className={`cursor-pointer ${currentSub === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang}</li>)}</ul></div>
            <div><h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Audio</h3><ul className="space-y-2">{audioTracks.map((t, i) => <li key={i} onClick={() => { hlsRef.current.audioTrack = i; setCurrentAudio(i); }} className={`cursor-pointer ${currentAudio === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang}</li>)}</ul></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
