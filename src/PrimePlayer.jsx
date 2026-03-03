// File: src/PrimePlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Hls from 'hls.js';

const TMDB_KEY = "cb1dc311039e6ae85db0aa200345cbc5";

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const fetchUrl = `/api/get-stream?type=${mediaType}&tmdbId=${tmdbId}&s=${season}&e=${episode}`;
        const [sRes, cRes] = await Promise.all([
          fetch(fetchUrl),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
        ]);
        
        if (!isMounted) return;

        const contentType = sRes.headers.get("content-type");
        
        // IF THE BACKEND SENT AN M3U8 MANIFEST DIRECTLY
        if (contentType && contentType.includes("mpegurl")) {
          const blob = await sRes.blob();
          setStreamUrl(URL.createObjectURL(blob));
          const cData = await cRes.json();
          setCast(cData.cast?.slice(0, 15) || []);
          setIsFetching(false);
        } else {
          // IF THE BACKEND SENT A JSON SUCCESS OBJECT
          const sData = await sRes.json();
          if (sData.success) {
            setStreamUrl(sData.streamUrl);
            const cData = await cRes.json();
            setCast(cData.cast?.slice(0, 15) || []);
            setIsFetching(false);
          } else if (sData.isDownloading) {
            setTimeout(fetchData, 3500); // Poll until cached
          } else {
            throw new Error(sData.error || "No Link Found");
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setIsFetching(false);
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    // Use HLS.js for both types to ensure proxy handling
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(e => console.log(e)));
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari support
      video.src = streamUrl;
      video.onloadedmetadata = () => video.play().catch(e => console.log(e));
    }

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  if (isFetching) return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1] mb-4" />
      <p className="text-[#00A8E1] text-xs font-bold tracking-widest uppercase">Initializing Hidden Pipeline...</p>
    </div>
  );

  if (error) return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
      <p className="text-red-500 font-bold mb-4">{error}</p>
      <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#00A8E1] text-white rounded">Go Back</button>
    </div>
  );

  return (
    <div className="relative w-full h-screen bg-black">
      <video ref={videoRef} className="w-full h-full object-contain" crossOrigin="anonymous" playsInline />
      {/* Re-add your Prime UI overlays here */}
    </div>
  );
};

export default PrimePlayer;
