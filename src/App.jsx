import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Clock, Ban, Eye, Bookmark, TrendingUp, Monitor } from 'lucide-react';

// --- GLOBAL HLS REFERENCE ---
// Note: Ensure <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script> is in your index.html
const Hls = window.Hls;

// --- CONFIGURATION ---
const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
const VIDFAST_BASE = "https://vidfast.pro";

// STRICT PRIME FILTERS
const PRIME_PROVIDER_IDS = "9|119";
const PRIME_REGION = "IN";

// --- HELPER: GET PROGRESS ---
const getMediaProgress = (type, id) => {
  try {
    const allProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
    const key = `${type === 'tv' ? 't' : 'm'}${id}`;
    return allProgress[key];
  } catch (e) { return null; }
};

// --- OPTIMIZATION HOOK: PRE-WARM CONNECTIONS ---
const useConnectionOptimizer = () => {
  useEffect(() => {
    const domains = [
      "https://vidfast.pro",
      "https://zxcstream.xyz",
      "https://slime403heq.com",
      "https://player.videasy.net",
      "https://dlhd.link",
      "https://embedsports.top",
      "https://api.themoviedb.org",
      "https://image.tmdb.org",
      "https://iptv-org.github.io",
      "https://a.111477.xyz",
      "https://corsproxy.io"
    ];
    domains.forEach(domain => {
      if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    });
  }, []);
};

// --- CSS STYLES ---
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .nav-gradient { background: linear-gradient(180deg, rgba(0,5,13,0.7) 10%, transparent); }
    .row-container {
      display: flex;
      overflow-y: hidden;
      overflow-x: scroll;
      padding: 100px 4%;
      margin-top: -60px;
      margin-bottom: -20px;
      gap: 16px;
      scroll-behavior: smooth;
      position: relative;
    }
    .rank-number {
      position: absolute;
      left: -75px;
      bottom: -15px;
      font-size: 240px;
      font-weight: 900;
      color: #19222b;
      -webkit-text-stroke: 4px #5a6069;
      z-index: 0;
      font-family: sans-serif;
      letter-spacing: -10px;
      line-height: 0.7;
      text-shadow: 0 0 15px rgba(0, 168, 225, 0.3);
    }
    @keyframes neon-pulse {
      0%, 100% { text-shadow: 0 0 10px rgba(0, 168, 225, 0.3); -webkit-text-stroke: 4px #5a6069; }
      50% { text-shadow: 0 0 30px rgba(0, 168, 225, 0.8); -webkit-text-stroke: 4px #00A8E1; transform: scale(1.02); }
    }
    .animate-neon-pulse { animation: neon-pulse 3s infinite ease-in-out; }
    .glow-card { position: relative; z-index: 10; }
    .glow-card::before {
      content: ""; position: absolute; inset: -2px; border-radius: 14px; padding: 2px;
      background: linear-gradient(45deg, transparent, rgba(0,168,225,0.3), transparent);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude; opacity: 0.5; transition: opacity 0.3s ease;
    }
    .glow-card:hover::before {
      background: linear-gradient(45deg, #00A8E1, #ffffff, #00A8E1); opacity: 1; box-shadow: 0 0 20px rgba(0,168,225,0.5);
    }
    @keyframes row-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-row-enter { animation: row-enter 0.6s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-in { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes modal-pop { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
    .animate-modal-pop { animation: modal-pop 0.2s ease-out forwards; }
  `}</style>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// --- 111477 DIRECTORY OPENER ---
async function get111477Downloads({ mediaItem, mediaType = 'movie' }) {
  const year = (mediaItem.release_date || mediaItem.first_air_date || '').slice(0, 4);
  const title = mediaItem.title || mediaItem.name;
  try {
    const baseDir = mediaType === 'tv' ? 'tvs' : 'movies';
    const baseUrl = `https://a.111477.xyz/${baseDir}/`;
    const finalUrl = mediaType === 'tv' ? `${baseUrl}${encodeURIComponent(title)}/` : `${baseUrl}${encodeURIComponent(title)}%20(${year})/`;
    return [{ source: '111477 Index', label: `Open Index`, url: finalUrl, type: 'external' }];
  } catch (error) { return []; }
}

const getTheme = (isPrimeOnly) => ({
  color: isPrimeOnly ? "text-[#00A8E1]" : "text-[#E50914]",
  bg: isPrimeOnly ? "bg-[#00A8E1]" : "bg-[#E50914]",
  hoverBg: isPrimeOnly ? "hover:bg-[#008ebf]" : "hover:bg-[#b20710]",
  border: isPrimeOnly ? "border-[#00A8E1]" : "border-[#E50914]",
  shadow: isPrimeOnly ? "shadow-[0_0_30px_rgba(0,168,225,0.5)]" : "shadow-[0_0_30px_rgba(229,9,20,0.5)]",
  name: isPrimeOnly ? "Prime" : "Every",
  logoText: isPrimeOnly ? "prime video" : "literally everything!"
});

// --- CATEGORY DECK & HOOKS ---
const CATEGORY_DECK = [
  { type: 'movie', label: "Action-Packed Thrillers", genre: 28, variant: 'standard' },
  { type: 'tv', label: "Binge-Worthy TV Dramas", genre: 18, variant: 'standard' },
  { type: 'movie', label: "Top 10 in India", variant: 'ranked' },
  { type: 'movie', label: "Laugh Out Loud", genre: 35, variant: 'vertical' },
  { type: 'movie', label: "Sci-Fi Masterpieces", genre: 878, variant: 'standard' },
  { type: 'movie', label: "Horror Nights", genre: 27, variant: 'vertical' },
  { type: 'tv', label: "Animated Adventures", genre: 16, variant: 'standard' },
  { type: 'movie', label: "Golden Oldies", year: 1995, variant: 'vertical' },
  { type: 'movie', label: "Critical Acclaim", sort: 'vote_average.desc', variant: 'standard' },
];

const shuffleDeck = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const useInfiniteRows = (type = 'movie', isPrimeOnly = true) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);

  useEffect(() => {
    const filteredDeck = type === 'all' ? [...CATEGORY_DECK] : CATEGORY_DECK.filter(item => item.type === type);
    setDeck(shuffleDeck(filteredDeck));
    
    const getBaseHeroUrl = (t) => isPrimeOnly
      ? `/discover/${t}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc&page=1`
      : `/trending/${t}/day?api_key=${TMDB_API_KEY}`;
    
    const initialRows = [
      { id: 'trending_hero', title: isPrimeOnly ? "Prime - Recommended" : "Trending Now", fetchUrl: getBaseHeroUrl(type === 'all' ? 'movie' : type), variant: 'standard', itemType: type === 'all' ? 'movie' : type },
      { id: 'top_10', title: "Top 10", fetchUrl: getBaseHeroUrl(type === 'all' ? 'movie' : type), variant: 'ranked', itemType: type === 'all' ? 'movie' : type },
    ];
    setRows(initialRows);
  }, [type, isPrimeOnly]);

  const loadMore = useCallback(() => {
    if (loading || deck.length === 0) return;
    setLoading(true);
    const nextThree = [];
    for(let i=0; i<3; i++) { const idx = (deckIndex + i) % deck.length; nextThree.push(deck[idx]); }
    const nextBatch = nextThree.map((cat, i) => ({
      id: `row-${Date.now()}-${i}`,
      title: cat.label,
      fetchUrl: `/discover/${cat.type}?api_key=${TMDB_API_KEY}&with_genres=${cat.genre || ''}&sort_by=${cat.sort || 'popularity.desc'}`,
      variant: cat.variant,
      itemType: cat.type
    }));
    setTimeout(() => { setRows(prev => [...prev, ...nextBatch]); setDeckIndex(prev => prev + 3); setLoading(false); }, 600);
  }, [loading, deck, deckIndex]);

  return { rows, loadMore, loading };
};

const InfiniteScrollTrigger = ({ onIntersect }) => {
  const triggerRef = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) onIntersect(); }, { threshold: 0.1 });
    if (triggerRef.current) observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, [onIntersect]);
  return <div ref={triggerRef} className="h-20 w-full flex items-center justify-center p-4"><div className="w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"></div></div>;
};

// --- COMPONENTS ---

