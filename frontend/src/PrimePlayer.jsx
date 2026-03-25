// frontend/src/PrimePlayer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { useNavigate } from 'react-router-dom';

// ─── ICONS ─────────────────────────────────────────────
const SubtitlesIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="6" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="6" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const SettingsIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0.33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg>);
const VolumeHighIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const VolumeMidIcon  = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const VolumeMuteIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const PiPIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="10" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/></svg>);
const FullscreenIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ExitFullscreenIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const CloseIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const CheckIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ChevronRightIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ChevronUpIcon   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ChevronDownIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const XRayExpandIcon  = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Rewind10Icon = () => (<svg width="88" height="88" viewBox="0 0 64 64" fill="none"><path d="M16 24 A20 20 0 1 1 16 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M25 15 L15 24 L25 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="32" dy="0.35em" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="700" fontFamily="system-ui">10</text></svg>);
const Forward10Icon = () => (<svg width="88" height="88" viewBox="0 0 64 64" fill="none"><path d="M48 24 A20 20 0 1 0 48 46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M39 15 L49 24 L39 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="32" y="32" dy="0.35em" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="700" fontFamily="system-ui">10</text></svg>);
const PlayIcon  = () => (<svg width="88" height="88" viewBox="0 0 64 64" fill="none"><path d="M24 16 L48 32 L24 48 Z" fill="currentColor" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/></svg>);
const PauseIcon = () => (<svg width="88" height="88" viewBox="0 0 64 64" fill="none"><rect x="20" y="16" width="7" height="32" rx="3.5" fill="currentColor"/><rect x="37" y="16" width="7" height="32" rx="3.5" fill="currentColor"/></svg>);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s |

| isNaN(s)) return '0:00:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};
const TMDB_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';

// Map ISO language codes / raw names → readable display names
function friendlyLang(raw) {
  if (!raw) return raw;
  const map = {
    hin:'Hindi', hi:'Hindi', hindi:'Hindi',
    eng:'English', en:'English', english:'English',
    tam:'Tamil', ta:'Tamil', tamil:'Tamil',
    tel:'Telugu', te:'Telugu', telugu:'Telugu',
    mal:'Malayalam', ml:'Malayalam', malayalam:'Malayalam',
    kan:'Kannada', kn:'Kannada', kannada:'Kannada',
    ben:'Bengali', bn:'Bengali', bengali:'Bengali',
    mar:'Marathi', mr:'Marathi', marathi:'Marathi',
    pun:'Punjabi', pa:'Punjabi', punjabi:'Punjabi',
    jpn:'Japanese', ja:'Japanese', japanese:'Japanese',
    kor:'Korean', ko:'Korean', korean:'Korean',
    fra:'French', fr:'French', french:'French',
    deu:'German', de:'German', german:'German',
    spa:'Spanish', es:'Spanish', spanish:'Spanish',
    zho:'Chinese', zh:'Chinese', chinese:'Chinese',
    ara:'Arabic', ar:'Arabic', arabic:'Arabic',
    mul:'Multi', multi:'Multi',
    und:'Unknown', unknown:'Unknown',
  };
  const key = raw.toLowerCase().trim();
  return map[key] |

| (raw.charAt(0).toUpperCase() + raw.slice(1));
}

// ─── MAIN PLAYER ──────────────────────────────────────────────────────────────
export default function PrimePlayer({ tmdbId, title = '', mediaType = 'movie', season = 1, episode = 1, onClose }) {
  const navigate = useNavigate();

  const containerRef   = useRef(null);
  const videoRef       = useRef(null);
  const hlsRef         = useRef(null);
  const iframeRef      = useRef(null);
  const progressBarRef = useRef(null);
  const ctrlTimer      = useRef(null);
  const volSliderRef   = useRef(null);
  const iframeTimer    = useRef(null);

  const rawFilesRef   = useRef();
  const allSourcesRef = useRef();
  const selQRef       = useRef(-1);
  const hasResumed    = useRef(false);

  // playback
  const [playing,     setPlaying]     = useState(false);
  const = useState(0);
  const    = useState(0);
  const    = useState(0);
  const   = useState(false);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [prevVol,     setPrevVol]     = useState(1);
  const [autoMuted,   setAutoMuted]   = useState(false);

  // stream
  const [mode,       setMode]       = useState('loading');
  const [hlsUrl,     setHlsUrl]     = useState(null);
  const [hlsKey,     setHlsKey]     = useState(0); // forces reload even for same URL
  const= useState();
  const  = useState(0);
  const [qualities,  setQualities]  = useState();
  const = useState(-1);
  const [embeds,     setEmbeds]     = useState();
  const [embedIdx,   setEmbedIdx]   = useState(0);
  const [embedPhase, setEmbedPhase] = useState('loading');

  // ── AUDIO TRACKS — populated from HLS.js after manifest loads ──
  const    = useState(); // [{id, name}]
  const [activeAudioIdx, setActiveAudioIdx] = useState(0);

  // subtitle tracks
  const    = useState();
  const = useState(-1);

  // ui
  const     = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const      = useState(false);
  const  = useState(false);
  const [panel,        setPanel]        = useState(null);
  const       = useState(null);
  const       = useState(null);
  const [hoverX,       setHoverX]       = useState(0);
  const [xrayOpen,     setXrayOpen]     = useState(false);
  const [xrayExpanded, setXrayExpanded] = useState(false);
  const [xrayCast,     setXrayCast]     = useState();
  const      = useState('scene');
  const [expandCast,   setExpandCast]   = useState(null);
  const   = useState(title);
  const = useState('');
  const   = useState(null);

  const isVideo  = mode === 'hls' |

| mode === 'direct';
  const chapters = duration > 0? [0.16,0.33,0.5,0.66,0.83].map(p => p*duration) :;

  // ── TV episode info ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType!== 'tv') return;
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`)
     .then(r => r.json()).then(d => {
        if (!d.episodes) return;
        const ep = d.episodes.find(e => e.episode_number == episode);
        if (ep) setEpisodeTitle(ep.name);
        const next = d.episodes.find(e => e.episode_number == Number(episode)+1);
        if (next) { setNextEpData({ season, episode: Number(episode)+1 }); return; }
        fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`)
         .then(r=>r.json()).then(tv=>{
            const ns = tv.seasons?.find(s=>s.season_number==Number(season)+1);
            setNextEpData(ns&&ns.episode_count>0?{season:Number(season)+1,episode:1}:null);
          });
      });
  },);

  const handleNextEpisode = e => {
    e.stopPropagation();
    if (nextEpData) navigate(`/watch/tv/${tmdbId}?season=${nextEpData.season}&episode=${nextEpData.episode}`,{replace:true});
  };

  // ── Progress save/restore ──────────────────────────────────────────────────
  useEffect(() => { hasResumed.current = false; }, [tmdbId, season, episode]);

  const saveProgress = useCallback((time, dur) => {
    if (!tmdbId ||!dur |

| time < 5) return;
    const key = `${mediaType==='tv'?'t':'m'}${tmdbId}`;
    const all = JSON.parse(localStorage.getItem('vidFastProgress')||'{}');
    all[key] = {...(all[key]||{}), id:tmdbId, type:mediaType,
      progress:{watched:time,duration:dur}, last_season_watched:season,
      last_episode_watched:episode, last_updated:Date.now(),
     ...(movieTitle?{title:movieTitle}:{}) };
    localStorage.setItem('vidFastProgress', JSON.stringify(all));
  },);

  useEffect(() => {
    const iv = setInterval(() => {
      if (playing && videoRef.current && duration>0) saveProgress(videoRef.current.currentTime, duration);
    }, 5000);
    return () => clearInterval(iv);
  }, [playing, duration, saveProgress]);

  const attemptResume = useCallback(vid => {
    if (hasResumed.current) return;
    const key = `${mediaType==='tv'?'t':'m'}${tmdbId}`;
    const prog = (JSON.parse(localStorage.getItem('vidFastProgress')||'{}'))[key];
    const sameEp = mediaType==='tv'? prog?.last_season_watched==season && prog?.last_episode_watched==episode : true;
    if (prog?.progress?.watched>0 && sameEp && prog.progress.watched < prog.progress.duration*0.95)
      vid.currentTime = prog.progress.watched;
    hasResumed.current = true;
  },);

  // ── Volume sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const fn = () => { setMuted(v.muted); setVolume(v.volume); if(!v.muted&&v.volume>0) setAutoMuted(false); };
    v.addEventListener('volumechange', fn);
    return () => v.removeEventListener('volumechange', fn);
  },);

  // ── Embed list ─────────────────────────────────────────────────────────────
  const buildEmbeds = (tid, iid, mt, s, e) => {
    const tv = mt==='tv'; const list=;
    if(iid){
      list.push({name:'VidSrc',    url:tv?`https://vidsrc.xyz/embed/tv?imdb=${iid}&season=${s}&episode=${e}`:`https://vidsrc.xyz/embed/movie?imdb=${iid}`});
      list.push({name:'VidSrc.me', url:tv?`https://vidsrc.me/embed/tv?imdb=${iid}&season=${s}&episode=${e}`:`https://vidsrc.me/embed/movie?imdb=${iid}`});
    }
    list.push({name:'VidSrc',    url:tv?`https://vidsrc.xyz/embed/tv?tmdb=${tid}&season=${s}&episode=${e}`:`https://vidsrc.xyz/embed/movie?tmdb=${tid}`});
    list.push({name:'VidSrc.in', url:tv?`https://vidsrc.in/embed/tv?tmdb=${tid}&season=${s}&episode=${e}`:`https://vidsrc.in/embed/movie?tmdb=${tid}`});
    list.push({name:'Videasy',   url:tv?`https://player.videasy.net/tv/${tid}/${s}/${e}`:`https://player.videasy.net/movie/${tid}`});
    list.push({name:'AutoEmbed', url:tv?`https://autoembed.cc/tv/tmdb/${tid}-${s}-${e}`:`https://autoembed.cc/movie/tmdb/${tid}`});
    return list;
  };

  // ── loadSource ─────────────────────────────────────────────────────────────
  const loadSource = useCallback(src => {
    setBuffering(true); setPlaying(false); setCurrentTime(0); setBuffered(0);
    setAudioTracks(); setActiveAudioIdx(0);
    setSubTracks(); setActiveSubIdx(-1);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); }

    if (src.url.includes('.m3u8') |

| src.url.includes('m3u') |
| src.url.includes('playlist')) {
      setHlsUrl(src.url);
      setHlsKey(k => k+1); // always bump so useEffect re-runs even for same URL
      setMode('hls');
    } else {
      setDirectFiles([src]);
      setDirectIdx(0);
      setMode('direct');
    }
  },);

  // ── Build quality menu + load first source ─────────────────────────────────
  const buildAndLoad = useCallback(files => {
    const order = {'1080p':6,'720p':5,'480p':4,'360p':3,'Auto':2,'2160p':1};
    const seen = new Set(); const menu =;
    files.forEach((f, i) => {
      const label = f.quality |

| 'Auto';
      const key = `${label}-${i}`;
      if (!seen.has(label)) {
        seen.add(label);
        menu.push({ label, value: i, url: f.url });
      } else {
        menu.push({ label: `${label} (${seen.size})`, value: i, url: f.url });
        seen.add(key);
      }
    });
    menu.sort((a,b) => (order[b.label.split(' ')]||0)-(order[a.label.split(' ')]||0));
    menu.forEach((m,i) => m.value=i);

    allSourcesRef.current = menu;
    setQualities(menu);
    if (menu.length > 0) {
      setSelQuality(0); selQRef.current=0;
      loadSource(menu);
    } else {
      setMode('iframe');
    }
  },);

  const handleQuality = useCallback(val => {
    setSelQuality(val); selQRef.current=val;
    const src = allSourcesRef.current.find(s=>s.value===val);
    if (src) loadSource(src);
    setPanel(null);
  },);

  const tryNextSource = useCallback(() => {
    const idx = allSourcesRef.current.findIndex(s=>s.value===selQRef.current);
    if (idx!==-1 && idx<allSourcesRef.current.length-1) handleQuality(allSourcesRef.current[idx+1].value);
    else { setMode('iframe'); setEmbedIdx(0); setEmbedPhase('loading'); }
  }, [handleQuality]);

  // ── MAIN INIT ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tmdbId) return;
    setMode('loading'); setHlsUrl(null);
    setDirectFiles(); setDirectIdx(0); setQualities(); setSelQuality(-1);
    setEmbeds(); setEmbedIdx(0); setEmbedPhase('loading');
    setPlaying(false); setBuffering(false); setAutoMuted(false);
    setCurrentTime(0); setDuration(0); setBuffered(0);
    setAudioTracks(); setSubTracks();
    rawFilesRef.current=; allSourcesRef.current=;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current=null; }

    let cancelled = false;
    const ac = new AbortController();

    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids,credits`,{signal:ac.signal})
     .then(r=>r.json()).then(d=>{
        if(cancelled) return;
        const iid = d.imdb_id||d.external_ids?.imdb_id||null;
        setMovieTitle(d.title||d.name||title);
        setXrayCast((d.credits?.cast||).slice(0,12).map(p=>({
          id:p.id,name:p.name,character:p.character,
          profile:p.profile_path?`https://image.tmdb.org/t/p/w185${p.profile_path}`:null,
        })));
        if(!cancelled) setEmbeds(buildEmbeds(tmdbId,iid,mediaType,season,episode));
      }).catch(()=>{});

    setEmbeds(buildEmbeds(tmdbId,null,mediaType,season,episode));

    (async()=>{
      let streams=;
      try {
        const r = await fetch(`/api/multi-stream?${new URLSearchParams({tmdbId,type:mediaType,season,episode})}`);
        if(r.ok){
          const d=await r.json();
          if(d?.success&&Array.isArray(d.streams))
            streams=d.streams.filter(s=>s?.url&&s.url.startsWith('http'));
        }
      } catch(e){ console.warn('[Player]',e.message); }

      if(cancelled) return;

      if(streams.length>0){
        // Build files list: direct URL + proxied fallback for each stream
        const files=;
        streams.forEach(s=>{
          files.push({url:s.url, quality:s.quality||'Auto'});
          files.push({url:`/api/proxy?url=${encodeURIComponent(s.url)}`, quality:(s.quality||'Auto')+' ↑'});
        });
        rawFilesRef.current=files;
        buildAndLoad(files);
        return;
      }
      if(!cancelled) setMode('iframe');
    })();

    return ()=>{ cancelled=true; ac.abort(); if(hlsRef.current){hlsRef.current.destroy();hlsRef.current=null;} };
  },);

  // ── HLS SETUP ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode!=='hls' ||!hlsUrl ||!videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current=null; }
    const vid = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker:true, backBufferLength:60, maxBufferLength:30, lowLatencyMode:false,
        fragLoadingTimeOut:30000, manifestLoadingTimeOut:20000, levelLoadingTimeOut:20000,
        fragLoadingMaxRetry:4, manifestLoadingMaxRetry:3, levelLoadingMaxRetry:3,
        fragLoadingRetryDelay:500, xhrSetup:xhr=>{ xhr.withCredentials=false; },
      });
      hlsRef.current=hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(vid);

      hls.on(Hls.Events.MANIFEST_PARSED, ()=>{
        setBuffering(false);

        // Cap ABR at 1080p to avoid 4K AC3 audio issues
        const cap = hls.levels.map((l,i)=>({h:l.height||0,i})).filter(x=>x.h>0&&x.h<=1080).sort((a,b)=>b.h-a.h);
        if(cap) hls.autoLevelCapping=cap.i;

        // ── AUDIO TRACKS from the HLS manifest ──
        if(hls.audioTracks && hls.audioTracks.length>0){
          const tracks = hls.audioTracks.map((t,i)=>({
            id:i,
            name: friendlyLang(t.name) |

| friendlyLang(t.lang) |
| friendlyLang(t.language) |
| `Track ${i+1}`,
          }));
          setAudioTracks(tracks);
          
          // Auto-select: prefer English track, else first
          const englishIdx = tracks.findIndex(t=>t.name==='English');
          const defaultIdx = englishIdx>=0? englishIdx : 0;
          hls.audioTrack=defaultIdx;
          setActiveAudioIdx(defaultIdx);
        } else {
          setAudioTracks();
        }

        // Subtitle tracks
        if(hls.subtitleTracks && hls.subtitleTracks.length>0){
          setSubTracks(hls.subtitleTracks.map((t,i)=>({
            id:i, name:friendlyLang(t.name||t.lang)||`Sub ${i+1}`,
          })));
          hls.subtitleTrack=-1;
          setActiveSubIdx(-1);
        } else {
          setSubTracks();
        }

        vid.volume=1; vid.muted=false;
        attemptResume(vid);
        vid.play()
         .then(()=>setPlaying(true))
         .catch(()=>{
            vid.muted=true;
            vid.play().then(()=>{setPlaying(true);setAutoMuted(true);}).catch(()=>{setPlaying(false);setBuffering(false);});
          });
      });

      let netR=0, medR=0;
      hls.on(Hls.Events.ERROR, (_,d)=>{
        if(d.details===Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR||d.details===Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT){
          if(hls.audioTracks&&hls.audioTracks.length>1){
            const next=(hls.audioTrack+1)%hls.audioTracks.length;
            hls.audioTrack=next; setActiveAudioIdx(next);
          } else if(d.fatal){hls.destroy();tryNextSource();}
          return;
        }
        if(!d.fatal) return;
        if(d.type===Hls.ErrorTypes.NETWORK_ERROR){
          if(netR<2){netR++;setTimeout(()=>hls.startLoad(),1000*netR);}
          else{hls.destroy();tryNextSource();}
        } else if(d.type===Hls.ErrorTypes.MEDIA_ERROR){
          if(medR<2){medR++;hls.recoverMediaError();}
          else{hls.destroy();tryNextSource();}
        } else{hls.destroy();tryNextSource();}
      });

    } else if(vid.canPlayType('application/vnd.apple.mpegurl')){
      vid.src=hlsUrl; vid.volume=1; vid.muted=false;
      vid.addEventListener('loadedmetadata',()=>{
        setBuffering(false);
        if(vid.audioTracks&&vid.audioTracks.length>0){
          setAudioTracks(Array.from(vid.audioTracks).map((t,i)=>({
            id:i, name:friendlyLang(t.language||t.label)||`Track ${i+1}`,
          })));
        }
        attemptResume(vid);
        vid.play().then(()=>setPlaying(true)).catch(()=>{vid.muted=true;vid.play().then(()=>{setPlaying(true);setAutoMuted(true);}).catch(()=>setPlaying(false));});
      },{once:true});
      vid.addEventListener('error',tryNextSource,{once:true});
    } else { tryNextSource(); }

    return ()=>{ if(hlsRef.current){hlsRef.current.destroy();hlsRef.current=null;} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl, hlsKey, mode]); 

  // ── DIRECT MODE ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(mode!=='direct'||!videoRef.current||!directFiles.length) return;
    const file=directFiles[directIdx]; if(!file?.url) return;
    const vid=videoRef.current;
    vid.pause(); vid.removeAttribute('src'); vid.load();
    const lt=setTimeout(()=>{if(!videoRef.current)return;vid.volume=1;vid.muted=false;vid.src=file.url;vid.load();},80);
    let done=false,st=null;
    const tryNext=()=>{if(done)return;done=true;clearTimeout(st);tryNextSource();};
    const onCanPlay=()=>{if(done)return;setBuffering(false);clearTimeout(st);vid.volume=1;vid.muted=false;attemptResume(vid);
      vid.play().then(()=>{if(!done)setPlaying(true);}).catch(()=>{vid.muted=true;vid.play().then(()=>{if(!done){setPlaying(true);setAutoMuted(true);}}).catch(()=>{if(!done){setPlaying(false);setBuffering(false);}});});};
    const onError=()=>{const e=vid.error;if(!e||e.code===1)return;tryNext();};
    st=setTimeout(()=>tryNext(),10000);
    const onProg=()=>{clearTimeout(st);st=setTimeout(()=>{if(vid.readyState<3&&!vid.paused)tryNext();},10000);};
    vid.addEventListener('canplay',onCanPlay,{once:true});
    vid.addEventListener('error',onError,{once:true});
    vid.addEventListener('progress',onProg);
    return()=>{done=true;clearTimeout(lt);clearTimeout(st);vid.removeEventListener('canplay',onCanPlay);vid.removeEventListener('error',onError);vid.removeEventListener('progress',onProg);};
  },);

  // ── IFRAME TIMEOUT ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(mode!=='iframe'||embedPhase!=='loading') return;
    clearTimeout(iframeTimer.current);
    iframeTimer.current=setTimeout(()=>{if(embedIdx<embeds.length-1)setEmbedIdx(i=>i+1);else setEmbedPhase('failed');},15000);
    return()=>clearTimeout(iframeTimer.current);
  },[mode,embedPhase,embedIdx,embeds.length]);

  // ── VIDEO DOM EVENTS ───────────────────────────────────────────────────────
  useEffect(()=>{
    const v=videoRef.current; if(!v) return;
    const handlers=,
      ['pause',   ()=>setPlaying(false)],
     ,
     ,
     ,
     ,
     ,
     ,
     ;
    handlers.forEach(([ev,fn])=>v.addEventListener(ev,fn));
    return()=>handlers.forEach(([ev,fn])=>v.removeEventListener(ev,fn));
  },);

  // ── CONTROLS HIDE ──────────────────────────────────────────────────────────
  const resetCtrl=useCallback(()=>{setShowCtrl(true);clearTimeout(ctrlTimer.current);ctrlTimer.current=setTimeout(()=>{if(!panel&&!xrayOpen)setShowCtrl(false);},3500);},[panel,xrayOpen]);
  useEffect(()=>{resetCtrl();return()=>clearTimeout(ctrlTimer.current);},[resetCtrl]);
  useEffect(()=>{if(panel||xrayOpen){setShowCtrl(true);clearTimeout(ctrlTimer.current);}else resetCtrl();},[panel,xrayOpen,resetCtrl]);

  // ── KEYBOARD ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==='INPUT') return;
      if(e.key===' '||e.key==='k'){e.preventDefault();togglePlay();}
      else if(e.key==='ArrowLeft'){e.preventDefault();skip(-10);}
      else if(e.key==='ArrowRight'){e.preventDefault();skip(10);}
      else if(e.key==='f') toggleFS();
      else if(e.key==='m') toggleMute();
      else if(e.key==='Escape'){setPanel(null);setXrayOpen(false);setXrayExpanded(false);}
    };
    window.addEventListener('keydown',fn);
    return()=>window.removeEventListener('keydown',fn);
  },[playing,muted,volume]);

  useEffect(()=>{
    const fn=()=>setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',fn);
    return()=>document.removeEventListener('fullscreenchange',fn);
  },);

  // ── ACTIONS ────────────────────────────────────────────────────────────────
  const togglePlay=()=>{const v=videoRef.current;if(!v)return;if(playing)v.pause();else v.play().then(()=>setPlaying(true)).catch(()=>{v.muted=true;v.play().then(()=>{setPlaying(true);setAutoMuted(true);}).catch(console.error);});};
  const skip=sec=>{const v=videoRef.current;if(!v)return;v.currentTime=Math.max(0,Math.min(duration,v.currentTime+sec));setSkipFX(sec<0?'back':'fwd');setTimeout(()=>setSkipFX(null),600);};
  const toggleMute=()=>{const v=videoRef.current;if(!v)return;if(v.muted||v.volume===0){v.muted=false;v.volume=prevVol>0?prevVol:1;setAutoMuted(false);}else{setPrevVol(v.volume);v.muted=true;}};
  const unmuteBanner=()=>{const v=videoRef.current;if(!v)return;v.muted=false;v.volume=prevVol>0?prevVol:1;setAutoMuted(false);};
  const changeVol=val=>{const v=videoRef.current;if(!v)return;if(val>0){setPrevVol(val);v.muted=false;v.volume=val;setAutoMuted(false);}else{v.muted=true;v.volume=0;}};
  const toggleFS=()=>{if(!document.fullscreenElement)containerRef.current?.requestFullscreen();else document.exitFullscreen();};
  const togglePiP=async()=>{const v=videoRef.current;if(!v)return;try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture();}catch(_){}};

  // ── PROGRESS BAR ───────────────────────────────────────────────────────────
  const seekTime=e=>{const b=progressBarRef.current;if(!b||!duration)return 0;return Math.max(0,Math.min(1,(e.clientX-b.getBoundingClientRect().left)/b.offsetWidth))*duration;};
  const onBarDown=e=>{setSeeking(true);const t=seekTime(e);if(videoRef.current){videoRef.current.currentTime=t;setCurrentTime(t);}};
  const onBarMove=e=>{const t=seekTime(e);setHoverT(t);if(progressBarRef.current)setHoverX(e.clientX-progressBarRef.current.getBoundingClientRect().left);if(seeking&&videoRef.current){videoRef.current.currentTime=t;setCurrentTime(t);}};
  const onBarUp=()=>setSeeking(false);
  const onBarLeave=()=>{setHoverT(null);if(seeking)setSeeking(false);};
  const volFromY=e=>{const s=volSliderRef.current;if(!s)return volume;return 1-Math.max(0,Math.min(1,(e.clientY-s.getBoundingClientRect().top)/s.offsetHeight));};
  useEffect(()=>{
    if(!draggingVol)return;
    const mv=e=>changeVol(volFromY(e));
    const up=()=>{setDraggingVol(false);setPanel(null);};
    window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);
    return()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);};
  },[draggingVol]);

  const pPct  = duration>0?(currentTime/duration)*100:0;
  const bPct  = duration>0?(buffered/duration)*100:0;
  const VolIco=(muted||volume===0)?VolumeMuteIcon:volume<0.5?VolumeMidIcon:VolumeHighIcon;
  const curEmbed=embeds[embedIdx];

  return (
    <div ref={containerRef} onMouseMove={resetCtrl} onClick={()=>setPanel(null)}
      style={{position:'fixed',inset:0,background:'#000',fontFamily:"'Amazon Ember','Segoe UI',system-ui,sans-serif",userSelect:'none',cursor:showCtrl?'default':'none',zIndex:9999}}>
      <style>{`
        :root{--c:#B3B3B3;--ct:rgba(179,179,179,.3);}
       .pb *{box-sizing:border-box;}
       .pbtn{background:none;border:none;cursor:pointer;color:var(--c);padding:0;display:flex;align-items:center;justify-content:center;transition:color.15s;}
       .pbtn:hover{color:#FFF;}
       .pbar{position:relative;height:4px;background:var(--ct);cursor:pointer;transition:height.1s;}
       .pbar:hover{height:6px;}
       .pbuf{position:absolute;top:0;left:0;height:100%;background:rgba(179,179,179,.4);pointer-events:none;}
       .ppld{position:absolute;top:0;left:0;height:100%;background:#FFF;pointer-events:none;}
       .pthumb{position:absolute;top:50%;width:14px;height:14px;background:#FFF;border-radius:50%;transform:translate(-50%,-50%) scale(0);pointer-events:none;transition:transform.1s;}
       .pbar:hover.pthumb{transform:translate(-50%,-50%) scale(1);}
       .cdot{position:absolute;top:0;width:2px;height:100%;background:#000;pointer-events:none;z-index:2;}
       .ppanel{position:absolute;top:48px;right:0;background:#111;border-radius:3px 0 0 3px;min-width:260px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.9);animation:pi.1s ease-out;}
        @keyframes pi{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
       .volpop{position:absolute;top:100%;margin-top:10px;left:50%;transform:translateX(-50%);background:#111;border-radius:4px;padding:14px 11px;width:40px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.9);animation:pi.1s ease-out;z-index:50;}
       .voltr{width:3px;height:120px;background:var(--ct);border-radius:2px;position:relative;cursor:pointer;}
       .volfil{position:absolute;bottom:0;left:0;width:100%;background:var(--c);border-radius:2px;pointer-events:none;}
       .volknob{position:absolute;left:50%;width:11px;height:11px;background:var(--c);border-radius:50%;transform:translate(-50%,50%);pointer-events:none;}
       .xray-ov{position:absolute;top:52px;left:14px;background:rgba(0,0,0,.9);border-radius:3px;padding:8px 0;min-width:250px;max-height:55vh;overflow-y:auto;scrollbar-width:none;animation:pi.12s ease-out;}
       .xray-ov::-webkit-scrollbar{display:none;}
       .xray-panel{position:absolute;top:0;right:0;bottom:0;width:340px;background:#080808;border-left:1px solid rgba(170,170,170,.08);display:flex;flex-direction:column;animation:si.18s ease-out;z-index:10;}
        @keyframes si{from{transform:translateX(100%)}to{transform:translateX(0)}}
       .skfx{position:absolute;top:50%;transform:translateY(-50%);pointer-events:none;animation:sf.4s ease-out forwards;}
        @keyframes sf{0%{opacity:.8}100%{opacity:0}}
       .spin{width:48px;height:48px;border-radius:50%;border:2px solid rgba(170,170,170,.2);border-top-color:#AAA;animation:sp.85s linear infinite;}
        @keyframes sp{to{transform:rotate(360deg)}}
       .qi:hover{background:rgba(255,255,255,.08);}
       .unmute{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.3);color:#fff;padding:10px 24px;border-radius:999px;display:flex;align-items:center;gap:10px;cursor:pointer;z-index:30;backdrop-filter:blur(10px);animation:pi.25s ease-out;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6);font-size:14px;font-weight:600;}
       .unmute:hover{background:rgba(20,20,20,.95);}
      `}</style>

      {autoMuted&&isVideo&&<div className="unmute" onClick={e=>{e.stopPropagation();unmuteBanner();}}><VolumeMuteIcon/><span>Tap to unmute</span></div>}

      <video ref={videoRef} playsInline preload="metadata"
        style={{width:'100%',height:'100%',objectFit:'contain',display:isVideo?'block':'none'}}
        onClick={e=>{e.stopPropagation();if(autoMuted){unmuteBanner();return;}if(isVideo)togglePlay();}}
      />

      {mode==='iframe'&&(
        <div style={{position:'absolute',inset:0,zIndex:1,background:'#000'}}>
          {embedPhase==='loading'&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#000',zIndex:6,pointerEvents:'none'}}><div className="spin"/></div>}
          {embedPhase==='failed'&&(
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#000',zIndex:6}}>
              <div style={{color:'#f87171',fontSize:16,fontWeight:600,marginBottom:8}}>All sources failed</div>
              <div style={{color:'#AAA',fontSize:13,marginBottom:20}}>This title may not be available right now.</div>
              <button onClick={()=>{setEmbedIdx(0);setEmbedPhase('loading');}} style={{background:'none',border:'1px solid rgba(170,170,170,.4)',color:'#AAA',padding:'8px 24px',borderRadius:6,cursor:'pointer',fontWeight:700}}>Retry</button>
            </div>
          )}
          {curEmbed&&embedPhase!=='failed'&&(
            <iframe ref={iframeRef} key={`${embedIdx}-${tmdbId}-${season}-${episode}`} src={curEmbed.url}
              style={{width:'100%',height:'100%',border:'none',display:'block',opacity:embedPhase==='playing'?1:0,transition:'opacity.4s'}}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" title={movieTitle}
              onLoad={()=>{clearTimeout(iframeTimer.current);iframeTimer.current=setTimeout(()=>setEmbedPhase('playing'),1500);}}
            />
          )}
          {embedPhase==='playing'&&embedIdx<embeds.length-1&&showCtrl&&(
            <div style={{position:'absolute',bottom:72,right:16,zIndex:20}}>
              <button onClick={e=>{e.stopPropagation();clearTimeout(iframeTimer.current);setEmbedIdx(i=>i+1);setEmbedPhase('loading');}}
                style={{background:'rgba(0,0,0,.7)',border:'1px solid rgba(170,170,170,.2)',color:'#AAA',padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,backdropFilter:'blur(8px)'}}>
                Not playing? Try next source →
              </button>
            </div>
          )}
        </div>
      )}

      {(mode==='loading'||(isVideo&&buffering))&&(
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:mode==='loading'?'#000':'transparent',zIndex:8,pointerEvents:'none'}}>
          <div className="spin"/>
        </div>
      )}

      <div className="pb" style={{position:'absolute',inset:0,opacity:showCtrl?1:0,transition:'opacity.3s',pointerEvents:mode==='iframe'?'none':(showCtrl?'auto':'none'),zIndex:5}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:140,background:'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:140,background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)',pointerEvents:'none'}}/>

        {/* TOP BAR */}
        <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'32px 40px',zIndex:10,pointerEvents:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <span style={{fontSize:18,fontWeight:600,color:'#FFF',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setXrayOpen(v=>!v);setXrayExpanded(false);setPanel(null);}}>X-Ray</span>
            <div style={{border:'1px solid #B3B3B3',color:'#B3B3B3',fontSize:11,fontWeight:700,padding:'2px 5px',borderRadius:3,cursor:'pointer'}} onClick={e=>{e.stopPropagation();setXrayExpanded(true);setXrayOpen(false);setPanel(null);}}>IMDb</div>
            <button className="pbtn" style={{fontSize:15,display:'flex',alignItems:'center',gap:4}} onClick={e=>{e.stopPropagation();setXrayExpanded(true);setXrayOpen(false);setPanel(null);}}>All <ChevronRightIcon/></button>
          </div>

          <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',whiteSpace:'nowrap',textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>
            <span style={{color:'#FFF',fontSize:22,fontWeight:600}}>{movieTitle}</span>
            {mediaType==='tv'&&<span style={{color:'#E0E0E0',fontSize:16,fontWeight:400,marginTop:2}}>Season {season}, Ep. {episode}{episodeTitle?` — ${episodeTitle}`:''}</span>}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:24}}>
            {/* SUBTITLES & AUDIO */}
            <div style={{position:'relative'}}>
              <button className="pbtn" onClick={e=>{e.stopPropagation();setPanel(panel==='subtitles'?null:'subtitles');}} title="Subtitles & Audio"><SubtitlesIcon/></button>
              {panel==='subtitles'&&(
                <div className="ppanel" style={{width:420,maxHeight:'70vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex'}}>
                    {/* Subtitles */}
                    <div style={{flex:1,borderRight:'1px solid rgba(255,255,255,.15)',padding:'20px 16px'}}>
                      <div style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:16}}>Subtitles</div>
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                        onClick={()=>{setActiveSubIdx(-1);if(hlsRef.current)hlsRef.current.subtitleTrack=-1;}}>
                        <div style={{width:20}}>{activeSubIdx===-1&&<CheckIcon/>}</div>
                        <span style={{color:activeSubIdx===-1?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>Off</span>
                      </div>
                      {subTracks.map(t=>(
                        <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                          onClick={()=>{setActiveSubIdx(t.id);if(hlsRef.current)hlsRef.current.subtitleTrack=t.id;}}>
                          <div style={{width:20}}>{activeSubIdx===t.id&&<CheckIcon/>}</div>
                          <span style={{color:activeSubIdx===t.id?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{t.name}</span>
                        </div>
                      ))}
                      {subTracks.length===0&&<div style={{color:'rgba(255,255,255,.3)',fontSize:13,fontStyle:'italic'}}>None available</div>}
                    </div>

                    {/* Audio — switches hls.audioTrack directly */}
                    <div style={{flex:1,padding:'20px 16px'}}>
                      <div style={{color:'#fff',fontSize:16,fontWeight:700,marginBottom:16}}>Audio</div>
                      {audioTracks.length>0? audioTracks.map(t=>(
                        <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',cursor:'pointer'}}
                          onClick={()=>{
                            // THE ACTUAL SWITCH — this is what changes the audio language
                            if(hlsRef.current) hlsRef.current.audioTrack=t.id;
                            setActiveAudioIdx(t.id);
                          }}>
                          <div style={{width:20}}>{activeAudioIdx===t.id&&<CheckIcon/>}</div>
                          <span style={{color:activeAudioIdx===t.id?'#fff':'rgba(255,255,255,.7)',fontSize:15}}>{t.name}</span>
                        </div>
                      )) : (
                        <div style={{color:'rgba(255,255,255,.3)',fontSize:13,fontStyle:'italic',padding:'8px 4px'}}>
                          {isVideo? 'Loading audio tracks…' : 'Default Audio'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quality */}
            <div style={{position:'relative'}}>
              <button className="pbtn" onClick={e=>{e.stopPropagation();setPanel(panel==='quality'?null:'quality');}} title="Video Quality"><SettingsIcon/></button>
              {panel==='quality'&&(
                <div className="ppanel" style={{width:260,maxHeight:'60vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
                  <div style={{padding:'20px 20px 12px'}}>
                    <div style={{color:'#fff',fontSize:17,fontWeight:700,marginBottom:14}}>Video Quality</div>
                    {qualities.length>0?qualities.map(q=>(
                      <div key={q.value} className="qi" style={{display:'flex',alignItems:'center',gap:14,padding:'11px 4px',cursor:'pointer',borderRadius:4}} onClick={()=>handleQuality(q.value)}>
                        <div style={{width:24,flexShrink:0}}>{selQuality===q.value&&<CheckIcon/>}</div>
                        <span style={{color:selQuality===q.value?'#fff':'rgba(255,255,255,.85)',fontSize:14,fontWeight:selQuality===q.value?700:400}}>{q.label}</span>
                      </div>
                    )):<div style={{color:'#AAA',fontSize:13,fontStyle:'italic'}}>Loading…</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Volume */}
            <div style={{position:'relative'}} onMouseEnter={()=>setPanel('volume')} onMouseLeave={()=>{if(!draggingVol)setPanel(null);}}>
              <button className="pbtn" onClick={e=>{e.stopPropagation();toggleMute();}} title="Volume"><VolIco/></button>
              {panel==='volume'&&(
                <div className="volpop" onClick={e=>e.stopPropagation()}>
                  <div ref={volSliderRef} className="voltr" onMouseDown={e=>{e.stopPropagation();setDraggingVol(true);changeVol(volFromY(e));}}>
                    <div className="volfil" style={{height:`${(muted?0:volume)*100}%`}}/>
                    <div className="volknob" style={{bottom:`${(muted?0:volume)*100}%`}}/>
                  </div>
                </div>
              )}
            </div>

            <button className="pbtn" onClick={e=>{e.stopPropagation();togglePiP();}} title="PiP"><PiPIcon/></button>
            <button className="pbtn" onClick={e=>{e.stopPropagation();toggleFS();}} title="Fullscreen">{isFullscreen?<ExitFullscreenIcon/>:<FullscreenIcon/>}</button>
            <div style={{width:1,height:24,background:'#B3B3B3',opacity:.4}}/>
            <button className="pbtn" onClick={e=>{e.stopPropagation();onClose?.();}} title="Close"><CloseIcon/></button>
          </div>
        </div>

        {/* X-Ray mini */}
        {xrayOpen&&xrayCast.length>0&&(
          <div className="xray-ov" onClick={e=>e.stopPropagation()}>
            <div style={{padding:'0 16px 10px',borderBottom:'1px solid rgba(255,255,255,.1)',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:'#AAA',fontSize:14}}>X-Ray</span>
              <div style={{background:'#f5c518',color:'#000',fontSize:10,fontWeight:800,padding:'2px 4px',borderRadius:3}}>IMDb</div>
              <button style={{marginLeft:4,background:'none',border:'none',color:'#AAA',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:13}} onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}}>All <ChevronRightIcon/></button>
            </div>
            {xrayCast.slice(0,3).map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',cursor:'pointer'}} onClick={()=>{setXrayExpanded(true);setXrayOpen(false);}}>
                {p.profile?<img src={p.profile} alt={p.name} style={{width:64,height:64,objectFit:'cover',borderRadius:4,flexShrink:0}}/>
                  :<div style={{width:64,height:64,background:'#111',borderRadius:4,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.3)',fontSize:20,fontWeight:700}}>{p.name.charAt(0)}</div>}
                <div><div style={{color:'#AAA',fontSize:14}}>{p.name}</div><div style={{color:'rgba(170,170,170,.6)',fontSize:12,marginTop:2}}>{p.character}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* Center controls */}
        {isVideo&&(
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',alignItems:'center',gap:120,zIndex:8}} onClick={e=>e.stopPropagation()}>
            <button className="pbtn" style={{position:'relative'}} onClick={()=>skip(-10)}><Rewind10Icon/>{skipFX==='back'&&<div className="skfx" style={{left:'50%',transform:'translate(-50%,-50%)',color:'#FFF',fontSize:24}}>-10</div>}</button>
            <button className="pbtn" onClick={togglePlay}>{playing?<PauseIcon/>:<PlayIcon/>}</button>
            <button className="pbtn" style={{position:'relative'}} onClick={()=>skip(10)}><Forward10Icon/>{skipFX==='fwd'&&<div className="skfx" style={{left:'50%',transform:'translate(-50%,-50%)',color:'#FFF',fontSize:24}}>+10</div>}</button>
          </div>
        )}

        {/* Bottom bar */}
        {isVideo&&(
          <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'0 40px 32px',zIndex:10}}>
            <div ref={progressBarRef} className="pbar" style={{marginBottom:12}}
              onMouseDown={onBarDown} onMouseMove={onBarMove} onMouseUp={onBarUp} onMouseLeave={onBarLeave} onClick={e=>e.stopPropagation()}>
              <div className="pbuf" style={{width:`${bPct}%`}}/><div className="ppld" style={{width:`${pPct}%`}}/>
              {chapters.map((t,i)=><div key={i} className="cdot" style={{left:`${(t/duration)*100}%`}}/>)}
              <div className="pthumb" style={{left:`${pPct}%`}}/>
              {hoverT!==null&&(
                <div style={{position:'absolute',bottom:16,left:Math.max(24,Math.min(hoverX,(progressBarRef.current?.offsetWidth||0)-24)),transform:'translateX(-50%)',background:'rgba(0,0,0,.85)',color:'#AAA',fontSize:11,padding:'3px 8px',borderRadius:4,whiteSpace:'nowrap',pointerEvents:'none'}}>{fmtTime(hoverT)}</div>
              )}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
              <div style={{fontSize:15,fontWeight:500}}>
                <span style={{color:'#FFF'}}>{fmtTime(currentTime)}</span>
                <span style={{color:'#B3B3B3'}}> / {fmtTime(duration)}</span>
              </div>
              {mediaType==='tv'&&nextEpData&&(
                <button onClick={handleNextEpisode} style={{color:'#FFF',fontSize:15,fontWeight:600,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',padding:0}}
                  onMouseEnter={e=>e.currentTarget.style.color='#00A8E1'} onMouseLeave={e=>e.currentTarget.style.color='#FFF'}>
                  Next Episode <ChevronRightIcon/>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* X-Ray expanded */}
      {xrayExpanded&&(
        <div className="xray-panel" onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
            <span style={{color:'#AAA',fontSize:17,fontWeight:400}}>X-Ray</span>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button className="pbtn"><XRayExpandIcon/></button>
              <div style={{width:1,height:22,background:'rgba(255,255,255,.2)'}}/>
              <button className="pbtn" onClick={()=>setXrayExpanded(false)}><CloseIcon/></button>
            </div>
          </div>
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
            {['scene','cast'].map(tab=>(
              <button key={tab} onClick={()=>setXrayTab(tab)} style={{flex:1,padding:'14px 0',background:'none',border:'none',color:xrayTab===tab?'#fff':'rgba(255,255,255,.5)',fontSize:15,fontWeight:xrayTab===tab?600:400,cursor:'pointer',borderBottom:xrayTab===tab?'2px solid #fff':'2px solid transparent',marginBottom:-1}}>
                {tab==='scene'?'In Scene':'Cast'}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px 0',scrollbarWidth:'none'}}>
            {xrayCast.map(p=>(
              <div key={p.id} style={{marginBottom:2}}>
                <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',cursor:'pointer',background:expandCast===p.id?'rgba(255,255,255,.06)':'transparent'}} onClick={()=>setExpandCast(expandCast===p.id?null:p.id)}>
                  <div style={{position:'relative',flexShrink:0}}>
                    {p.profile?<img src={p.profile} alt={p.name} style={{width:72,height:72,objectFit:'cover',borderRadius:6}}/>
                      :<div style={{width:72,height:72,background:'#111',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.3)',fontSize:22,fontWeight:700}}>{p.name.charAt(0)}</div>}
                    <div style={{position:'absolute',bottom:4,left:4,background:'#f5c518',color:'#000',fontSize:8,fontWeight:800,padding:'1px 3px',borderRadius:2}}>IMDb</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:'#AAA',fontSize:14,marginBottom:3}}>{p.name}</div>
                    <div style={{color:'rgba(170,170,170,.65)',fontSize:12}}>Portrays: {p.character}</div>
                  </div>
                  <div style={{color:'#AAA'}}>{expandCast===p.id?<ChevronUpIcon/>:<ChevronDownIcon/>}</div>
                </div>
                {expandCast===p.id&&(
                  <div style={{padding:'12px 16px 16px 102px',background:'rgba(255,255,255,.03)'}}>
                    <div style={{color:'rgba(170,170,170,.7)',fontSize:12,lineHeight:1.6}}>Known for various acclaimed productions.</div>
                    <button style={{marginTop:10,background:'none',border:'1px solid rgba(255,255,255,.2)',color:'#f5c518',fontSize:12,fontWeight:600,padding:'5px 12px',borderRadius:4,cursor:'pointer'}}>View on IMDb</button>
                  </div>
                )}
              </div>
            ))}
            {xrayCast.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'rgba(170,170,170,.5)',fontSize:13}}>Loading cast…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
