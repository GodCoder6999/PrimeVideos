import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode, startTime = 0 }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimeout = useRef(null);

  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isReady, setIsReady] = useState(false); // New: Tracks if video is ready to play

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showXRay, setShowXRay] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  // Language & Track States
  const [audioTracks, setAudioTracks] = useState([]);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [currentSubs, setCurrentSubs] = useState(-1);

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

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setAudioTracks(hls.audioTracks);
        setSubtitleTracks(hls.subtitleTracks);
        video.currentTime = startTime; // Resume logic
        setIsReady(true);
        video.play().catch(() => {});
      });
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = () => {
        video.currentTime = startTime; // Resume logic
        setIsReady(true);
        video.play().catch(() => {});
      };
    }
    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  const saveProgress = (time) => {
    const key = `${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`;
    const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
    allProgress[key] = {
      id: tmdbId,
      type: mediaType,
      last_updated: Date.now(),
      progress: { watched: time, duration: videoRef.current?.duration || 0 },
      last_season_watched: season,
      last_episode_watched: episode
    };
    localStorage.setItem('vidFastProgress', JSON.stringify(allProgress));
  };

  const handleNextEpisode = () => {
    if (mediaType === 'tv') {
      navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${episode + 1}`);
      window.location.reload(); // Refresh to trigger new stream fetch
    }
  };

  const togglePlay = () => {
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isFetching || !isReady) return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1] mb-4" />
      <p className="text-gray-400 animate-pulse text-sm tracking-widest uppercase">Initializing Secure Stream...</p>
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black text-[#B3B3B3] font-sans overflow-hidden select-none" onMouseMove={() => { setUiVisible(true); clearTimeout(hideTimeout.current); hideTimeout.current = setTimeout(() => isPlaying && setUiVisible(false), 3000); }}>
      <video ref={videoRef} className="w-full h-full object-contain" onTimeUpdate={(e) => { setCurrentTime(e.target.currentTime); if (Math.floor(e.target.currentTime) % 5 === 0) saveProgress(e.target.currentTime); }} onLoadedMetadata={(e) => setDuration(e.target.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onClick={togglePlay} />

      <div className={`absolute inset-0 flex flex-col justify-between p-8 bg-gradient-to-b from-black/85 via-transparent to-black/85 transition-opacity duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white transition">X-Ray</button>
            <div className="border border-[#B3B3B3] px-1 rounded text-[11px] font-black">IMDb</div>
            <button onClick={() => setShowXRay(!showXRay)} className="flex items-center hover:text-white transition">All <svg className={`w-3 h-3 ml-2 transition-transform ${showXRay ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-normal text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-xs text-white/70 mt-1">S{season}, Ep. {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => setShowSubMenu(!showSubMenu)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/></svg>
            <svg onClick={() => setShowQualityMenu(!showQualityMenu)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <svg onClick={() => navigate(-1)} className="w-6 h-6 stroke-current hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-16 pointer-events-none">
          <button onClick={() => { videoRef.current.currentTime -= 10; }} className="text-white pointer-events-auto relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
          <button onClick={togglePlay} className="text-white pointer-events-auto">{isPlaying ? <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}</button>
          <button onClick={() => { videoRef.current.currentTime += 10; }} className="text-white pointer-events-auto relative"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
        </div>

        <div className="w-full">
          <input type="range" min="0" max="100" value={(currentTime / (duration || 1)) * 100} onChange={(e) => videoRef.current.currentTime = (e.target.value / 100) * duration} className="w-full cursor-pointer mb-2" />
          <div className="flex justify-between text-xs font-medium text-white/90">
            <div>{formatTime(currentTime)} / {formatTime(duration)}</div>
            {mediaType === 'tv' && <button onClick={handleNextEpisode} className="flex items-center hover:text-white group">Next Episode <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>}
          </div>
        </div>
      </div>

      {showSubMenu && (
        <div className="absolute top-20 right-24 w-[400px] bg-[#19212b]/98 border border-white/10 p-6 z-50 rounded shadow-xl">
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div><h3 className="text-gray-500 text-[10px] font-bold mb-4 uppercase">Subtitles</h3><ul className="space-y-3"><li onClick={() => { hlsRef.current.subtitleTrack = -1; setShowSubMenu(false); }} className="cursor-pointer hover:text-white">Off</li>{subtitleTracks.map((t, i) => <li key={i} onClick={() => { hlsRef.current.subtitleTrack = i; setShowSubMenu(false); }} className="cursor-pointer hover:text-white">{t.name || t.lang}</li>)}</ul></div>
            <div><h3 className="text-gray-500 text-[10px] font-bold mb-4 uppercase">Audio</h3><ul className="space-y-3">{audioTracks.map((t, i) => <li key={i} onClick={() => { hlsRef.current.audioTrack = i; setShowSubMenu(false); }} className="cursor-pointer hover:text-white">{t.name || t.lang}</li>)}</ul></div>
          </div>
        </div>
      )}

      {showXRay && (
        <div className="absolute top-20 left-8 w-72 bg-[#19212b]/98 border border-white/10 p-5 rounded z-30 max-h-[70vh] overflow-y-auto scrollbar-hide">
          <h2 className="text-xl font-bold text-white mb-6">X-Ray</h2>
          <div className="space-y-4">
            {cast.map(member => (
              <div key={member.id} className="flex items-center gap-4 group cursor-pointer hover:bg-white/5 p-1 rounded">
                <img src={`https://image.tmdb.org/t/p/w200${member.profile_path}`} className="w-12 h-12 bg-gray-800 rounded object-cover" alt="" />
                <div className="border-b border-white/5 pb-2 w-full"><span className="text-sm font-semibold text-white group-hover:text-sky-400">{member.name}</span><p className="text-xs text-gray-400">{member.character}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