// --- NAVBAR ---
const Navbar = ({ isPrimeOnly }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState({ text: [], visual: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const theme = getTheme(isPrimeOnly);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length < 2) { setSuggestions({ text: [], visual: [] }); return; }
      try {
        const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}&page=1`);
        const data = await res.json();
        let results = (data.results || []).filter(i => i.media_type === 'movie' || i.media_type === 'tv');
        setSuggestions({ text: results.map(i => i.title || i.name).slice(0, 3), visual: results.slice(0, 4) });
      } catch (e) {}
    };
    const timeoutId = setTimeout(() => { if (query) fetchSuggestions(); else setShowSuggestions(false); }, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault(); setShowSuggestions(false);
    if (query.trim()) navigate(`${isPrimeOnly ? '/search' : '/everything/search'}?q=${encodeURIComponent(query)}`);
  };

  const getNavLinkClass = (path) => location.pathname === path 
    ? "text-white font-bold bg-white/20 backdrop-blur-md rounded-[20px] px-5 py-2 text-[15px] transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
    : "text-[#aaaaaa] font-bold text-[15px] hover:text-white px-4 py-2 transition-colors duration-300";

  // Floating, Carved Glass Effect, 60px Padding
  const navContainerClass = isScrolled
    ? "fixed top-0 left-1/2 -translate-x-1/2 w-[1521px] max-w-[95%] h-[66px] z-[1000] rounded-b-[16px] backdrop-blur-xl bg-[#0f171e]/95 shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.1)] border-b border-white/5 transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] will-change-transform"
    : "fixed top-0 left-1/2 -translate-x-1/2 w-full h-[66px] z-[1000] bg-gradient-to-b from-black/90 to-transparent transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]";

  return (
    <nav className={navContainerClass} style={{ fontFamily: '"Amazon Ember", "Inter", sans-serif' }}>
      <div className="w-full h-full flex items-center justify-between px-[60px]">
        <div className="flex items-center gap-8">
          <Link to={isPrimeOnly ? "/" : "/everything"} className="text-[#ffffff] font-bold text-[22px] tracking-tight no-underline leading-none hover:text-[#00A8E1] transition-colors">{theme.logoText}</Link>
          <div className="flex items-center gap-2">
            <Link to={isPrimeOnly ? "/" : "/everything"} className={getNavLinkClass(isPrimeOnly ? "/" : "/everything")}>Home</Link>
            <Link to={isPrimeOnly ? "/movies" : "/everything/movies"} className={getNavLinkClass(isPrimeOnly ? "/movies" : "/everything/movies")}>Movies</Link>
            <Link to={isPrimeOnly ? "/tv" : "/everything/tv"} className={getNavLinkClass(isPrimeOnly ? "/tv" : "/everything/tv")}>TV shows</Link>
            <Link to="/sports" className={getNavLinkClass("/sports")}>Live TV</Link>
            <div className="w-[1px] h-5 bg-gray-600 mx-3"></div>
            <Link to="/subscriptions" className="text-[#aaaaaa] font-bold text-[15px] hover:text-white px-2 flex items-center gap-2 transition-colors"><Grip size={18} className="rotate-45" /> Subscriptions</Link>
            <Link to="/store" className="text-[#aaaaaa] font-bold text-[15px] hover:text-white px-2 flex items-center gap-2 transition-colors"><Monitor size={18} /> Store</Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div ref={searchRef} className="relative group">
             <div className={`flex items-center ${query ? 'bg-[#19222b] border border-white/20 w-[260px]' : 'w-auto'} transition-all duration-300 rounded-[4px]`}>
               {query ? (
                  <><Search size={20} className="text-[#c7cbd1] ml-2" /><form onSubmit={handleSearch} className="flex-1"><input className="bg-transparent border-none outline-none text-white text-[15px] font-medium px-2 w-full h-9 placeholder-[#5a6069]" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></form><X size={18} className="text-[#c7cbd1] mr-2 cursor-pointer" onClick={() => setQuery("")} /></>
               ) : (
                  <Search size={24} className="text-[#aaaaaa] hover:text-white cursor-pointer transition-colors" onClick={() => setQuery(" ")} />
               )}
            </div>
            {showSuggestions && suggestions.visual.length > 0 && (
                <div className="absolute top-12 right-0 w-[300px] bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-[160]">
                   {suggestions.visual.slice(0,5).map((item) => (
                      <div key={item.id} onClick={() => { setShowSuggestions(false); navigate(`/detail/${item.media_type}/${item.id}`); }} className="flex items-center gap-3 p-3 hover:bg-[#333c46] cursor-pointer border-b border-white/5"><img src={`${IMAGE_BASE_URL}${item.poster_path}`} className="w-8 rounded-sm" alt="" /><div className="text-sm font-bold text-gray-300">{item.title || item.name}</div></div>
                   ))}
                </div>
            )}
          </div>
          <div className="relative" ref={dropdownRef}>
            <div className="cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}><Grip size={24} className="text-[#aaaaaa] hover:text-white transition-colors" /></div>
            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl p-2 z-[150] animate-in fade-in">
                 <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${isPrimeOnly ? 'bg-[#00A8E1] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Prime Video</div></div></Link>
                 <Link to="/everything" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${!isPrimeOnly ? 'bg-[#E50914] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={!isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Literally Everything!</div></div></Link>
              </div>
            )}
          </div>
          <Link to="/watchlist"><Bookmark size={24} className="text-[#aaaaaa] hover:text-white transition-colors" /></Link>
          <div className="w-9 h-9 rounded-full bg-[#232f3e] flex items-center justify-center cursor-pointer border border-transparent hover:border-white/50 transition-all overflow-hidden relative"><div className="absolute inset-0 bg-gradient-to-tr from-[#1A92B6] to-[#6DD5FA] opacity-80"></div><div className="relative z-10 w-3 h-3 bg-white rounded-full mb-1"></div><div className="absolute bottom-0 w-6 h-3 bg-white rounded-t-full z-10"></div></div>
          <button className="bg-[#007185] hover:bg-[#006476] text-white text-[15px] font-bold px-4 py-2 rounded-[4px] transition-colors shadow-sm">Join Prime</button>
        </div>
      </div>
    </nav>
  );
};

// --- HERO COMPONENT ---
const Hero = ({ isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  useEffect(() => {
    const endpoint = isPrimeOnly
      ? `/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc`
      : `/trending/all/day?api_key=${TMDB_API_KEY}`;
    fetch(`${BASE_URL}${endpoint}`).then(res => res.json()).then(data => setMovies(data.results.slice(0, 5)));
  }, [isPrimeOnly]);

  useEffect(() => {
    if (movies.length === 0) return;
    setShowVideo(false); setTrailerKey(null);
    const movie = movies[currentSlide];
    fetch(`${BASE_URL}/${movie.media_type || 'movie'}/${movie.id}/videos?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => {
      const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) { setTrailerKey(trailer.key); setTimeout(() => setShowVideo(true), 4000); }
    });
  }, [currentSlide, movies]);

  if (movies.length === 0) return <div className="h-[85vh] w-full bg-[#00050D]" />;
  const movie = movies[currentSlide];

  return (
    <div className="relative w-full h-[85vh] overflow-hidden group">
      <div className={`absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`}><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" /></div>
      {showVideo && trailerKey && (
        <div className="absolute inset-0 animate-in pointer-events-none">
          <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} className="w-full h-full scale-[1.3]" allow="autoplay; encrypted-media" frameBorder="0" title="Hero"></iframe>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/40 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-transparent to-transparent" />
      <div className="absolute top-[25%] left-[4%] max-w-[600px] z-30 animate-row-enter">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-md">{movie.title || movie.name}</h1>
        <div className="flex items-center gap-3 text-[#a9b7c1] font-bold text-sm mb-6">{isPrimeOnly && <span className={`${theme.color}`}>Included with Prime</span>}<span>UHD</span><span>16+</span></div>
        <p className="text-lg text-white font-medium line-clamp-3 mb-8 opacity-90">{movie.overview}</p>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} text-white h-14 px-8 rounded-md font-bold text-lg flex items-center gap-3 hover:scale-105 transition`}><Play fill="white" size={24} /> Play</button>
          <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] transition"><Info size={28} className="text-gray-200" /></button>
        </div>
      </div>
      <button onClick={() => setIsMuted(!isMuted)} className="absolute top-32 right-[4%] z-40 w-12 h-12 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
    </div>
  );
};

// --- MOVIE CARD ---
const MovieCard = ({ movie, variant, itemType, onHover, onLeave, isHovered, rank, isPrimeOnly, isFirst, isLast }) => {
  const navigate = useNavigate();
  const type = movie.media_type || itemType || 'movie';
  const id = movie.id;
  const progressData = getMediaProgress(type, id);
  const percent = progressData?.progress?.watched && progressData?.progress?.duration ? (progressData.progress.watched / progressData.progress.duration) * 100 : 0;
  
  return (
    <div className={`relative flex-shrink-0 w-[160px] md:w-[200px] aspect-[2/3] ${variant === 'ranked' ? 'ml-[110px]' : ''} group transition-all duration-300`} onMouseEnter={() => onHover(movie.id)} onMouseLeave={onLeave} onClick={() => navigate(`/detail/${type}/${id}`)} style={{ zIndex: isHovered ? 100 : 10 }}>
      {variant === 'ranked' && <span className="rank-number animate-neon-pulse">{rank}</span>}
      <div className={`relative w-full h-full rounded-xl overflow-hidden cursor-pointer bg-[#19222b] shadow-xl transform transition-all duration-[400ms] border border-white/5 glow-card ${isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center'}`} style={{ transform: isHovered ? 'scale(1.8)' : 'scale(1)' }}>
        <img src={`${IMAGE_BASE_URL}${movie.poster_path || movie.backdrop_path}`} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
        {percent > 0 && percent < 95 && <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700 z-20"><div className="h-full bg-[#00A8E1]" style={{ width: `${percent}%` }} /></div>}
        <div className={`absolute inset-0 flex flex-col justify-end px-4 py-5 text-white bg-gradient-to-t from-[#0f171e] to-transparent transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <h3 className="font-extrabold text-[10px] mb-2 line-clamp-2">{movie.title || movie.name}</h3>
          <div className="flex items-center gap-2 mb-3"><button className="bg-white text-black text-[6px] font-bold h-6 px-3 rounded-[3px] flex items-center justify-center gap-1"><Play fill="black" size={6} /> Play</button><button className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><Plus size={8} className="text-white" /></button></div>
          <div className="flex items-center gap-1.5 text-[6px] font-medium text-gray-300"><span className="text-[#46d369]">98% Match</span><span>•</span><span>{movie.release_date?.split('-')[0]}</span></div>
        </div>
      </div>
    </div>
  );
};

// --- ROW ---
const Row = ({ title, fetchUrl, data = null, variant = 'standard', itemType = 'movie', isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const rowRef = useRef(null);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    if (data) { setMovies(data); return; }
    fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(data => setMovies((data.results || []).filter(m => m.poster_path))).catch(err => console.error(err));
  }, [fetchUrl, data]);

  const handleHover = (id) => { clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setHoveredId(id), 400); };
  const handleLeave = () => { clearTimeout(timeoutRef.current); setHoveredId(null); };
  const slide = (dir) => { if (rowRef.current) rowRef.current.scrollBy({ left: dir === 'left' ? -800 : 800, behavior: 'smooth' }); };

  return (
    <div className="mb-6 pl-4 md:pl-12 relative z-20 group/row animate-row-enter hover:z-30">
      <h3 className="text-[19px] font-bold text-white mb-2 flex items-center gap-2">{title}<ChevronRight size={18} className="text-[#8197a4] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"/></h3>
      <div className="relative">
        <button onClick={() => slide('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-start pl-3"><ChevronLeft size={40} className="text-white hover:scale-125" /></button>
        <div ref={rowRef} className={`row-container ${variant === 'vertical' ? 'vertical' : ''} scrollbar-hide`}>
          {(variant === 'ranked' ? movies.slice(0, 10) : movies).map((movie, index) => ( <MovieCard key={movie.id} movie={movie} variant={variant} itemType={itemType} rank={index + 1} isHovered={hoveredId === movie.id} onHover={handleHover} onLeave={handleLeave} isPrimeOnly={isPrimeOnly} isFirst={index === 0} isLast={index === movies.length - 1} /> ))}
        </div>
        <button onClick={() => slide('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-end pr-3"><ChevronRight size={40} className="text-white hover:scale-125" /></button>
      </div>
    </div>
  );
};

// --- MOVIE DETAIL ---
const MovieDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [related, setRelated] = useState([]);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  
  useEffect(() => {
    window.scrollTo(0, 0); setShowVideo(false);
    fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => setMovie(data));
    fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => setRelated(data.results));
    fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => {
        const trailer = data.results?.find(v => v.site === 'YouTube');
        if (trailer) { setTrailerKey(trailer.key); setTimeout(() => setShowVideo(true), 3000); }
    });
  }, [type, id]);

  if (!movie) return <div className="min-h-screen bg-[#0f171e]" />;

  return (
    <div className="min-h-screen bg-[#0f171e] text-white pb-20">
      <div className="relative w-full h-[85vh]">
        <div className={`absolute inset-0 transition-opacity duration-1000 ${showVideo ? 'opacity-0' : 'opacity-100'}`}><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" /></div>
        {showVideo && trailerKey && (<div className="absolute inset-0 animate-in pointer-events-none"><iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&loop=1&playlist=${trailerKey}`} className="w-full h-full scale-[1.5]" frameBorder="0" allow="autoplay; encrypted-media"></iframe></div>)}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-20 max-w-4xl pt-12">
          <h1 className="text-6xl font-bold mb-6">{movie.title || movie.name}</h1>
          <div className="flex gap-4 mb-6"><button onClick={() => navigate(`/watch/${type}/${id}`)} className="h-14 w-full rounded bg-white text-black font-bold text-lg flex items-center justify-center gap-2"><Play fill="black" /> Play</button></div>
          <p className="text-gray-300 leading-relaxed">{movie.overview}</p>
        </div>
      </div>
      <div className="px-12 py-8"><h3 className="text-xl font-bold mb-4">Related</h3><div className="flex gap-4 overflow-x-auto scrollbar-hide">{related.map(m => <div key={m.id} onClick={() => navigate(`/detail/${type}/${m.id}`)} className="min-w-[200px] aspect-[2/3] cursor-pointer"><img src={`${IMAGE_BASE_URL}${m.poster_path}`} className="rounded-lg" /></div>)}</div></div>
    </div>
  );
};

