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
  const isSeeking = useRef(false);

  // -- Engine & Data State --
  const [streamUrl, setStreamUrl] = useState(null);
  const [cast, setCast] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState(""); // NEW STATE

  // -- Track & UI State --
  const [audioTracks, setAudioTracks] = useState([]);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [currentSub, setCurrentSub] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showSetMenu, setShowSetMenu] = useState(false);
  const [showXRay, setShowXRay] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  // 1. Fetch Stream & Cast (CLIENT-SIDE EXECUTION BYPASS)
  useEffect(() => {
    let isMounted = true;
    
    // REPLACE WITH YOUR ALLEDBRID API KEY
    const AD_API_KEY = "PASTE_YOUR_ALLDEBRID_KEY_HERE"; 
    const AD_AGENT = "primevideos";

    const fetchData = async () => {
      try {
        // Fetch Cast Data (Unchanged)
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`)
            .then(res => res.json())
            .then(cData => { if (isMounted) setCast(cData.cast?.slice(0, 15) || []); });

        // Step A: Get IMDb ID
        setDownloadProgressMsg("Resolving Movie ID...");
        const idRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
        const idData = await idRes.json();
        const imdbId = idData.imdb_id;
        if (!imdbId) throw new Error("IMDb ID not found");

        // Step B: Scrape Torrentio DIRECTLY from the user's browser
        setDownloadProgressMsg("Scraping Torrentio...");
        const tUrl = mediaType === 'tv' 
            ? `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json` 
            : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        
        const tRes = await fetch(tUrl);
        const tData = await tRes.json();
        const streams = tData.streams || [];
        
        // Strict MP4 filter to ensure the browser doesn't get a black MKV screen
        let bestStream = streams.find(st => st.title?.toLowerCase().includes('mp4') && !st.title?.toLowerCase().includes('hevc'));
        if (!bestStream) bestStream = streams[0]; // Fallback if no MP4 found
        if (!bestStream) throw new Error("No streams found on Torrentio.");
        
        const hash = bestStream.infoHash.toLowerCase();
        const magnet = `magnet:?xt=urn:btih:${hash}`;

        // Step C: Send Magnet to AllDebrid
        setDownloadProgressMsg("Bypassing servers via AllDebrid...");
        const addUrl = `https://api.alldebrid.com/v4/magnet/upload?agent=${AD_AGENT}&apikey=${AD_API_KEY}&magnets[]=${encodeURIComponent(magnet)}`;
        const addRes = await fetch(addUrl);
        const addData = await addRes.json();
        
        if (addData.status !== 'success') throw new Error("AllDebrid rejected magnet. Check API Key.");
        const magnetId = addData.data.magnets[0].id;

        // Step D: Check AllDebrid Status
        const statusUrl = `https://api.alldebrid.com/v4/magnet/status?agent=${AD_AGENT}&apikey=${AD_API_KEY}&id=${magnetId}`;
        const statusRes = await fetch(statusUrl);
        const statusData = await statusRes.json();
        const magnetInfo = statusData.data.magnets;

        // statusCode 4 = Ready to play
        if (magnetInfo.statusCode !== 4) {
            setDownloadProgressMsg("AllDebrid caching to their server (Retrying)...");
            setTimeout(fetchData, 4000); // Check again in 4 seconds
            return;
        }

        if (!magnetInfo.links || magnetInfo.links.length === 0) throw new Error("No video files found in torrent.");
        const fileLink = magnetInfo.links[0].link; // Grab the main video file

        // Step E: Unlock the final stream link
        setDownloadProgressMsg("Generating final stream URL...");
        const unlockUrl = `https://api.alldebrid.com/v4/link/unlock?agent=${AD_AGENT}&apikey=${AD_API_KEY}&link=${encodeURIComponent(fileLink)}`;
        const unlockRes = await fetch(unlockUrl);
        const unlockData = await unlockRes.json();
        
        if (unlockData.status !== 'success') throw new Error("Failed to unlock stream link.");

        // Stream is ready! Pass it to the video player and remove the loading spinner
        if (isMounted) {
            setStreamUrl(unlockData.data.link);
            setIsFetching(false);
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

  // 3. HLS Setup & Teardown
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const resumePlayback = () => {
      const saved = JSON.parse(localStorage.getItem('vidFastProgress'))?.[`${mediaType === 'tv' ? 't' : 'm'}${tmdbId}`];
      if (saved && saved.progress?.watched && saved.last_season_watched === season && saved.last_episode_watched === episode) {
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

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    };
  }, [streamUrl, tmdbId, mediaType, season, episode]);

  // 4. Video Event Listeners (Smooth Slider)
  const handleTimeUpdate = () => {
    if (!isSeeking.current && videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        setProgress((videoRef.current.currentTime / (duration || 1)) * 100);
    }
  };

  const handleLoadedMetadata = () => {
      if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const onSeekStart = () => { isSeeking.current = true; };
  const onSeekInput = (e) => {
      const val = parseFloat(e.target.value);
      setProgress(val);
      setCurrentTime((val / 100) * duration);
  };
  const onSeekEnd = (e) => {
      isSeeking.current = false;
      const val = parseFloat(e.target.value);
      if (videoRef.current) videoRef.current.currentTime = (val / 100) * duration;
  };

  // 5. Action Handlers
  const togglePlay = () => videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  const skip = (val) => { if (videoRef.current) videoRef.current.currentTime += val; };
  const toggleMute = () => { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); };
  
  const toggleFullScreen = () => {
      if (!document.fullscreenElement) containerRef.current.requestFullscreen();
      else document.exitFullscreen();
  };

  const handlePiP = async () => {
      try {
          if (videoRef.current !== document.pictureInPictureElement) await videoRef.current.requestPictureInPicture();
          else await document.exitPictureInPicture();
      } catch (error) { console.error("PiP failed", error); }
  };

  const handleClose = () => {
      if (hlsRef.current) hlsRef.current.destroy();
      navigate(-1);
  };

  const formatTime = (secs) => {
      if (isNaN(secs)) return "0:00:00";
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleNextEpisode = () => {
    if (mediaType === 'tv') {
      navigate(`/watch/tv/${tmdbId}?season=${season}&episode=${parseInt(episode) + 1}`, { replace: true });
      window.location.reload();
    }
  };

  const changeAudio = (index) => { if (hlsRef.current) { hlsRef.current.audioTrack = index; setCurrentAudio(index); }};
  const changeSubtitle = (index) => { if (hlsRef.current) { hlsRef.current.subtitleTrack = index; setCurrentSub(index); }};

  const resetTimer = () => {
    setUiVisible(true);
    clearTimeout(hideTimeout.current);
    if (isPlaying) hideTimeout.current = setTimeout(() => {
        setUiVisible(false);
        setShowSubMenu(false);
        setShowSetMenu(false);
    }, 3500);
  };

  // --- RENDERS ---
  if (isFetching) return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
          <Loader2 className="w-14 h-14 animate-spin text-[#00A8E1] mb-4" />
          {/* Displays the "Downloading to server: 45%" message */}
          {downloadProgressMsg && <div className="text-[#B3B3B3] text-sm font-bold tracking-widest uppercase">{downloadProgressMsg}</div>}
      </div>
  );
  if (error) return <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white"><p className="text-xl mb-4 font-bold text-red-500">{error}</p><button onClick={handleClose} className="px-6 py-2 bg-[#00A8E1] rounded">Go Back</button></div>;

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden select-none" onMouseMove={resetTimer} onClick={resetTimer}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .prime-font { font-family: 'Inter', sans-serif; }
        .v-gradient { background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%); }
        .svg-icon { width: 24px; height: 24px; fill: none; stroke: #B3B3B3; stroke-width: 1.8; cursor: pointer; transition: stroke 0.2s; }
        .svg-icon:hover { stroke: white; }
        .svg-icon.fill-icon { fill: #B3B3B3; stroke: none; }
        .svg-icon.fill-icon:hover { fill: white; }
        .center-action { color: white; background: none; border: none; cursor: pointer; transition: transform 0.2s; }
        .center-action:hover { transform: scale(1.1); }
        input[type="range"] { -webkit-appearance: none; background: rgba(179, 179, 179, 0.2); height: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; transition: transform 0.1s; }
        input[type="range"]:hover::-webkit-slider-thumb { transform: scale(1.3); }
        .imdb-box { border: 1px solid #B3B3B3; padding: 0px 4px; border-radius: 3px; font-size: 11px; font-weight: 900; line-height: 1.2; color: #B3B3B3; }
        .menu-panel { background: rgba(25, 33, 43, 0.98); border: 1px solid rgba(255,255,255,0.1); }
      `}</style>

      {/* VIDEO */}
      <video 
        ref={videoRef} 
        className="w-full h-full object-contain bg-black" 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onClick={togglePlay} 
        playsInline
      />

      {/* UI OVERLAY */}
      <div className={`absolute inset-0 flex flex-col justify-between p-8 v-gradient z-10 transition-opacity duration-300 prime-font ${uiVisible || !isPlaying ? 'opacity-100' : 'opacity-0 cursor-none pointer-events-none'}`}>
        
        {/* Top Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Left: X-Ray & IMDb */}
          <div className="flex items-center space-x-5 text-sm font-medium text-[#B3B3B3]">
            <button onClick={() => setShowXRay(!showXRay)} className="hover:text-white transition">X-Ray</button>
            <div className="imdb-box">IMDb</div>
            <button onClick={() => setShowXRay(!showXRay)} className="flex items-center hover:text-white transition">
              All <svg className="w-3 h-3 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          
          {/* Center: Title */}
          <div className="text-center mt-[-4px]">
            <h1 className="text-[26px] md:text-[30px] font-medium tracking-wide text-white drop-shadow-md">{title}</h1>
            {mediaType === 'tv' && <p className="text-sm font-normal text-white/70 mt-1">Season {season}, Ep. {episode}</p>}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center space-x-6">
            <svg onClick={(e) => { e.stopPropagation(); setShowSubMenu(!showSubMenu); setShowSetMenu(false); }} className="svg-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="6" y1="12" x2="15" y2="12" strokeWidth="2"/><line x1="6" y1="15" x2="10" y2="15" strokeWidth="2"/></svg>
            <svg onClick={(e) => { e.stopPropagation(); setShowSetMenu(!showSetMenu); setShowSubMenu(false); }} className="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <svg onClick={toggleMute} className="svg-icon" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/>{!isMuted && <><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>}</svg>
            <svg onClick={handlePiP} className="svg-icon fill-icon" style={{width: '28px'}} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="14" y="12" width="4" height="4" /></svg>
            <svg onClick={toggleFullScreen} className="svg-icon" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            <span className="text-gray-700 h-6">|</span>
            <svg onClick={handleClose} className="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/><line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/></svg>
          </div>
        </div>

        {/* Center Playback Controls */}
        <div className="flex items-center justify-center space-x-16 pointer-events-auto">
          <button onClick={() => skip(-10)} className="center-action relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>
          
          <button onClick={togglePlay} className="center-action">
            {isPlaying ? (
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>
            )}
          </button>

          <button onClick={() => skip(10)} className="center-action relative">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold mt-1.5">10</span>
          </button>
        </div>

        {/* Bottom Scrubber */}
        <div className="w-full pointer-events-auto">
          <div className="relative w-full mb-3 flex items-center">
            <input 
              type="range" 
              min="0" max="100" step="0.01"
              value={progress}
              onMouseDown={onSeekStart}
              onTouchStart={onSeekStart}
              onChange={onSeekInput}
              onMouseUp={onSeekEnd}
              onTouchEnd={onSeekEnd}
              className="w-full cursor-pointer z-10" 
            />
            <div className="absolute left-0 h-[2px] bg-[#B3B3B3] pointer-events-none" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center text-xs font-medium">
            <div className="text-white/90">
              <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
            </div>
            {mediaType === 'tv' && (
              <button onClick={handleNextEpisode} className="flex items-center text-white/90 hover:text-white transition group">
                Next Episode
                <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* --- HIDDEN PANELS --- */}
      
      {showSubMenu && (
        <div className="absolute top-20 right-24 w-[400px] menu-panel p-6 z-50 rounded shadow-xl pointer-events-auto prime-font text-[#B3B3B3]">
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
                <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Subtitles</h3>
                <ul className="space-y-3 max-h-48 overflow-y-auto">
                    <li onClick={() => changeSubtitle(-1)} className={`cursor-pointer hover:text-white ${currentSub === -1 ? 'text-sky-400 font-bold' : ''}`}>Off</li>
                    {subtitleTracks.map((t, i) => (
                        <li key={i} onClick={() => changeSubtitle(i)} className={`cursor-pointer hover:text-white ${currentSub === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang || `Track ${i+1}`}</li>
                    ))}
                </ul>
            </div>
            <div>
                <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Audio</h3>
                <ul className="space-y-3 max-h-48 overflow-y-auto">
                    {audioTracks.map((t, i) => (
                        <li key={i} onClick={() => changeAudio(i)} className={`cursor-pointer hover:text-white ${currentAudio === i ? 'text-sky-400 font-bold' : ''}`}>{t.name || t.lang || `Track ${i+1}`}</li>
                    ))}
                    {audioTracks.length === 0 && <li className="text-white">Default English</li>}
                </ul>
            </div>
          </div>
        </div>
      )}

      {showSetMenu && (
        <div className="absolute top-20 right-24 w-[200px] menu-panel p-6 z-50 rounded shadow-xl pointer-events-auto prime-font text-[#B3B3B3]">
           <h3 className="text-gray-500 uppercase text-[10px] font-bold mb-4 tracking-widest">Video Quality</h3>
           <ul className="space-y-3 text-sm">
              <li className="cursor-pointer text-sky-400 font-bold">Auto (Recommended)</li>
              <li className="cursor-pointer hover:text-white">Good (1080p)</li>
              <li className="cursor-pointer hover:text-white">Data Saver (720p)</li>
           </ul>
        </div>
      )}

      {showXRay && (
        <div className="absolute top-20 left-8 w-[340px] menu-panel p-5 z-50 rounded shadow-2xl pointer-events-auto prime-font">
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
             <h3 className="text-white font-bold tracking-wide">In Scene</h3>
             <svg onClick={() => setShowXRay(false)} className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide pr-2">
            {cast.length > 0 ? cast.map((actor) => (
               <div key={actor.id} className="flex items-center gap-4 group cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <div className="w-12 h-14 bg-gray-800 rounded flex-shrink-0 overflow-hidden border border-gray-700">
                     {actor.profile_path ? (
                        <img src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt={actor.name} />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 uppercase font-bold">{actor.name.charAt(0)}</div>
                     )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                     <span className="text-white text-sm font-medium truncate">{actor.name}</span>
                     <span className="text-[#B3B3B3] text-xs truncate">{actor.character}</span>
                  </div>
               </div>
            )) : (
               <div className="text-sm text-gray-500 italic">No actor data available.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default PrimePlayer;
