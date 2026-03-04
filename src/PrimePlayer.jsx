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
  const isSeeking = useRef(false);

  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [downloadMsg, setDownloadMsg] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [showXRay, setShowXRay] = useState(false);

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
          setCast(cData.cast?.slice(0, 12) || []);
          setIsFetching(false);
        } else if (sData.isDownloading) {
          setDownloadMsg(sData.message);
          setTimeout(fetchData, 3000);
        } else {
          setError(sData.error);
          setIsFetching(false);
        }
      } catch { if (isMounted) setIsFetching(false); }
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
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = () => video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    };
  }, [streamUrl]);

  const onSeekInput = (e) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    setCurrentTime((val / 100) * duration);
  };

  const onSeekEnd = (e) => {
    isSeeking.current = false;
    videoRef.current.currentTime = (parseFloat(e.target.value) / 100) * duration;
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isFetching) return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1] mb-4" />
      {downloadMsg && <p className="text-[#B3B3B3] text-sm font-bold uppercase tracking-widest">{downloadMsg}</p>}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden select-none" onMouseMove={() => setUiVisible(true)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        .prime-font { font-family: 'Inter', sans-serif; }
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        .svg-icon { width: 24px; height: 24px; fill: none; stroke: #B3B3B3; stroke-width: 1.8; cursor: pointer; transition: stroke 0.2s; }
        .svg-icon:hover { stroke: white; }
        input[type="range"] { -webkit-appearance: none; background: rgba(179, 179, 179, 0.2); height: 2px; outline: none; width: 100%; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
      `}</style>

      <video 
        ref={videoRef} 
        className="w-full h-full object-contain" 
        onTimeUpdate={() => !isSeeking.current && setProgress((videoRef.current.currentTime / duration) * 100) || setCurrentTime(videoRef.current.currentTime)} 
        onLoadedMetadata={() => setDuration(videoRef.current.duration)}
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
        onClick={() => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause()} 
      />

      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-500 prime-font ${uiVisible || !isPlaying ? 'opacity-100' : 'opacity-0 cursor-none'}`}>
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex items-center space-x-5 text-sm font-medium">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white transition">X-Ray</button>
            <div className="border border-[#B3B3B3] px-1 py-0 rounded text-[11px] font-black">IMDb</div>
          </div>
          <div className="text-center">
            <h1 className="text-[30px] font-medium tracking-wide text-white">{title}</h1>
            {mediaType === 'tv' && <p className="text-xs text-white/70">Season {season}, Ep. {episode}</p>}
          </div>
          <div className="flex items-center space-x-6">
            <svg onClick={() => navigate(-1)} className="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-16 pointer-events-auto">
          <button onClick={() => videoRef.current.currentTime -= 10} className="relative text-white hover:scale-110 transition"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
          <button onClick={() => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause()} className="text-white hover:scale-105 transition">{isPlaying ? <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>}</button>
          <button onClick={() => videoRef.current.currentTime += 10} className="relative text-white hover:scale-110 transition"><svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span></button>
        </div>

        <div className="w-full pointer-events-auto">
          <div className="relative w-full mb-3 flex items-center">
            <input type="range" min="0" max="100" step="0.01" value={progress} onMouseDown={() => isSeeking.current = true} onChange={onSeekInput} onMouseUp={onSeekEnd} className="z-10 cursor-pointer" />
            <div className="absolute left-0 h-[2px] bg-[#B3B3B3] pointer-events-none" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs font-medium text-white/90">{formatTime(currentTime)} / {formatTime(duration)}</div>
        </div>
      </div>

      {showXRay && (
        <div className="absolute top-20 left-8 w-[340px] bg-[rgba(25,33,43,0.98)] border border-white/10 p-5 z-50 rounded shadow-2xl prime-font">
          <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-3">In Scene</h3>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
            {cast.map(actor => (
              <div key={actor.id} className="flex items-center gap-4 group transition-colors p-1 rounded hover:bg-white/5">
                <img src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} className="w-12 h-14 object-cover rounded border border-white/10" alt="" />
                <div className="overflow-hidden"><p className="text-white text-sm font-medium truncate">{actor.name}</p><p className="text-[#B3B3B3] text-xs truncate">{actor.character}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimePlayer;
