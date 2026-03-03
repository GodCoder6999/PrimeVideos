// File: src/PrimePlayer.jsx
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
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const fetchUrl = `/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`;
        const [sRes, cRes] = await Promise.all([
          fetch(fetchUrl),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
        ]);
        
        // Handle manifest text or JSON error
        const contentType = sRes.headers.get("content-type");
        if (contentType && contentType.includes("mpegurl")) {
          const blob = await sRes.blob();
          if (isMounted) {
            setStreamUrl(URL.createObjectURL(blob));
            const cData = await cRes.json();
            setCast(cData.cast?.slice(0, 15) || []);
            setIsFetching(false);
          }
        } else {
          const sData = await sRes.json();
          if (sData.success) {
            setStreamUrl(sData.streamUrl);
            const cData = await cRes.json();
            setCast(cData.cast?.slice(0, 15) || []);
            setIsFetching(false);
          } else if (sData.isDownloading) {
            setTimeout(fetchData, 3000);
          } else {
            setError(sData.error || "Stream unavailable");
            setIsFetching(false);
          }
        }
      } catch (err) {
        if (isMounted) setIsFetching(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ 
        enableWorker: true, 
        xhrSetup: (xhr) => { xhr.withCredentials = false; } 
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    } else {
      video.src = streamUrl;
      video.onloadedmetadata = () => video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [streamUrl]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
        setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();

  if (isFetching) return <div className="w-full h-screen bg-black flex items-center justify-center"><Loader2 className="w-14 h-14 animate-spin text-[#00A8E1]" /></div>;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden select-none">
      <video 
        ref={videoRef} 
        className="w-full h-full object-contain" 
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onClick={togglePlay}
      />
      {/* UI overlays from original PrimePlayer.jsx remain here */}
      <div className={`absolute inset-0 flex flex-col justify-between p-8 bg-gradient-to-b from-black/80 via-transparent to-black/80 transition-opacity ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
         <h1 className="text-2xl text-white font-medium">{title}</h1>
         <div className="w-full h-1 bg-gray-600">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }}></div>
         </div>
      </div>
    </div>
  );
};

export default PrimePlayer;
