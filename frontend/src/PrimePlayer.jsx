import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

// SVG Icons (abridged for brevity, keeping the ones used)
const PlayIcon = ()=><svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = ()=><svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const FullscreenIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>;
const ExitFullscreenIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>;
const SettingsIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>;
const SubtitleIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1.5c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5V11zm7 0h-1.5v-.5h-2v3h2V13H18v1.5c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5V11z"/></svg>;
const VolumeUpIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const VolumeOffIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>;
const LoadingSpinner = ()=>(<svg width="48" height="48" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="31.4 31.4" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg>);
const BackIcon = ()=><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
const Forward10Icon = ()=><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="12" y="16" fill="#fff" fontSize="7px" textAnchor="middle" fontWeight="bold">10</text></svg>;
const Replay10Icon = ()=><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16" fill="#fff" fontSize="7px" textAnchor="middle" fontWeight="bold">10</text></svg>;
const CheckIcon = ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const PiPIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>;
const CloseIcon = ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;

// Helpers
const formatTime = (secs) => {
  if (isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function PrimePlayer({ 
  id, title, isMovie, season, episode, onClose, 
  tmdbId, providerId 
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  // Core state
  const [mode, setMode] = useState('loading'); // loading, custom, iframe, error
  const [iframeUrl, setIframeUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Video UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setBuffering] = useState(false);

  // Settings & Menus
  const [panel, setPanel] = useState(null); // 'settings', 'subtitles', 'audio', 'qualities'
  const [qualities, setQualities] = useState([]);
  const [selQuality, setSelQuality] = useState(0);

  // Subtitles & Audio (HLS specific)
  const [subs, setSubs] = useState([]);
  const [activeSubId, setActiveSubId] = useState(-1);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudioIdx, setActiveAudioIdx] = useState(0);

  // *** Multi-Language Stream states ***
  const [availableLangs, setAvailableLangs] = useState([]);
  const [selLang, setSelLang] = useState('Original');

  // Refs for logic
  const rawFilesRef = useRef([]);
  const allSourcesRef = useRef([]);
  const selQRef = useRef(0);
  const isDraggingRef = useRef(false);

  // ── Progress Tracking ────────────────────────────────────────────────────────
  const progressKey = `progress_${id}${!isMovie ? `_s${season}e${episode}` : ''}`;

  const saveProgress = useCallback((time, dur) => {
    if (time > 5 && dur > 10) {
      localStorage.setItem(progressKey, JSON.stringify({
        time,
        duration: dur,
        percentage: time / dur,
        timestamp: Date.now()
      }));
    }
  }, [progressKey]);

  const attemptResume = useCallback((vid) => {
    try {
      const saved = localStorage.getItem(progressKey);
      if (saved) {
        const { time, percentage } = JSON.parse(saved);
        if (percentage < 0.95 && time > 0) {
          vid.currentTime = time;
        }
      }
    } catch(e) {}
  }, [progressKey]);

  // ── Build quality menu + load first source ─────────────────────────────────
  const updateQualityMenu = useCallback((files, lang, autoLoad = true) => {
    const order = {'1080p':6,'720p':5,'480p':4,'360p':3,'Auto':2,'2160p':1,'4k':7};
    const seen = new Set(); const menu = [];
    
    // Filter the raw streams by the selected language
    const filteredFiles = files.filter(f => (f.language || 'Original') === lang);
    
    filteredFiles.forEach((f, i) => {
      const label = f.quality || 'Auto';
      const key = `${label}-${i}`;
      if (!seen.has(label)) {
        seen.add(label);
        menu.push({ label, value: i, url: f.url });
      } else {
        menu.push({ label: `${label} (${seen.size})`, value: i, url: f.url });
        seen.add(key);
      }
    });
    
    menu.sort((a,b) => (order[b.label.split(' ')[0].toLowerCase()]||0)-(order[a.label.split(' ')[0].toLowerCase()]||0));
    menu.forEach((m,i) => m.value=i);

    allSourcesRef.current = menu;
    setQualities(menu);
    if (menu.length > 0 && autoLoad) {
      setSelQuality(menu[0].value); selQRef.current=menu[0].value;
      loadSource(menu[0]);
    } else if (menu.length === 0 && autoLoad) {
      setMode('iframe');
    }
  }, []);

  const buildAndLoad = useCallback(files => {
    // Extract unique languages
    const langs = [...new Set(files.map(f => f.language || 'Original'))];
    setAvailableLangs(langs);
    
    // Auto-select Hindi/Multi if available, otherwise first language
    const initialLang = langs.find(l => l.includes('Hindi')) || langs[0];
    setSelLang(initialLang);
    
    updateQualityMenu(files, initialLang, true);
  }, [updateQualityMenu]);

  // ── Fetch Sources ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Fetch Subtitles (Convert to blob to bypass crossOrigin constraints)
      try {
        const subUrl = `https://vidsrc.pro/api/subtitles/${tmdbId}${!isMovie?`/${season}/${episode}`:''}`;
        const sRes = await fetch(subUrl);
        if(sRes.ok){
          const sData = await sRes.json();
          if(sData.subtitles) {
            const blobSubs = await Promise.all(sData.subtitles.map(async (s, i) => {
              try {
                const subFetch = await fetch(s.file);
                const text = await subFetch.text();
                const blob = new Blob([text], { type: 'text/vtt' });
                return { ...s, id: i, file: URL.createObjectURL(blob) };
              } catch (e) {
                return { ...s, id: i }; // fallback to original URL if blob fails
              }
            }));
            setSubs(blobSubs);
          }
        }
      } catch(e){}

      // 2. Fetch direct streams
      try {
        const epStr = !isMovie ? `&s=${season}&e=${episode}` : '';
        const res = await fetch(`/api/multi-stream?tmdbId=${tmdbId}&type=${isMovie?'movie':'tv'}${epStr}`);
        const data = await res.json();
        const streams = data.streams||[];

        if(streams.length>0){
          const files=[];
          streams.forEach(s=>{
            // Prioritize raw direct links, then proxies
            files.push({url:s.url, quality:s.quality||'Auto', language: s.language || 'Original'});
            files.push({url:`/api/proxy?url=${encodeURIComponent(s.url)}`, quality:(s.quality||'Auto')+' (Proxy)', language: s.language || 'Original'});
          });
          rawFilesRef.current = files;
          buildAndLoad(files);
          return;
        }
      } catch(e) { console.warn('Stream fetch failed',e); }
      
      // 3. Fallback to iframe
      setIframeUrl(`https://vidsrc.pro/embed/${isMovie?'movie':'tv'}/${tmdbId}${!isMovie?`/${season}/${episode}`:''}`);
      setMode('iframe');
    };
    init();
  }, [tmdbId, isMovie, season, episode, buildAndLoad]);

  // ── Media Engine Setup ─────────────────────────────────────────────────────
  const loadSource = useCallback((srcObj) => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const url = srcObj.url;

    if(hlsRef.current){ hlsRef.current.destroy(); hlsRef.current=null; }
    
    setBuffering(true); setAudioTracks([]); setActiveAudioIdx(0);

    const friendlyLang = (raw) => {
      if(!raw) return raw;
      const m={hin:'Hindi',hi:'Hindi',hindi:'Hindi',eng:'English',en:'English',english:'English'};
      return m[raw.toLowerCase().trim()] || (raw.charAt(0).toUpperCase()+raw.slice(1));
    };

    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength:30, maxMaxBufferLength:600 });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(vid);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setBuffering(false);
          if(hls.audioTracks && hls.audioTracks.length>0){
            const t=hls.audioTracks.map((tr,i)=>({
              id:i, name:friendlyLang(tr.name)||friendlyLang(tr.lang)||friendlyLang(tr.language)||`Track ${i+1}`
            }));
            setAudioTracks(t);
            // Default to English if available
            const eIdx=t.findIndex(x=>x.name==='English');
            const defIdx=eIdx>=0?eIdx:0;
            hls.audioTrack=defIdx;
            setActiveAudioIdx(defIdx);
          }
          vid.play().catch(()=>{});
        });
        hls.on(Hls.Events.ERROR, (e, data) => { 
          if(data.fatal) {
            console.warn("HLS Error - Falling back", data);
            setMode('iframe'); 
          }
        });
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.src = url;
        vid.play().catch(()=>{});
      }
    } else {
      // Direct MP4 / MKV
      vid.src = url;
      vid.play().catch(()=>{});
    }
    setMode('custom');
  }, []);

  const handleVideoError = () => {
    if (!videoRef.current) return;
    const err = videoRef.current.error;
    if (err) {
      console.warn("Video Decode/Network Error:", err.message, "Code:", err.code);
      // Auto fallback to the iframe player if the native player strictly fails 
      setMode('iframe');
    }
  };

  // ── UI Interactions ────────────────────────────────────────────────────────
  const togglePlay = () => {
    if(!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  };

  const handleSeek = (e) => {
    if(!videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (amt) => {
    if(videoRef.current) videoRef.current.currentTime += amt;
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if(containerRef.current.requestFullscreen) await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if(document.exitFullscreen) await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && videoRef.current) {
      await videoRef.current.requestPictureInPicture();
    }
  };

  // ── Multi-Audio Feature Handlers ───────────────────────────────────────────
  const handleLanguage = useCallback(lang => {
    setSelLang(lang);
    // Save progress instantly before switching
    if (videoRef.current && duration > 0) saveProgress(videoRef.current.currentTime, duration);
    updateQualityMenu(rawFilesRef.current, lang, true);
    setPanel(null);
  }, [duration, saveProgress, updateQualityMenu]);

  const handleQuality = useCallback(val => {
    setSelQuality(val); selQRef.current=val;
    const src = allSourcesRef.current.find(s=>s.value===val);
    // Save progress instantly before switching
    if (videoRef.current && duration > 0) saveProgress(videoRef.current.currentTime, duration);
    if (src) loadSource(src);
    setPanel(null);
  }, [loadSource, duration, saveProgress]);

  // ── Event Listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onTimeUpdate = () => {
      if(!isDraggingRef.current) setCurrentTime(vid.currentTime);
      if(vid.buffered.length>0) setBuffered(vid.buffered.end(vid.buffered.length-1));
    };
    const onDuration = () => setDuration(vid.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    
    // Resume when video metadata loads (perfect for hot-swapping URLs)
    const onCanPlay = () => attemptResume(vid);

    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('durationchange', onDuration);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('playing', onPlaying);
    vid.addEventListener('loadedmetadata', onCanPlay);

    // Save progress interval
    const int = setInterval(()=>{
      if(!vid.paused && vid.currentTime>0 && vid.duration>0){
        saveProgress(vid.currentTime, vid.duration);
      }
    }, 5000);

    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('durationchange', onDuration);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('playing', onPlaying);
      vid.removeEventListener('loadedmetadata', onCanPlay);
      clearInterval(int);
    };
  }, [saveProgress, attemptResume, mode]);

  useEffect(() => {
    const wakeControls = () => {
      setShowControls(true);
      clearTimeout(controlsTimeoutRef.current);
      if (isPlaying && !panel) {
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    };
    const el = containerRef.current;
    if(el){
      el.addEventListener('mousemove', wakeControls);
      el.addEventListener('click', wakeControls);
      el.addEventListener('mouseleave', () => { if(isPlaying && !panel) setShowControls(false) });
    }
    return () => {
      if(el){
        el.removeEventListener('mousemove', wakeControls);
        el.removeEventListener('click', wakeControls);
      }
      clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, panel]);

  // Hotkeys
  useEffect(() => {
    const handleKey = e => {
      if(mode!=='custom') return;
      if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
      if(e.code==='ArrowRight'){ e.preventDefault(); skip(10); }
      if(e.code==='ArrowLeft'){ e.preventDefault(); skip(-10); }
      if(e.code==='KeyF'){ e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener('keydown', handleKey);
    return ()=>window.removeEventListener('keydown', handleKey);
  }, [mode]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div style={styles.fullscreenBase}>
        <LoadingSpinner />
        <div style={{color:'#fff',marginTop:20,fontFamily:'sans-serif'}}>Hunting Streams...</div>
      </div>
    );
  }

  if (mode === 'iframe') {
    return (
      <div style={styles.fullscreenBase}>
        <button onClick={onClose} style={styles.closeBtn}><BackIcon/></button>
        <iframe src={iframeUrl} style={{width:'100%',height:'100%',border:'none'}} allowFullScreen/>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.fullscreenBase}>
      
      {/* Video Element */}
      <video
        ref={videoRef}
        style={{width:'100%',height:'100%',backgroundColor:'#000',objectFit:'contain'}}
        autoPlay playsInline
        onError={handleVideoError} // Auto-fallback if MKV direct link decoding fails
        // crossOrigin="anonymous" is INTENTIONALLY OMITTED to allow raw stream playback.
      >
        {subs.map(s => (
          <track key={s.id} kind="subtitles" src={s.file} srcLang={s.lang} label={s.label} default={s.id===activeSubId}/>
        ))}
      </video>

      {/* Buffering Indicator */}
      {isBuffering && (
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',pointerEvents:'none'}}>
          <LoadingSpinner />
        </div>
      )}

      {/* Top Gradient & Back Button */}
      <div style={{...styles.topGradient, opacity: showControls ? 1 : 0}}>
        <button onClick={onClose} style={styles.iconBtn}><BackIcon/></button>
        <div style={{color:'#fff',fontSize:18,fontWeight:600,fontFamily:'sans-serif',textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>
          {title} {season ? `— S${season} E${episode}` : ''}
        </div>
      </div>

      {/* Main Controls Overlay */}
      <div style={{...styles.controlsOverlay, opacity: showControls ? 1 : 0, pointerEvents: showControls?'auto':'none'}}>
        
        {/* Center Play/Pause & Skip */}
        <div style={styles.centerControls}>
          <button onClick={(e)=>{e.stopPropagation();skip(-10)}} style={styles.bigBtn}><Replay10Icon/></button>
          <button onClick={(e)=>{e.stopPropagation();togglePlay()}} style={{...styles.bigBtn, transform:'scale(1.2)'}}>
            {isPlaying ? <PauseIcon/> : <PlayIcon/>}
          </button>
          <button onClick={(e)=>{e.stopPropagation();skip(10)}} style={styles.bigBtn}><Forward10Icon/></button>
        </div>

        {/* Bottom Bar */}
        <div style={styles.bottomBar}>
          {/* Progress Bar */}
          <div 
            ref={progressBarRef}
            onClick={handleSeek}
            style={styles.progressContainer}
            onMouseDown={()=>{isDraggingRef.current=true;}}
            onMouseUp={()=>{isDraggingRef.current=false;}}
            onMouseLeave={()=>{isDraggingRef.current=false;}}
            onMouseMove={(e)=>{
              if(isDraggingRef.current) handleSeek(e);
            }}
          >
            <div style={{...styles.progressBg}}>
              <div style={{...styles.progressBuffer, width: `${(buffered/duration)*100}%`}}/>
              <div style={{...styles.progressFill, width: `${(currentTime/duration)*100}%`}}/>
              <div style={{...styles.progressThumb, left: `${(currentTime/duration)*100}%`}}/>
            </div>
          </div>

          {/* Controls Row */}
          <div style={styles.controlsRow}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={togglePlay} style={styles.iconBtn}>
                {isPlaying ? <PauseIcon/> : <PlayIcon/>}
              </button>
              <div style={{color:'#fff',fontFamily:'sans-serif',fontSize:14,fontWeight:500}}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={()=>setPanel(panel==='settings'?'':'settings')} style={styles.iconBtn}><SettingsIcon/></button>
              {document.pictureInPictureEnabled && <button onClick={togglePiP} style={styles.iconBtn}><PiPIcon/></button>}
              <button onClick={toggleFullscreen} style={styles.iconBtn}>
                {isFullscreen ? <ExitFullscreenIcon/> : <FullscreenIcon/>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {panel === 'settings' && (
        <div style={styles.settingsPanel}>
          <div style={styles.panelHeader}>
            <span>Settings</span>
            <button onClick={()=>setPanel(null)} style={styles.iconBtn}><CloseIcon/></button>
          </div>
          <div style={{display:'flex',flexDirection:'row'}}>
            
            {/* Qualities */}
            <div style={{flex:1,borderRight:'1px solid rgba(255,255,255,0.1)',padding:'20px 16px'}}>
              <div style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:16}}>Quality</div>
              {qualities.map(q => (
                <div key={q.value} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                  onClick={()=>handleQuality(q.value)}>
                  <div style={{width:20}}>{selQuality===q.value&&<CheckIcon/>}</div>
                  <span style={{color:selQuality===q.value?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{q.label}</span>
                </div>
              ))}
            </div>

            {/* Audio — switches hls.audioTrack directly OR switches video file based on parsed Languages */}
            <div style={{flex:1,padding:'20px 16px'}}>
              <div style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:16}}>Audio</div>
              
              {audioTracks && audioTracks.length > 0 ? (
                  // HLS Native Audio Tracks
                  audioTracks.map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                      onClick={()=>{
                        if(hlsRef.current) hlsRef.current.audioTrack=t.id;
                        setActiveAudioIdx(t.id);
                      }}>
                      <div style={{width:20}}>{activeAudioIdx===t.id&&<CheckIcon/>}</div>
                      <span style={{color:activeAudioIdx===t.id?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{t.name}</span>
                    </div>
                  ))
              ) : availableLangs && availableLangs.length > 1 ? (
                  // File-Based Stream Switching (for .mkv/.mp4 single-track files from MoviesMod)
                  availableLangs.map(lang => (
                      <div key={lang} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                      onClick={()=>handleLanguage(lang)}>
                      <div style={{width:20}}>{selLang===lang&&<CheckIcon/>}</div>
                      <span style={{color:selLang===lang?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{lang}</span>
                    </div>
                  ))
              ) : (
                <div style={{color:'rgba(255,255,255,.3)',fontSize:13,fontStyle:'italic',padding:'8px 4px'}}>
                  {isMovie? (availableLangs?.[0] || 'Default Audio') : 'Loading audio...'}
                </div>
              )}
            </div>

            {/* Subtitles */}
            {subs.length > 0 && (
              <div style={{flex:1,borderLeft:'1px solid rgba(255,255,255,0.1)',padding:'20px 16px',maxHeight:300,overflowY:'auto'}}>
                <div style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:16}}>Subtitles</div>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                  onClick={()=>setActiveSubId(-1)}>
                  <div style={{width:20}}>{activeSubId===-1&&<CheckIcon/>}</div>
                  <span style={{color:activeSubId===-1?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>Off</span>
                </div>
                {subs.map(s => (
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                    onClick={()=>setActiveSubId(s.id)}>
                    <div style={{width:20}}>{activeSubId===s.id&&<CheckIcon/>}</div>
                    <span style={{color:activeSubId===s.id?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Inline styles for zero external CSS dependencies
const styles = {
  fullscreenBase: {
    position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
    backgroundColor:'#000', zIndex:99999, display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center', fontFamily:'sans-serif'
  },
  closeBtn: {
    position:'absolute', top:20, left:20, zIndex:999999, background:'rgba(0,0,0,0.5)',
    border:'none', borderRadius:'50%', padding:10, cursor:'pointer'
  },
  iconBtn: {
    background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center',
    justifyContent:'center', padding:8, opacity:0.8, transition:'opacity 0.2s'
  },
  bigBtn: {
    background:'rgba(0,0,0,0.4)', border:'none', borderRadius:'50%', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    color:'#fff', backdropFilter:'blur(4px)', transition:'transform 0.1s'
  },
  topGradient: {
    position:'absolute', top:0, left:0, width:'100%', padding:'20px 30px',
    background:'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
    display:'flex', alignItems:'center', gap:20, transition:'opacity 0.3s ease'
  },
  controlsOverlay: {
    position:'absolute', top:0, left:0, width:'100%', height:'100%',
    display:'flex', flexDirection:'column', justifyContent:'flex-end',
    transition:'opacity 0.3s ease'
  },
  centerControls: {
    position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
    display:'flex', alignItems:'center', gap:40
  },
  bottomBar: {
    width:'100%', padding:'0 30px 20px 30px',
    background:'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
  },
  progressContainer: {
    width:'100%', height:20, display:'flex', alignItems:'center', cursor:'pointer', marginBottom:10
  },
  progressBg: {
    position:'relative', width:'100%', height:5, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:3
  },
  progressBuffer: {
    position:'absolute', top:0, left:0, height:'100%', backgroundColor:'rgba(255,255,255,0.4)', borderRadius:3
  },
  progressFill: {
    position:'absolute', top:0, left:0, height:'100%', backgroundColor:'#00a8e1', borderRadius:3
  },
  progressThumb: {
    position:'absolute', top:'50%', width:14, height:14, backgroundColor:'#00a8e1',
    borderRadius:'50%', transform:'translate(-50%, -50%)', boxShadow:'0 0 5px rgba(0,0,0,0.5)'
  },
  controlsRow: {
    display:'flex', justifyContent:'space-between', alignItems:'center'
  },
  settingsPanel: {
    position:'absolute', bottom:80, right:30, width:'max-content', minWidth:500,
    backgroundColor:'rgba(15,15,15,0.95)', backdropFilter:'blur(10px)',
    borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden',
    display:'flex', flexDirection:'column', boxShadow:'0 10px 30px rgba(0,0,0,0.5)'
  },
  panelHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px',
    borderBottom:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontWeight:600
  }
};