// --- SEARCH RESULTS ---
const SearchResults = ({ isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const query = new URLSearchParams(useLocation().search).get('q');
  const navigate = useNavigate();
  
  useEffect(() => {
    if (query) fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}`).then(res => res.json()).then(data => setMovies((data.results || []).filter(m => m.poster_path)));
  }, [query]);

  return (
    <div className="pt-28 px-8 min-h-screen">
      <h2 className="text-white text-2xl mb-6">Results for "{query}"</h2>
      <div className="grid grid-cols-6 gap-4">{movies.map(m => <div key={m.id} onClick={() => navigate(`/detail/${m.media_type || 'movie'}/${m.id}`)} className="cursor-pointer"><img src={`${IMAGE_BASE_URL}${m.poster_path}`} className="rounded-md hover:scale-105 transition" /></div>)}</div>
    </div>
  );
};

// --- WATCHLIST PAGE ---
const WatchlistPage = () => {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    const list = JSON.parse(localStorage.getItem('watchlist')) || [];
    Promise.all(list.map(k => { const [t, i] = k.split('-'); return fetch(`${BASE_URL}/${t}/${i}?api_key=${TMDB_API_KEY}`).then(r => r.json()).then(d => ({ ...d, media_type: t })); })).then(res => setItems(res));
  }, []);
  return (
    <div className="pt-28 px-12 min-h-screen"><h2 className="text-3xl font-bold text-white mb-8">Watchlist</h2><div className="grid grid-cols-6 gap-6">{items.map(item => <div key={item.id} onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)} className="cursor-pointer"><img src={`${IMAGE_BASE_URL}${item.poster_path}`} className="rounded-lg" /></div>)}</div></div>
  );
};

// --- PLAYER COMPONENT (UPDATED) ---
const Player = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeServer, setActiveServer] = useState('vidfast'); 
  const [isIndian, setIsIndian] = useState(false);
  const [isBengali, setIsBengali] = useState(false); 
  const [imdbId, setImdbId] = useState(null);
  const [movieData, setMovieData] = useState(null);
  
  const queryParams = new URLSearchParams(location.search);
  const [season, setSeason] = useState(Number(queryParams.get('season')) || 1);
  const [episode, setEpisode] = useState(Number(queryParams.get('episode')) || 1);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [seasonData, setSeasonData] = useState(null);
  const [totalSeasons, setTotalSeasons] = useState(1);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const data = await res.json();
        setMovieData(data);
        const foundImdbId = data.imdb_id || data.external_ids?.imdb_id;
        setImdbId(foundImdbId);
        const lang = data.original_language;
        const indianLanguages = ['hi', 'ta', 'te', 'ml', 'kn', 'mr', 'pa', 'gu']; 
        const isBn = lang === 'bn';
        const isInd = indianLanguages.includes(lang);
        setIsBengali(isBn); setIsIndian(isInd);
        if (isBn) setActiveServer('videasy'); else if (isInd) setActiveServer('slime'); else setActiveServer('vidfast');
        if (type === 'tv' && data.number_of_seasons) setTotalSeasons(data.number_of_seasons);
      } catch (e) { console.error(e); }
    };
    fetchDetails();
  }, [type, id]);

  useEffect(() => {
    if (!movieData) return;
    const saveProgress = (currentTime, duration) => {
        const key = `${type === 'tv' ? 't' : 'm'}${id}`;
        const existing = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
        const entry = { id: Number(id), type: type, title: movieData.title || movieData.name, poster_path: movieData.poster_path, backdrop_path: movieData.backdrop_path, last_season_watched: type === 'tv' ? season : undefined, last_episode_watched: type === 'tv' ? episode : undefined, progress: { watched: currentTime, duration: duration || (movieData.runtime ? movieData.runtime * 60 : 0) }, last_updated: Date.now() };
        localStorage.setItem('vidFastProgress', JSON.stringify({ ...existing, [key]: entry }));
    };
    saveProgress(0, 0);
    const handleMessage = (e) => {
        if (!e.data) return;
        if (e.data.type === 'timeupdate' || e.data.event === 'timeupdate') { const time = e.data.time || e.data.currentTime; const duration = e.data.duration; if (time > 5) saveProgress(time, duration); }
        try { if (typeof e.data === 'string' && e.data.includes('timestamp')) { const parsed = JSON.parse(e.data); if (parsed && parsed.timestamp) saveProgress(parsed.timestamp, parsed.duration); } } catch (err) {}
    };
    window.addEventListener('message', handleMessage); return () => window.removeEventListener('message', handleMessage);
  }, [movieData, type, id, season, episode]);

  useEffect(() => { if (type === 'tv') fetch(`${BASE_URL}/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => setSeasonData(data)); }, [type, id, season]);

  const getSourceUrl = () => {
    const progress = getMediaProgress(type, id); const startTime = progress?.progress?.watched || 0;
    if (activeServer === 'videasy') { const commonParams = `color=00A8E1&overlay=true&progress=${startTime}`; if (type === 'tv') return `https://player.videasy.net/tv/${id}/${season}/${episode}?${commonParams}&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true`; return `https://player.videasy.net/movie/${id}?${commonParams}`; }
    if (activeServer === 'slime') { const targetId = imdbId || id; const hash = startTime > 0 ? `#t=${startTime}` : ''; if (type === 'tv') return `https://slime403heq.com/play/${targetId}?season=${season}&episode=${episode}${hash}`; return `https://slime403heq.com/play/${targetId}${hash}`; }
    if (activeServer === 'vidfast') { const themeParam = "theme=00A8E1"; if (type === 'tv') return `${VIDFAST_BASE}/tv/${id}/${season}/${episode}?autoPlay=true&t=${startTime}&${themeParam}&nextButton=true&autoNext=true`; return `${VIDFAST_BASE}/movie/${id}?autoPlay=true&t=${startTime}&${themeParam}`; }
    else { const startParam = startTime > 0 ? `&start=${startTime}` : ''; if (type === 'tv') return `https://www.zxcstream.xyz/player/tv/${id}/${season}/${episode}?autoplay=false&back=true&server=0${startParam}`; return `https://www.zxcstream.xyz/player/movie/${id}?autoplay=false&back=true&server=0${startParam}`; }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-full h-20 pointer-events-none z-[120] flex items-center justify-between px-6">
        <button onClick={() => navigate(-1)} className="pointer-events-auto bg-black/50 hover:bg-[#00A8E1] text-white p-3 rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg group"><ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" /></button>
        <div className="pointer-events-auto flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-2xl transform translate-y-2">
          <div className="flex bg-[#19222b] rounded-lg p-1 gap-1">
            {isBengali && <button onClick={() => setActiveServer('videasy')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeServer === 'videasy' ? 'bg-[#00A8E1] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><CheckCircle2 size={12} /> Bengali Player</button>}
            {!isBengali && <button onClick={() => setActiveServer('slime')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeServer === 'slime' ? 'bg-[#E50914] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>{isIndian && <CheckCircle2 size={12} />} Bollywood / Indian</button>}
            <button onClick={() => setActiveServer('vidfast')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeServer === 'vidfast' ? 'bg-[#00A8E1] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>VidFast</button>
            <button onClick={() => setActiveServer('zxcstream')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeServer === 'zxcstream' ? 'bg-[#00A8E1] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Multi-Audio</button>
          </div>
        </div>
        {type === 'tv' ? <button onClick={() => setShowEpisodes(!showEpisodes)} className={`pointer-events-auto p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${showEpisodes ? 'bg-[#00A8E1] text-white' : 'bg-black/50 hover:bg-[#333c46] text-gray-200'}`}><List size={24} /></button> : <div className="w-12"></div>}
      </div>
      <div className="flex-1 relative w-full h-full bg-black"><iframe key={activeServer + season + episode} src={getSourceUrl()} className="w-full h-full border-none" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen title="Player"></iframe></div>
      {type === 'tv' && (
        <div className={`fixed right-0 top-0 h-full bg-[#00050D]/95 backdrop-blur-xl border-l border-white/10 transition-all duration-500 ease-in-out z-[110] flex flex-col ${showEpisodes ? 'w-[350px] translate-x-0 shadow-2xl' : 'w-[350px] translate-x-full shadow-none'}`}>
          <div className="pt-24 px-6 pb-4 border-b border-white/10 flex items-center justify-between bg-[#1a242f]/50"><h2 className="font-bold text-white text-lg">Episodes</h2><div className="relative"><select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="appearance-none bg-[#00A8E1] text-white font-bold py-1.5 pl-3 pr-8 rounded cursor-pointer text-sm outline-none hover:bg-[#008ebf] transition">{Array.from({length: totalSeasons}, (_, i) => i + 1).map(s => (<option key={s} value={s} className="bg-[#1a242f]">Season {s}</option>))}</select><ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-white pointer-events-none" /></div></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">{seasonData?.episodes ? (seasonData.episodes.map(ep => (<div key={ep.id} onClick={() => setEpisode(ep.episode_number)} className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all group ${episode === ep.episode_number ? 'bg-[#333c46] border border-[#00A8E1]' : 'hover:bg-[#333c46] border border-transparent'}`}><div className="relative w-28 h-16 flex-shrink-0 bg-black rounded overflow-hidden">{ep.still_path ? (<img src={`${IMAGE_BASE_URL}${ep.still_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" />) : (<div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Img</div>)}{episode === ep.episode_number && (<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Play size={16} fill="white" className="text-white" /></div>)}</div><div className="flex flex-col justify-center min-w-0"><span className={`text-xs font-bold mb-0.5 ${episode === ep.episode_number ? 'text-[#00A8E1]' : 'text-gray-400'}`}>Episode {ep.episode_number}</span><h4 className={`text-sm font-medium truncate leading-tight ${episode === ep.episode_number ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{ep.name}</h4></div></div>))) : (<div className="text-center text-gray-500 mt-10 flex flex-col items-center"><Loader className="animate-spin mb-2" /><span>Loading Season {season}...</span></div>)}</div>
        </div>
      )}
    </div>
  );
};

// --- SPORTS PAGE ---
const SportsPage = () => {
  const [channels, setChannels] = useState([]);
  const [displayedChannels, setDisplayedChannels] = useState([]);
  const [activeMainCategory, setActiveMainCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 60;
  
  const navigate = useNavigate(); 

  const SPECIAL_STREAM = { name: "T20 WC: Zimbabwe vs Oman", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/ICC_Men%27s_T20_World_Cup_2024.svg/1200px-ICC_Men%27s_T20_World_Cup_2024.svg.png", group: "Cricket", parentGroup: "Sports", url: "https://embedsports.top/embed/echo/mens-t20-world-cup-zimbabwe-vs-oman-cricket-hundred-1/1?autoplay=1", isEmbed: true };

  const DLHD_CHANNELS = [
    { name: "ABC USA", id: "51" }, { name: "AHC", id: "206" }, { name: "Antenna TV USA", id: "283" }, { name: "A&E USA", id: "302" }, { name: "AMC USA", id: "303" }, { name: "Animal Planet", id: "304" }, { name: "Astro SuperSport 1", id: "123" }, { name: "Astro SuperSport 2", id: "124" }, { name: "Astro SuperSport 3", id: "125" }, { name: "Astro SuperSport 4", id: "126" }, { name: "Arena Sport 1 Premium", id: "134" }, { name: "Arena Sport 2 Premium", id: "135" }, { name: "Arena Sport 3 Premium", id: "139" }, { name: "Arena Sport 1 Serbia", id: "429" }, { name: "Arena Sport 2 Serbia", id: "430" }, { name: "Arena Sport 3 Serbia", id: "431" }, { name: "Arena Sport 4 Serbia", id: "581" }, { name: "Arena Sport 1 Croatia", id: "432" }, { name: "Arena Sport 2 Croatia", id: "433" }, { name: "Arena Sport 3 Croatia", id: "434" }, { name: "Arena Sport 4 Croatia", id: "580" }, { name: "Alkass One", id: "781" }, { name: "Alkass Two", id: "782" }, { name: "Alkass Three", id: "783" }, { name: "Alkass Four", id: "784" }, { name: "Arena Sport 1 BiH", id: "579" }, { name: "Abu Dhabi Sports 1 UAE", id: "600" }, { name: "Abu Dhabi Sports 2 UAE", id: "601" }, { name: "Abu Dhabi Sports 1 Premium", id: "609" }, { name: "Abu Dhabi Sports 2 Premium", id: "610" }, { name: "Astro Cricket", id: "370" }, { name: "Antena 3 Spain", id: "531" }, { name: "Arena Sports Tenis Serbia", id: "612" }, { name: "ACC Network USA", id: "664" }, { name: "Adult Swim", id: "295" }, { name: "A Sport PK", id: "269" }, { name: "AXN Movies Portugal", id: "717" }, { name: "Arte DE", id: "725" }, { name: "AXS TV USA", id: "742" }, { name: "ABC NY USA", id: "766" }, { name: "Azteca 7 MX", id: "844" }, { name: "Altitude Sports", id: "923" }, { name: "Azteca Uno MX", id: "934" }, { name: "Arena Sport 5 Serbia", id: "940" }, { name: "Arena Sport 6 Serbia", id: "941" }, { name: "Arena Sport 7 Serbia", id: "942" }, { name: "Arena Sport 8 Serbia", id: "943" }, { name: "Arena Sport 9 Serbia", id: "944" }, { name: "Arena Sport 10 Serbia", id: "945" }, { name: "Arte France", id: "958" }, { name: "Automoto La chaîne", id: "961" }, { name: "ATV Turkey", id: "1000" }, { name: "A Spor Turkey", id: "1011" },
    { name: "beIN Sports MENA English 1", id: "61" }, { name: "beIN Sports MENA English 2", id: "90" }, { name: "beIN Sports 1 Arabic", id: "91" }, { name: "beIN Sports 2 Arabic", id: "92" }, { name: "beIN Sports 3 Arabic", id: "93" }, { name: "beIN Sports 4 Arabic", id: "94" }, { name: "beIN Sports 5 Arabic", id: "95" }, { name: "beIN Sports 6 Arabic", id: "96" }, { name: "beIN Sports 7 Arabic", id: "97" }, { name: "beIN Sports 8 Arabic", id: "98" }, { name: "beIN Sports 9 Arabic", id: "99" }, { name: "beIN SPORTS XTRA 1", id: "100" }, { name: "beIN Sports MAX 4 France", id: "494" }, { name: "beIN Sports MAX 5 France", id: "495" }, { name: "beIN Sports MAX 6 France", id: "496" }, { name: "beIN Sports MAX 7 France", id: "497" }, { name: "beIN Sports MAX 8 France", id: "498" }, { name: "beIN Sports MAX 9 France", id: "499" }, { name: "beIN Sports MAX 10 France", id: "500" }, { name: "beIN SPORTS 1 France", id: "116" }, { name: "beIN SPORTS 2 France", id: "117" }, { name: "beIN SPORTS 3 France", id: "118" }, { name: "beIN SPORTS 1 Turkey", id: "62" }, { name: "beIN SPORTS 2 Turkey", id: "63" }, { name: "beIN SPORTS 3 Turkey", id: "64" }, { name: "beIN SPORTS 4 Turkey", id: "67" }, { name: "BeIN Sports HD Qatar", id: "578" }, { name: "BeIN SPORTS USA", id: "425" }, { name: "beIN SPORTS en Espańol", id: "372" }, { name: "beIN SPORTS Australia 1", id: "491" }, { name: "beIN SPORTS Australia 2", id: "492" }, { name: "beIN SPORTS Australia 3", id: "493" }, { name: "beIN Sports 1 Malaysia", id: "712" }, { name: "beIN Sports 2 Malaysia", id: "713" }, { name: "beIN Sports 3 Malaysia", id: "714" }, { name: "bein Sports 5 Turkey", id: "1010" },
    { name: "Barca TV Spain", id: "522" }, { name: "Benfica TV PT", id: "380" }, { name: "Boomerang", id: "648" }, { name: "BNT 1 Bulgaria", id: "476" }, { name: "BNT 2 Bulgaria", id: "477" }, { name: "BNT 3 Bulgaria", id: "478" }, { name: "BR Fernsehen DE", id: "737" }, { name: "bTV Bulgaria", id: "479" }, { name: "bTV Action Bulgaria", id: "481" }, { name: "bTV Lady Bulgaria", id: "484" }, { name: "BBC America (BBCA)", id: "305" }, { name: "BET USA", id: "306" }, { name: "Bravo USA", id: "307" }, { name: "BBC News Channel HD", id: "349" }, { name: "BBC One UK", id: "356" }, { name: "BBC Two UK", id: "357" }, { name: "BBC Three UK", id: "358" }, { name: "BBC Four UK", id: "359" }, { name: "BIG TEN Network (BTN USA)", id: "397" }, { name: "BFM TV France", id: "957" }, { name: "Bandsports Brasil", id: "275" },
    { name: "Canal+ MotoGP France", id: "271" }, { name: "Canal+ Formula 1", id: "273" }, { name: "CW PIX 11 USA", id: "280" }, { name: "CBS USA", id: "52" }, { name: "Court TV USA", id: "281" }, { name: "CW USA", id: "300" }, { name: "CNBC USA", id: "309" }, { name: "Comedy Central", id: "310" }, { name: "Cartoon Network", id: "339" }, { name: "CNN USA", id: "345" }, { name: "Cinemax USA", id: "374" }, { name: "Cuatro Spain", id: "535" }, { name: "Channel 4 UK", id: "354" }, { name: "Channel 5 UK", id: "355" }, { name: "CBS Sports Network (CBSSN)", id: "308" }, { name: "Canal+ France", id: "121" }, { name: "Canal+ Sport France", id: "122" }, { name: "Canal+ Foot France", id: "463" }, { name: "Canal+ Sport360", id: "464" }, { name: "Canal 11 Portugal", id: "540" }, { name: "Canal+ Sport Poland", id: "48" }, { name: "Canal+ Sport 2 Poland", id: "73" }, { name: "Canal+ Sport 3 Poland", id: "259" }, { name: "Canal+ Sport 5 Poland", id: "75" }, { name: "Canal+ Premium Poland", id: "566" }, { name: "Canal+ Family Poland", id: "567" }, { name: "Canal+ Seriale Poland", id: "570" }, { name: "Canal+ Sport 1 Afrique", id: "486" }, { name: "Canal+ Sport 2 Afrique", id: "487" }, { name: "Canal+ Sport 3 Afrique", id: "488" }, { name: "Canal+ Sport 4 Afrique", id: "489" }, { name: "Canal+ Sport 5 Afrique", id: "490" }, { name: "CANAL 9 Denmark", id: "805" }, { name: "Combate Brasil", id: "89" }, { name: "Channel 9 Israel", id: "546" }, { name: "Channel 10 Israe", id: "547" }, { name: "Channel 11 Israel", id: "548" }, { name: "Channel 12 Israel", id: "549" }, { name: "Channel 13 Israel", id: "551" }, { name: "Channel 14 Israel", id: "552" }, { name: "C More First Sweden", id: "812" }, { name: "C More Hits Sweden", id: "813" }, { name: "C More Series Sweden", id: "814" }, { name: "COZI TV USA", id: "748" }, { name: "CMT USA", id: "647" }, { name: "CTV Canada", id: "602" }, { name: "CTV 2 Canada", id: "838" }, { name: "Crime+ Investigation USA", id: "669" }, { name: "Comet USA", id: "696" }, { name: "Cooking Channel USA", id: "697" }, { name: "Cleo TV", id: "715" }, { name: "C SPAN 1", id: "750" }, { name: "CBSNY USA", id: "767" }, { name: "Chicago Sports Network", id: "776" }, { name: "Citytv", id: "831" }, { name: "CBC CA", id: "832" }, { name: "Claro Sports MX", id: "933" }, { name: "Canal5 MX", id: "936" }, { name: "C8 France", id: "956" }, { name: "CNews France", id: "964" }, { name: "Canal+ Sport CZ", id: "1020" }, { name: "CT Sport CZ", id: "1033" }, { name: "Nova HD CZ", id: "1034" }, { name: "CT1 HD CZ", id: "1035" }, { name: "CT2 HD CZ", id: "1036" }, { name: "TN Live CZ", id: "1037" }, { name: "OnePlay Sport 4 CZ", id: "1038" }, { name: "OnePlay MD2 CZ", id: "1039" }, { name: "OnePlay MD3 CZ", id: "1040" }, { name: "OnePlay MD4 CZ", id: "1041" }, { name: "Sport 1 CZ", id: "1042" }, { name: "Canal+ Sport 2 CZ", id: "1043" }, { name: "Canal+ Sport 3 CZ", id: "1044" }, { name: "Canal+ Sport 4 CZ", id: "1045" }, { name: "Canal+ Sport 5 CZ", id: "1046" }, { name: "Canal+ Sport 6 CZ", id: "1047" }, { name: "Canal+ Sport 7 CZ", id: "1048" }, { name: "Canal+ Sport 8 CZ", id: "1049" }, { name: "JOJ SK", id: "1050" }, { name: "Dajto SK", id: "1051" }, { name: "JOJ Šport SK", id: "1052" }, { name: "Voyo Special 1 SK", id: "1053" }, { name: "Voyo Special 2 SK", id: "1054" }, { name: "Voyo Special 3 SK", id: "1055" }, { name: "Voyo Special 4 SK", id: "1056" }, { name: "Voyo Special 7 SK", id: "1057" }, { name: "Voyo Special 8 SK", id: "1058" }, { name: "Voyo Special 9 SK", id: "1059" }, { name: "Nova Sport 3 SK", id: "1060" }, { name: "Nova Sport 4 SK", id: "1061" }, { name: "Nova Sport 5 SK", id: "1062" }, { name: "Canal+ Sport SK", id: "1063" }, { name: "Canal+ Sport 2 SK", id: "1064" }, { name: "Canal+ Sport 3 SK", id: "1065" }, { name: "Canal+ Sport 4 SK", id: "1066" }, { name: "CBS Sports Golazo", id: "910" }, { name: "CMTV Portugal", id: "790" }, { name: "Cytavision Sports 1 Cyprus", id: "911" }, { name: "Cytavision Sports 2 Cyprus", id: "912" }, { name: "Cytavision Sports 3 Cyprus", id: "913" }, { name: "Cytavision Sports 4 Cyprus", id: "914" }, { name: "Cytavision Sports 5 Cyprus", id: "915" }, { name: "Cytavision Sports 6 Cyprus", id: "916" }, { name: "Cytavision Sports 7 Cyprus", id: "917" },
    { name: "Cosmote Sport 1 HD", id: "622" }, { name: "Cosmote Sport 2 HD", id: "623" }, { name: "Cosmote Sport 3 HD", id: "624" }, { name: "Cosmote Sport 4 HD", id: "625" }, { name: "Cosmote Sport 5 HD", id: "626" }, { name: "Cosmote Sport 6 HD", id: "627" }, { name: "Cosmote Sport 7 HD", id: "628" }, { name: "Cosmote Sport 8 HD", id: "629" }, { name: "Cosmote Sport 9 HD", id: "630" },
    { name: "DAZN 1 UK", id: "230" }, { name: "Discovery Velocity CA", id: "285" }, { name: "DAZN 1 Bar DE", id: "426" }, { name: "DAZN 2 Bar DE", id: "427" }, { name: "DAZN 1 Spain", id: "445" }, { name: "DAZN 2 Spain", id: "446" }, { name: "DAZN 3 Spain", id: "447" }, { name: "DAZN 4 Spain", id: "448" }, { name: "DAZN F1 ES", id: "537" }, { name: "DAZN LaLiga", id: "538" }, { name: "DAZN Portugal FIFA Mundial de Clubes", id: "918" }, { name: "DR1 Denmark", id: "801" }, { name: "DR2 Denmark", id: "802" }, { name: "DAZN Ligue 1 France", id: "960" }, { name: "Digi Sport 1 Romania", id: "400" }, { name: "Digi Sport 2 Romania", id: "401" }, { name: "Digi Sport 3 Romania", id: "402" }, { name: "Digi Sport 4 Romania", id: "403" }, { name: "Diema Sport Bulgaria", id: "465" }, { name: "Diema Sport 2 Bulgaria", id: "466" }, { name: "Diema Sport 3 Bulgaria", id: "467" }, { name: "Diema Bulgaria", id: "482" }, { name: "Diema Family Bulgaria", id: "485" }, { name: "Dubai Sports 1 UAE", id: "604" }, { name: "Dubai Sports 2 UAE", id: "605" }, { name: "Dubai Sports 3 UAE", id: "606" }, { name: "Dubai Racing 2 UAE", id: "608" }, { name: "DSTV Mzansi Magic", id: "786" }, { name: "DSTV M-Net", id: "827" }, { name: "DSTV kykNET & kie", id: "828" }, { name: "DAZN ZONA Italy", id: "877" }, { name: "Discovery Life Channel", id: "311" }, { name: "Disney Channel", id: "312" }, { name: "Discovery Channel", id: "313" }, { name: "Discovery Family", id: "657" }, { name: "Disney XD", id: "314" }, { name: "Destination America", id: "651" }, { name: "Disney JR", id: "652" }, { name: "Dave", id: "348" },
    { name: "ESPN USA", id: "44" }, { name: "ESPN2 USA", id: "45" }, { name: "ESPNU USA", id: "316" }, { name: "ESPN 1 NL", id: "379" }, { name: "ESPN 2 NL", id: "386" }, { name: "Eleven Sports 1 Poland", id: "71" }, { name: "Eleven Sports 2 Poland", id: "72" }, { name: "Eleven Sports 3 Poland", id: "428" }, { name: "Eleven Sports 1 Portugal", id: "455" }, { name: "Eleven Sports 2 Portugal", id: "456" }, { name: "Eleven Sports 3 Portugal", id: "457" }, { name: "Eleven Sports 4 Portugal", id: "458" }, { name: "Eleven Sports 5 Portugal", id: "459" }, { name: "EuroSport 1 Greece", id: "41" }, { name: "EuroSport 2 Greece", id: "42" }, { name: "EuroSport 1 Poland", id: "57" }, { name: "EuroSport 2 Poland", id: "58" }, { name: "Eurosport 1 SW", id: "231" }, { name: "Eurosport 2 SW", id: "232" }, { name: "Eurosport 1 NL", id: "233" }, { name: "Eurosport 2 NL", id: "234" }, { name: "EuroSport 1 Spain", id: "524" }, { name: "EuroSport 2 Spain", id: "525" }, { name: "EuroSport 1 Italy", id: "878" }, { name: "EuroSport 2 Italy", id: "879" }, { name: "ESPN Premium Argentina", id: "387" }, { name: "ESPN Brasil", id: "81" }, { name: "ESPN2 Brasil", id: "82" }, { name: "ESPN3 Brasil", id: "83" }, { name: "ESPN4 Brasil", id: "85" }, { name: "ESPN Argentina", id: "149" }, { name: "ESPN2 Argentina", id: "150" }, { name: "ESPN Deportes", id: "375" }, { name: "ESPNews", id: "288" }, { name: "E! Entertainment Television", id: "315" }, { name: "E4 Channel", id: "363" }, { name: "ESPN 3 NL", id: "888" }, { name: "ERT 1 Greece", id: "774" }, { name: "Eurosport 1 France", id: "772" }, { name: "Eurosport 2 France", id: "773" }, { name: "ESPN3 Argentina", id: "798" }, { name: "ESPN 1 MX", id: "925" }, { name: "ESPN 2 MX", id: "926" }, { name: "ESPN 3 MX", id: "927" }, { name: "ESPN 4 MX", id: "928" },
    { name: "FUSE TV USA", id: "279" }, { name: "Fox Sports 1 USA", id: "39" }, { name: "Fox Sports 2 USA", id: "758" }, { name: "FOX Soccer Plus", id: "756" }, { name: "Fox Cricket", id: "369" }, { name: "FOX Deportes USA", id: "643" }, { name: "FOX Sports 502 AU", id: "820" }, { name: "FOX Sports 503 AU", id: "821" }, { name: "FOX Sports 504 AU", id: "822" }, { name: "FOX Sports 505 AU", id: "823" }, { name: "FOX Sports 506 AU", id: "824" }, { name: "FOX Sports 507 AU", id: "825" }, { name: "Fox Sports 1 MX", id: "929" }, { name: "Fox Sports 2 MX", id: "930" }, { name: "Fox Sports 3 MX", id: "931" }, { name: "Fox Sports Argentina", id: "787" }, { name: "Fox Sports 2 Argentina", id: "788" }, { name: "Fox Sports 3 Argentina", id: "789" }, { name: "Fox Sports Premium MX", id: "830" }, { name: "FilmBox Premium Poland", id: "568" }, { name: "Fight Network", id: "757" }, { name: "Fox Business", id: "297" }, { name: "FOX HD Bulgaria", id: "483" }, { name: "FOX USA", id: "54" }, { name: "FX USA", id: "317" }, { name: "FXX USA", id: "298" }, { name: "Freeform", id: "301" }, { name: "Fox News", id: "347" }, { name: "FX Movie Channel", id: "381" }, { name: "FYI", id: "665" }, { name: "Film4 UK", id: "688" }, { name: "Fashion TV", id: "744" }, { name: "FETV", id: "751" }, { name: "FOXNY USA", id: "768" }, { name: "Fox Weather Channel", id: "775" }, { name: "FanDuel Sports Network Arizona", id: "890" }, { name: "FanDuel Sports Network Detroit", id: "891" }, { name: "FanDuel Sports Network Florida", id: "892" }, { name: "FanDuel Sports Network Great Lakes", id: "893" }, { name: "FanDuel Sports Network Indiana", id: "894" }, { name: "FanDuel Sports Network Kansas City", id: "895" }, { name: "FanDuel Sports Network Midwest", id: "896" }, { name: "FanDuel Sports Network New Orleans", id: "897" }, { name: "FanDuel Sports Network North", id: "898" }, { name: "FanDuel Sports Network Ohio", id: "899" }, { name: "FanDuel Sports Network Oklahoma", id: "900" }, { name: "FanDuel Sports Network SoCal", id: "902" }, { name: "FanDuel Sports Network South", id: "903" }, { name: "FanDuel Sports Network Southeast", id: "904" }, { name: "FanDuel Sports Network Sun", id: "905" }, { name: "FanDuel Sports Network West", id: "906" }, { name: "FanDuel Sports Network Wisconsin", id: "907" }, { name: "France 2", id: "950" }, { name: "France 3", id: "951" }, { name: "France 4", id: "952" }, { name: "France 5", id: "953" },
    { name: "GOL PLAY Spain", id: "530" }, { name: "GOLF Channel USA", id: "318" }, { name: "Game Show Network", id: "319" }, { name: "beIN SPORTS MAX AR", id: "597" }, { name: "Gold UK", id: "687" }, { name: "Great American Family Channel (GAC)", id: "699" }, { name: "Galavisión USA", id: "743" }, { name: "Grit Channel", id: "752" }, { name: "Globo SP", id: "760" }, { name: "Globo RIO", id: "761" }, { name: "Global CA", id: "836" },
    { name: "The Hallmark Channel", id: "320" }, { name: "Hallmark Movies & Mysterie", id: "296" }, { name: "Heroes & Icons (H&I) USA", id: "282" }, { name: "HBO USA", id: "321" }, { name: "HBO2 USA", id: "689" }, { name: "HBO Comedy USA", id: "690" }, { name: "HBO Family USA", id: "691" }, { name: "HBO Latino USA", id: "692" }, { name: "HBO Signature USA", id: "693" }, { name: "HBO Zone USA", id: "694" }, { name: "HBO Poland", id: "569" }, { name: "History USA", id: "322" }, { name: "Headline News", id: "323" }, { name: "HGTV", id: "382" }, { name: "Happy TV Serbia", id: "846" }, { name: "HOT3 Israel", id: "553" },
    { name: "ITV 1 UK", id: "350" }, { name: "ITV 2 UK", id: "351" }, { name: "ITV 3 UK", id: "352" }, { name: "ITV 4 UK", id: "353" }, { name: "ITV Quiz", id: "876" }, { name: "Italia 1 Italy", id: "854" }, { name: "Investigation Discovery (ID USA)", id: "324" }, { name: "ION USA", id: "325" }, { name: "IFC TV USA", id: "656" },
    { name: "Kanal 4 Denmark", id: "803" }, { name: "Kanal 5 Denmark", id: "804" }, { name: "Kabel Eins (Kabel 1) DE", id: "731" }, { name: "Kanal D Turkey", id: "1001" },
    { name: "LaLigaTV UK", id: "276" }, { name: "Law & Crime Network", id: "278" }, { name: "LaLiga SmartBank TV", id: "539" }, { name: "L'Equipe France", id: "645" }, { name: "La Sexta Spain", id: "534" }, { name: "Liverpool TV (LFC TV)", id: "826" }, { name: "Logo TV USA", id: "849" }, { name: "Las Estrellas", id: "924" }, { name: "LCI France", id: "962" }, { name: "Lifetime Network", id: "326" }, { name: "Lifetime Movies Network", id: "389" }, { name: "La7 Italy", id: "855" }, { name: "LA7d HD+ Italy", id: "856" },
    { name: "Match Football 1 Russia", id: "136" }, { name: "Match Football 2 Russia", id: "137" }, { name: "Match Football 3 Russia", id: "138" }, { name: "Match Premier Russia", id: "573" }, { name: "Match TV Russia", id: "127" }, { name: "МАТЧ! БОЕЦ Russia", id: "395" }, { name: "Movistar Laliga", id: "84" }, { name: "Movistar Liga de Campeones", id: "435" }, { name: "Movistar Deportes Spain", id: "436" }, { name: "Movistar Deportes 2 Spain", id: "438" }, { name: "Movistar Deportes 3 Spain", id: "526" }, { name: "Movistar Deportes 4 Spain", id: "527" }, { name: "Movistar Golf Spain", id: "528" }, { name: "Motowizja Poland", id: "563" }, { name: "MSG USA", id: "765" }, { name: "MSNBC", id: "327" }, { name: "Magnolia Network", id: "299" }, { name: "M4 Sports Hungary", id: "265" }, { name: "Movistar Supercopa de España", id: "437" }, { name: "MTV UK", id: "367" }, { name: "MTV USA", id: "371" }, { name: "MUTV UK", id: "377" }, { name: "M6 France", id: "470" }, { name: "Racer TV USA", id: "646" }, { name: "Max Sport 1 Croatia", id: "779" }, { name: "Max Sport 2 Croatia", id: "780" }, { name: "Marquee Sports Network", id: "770" }, { name: "Max Sport 1 Bulgaria", id: "472" }, { name: "Max Sport 2 Bulgaria", id: "473" }, { name: "Max Sport 3 Bulgaria", id: "474" }, { name: "Max Sport 4 Bulgaria", id: "475" }, { name: "MLB Network USA", id: "399" }, { name: "MASN USA", id: "829" }, { name: "MY9TV USA", id: "654" }, { name: "Discovery Turbo", id: "661" }, { name: "METV USA", id: "662" }, { name: "MDR DE", id: "733" }, { name: "Mundotoro TV Spain", id: "749" }, { name: "Monumental Sports Network", id: "778" }, { name: "MTV Denmark", id: "806" }, { name: "MGM+ USA / Epix", id: "791" },
    { name: "NBC10 Philadelphia", id: "277" }, { name: "NHL Network USA", id: "663" }, { name: "NFL RedZone", id: "667" }, { name: "Nova Sport Bulgaria", id: "468" }, { name: "Nova Sport Serbia", id: "582" }, { name: "Nova Sports 1 Greece", id: "631" }, { name: "Nova Sports 2 Greece", id: "632" }, { name: "Nova Sports 3 Greece", id: "633" }, { name: "Nova Sports 4 Greece", id: "634" }, { name: "Nova Sports 5 Greece", id: "635" }, { name: "Nova Sports 6 Greece", id: "636" }, { name: "Nova Sports Premier League Greece", id: "599" }, { name: "Nova Sports Start Greece", id: "637" }, { name: "Nova Sports Prime Greece", id: "638" }, { name: "Nova Sports News Greece", id: "639" }, { name: "Nick Music", id: "666" }, { name: "NESN USA", id: "762" }, { name: "NBC USA", id: "53" }, { name: "NBA TV USA", id: "404" }, { name: "NBC Sports Philadelphia", id: "777" }, { name: "NFL Network", id: "405" }, { name: "NBC Sports Bay Area", id: "753" }, { name: "NBC Sports Boston", id: "754" }, { name: "NBC Sports California", id: "755" }, { name: "NBCNY USA", id: "769" }, { name: "Nova TV Bulgaria", id: "480" }, { name: "Nova S Serbia", id: "847" }, { name: "NewsNation USA", id: "292" }, { name: "National Geographic", id: "328" }, { name: "NICK JR", id: "329" }, { name: "NICK", id: "330" }, { name: "Nicktoons", id: "649" }, { name: "NDR DE", id: "736" }, { name: "Newsmax USA", id: "613" }, { name: "Nat Geo Wild USA", id: "745" }, { name: "Noovo CA", id: "835" }, { name: "NBC Universo", id: "845" }, { name: "NOW TV Turkey", id: "1003" }, { name: "Nova Sport 1 CZ", id: "1021" }, { name: "Nova Sport 2 CZ", id: "1022" }, { name: "Nova Sport 3 CZ", id: "1023" }, { name: "Nova Sport 4 CZ", id: "1024" }, { name: "Nova Sport 5 CZ", id: "1025" }, { name: "Nova Sport 6 CZ", id: "1026" },
    { name: "OnTime Sports", id: "611" }, { name: "ONE 1 HD Israel", id: "541" }, { name: "ONE 2 HD Israel", id: "542" }, { name: "Orange Sport 1 Romania", id: "439" }, { name: "Orange Sport 2 Romania", id: "440" }, { name: "Orange Sport 3 Romania", id: "441" }, { name: "Orange Sport 4 Romania", id: "442" }, { name: "Oprah Winfrey Network", id: "331" }, { name: "Oxygen True Crime", id: "332" }, { name: "Outdoor Channel USA", id: "848" }, { name: "Oneplay Sport 1 CZ", id: "1027" }, { name: "Oneplay Sport 2 CZ", id: "1028" }, { name: "Oneplay Sport 3 CZ", id: "1029" },
    { name: "Polsat Poland", id: "562" }, { name: "Polsat Sport Poland", id: "47" }, { name: "Polsat Sport 2 Poland", id: "50" }, { name: "Polsat Sport 3 Poland", id: "129" }, { name: "Polsat News Poland", id: "443" }, { name: "Polsat Film Poland", id: "564" }, { name: "Porto Canal Portugal", id: "718" }, { name: "ProSieben (PRO7) DE", id: "730" }, { name: "Premier Sports Ireland 1", id: "771" }, { name: "PTV Sports", id: "450" }, { name: "PDC TV", id: "43" }, { name: "Premier Brasil", id: "88" }, { name: "Prima Sport 1", id: "583" }, { name: "Prima Sport 2", id: "584" }, { name: "Prima Sport 3", id: "585" }, { name: "Prima Sport 4", id: "586" }, { name: "Paramount Network", id: "334" }, { name: "POP TV USA", id: "653" }, { name: "Premier Sports Ireland 2", id: "799" }, { name: "Prima TV RO", id: "843" }, { name: "Premier Sport 1 CZ", id: "1030" }, { name: "Premier Sport 2 CZ", id: "1031" }, { name: "Premier Sport 3 CZ", id: "1032" }, { name: "Pac-12 Network USA", id: "287" }, { name: "PBS USA", id: "210" },
    { name: "Reelz Channel", id: "293" }, { name: "RTE 1", id: "364" }, { name: "RTE 2", id: "365" }, { name: "RMC Sport 1 France", id: "119" }, { name: "RMC Sport 2 France", id: "120" }, { name: "RMC Story France", id: "954" }, { name: "RTP 1 Portugal", id: "719" }, { name: "RTP 2 Portugal", id: "720" }, { name: "RTP 3 Portugal", id: "721" }, { name: "Rai 1 Italy", id: "850" }, { name: "Rai 2 Italy", id: "851" }, { name: "Rai 3 Italy", id: "852" }, { name: "Rai 4 Italy", id: "853" }, { name: "Rai Sport Italy", id: "882" }, { name: "Rai Premium Italy", id: "858" }, { name: "Real Madrid TV Spain", id: "523" }, { name: "RTL DE", id: "740" }, { name: "RDS CA", id: "839" }, { name: "RDS 2 CA", id: "840" }, { name: "RDS Info CA", id: "841" }, { name: "Ring Bulgaria", id: "471" }, { name: "RTL7 Netherland", id: "390" }, { name: "Racing Tv UK", id: "555" }, { name: "Rally Tv", id: "607" }, { name: "Root Sports Northwest", id: "920" },
    { name: "Sky Sports Football UK", id: "35" }, { name: "Sky Sports+ Plus", id: "36" }, { name: "Sky Sports Action UK", id: "37" }, { name: "Sky Sports Main Event", id: "38" }, { name: "Sky Sports Tennis UK", id: "46" }, { name: "Sky sports Premier League", id: "130" }, { name: "Sky Sports F1 UK", id: "60" }, { name: "Sky Sports Cricket", id: "65" }, { name: "Sky Sports Golf UK", id: "70" }, { name: "Sky Sports 1 DE", id: "240" }, { name: "Sky Sports 2 DE", id: "241" }, { name: "Sky Sports Golf Italy", id: "574" }, { name: "Sky Sport MotoGP Italy", id: "575" }, { name: "Sky Sport Tennis Italy", id: "576" }, { name: "Sky Sport F1 Italy", id: "577" }, { name: "Sky Sports News UK", id: "366" }, { name: "Sky Sports MIX UK", id: "449" }, { name: "Sky Sport Top Event DE", id: "556" }, { name: "Sky Sport Mix DE", id: "557" }, { name: "Sky Sport Bundesliga 1 HD", id: "558" }, { name: "Sky Sport Austria 1 HD", id: "559" }, { name: "SportsNet New York (SNY)", id: "759" }, { name: "Sky Sport MAX Italy", id: "460" }, { name: "Sky Sport UNO Italy", id: "461" }, { name: "Sky Sport Arena Italy", id: "462" }, { name: "Sky Sports Racing UK", id: "554" }, { name: "Sky UNO Italy", id: "881" }, { name: "SONY TEN 1", id: "885" }, { name: "SONY TEN 2", id: "886" }, { name: "SONY TEN 3", id: "887" }, { name: "Sky Sport Bundesliga 2", id: "946" }, { name: "Sky Sport Bundesliga 3", id: "947" }, { name: "Sky Sport Bundesliga 4", id: "948" }, { name: "Sky Sport Bundesliga 5", id: "949" }, { name: "Sport en France", id: "965" }, { name: "Starz Cinema", id: "970" }, { name: "Starz Comedy", id: "971" }, { name: "Starz Edge", id: "972" }, { name: "Starz In Black", id: "973" }, { name: "Starz Kids & Family", id: "974" }, { name: "Starz Encore", id: "975" }, { name: "Starz Encore Action", id: "976" }, { name: "Starz Encore Black", id: "977" }, { name: "Starz Encore Classic", id: "978" }, { name: "Starz Encore Family", id: "979" }, { name: "Starz Encore Suspense", id: "980" }, { name: "Starz Encore Westerns", id: "981" }, { name: "Spectrum SportsNet USA", id: "982" }, { name: "Canal+ Extra 1 Poland", id: "983" }, { name: "Canal+ Extra 2 Poland", id: "984" }, { name: "Canal+ Extra 3 Poland", id: "985" }, { name: "Canal+ Extra 4 Poland", id: "986" }, { name: "Canal+ Extra 5 Poland", id: "987" }, { name: "Canal+ Extra 6 Poland", id: "988" }, { name: "Canal+ Extra 7 Poland", id: "989" }, { name: "MTV Poland", id: "990" }, { name: "Polsat Sport Premium 1", id: "991" }, { name: "Polsat Sport Premium 2", id: "992" }, { name: "Polsat Sport Extra 1", id: "993" }, { name: "Polsat Sport Extra 2", id: "994" }, { name: "Polsat Sport Extra 3", id: "995" }, { name: "Polsat Sport Extra 4", id: "996" }, { name: "Polsat Sport Fight", id: "997" }, { name: "Polsat Sport NEWS", id: "998" }, { name: "Eleven Sports 4 Poland", id: "999" }, { name: "Sky Sport 1 NZ", id: "588" }, { name: "Sky Sport 2 NZ", id: "589" }, { name: "Sky Sport 3 NZ", id: "590" }, { name: "Sky Sport 4 NZ", id: "591" }, { name: "Sky Sport 5 NZ", id: "592" }, { name: "Sky Sport 6 NZ", id: "593" }, { name: "Sky Sport 7 NZ", id: "594" }, { name: "Sky Sport 8 NZ", id: "595" }, { name: "Sky Sport 9 NZ", id: "596" }, { name: "Sky Sport Select NZ", id: "587" }, { name: "Sport TV1 Portugal", id: "49" }, { name: "Sport TV2 Portugal", id: "74" }, { name: "Sport TV4 Portugal", id: "289" }, { name: "Sport TV3 Portugal", id: "454" }, { name: "Sport TV5 Portugal", id: "290" }, { name: "Sport TV6 Portugal", id: "291" }, { name: "SIC Portugal", id: "722" }, { name: "SEC Network USA", id: "385" }, { name: "SporTV Brasil", id: "78" }, { name: "SporTV2 Brasil", id: "79" }, { name: "SporTV3 Brasil", id: "80" }, { name: "Sport Klub 1 Croatia", id: "101" }, { name: "Sport Klub 2 Croatia", id: "102" }, { name: "Sport Klub 3 Croatia", id: "103" }, { name: "Sport Klub 4 Croatia", id: "104" }, { name: "Sport Klub HD Croatia", id: "453" }, { name: "Sportsnet Ontario", id: "406" }, { name: "Sportsnet One", id: "411" }, { name: "Sportsnet West", id: "407" }, { name: "Sportsnet East", id: "408" }, { name: "Sportsnet 360", id: "409" }, { name: "Sportsnet World", id: "410" }, { name: "SuperSport Grandstand", id: "412" }, { name: "SuperSport PSL", id: "413" }, { name: "SuperSport Premier league", id: "414" }, { name: "SuperSport LaLiga", id: "415" }, { name: "SuperSport Variety 1", id: "416" }, { name: "SuperSport Variety 2", id: "417" }, { name: "SuperSport Variety 3", id: "418" }, { name: "SuperSport Variety 4", id: "419" }, { name: "SuperSport Action", id: "420" }, { name: "SuperSport Rugby", id: "421" }, { name: "SuperSport Golf", id: "422" }, { name: "SuperSport Tennis", id: "423" }, { name: "SuperSport Motorsport", id: "424" }, { name: "Supersport Football", id: "56" }, { name: "SuperSport Cricket", id: "368" }, { name: "SuperSport MaXimo 1", id: "572" }, { name: "Sporting TV Portugal", id: "716" }, { name: "SportDigital Fussball", id: "571" }, { name: "Spectrum Sportsnet LA", id: "764" }, { name: "Sportdigital1+ Germany", id: "640" }, { name: "Sport1 Germany", id: "641" }, { name: "S4C UK", id: "670" }, { name: "Sport KLUB Golf Croatia", id: "710" }, { name: "SAT.1 DE", id: "729" }, { name: "Sky Cinema Premiere", id: "671" }, { name: "Sky Cinema Select", id: "672" }, { name: "Sky Cinema Hits", id: "673" }, { name: "Sky Cinema Greats", id: "674" }, { name: "Sky Cinema Animation", id: "675" }, { name: "Sky Cinema Family", id: "676" }, { name: "Sky Cinema Action", id: "677" }, { name: "Sky Cinema Comedy", id: "678" }, { name: "Sky Cinema Thriller", id: "679" }, { name: "Sky Cinema Drama", id: "680" }, { name: "Sky Cinema Sci-Fi", id: "681" }, { name: "Showtime SHOxBET USA", id: "695" }, { name: "SEE Denmark", id: "811" }, { name: "Sky Cinema Collection", id: "859" }, { name: "Sky Cinema Uno", id: "860" }, { name: "Sky Cinema Action IT", id: "861" }, { name: "Sky Cinema Comedy IT", id: "862" }, { name: "Sky Cinema Uno +24", id: "863" }, { name: "Sky Cinema Romance", id: "864" }, { name: "Sky Cinema Family IT", id: "865" }, { name: "CW Philly", id: "866" }, { name: "Sky Cinema Drama IT", id: "867" }, { name: "Sky Cinema Suspense", id: "868" }, { name: "Sky Sport 24 Italy", id: "869" }, { name: "Sky Sport Calcio", id: "870" }, { name: "Sky Calcio 1", id: "871" }, { name: "Sky Calcio 2", id: "872" }, { name: "Sky Calcio 3", id: "873" }, { name: "Sky Calcio 4", id: "874" }, { name: "Sky Sport Basket", id: "875" }, { name: "Sky Serie Italy", id: "880" }, { name: "StarzPlay CricLife", id: "284" }, { name: "Sky Showcase UK", id: "682" }, { name: "Sky Arts UK", id: "683" }, { name: "Sky Comedy UK", id: "684" }, { name: "Sky Crime", id: "685" }, { name: "Sky History", id: "686" }, { name: "Sky MAX UK", id: "708" }, { name: "SSC Sport 1", id: "614" }, { name: "SSC Sport 2", id: "615" }, { name: "SSC Sport 3", id: "616" }, { name: "SSC Sport 4", id: "617" }, { name: "SSC Sport 5", id: "618" }, { name: "SSC Sport Extra 1", id: "619" }, { name: "SSC Sport Extra 2", id: "620" }, { name: "SSC Sport Extra 3", id: "621" }, { name: "Sport 1 Israel", id: "140" }, { name: "Sport 2 Israel", id: "141" }, { name: "Sport 3 Israel", id: "142" }, { name: "Sport 4 Israel", id: "143" }, { name: "Sport 5 Israel", id: "144" }, { name: "Sport 5 PLUS Israel", id: "145" }, { name: "Sport 5 Live Israel", id: "146" }, { name: "Sport 5 Star Israel", id: "147" }, { name: "Sport 5 Gold Israel", id: "148" }, { name: "Science Channel", id: "294" }, { name: "Showtime USA", id: "333" }, { name: "Starz", id: "335" }, { name: "Sky Witness HD", id: "361" }, { name: "Sixx DE", id: "732" }, { name: "Sky Atlantic", id: "362" }, { name: "SYFY USA", id: "373" }, { name: "Sundance TV", id: "658" }, { name: "SWR DE", id: "735" }, { name: "SUPER RTL DE", id: "738" }, { name: "SR Fernsehen DE", id: "739" }, { name: "Sky Sports Golf DE", id: "785" }, { name: "Smithsonian Channel", id: "603" }, { name: "Sky Sports F1 DE", id: "274" }, { name: "Sky Sports Tennis DE", id: "884" }, { name: "SBS6 NL", id: "883" }, { name: "Star Sports 1 IN", id: "267" }, { name: "Star Sports Hindi IN", id: "268" }, { name: "Showtime 2 USA", id: "792" }, { name: "Showtime Showcase", id: "793" }, { name: "Showtime Extreme", id: "794" }, { name: "Showtime Family Zone", id: "795" }, { name: "Showtime Next", id: "796" }, { name: "Showtime Women", id: "797" }, { name: "Space City Home Network", id: "921" }, { name: "SportsNet Pittsburgh", id: "922" }, { name: "Show TV Turkey", id: "1002" }, { name: "Star TV Turkey", id: "1004" }, { name: "TNT Sports 1 UK", id: "31" }, { name: "TNT Sports 2 UK", id: "32" }, { name: "TNT Sports 3 UK", id: "33" }, { name: "TNT Sports 4 UK", id: "34" }, { name: "TSN1", id: "111" }, { name: "TSN2", id: "112" }, { name: "TSN3", id: "113" }, { name: "TSN4", id: "114" }, { name: "TSN5", id: "115" }, { name: "TVN HD Poland", id: "565" }, { name: "TVN24 Poland", id: "444" }, { name: "TVP1 Poland", id: "560" }, { name: "TVP2 Poland", id: "561" }, { name: "Telecinco Spain", id: "532" }, { name: "TVE La 1 Spain", id: "533" }, { name: "TVE La 2 Spain", id: "536" }, { name: "TVI Portugal", id: "723" }, { name: "TVI Reality Portugal", id: "724" }, { name: "Teledeporte Spain", id: "529" }, { name: "TYC Sports Argentina", id: "746" }, { name: "TVP Sport Poland", id: "128" }, { name: "TNT Brasil", id: "87" }, { name: "TNT Sports Argentina", id: "388" }, { name: "TNT Sports HD Chile", id: "642" }, { name: "Tennis Channel", id: "40" }, { name: "Ten Sports PK", id: "741" }, { name: "TUDN USA", id: "66" }, { name: "Telemundo", id: "131" }, { name: "TBS USA", id: "336" }, { name: "TLC", id: "337" }, { name: "TNT USA", id: "338" }, { name: "TF1 France", id: "469" }, { name: "TVA Sports", id: "833" }, { name: "TVA Sports 2", id: "834" }, { name: "TVC Deportes MX", id: "932" }, { name: "TUDN MX", id: "935" }, { name: "TMC France", id: "955" }, { name: "Travel Channel", id: "340" }, { name: "TruTV USA", id: "341" }, { name: "TVLAND", id: "342" }, { name: "TCM USA", id: "644" }, { name: "TMC Channel USA", id: "698" }, { name: "The Food Network", id: "384" }, { name: "The Weather Channel", id: "394" }, { name: "TVP INFO", id: "452" }, { name: "TeenNick", id: "650" }, { name: "TV ONE USA", id: "660" }, { name: "TV2 Bornholm DK", id: "807" }, { name: "TV2 Sport X DK", id: "808" }, { name: "TV3 Sport Denmark", id: "809" }, { name: "TV2 Sport Denmark", id: "810" }, { name: "TV2 Denmark", id: "817" }, { name: "TV2 Zulu", id: "818" }, { name: "TV3+ Denmark", id: "819" }, { name: "TVO CA", id: "842" }, { name: "TV8 Turkey", id: "1005" }, { name: "TV4 Hockey", id: "700" }, { name: "TV3 Max Denmark", id: "223" }, { name: "T Sports BD", id: "270" }, { name: "TV4 Tennis", id: "701" }, { name: "TV4 Motor", id: "702" }, { name: "TV4 Sport Live 1", id: "703" }, { name: "TV4 Sport Live 2", id: "704" }, { name: "TV4 Sport Live 3", id: "705" }, { name: "TV4 Sport Live 4", id: "706" }, { name: "TV4 Sportkanalen", id: "707" }, { name: "TV4 Football", id: "747" }, { name: "Tennis+ 10", id: "709" }, { name: "Tennis+ 12", id: "711" }, { name: "TRT Spor TR", id: "889" }, { name: "USA Network", id: "343" }, { name: "Universal Kids USA", id: "668" }, { name: "Univision", id: "132" }, { name: "Unimas", id: "133" }, { name: "Viaplay Sports 1 UK", id: "451" }, { name: "Viaplay Sports 2 UK", id: "550" }, { name: "#Vamos Spain", id: "521" }, { name: "V Film Premiere", id: "815" }, { name: "V Film Family", id: "816" }, { name: "Vodafone Sport", id: "260" }, { name: "V Sport Motor SE", id: "272" }, { name: "VH1 USA", id: "344" }, { name: "Veronica NL", id: "378" }, { name: "VTV+ Uruguay", id: "391" }, { name: "VICE TV", id: "659" }, { name: "Willow Cricket", id: "346" }, { name: "Willow 2 Cricket", id: "598" }, { name: "WWE Network", id: "376" }, { name: "Win Sports+ CO", id: "392" }, { name: "WETV USA", id: "655" }, { name: "WDR DE", id: "734" }, { name: "W9 France", id: "959" }, { name: "YTV CA", id: "286" }, { name: "YES Network USA", id: "763" }, { name: "Yes Movies Action", id: "543" }, { name: "Yes Movies Kids", id: "544" }, { name: "Yes Movies Comedy", id: "545" }, { name: "Yes TV CA", id: "837" }, { name: "Ziggo Sport NL", id: "393" }, { name: "Ziggo Sport 2 NL", id: "398" }, { name: "Ziggo Sport 3 NL", id: "919" }, { name: "Ziggo Sport 4 NL", id: "396" }, { name: "Ziggo Sport 5 NL", id: "383" }, { name: "Ziggo Sport 6 NL", id: "901" }, { name: "ZDF DE", id: "727" }, { name: "ZDF Info DE", id: "728" }, { name: "6ter France", id: "963" }, { name: "20 Mediaset Italy", id: "857" }, { name: "6'eren Denmark", id: "800" }, { name: "5 USA", id: "360" }, { name: "3sat DE", id: "726" }
  ];

  const CATEGORIES_TREE = {
    'All': [], 'Literally Every Channels': [],
    'Sports': ['Sports', 'Live Sports', 'Cricket', 'Football (Soccer)', 'Basketball', 'Tennis', 'Motorsports', 'Wrestling', 'Boxing'],
    'News': ['News', 'Business News'], 'Other': ['Entertainment', 'Music', 'Lifestyle']
  };

  const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/categories/sports.m3u';
  
  const normalizeCategory = (groupName) => {
    if (!groupName) return 'Sports';
    const lower = groupName.toLowerCase();
    if (lower.includes('cricket')) return 'Cricket';
    if (lower.includes('football') || lower.includes('soccer') || lower.includes('premier league')) return 'Football (Soccer)';
    if (lower.includes('basket') || lower.includes('nba')) return 'Basketball';
    if (lower.includes('tennis') || lower.includes('wimbledon')) return 'Tennis';
    if (lower.includes('motor') || lower.includes('racing') || lower.includes('f1')) return 'Motorsports';
    if (lower.includes('wrestling') || lower.includes('wwe') || lower.includes('ufc')) return 'Wrestling';
    if (lower.includes('boxing')) return 'Boxing';
    return 'Live Sports';
  };

  const getParentCategory = (subCat) => {
    for (const [main, subs] of Object.entries(CATEGORIES_TREE)) {
      if (subs.includes(subCat)) return main;
    }
    return 'Sports';
  };

  useEffect(() => {
    setLoading(true); setError(null);
    if (activeMainCategory === 'Literally Every Channels') {
        setChannels(DLHD_CHANNELS.map(ch => ({ name: ch.name, logo: null, group: 'DLHD VIP', parentGroup: 'Literally Every Channels', url: `https://dlhd.link/stream/stream-${ch.id}.php`, isEmbed: true })));
        setLoading(false); return;
    }
    fetch(PLAYLIST_URL).then(res => { if(!res.ok) throw new Error(); return res.text(); }).then(data => {
        const lines = data.split('\n'); const parsed = [SPECIAL_STREAM]; let current = {};
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]*)"/); const groupMatch = line.match(/group-title="([^"]*)"/); const name = line.split(',').pop().trim();
            const rawGroup = groupMatch ? groupMatch[1].trim() : 'Sports';
            const normalizedGroup = normalizeCategory(rawGroup + " " + name);
            const parentGroup = getParentCategory(normalizedGroup);
            parsed.push({ name, logo: logoMatch ? logoMatch[1] : null, group: normalizedGroup, parentGroup, url: null, isEmbed: false });
          } else if (line.startsWith('http') && parsed.length > 0 && !parsed[parsed.length-1].url) { parsed[parsed.length-1].url = line; }
        }
        setChannels(parsed.filter(c => c.url)); setLoading(false);
    }).catch(e => { setChannels([SPECIAL_STREAM]); setLoading(false); });
  }, [activeMainCategory]);

  useEffect(() => {
    let filtered = channels;
    if (activeSubCategory !== 'All' && activeMainCategory !== 'Literally Every Channels') filtered = filtered.filter(c => c.group === activeSubCategory);
    if (searchQuery.trim()) filtered = filtered.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    setDisplayedChannels(filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage));
  }, [activeMainCategory, activeSubCategory, searchQuery, channels, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [activeMainCategory, activeSubCategory, searchQuery]);

  const totalPages = Math.ceil((activeMainCategory === 'Literally Every Channels' ? (searchQuery ? channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length : channels.length) : channels.filter(c => { const matchSub = activeSubCategory === 'All' || c.group === activeSubCategory; const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()); return matchSub && matchSearch; }).length) / itemsPerPage);

  return (
    <div className="pt-24 px-4 md:px-12 min-h-screen pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
        <div><h2 className="text-3xl font-bold text-white flex items-center gap-2 glow-text"><Monitor className="text-[#00A8E1]" /> Live TV</h2><p className="text-gray-400 text-sm mt-1">{loading ? "Loading..." : `${channels.length} Channels`}</p></div>
        <div className="relative flex-1 md:w-80"><input type="text" placeholder="Find channel..." className="w-full bg-[#19222b] border border-white/10 rounded-lg px-4 py-3 pl-10 text-white focus:border-[#00A8E1] outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><Search className="absolute left-3 top-3.5 text-gray-500" size={18} /></div>
      </div>
      <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2">
            {['All', 'Literally Every Channels', ...Object.keys(CATEGORIES_TREE).filter(k => k !== 'All' && k !== 'Literally Every Channels')].map(cat => (
              <button key={cat} onClick={() => { setActiveMainCategory(cat); setActiveSubCategory('All'); }} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all border ${activeMainCategory === cat ? 'bg-[#00A8E1] border-transparent' : 'bg-[#19222b] border-transparent hover:bg-[#333c46]'}`}>{cat}</button>
            ))}
          </div>
          {activeMainCategory !== 'All' && activeMainCategory !== 'Literally Every Channels' && (
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2 animate-in fade-in">
              <button onClick={() => setActiveSubCategory('All')} className="px-4 py-1.5 rounded-full text-xs font-bold border">All {activeMainCategory}</button>
              {CATEGORIES_TREE[activeMainCategory].map(sub => (<button key={sub} onClick={() => setActiveSubCategory(sub)} className={`px-4 py-1.5 rounded-full text-xs font-bold border ${activeSubCategory === sub ? 'bg-[#00A8E1]' : 'bg-[#19222b]'}`}>{sub}</button>))}
            </div>
          )}
      </div>
      {loading ? (<div className="h-80 flex flex-col items-center justify-center text-[#00A8E1]"><Loader className="animate-spin" size={48} /></div>) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in">
            {displayedChannels.map((channel, idx) => (
              <div key={idx} onClick={() => navigate('/watch/sport/iptv', { state: { streamUrl: channel.url, title: channel.name, logo: channel.logo, group: channel.group, isEmbed: channel.isEmbed } })} className="bg-[#19222b] hover:bg-[#232d38] rounded-xl overflow-hidden cursor-pointer group hover:-translate-y-2 transition-all shadow-lg border border-white/5">
                <div className="aspect-video bg-black/40 flex items-center justify-center p-4 relative">{channel.logo ? <img src={channel.logo} className="w-full h-full object-contain" /> : <Signal size={32} className="text-gray-700" />}</div>
                <div className="p-3"><h3 className="text-gray-200 text-xs font-bold truncate group-hover:text-[#00A8E1]">{channel.name}</h3></div>
              </div>
            ))}
          </div>
          <div className="flex justify-center items-center gap-4 mt-12 mb-8">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] text-white"><ChevronLeft size={24} /></button>
            <span className="text-sm font-bold text-gray-400">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] text-white"><ChevronRight size={24} /></button>
          </div>
        </>
      )}
    </div>
  );
};

// --- SPORTS PLAYER (UPDATED) ---
const SportsPlayer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const { streamUrl, title, isEmbed } = location.state || {}; 

  useEffect(() => {
    if (!streamUrl || isEmbed) return;
    let hls;
    if (Hls && Hls.isSupported()) {
      hls = new Hls(); hls.loadSource(streamUrl); hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current.play().catch(e => {}));
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = streamUrl; videoRef.current.addEventListener('loadedmetadata', () => videoRef.current.play());
    }
    return () => { if (hls) hls.destroy(); };
  }, [streamUrl, isEmbed]);

  if (!streamUrl) return <div className="text-white pt-20 text-center">No Stream <button onClick={() => navigate(-1)} className="text-[#00A8E1]">Back</button></div>;

  return (
    <div className="fixed inset-0 bg-[#0f171e] z-[200] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center px-6 pointer-events-none">
        <button onClick={() => navigate(-1)} className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 hover:bg-[#00A8E1] text-white flex items-center justify-center"><ArrowLeft size={24} /></button>
        <h1 className="ml-4 text-white font-bold text-xl drop-shadow-md">{title}</h1>
      </div>
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {isEmbed ? <iframe src={streamUrl} className="w-full h-full border-none" allow="autoplay; fullscreen" allowFullScreen></iframe> : <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline></video>}
      </div>
    </div>
  );
};

// --- HOME & WRAPPERS ---
const Home = ({ isPrimeOnly }) => {
  const { rows, loadMore } = useInfiniteRows('all', isPrimeOnly);
  const [history, setHistory] = useState([]);
  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
    const list = Object.values(raw).sort((a,b)=>b.last_updated - a.last_updated);
    setHistory(list);
  }, []);
  return (
    <>
      <Hero isPrimeOnly={isPrimeOnly} />
      <div className="-mt-10 relative z-20 pb-20">
        {history.length > 0 && <Row title="Continue Watching" data={history} variant="standard" itemType="history" isPrimeOnly={isPrimeOnly} />}
        {rows.map(row => <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />)}
        <InfiniteScrollTrigger onIntersect={loadMore} />
      </div>
    </>
  );
};

const MoviesPage = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('movie', isPrimeOnly); return (<><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => (<Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />))}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>); };
const TVPage = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('tv', isPrimeOnly); return (<><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => (<Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />))}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>); };
const StorePage = () => <div className="pt-32 px-12 text-white">Store</div>;

function App() {
  useConnectionOptimizer();
  return (
    <BrowserRouter>
      <GlobalStyles />
      <ScrollToTop />
      <div className="bg-[#00050D] min-h-screen text-white font-sans selection:bg-[#00A8E1] selection:text-white">
        <Routes>
          <Route path="/" element={<><Navbar isPrimeOnly={true} /><Home isPrimeOnly={true} /></>} />
          <Route path="/movies" element={<><Navbar isPrimeOnly={true} /><MoviesPage isPrimeOnly={true} /></>} />
          <Route path="/tv" element={<><Navbar isPrimeOnly={true} /><TVPage isPrimeOnly={true} /></>} />
          <Route path="/search" element={<><Navbar isPrimeOnly={true} /><SearchResults isPrimeOnly={true} /></>} />
          <Route path="/everything" element={<><Navbar isPrimeOnly={false} /><Home isPrimeOnly={false} /></>} />
          <Route path="/everything/movies" element={<><Navbar isPrimeOnly={false} /><MoviesPage isPrimeOnly={false} /></>} />
          <Route path="/everything/tv" element={<><Navbar isPrimeOnly={false} /><TVPage isPrimeOnly={false} /></>} />
          <Route path="/everything/search" element={<><Navbar isPrimeOnly={false} /><SearchResults isPrimeOnly={false} /></>} />
          <Route path="/detail/:type/:id" element={<><Navbar isPrimeOnly={true} /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
          <Route path="/sports" element={<><Navbar isPrimeOnly={true} /><SportsPage /></>} />
          <Route path="/watch/sport/iptv" element={<SportsPlayer />} />
          <Route path="/live" element={<><Navbar isPrimeOnly={true} /><SportsPage /></>} />
          <Route path="/store" element={<><Navbar isPrimeOnly={true} /><StorePage /></>} />
          <Route path="/watchlist" element={<><Navbar isPrimeOnly={true} /><WatchlistPage isPrimeOnly={true} /></>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
