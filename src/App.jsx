import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Clock, Ban, Eye, Bookmark, TrendingUp } from 'lucide-react';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
const VIDFAST_BASE = "https://vidfast.pro";
const LIVESPORT_BASE = ""; // Empty to use proxy

// PRIME FILTERS
const PRIME_PROVIDER_IDS = "9|119"; 
const PRIME_REGION = "IN";      

// --- GLOBAL STYLES ---
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .nav-gradient { background: linear-gradient(180deg, rgba(0,5,13,0.7) 10%, transparent); }
    
    /* Horizontal Scrolling Container */
    .row-container { 
        display: flex; 
        overflow-y: hidden; 
        overflow-x: scroll; 
        padding: 40px 4%; 
        margin-top: -20px;
        margin-bottom: -20px;
        gap: 16px; 
        scroll-behavior: smooth; 
        position: relative;
    }

    /* Ranked Number Styling (Top 10) */
    .rank-number { 
        position: absolute; 
        left: -15px; 
        bottom: 0; 
        font-size: 220px; 
        font-weight: 900; 
        color: #1a242f; 
        -webkit-text-stroke: 4px #4a5561; 
        z-index: 0; 
        font-family: 'Impact', sans-serif; 
        line-height: 0.8; 
        opacity: 0.8;
        transform: translateX(-40%);
        pointer-events: none;
    }

    /* Animations */
    @keyframes row-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-row-enter { animation: row-enter 0.6s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-in { animation: fadeIn 0.3s ease-out forwards; }
  `}</style>
);

// --- MOCK DATA FOR STATIC ROWS ---
const MOODS = [
    { id: 1, label: "Feel Good", icon: "😊", color: "from-yellow-600 to-orange-900" },
    { id: 2, label: "Thrill", icon: "😱", color: "from-red-900 to-black" },
    { id: 3, label: "Mystery", icon: "🔍", color: "from-purple-900 to-black" },
    { id: 4, label: "Chill", icon: "☕", color: "from-green-900 to-black" },
    { id: 5, label: "Romantic", icon: "❤️", color: "from-pink-900 to-black" },
];

const DECADES = [
    { id: 1, label: "1980s", image: "https://image.tmdb.org/t/p/w500/7G9915LfUQ2lVfwMEEhDsn3kT4B.jpg" }, // Star Wars
    { id: 2, label: "1990s", image: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg" }, // Godfather
    { id: 3, label: "2000s", image: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg" }, // Dark Knight
    { id: 4, label: "2010s", image: "https://image.tmdb.org/t/p/w500/8Y43POKjjKDGI9MH89NW0NA858c.jpg" }, // Inception
];

const COLLECTIONS = [
    { id: 1, title: "Marvel Universe", subtitle: "Heroes United", image: "https://image.tmdb.org/t/p/w500/n3GZebf77fQJ8707XJ3IkM5zS8j.jpg" },
    { id: 2, title: "DC Worlds", subtitle: "Darker & Gritty", image: "https://image.tmdb.org/t/p/w500/c3OHQncTAnKFhmFXR839V3eh9vR.jpg" },
    { id: 3, title: "Award Winners", subtitle: "Critically Acclaimed", image: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg" },
];

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const getTheme = (isPrimeOnly) => ({
    color: isPrimeOnly ? "text-[#00A8E1]" : "text-[#E50914]",
    bg: isPrimeOnly ? "bg-[#00A8E1]" : "bg-[#E50914]",
    hoverBg: isPrimeOnly ? "hover:bg-[#008ebf]" : "hover:bg-[#b20710]",
    border: isPrimeOnly ? "border-[#00A8E1]" : "border-[#E50914]",
    shadow: isPrimeOnly ? "shadow-[0_0_30px_rgba(0,168,225,0.5)]" : "shadow-[0_0_30px_rgba(229,9,20,0.5)]",
    name: isPrimeOnly ? "Prime" : "Every",
    logoText: isPrimeOnly ? "prime video" : "literally everything!"
});

// --- COMPONENTS ---

const Navbar = ({ isPrimeOnly }) => {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState({ text: [], visual: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const theme = getTheme(isPrimeOnly);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
      const handleClickOutside = (event) => { 
          if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setMenuOpen(false); 
          if (searchRef.current && !searchRef.current.contains(event.target)) setShowSuggestions(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      const fetchSuggestions = async () => {
          if (query.trim().length < 2) {
              setSuggestions({ text: [], visual: [] });
              return;
          }
          try {
              const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}&page=1`);
              const data = await res.json();
              let results = data.results || [];
              results = results.filter(i => i.media_type === 'movie' || i.media_type === 'tv');
              setSuggestions({
                  text: results.map(i => i.title || i.name).slice(0, 3),
                  visual: results.slice(0, 4)
              });
              setShowSuggestions(true);
          } catch (e) { console.error("Search Error", e); }
      };
      const timeoutId = setTimeout(() => { if (query) fetchSuggestions(); else setShowSuggestions(false); }, 300);
      return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSearch = (e) => { 
      e.preventDefault(); 
      setShowSuggestions(false);
      if (query.trim()) {
          const searchPath = isPrimeOnly ? '/search' : '/everything/search';
          navigate(`${searchPath}?q=${encodeURIComponent(query)}`);
      }
  };

  const getLinkClass = (path) => {
    const isActive = location.pathname === path;
    return isActive ? "text-white font-extrabold" : "hover:text-white transition";
  };

  return (
    <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 border-b border-transparent ${scrolled ? 'bg-[#00050D] border-[#1f2a33]' : 'nav-gradient'}`}>
      <div className="flex items-center justify-between px-4 md:px-10 h-[72px]">
        <div className="flex items-center gap-6">
          <Link to={isPrimeOnly ? "/" : "/everything"} className={`font-extrabold text-xl tracking-tighter transition-colors ${theme.color} hover:text-white`}>
              {theme.logoText}
          </Link>
          <div className="hidden lg:flex gap-6 h-full font-bold text-[#8197a4] text-[15px]">
            <Link to={isPrimeOnly ? "/" : "/everything"} className={getLinkClass(isPrimeOnly ? "/" : "/everything")}>Home</Link>
            <Link to={isPrimeOnly ? "/movies" : "/everything/movies"} className={getLinkClass(isPrimeOnly ? "/movies" : "/everything/movies")}>Movies</Link>
            <Link to={isPrimeOnly ? "/tv" : "/everything/tv"} className={getLinkClass(isPrimeOnly ? "/tv" : "/everything/tv")}>TV Shows</Link>
            <Link to="/sports" className={`${getLinkClass("/sports")} flex items-center gap-1.5`}><Trophy size={16} className={location.pathname === "/sports" ? "text-[#00A8E1]" : ""} /> Live Sports</Link>
          </div>
        </div>
        <div className="flex items-center gap-6 relative">
          <div ref={searchRef} className="relative">
              <form onSubmit={handleSearch} className={`bg-[#19222b] border border-white/10 px-3 py-1.5 rounded-md flex items-center group focus-within:${theme.border} transition-all w-[200px] md:w-[350px]`}>
                 <Search size={18} className={`text-gray-400 group-focus-within:${theme.color}`} />
                 <input className="bg-transparent border-none outline-none text-white text-sm font-semibold ml-2 w-full placeholder-gray-500" placeholder={isPrimeOnly ? "Search Prime..." : "Search..."} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if(query.length > 1) setShowSuggestions(true); }} />
                 {query && <X size={16} className="text-gray-400 cursor-pointer hover:text-white" onClick={() => { setQuery(""); setShowSuggestions(false); }} />}
              </form>
              {showSuggestions && (
                  <div className="absolute top-12 left-0 w-full bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in z-[160]">
                      {suggestions.text.map((text, idx) => ( <div key={idx} onClick={() => { setQuery(text); handleSearch({preventDefault:()=>{}}); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-[#333c46] hover:text-white cursor-pointer flex items-center gap-2 border-b border-white/5 last:border-0"><Search size={14} /> {text}</div> ))}
                      <div className="flex gap-3 p-3 overflow-x-auto scrollbar-hide bg-[#00050D]/50">
                          {suggestions.visual.map((item) => (
                              <div key={item.id} onClick={() => { setShowSuggestions(false); navigate(`/detail/${item.media_type}/${item.id}`); }} className="w-[100px] flex-shrink-0 cursor-pointer group">
                                  <div className="aspect-video rounded-md overflow-hidden bg-gray-800 relative"><img src={`${IMAGE_BASE_URL}${item.backdrop_path || item.poster_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" /></div>
                                  <div className="text-[11px] font-bold text-gray-400 mt-1 truncate group-hover:text-white">{item.title || item.name}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
          <div className="relative" ref={dropdownRef}>
              <div className={`w-9 h-9 rounded-full bg-[#3d464f] flex items-center justify-center border-2 border-transparent hover:border-white transition-all cursor-pointer`} onClick={() => setMenuOpen(!menuOpen)}><Grip size={20} className="text-gray-300" /></div>
              {menuOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl p-2 z-[150] animate-in">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 pt-2">Switch Mode</div>
                      <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${isPrimeOnly ? 'bg-[#00A8E1] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Prime Video</div><div className="text-[10px] opacity-80">Included with Prime only</div></div></Link>
                      <Link to="/everything" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${!isPrimeOnly ? 'bg-[#E50914] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={!isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Literally Everything!</div><div className="text-[10px] opacity-80">All streaming services</div></div></Link>
                  </div>
              )}
          </div>
          <div className={`w-9 h-9 rounded-full ${theme.bg} flex items-center justify-center text-white font-bold cursor-pointer`}>U</div>
        </div>
      </div>
    </nav>
  );
};

// --- SPORTS COMPONENTS (Preserved) ---
const SportsPage = () => {
    const [sports, setSports] = useState([]);
    const [matches, setMatches] = useState([]);
    const [activeCategory, setActiveCategory] = useState('live'); 
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${LIVESPORT_BASE}/api/sports`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? setSports(d) : setSports([])).catch(()=>setSports([]));
    }, []);

    useEffect(() => {
        setLoading(true); setMatches([]); 
        let endpoint = activeCategory === 'live' ? "/api/matches/live" : activeCategory === 'popular' ? "/api/matches/popular" : `/api/matches/${activeCategory}`;
        fetch(`${LIVESPORT_BASE}${endpoint}`).then(r => r.ok ? r.json() : []).then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); }).catch(()=>{ setMatches([]); setLoading(false); });
    }, [activeCategory]);

    const isLive = (date) => (activeCategory === 'live' || (date && date < Date.now() && date + 7200000 > Date.now()));

    return (
        <div className="pt-24 px-4 md:px-12 min-h-screen pb-20">
            <div className="flex items-center gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2">
                <button onClick={() => setActiveCategory('live')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeCategory === 'live' ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}><Signal size={16} className={activeCategory === 'live' ? "animate-pulse" : ""} /> Live Now</button>
                <button onClick={() => setActiveCategory('popular')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeCategory === 'popular' ? 'bg-[#00A8E1] text-white shadow-lg shadow-blue-900/40' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}><Trophy size={16} /> Popular</button>
                <div className="w-px h-6 bg-gray-700 mx-2"></div>
                {sports.map(s => (<button key={s.id} onClick={() => setActiveCategory(s.id)} className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap capitalize ${activeCategory === s.id ? 'bg-white text-black' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}>{s.name}</button>))}
            </div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">{activeCategory === 'live' ? "Live Matches" : "Matches"} {loading && <Loader className="animate-spin text-[#00A8E1]" size={20} />}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {matches.map((match, idx) => (
                    <div key={match.id || idx} onClick={() => navigate(`/watch/sport/${match.id}`)} className="bg-[#19222b] hover:bg-[#232d38] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl border border-transparent hover:border-[#00A8E1]/30">
                        <div className="h-32 bg-gradient-to-br from-[#0f171e] to-[#1a242f] relative p-4 flex items-center justify-between">
                            <div className="flex flex-col items-center gap-2 w-[40%] text-center"><div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center p-2 backdrop-blur-sm">{match.teams?.home?.badge ? <img src={match.teams.home.badge} className="w-full h-full object-contain" alt="" /> : <span className="text-xs font-bold">H</span>}</div><span className="text-xs font-bold text-gray-300 line-clamp-1">{match.teams?.home?.name || "Home"}</span></div>
                            <span className="text-xs font-black text-[#5a6b7c]">VS</span>
                            <div className="flex flex-col items-center gap-2 w-[40%] text-center"><div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center p-2 backdrop-blur-sm">{match.teams?.away?.badge ? <img src={match.teams.away.badge} className="w-full h-full object-contain" alt="" /> : <span className="text-xs font-bold">A</span>}</div><span className="text-xs font-bold text-gray-300 line-clamp-1">{match.teams?.away?.name || "Away"}</span></div>
                            {isLive(match.date) && (<div className="absolute top-2 right-2 flex items-center gap-1 bg-[#E50914] text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest animate-pulse">LIVE</div>)}
                        </div>
                        <div className="p-4 border-t border-white/5"><h3 className="font-bold text-white text-sm mb-2 line-clamp-1 group-hover:text-[#00A8E1] transition">{match.title || "Match"}</h3><div className="flex items-center justify-between text-xs text-[#8197a4] font-medium"><span className="capitalize flex items-center gap-1"><Trophy size={12} /> {match.category || "Sport"}</span></div></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SportsPlayer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [streams, setStreams] = useState([]);
    const [activeStream, setActiveStream] = useState(null);
    useEffect(() => {
        fetch(`${LIVESPORT_BASE}/api/matches/${id}/detail`).then(r => r.ok ? r.json() : {}).then(d => { if (d.sources?.length) { setStreams(d.sources); setActiveStream(d.sources[0]); }});
    }, [id]);
    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
            <div className="h-16 bg-[#19222b] flex items-center px-4 justify-between shrink-0 border-b border-white/10 relative z-50">
                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition"><ArrowLeft size={24} /></button>
                <div className="text-white font-bold">Live Stream</div>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
                {activeStream ? <iframe src={activeStream.embedUrl} className="w-full h-full border-0" allowFullScreen allow="autoplay; encrypted-media" title="Sports Player" /> : <div className="text-gray-500">Loading Stream...</div>}
            </div>
        </div>
    );
};

// --- HERO SECTION ---
const Hero = ({ isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const playTimeout = useRef(null);
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { 
      const endpoint = isPrimeOnly ? `/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc` : `/trending/all/day?api_key=${TMDB_API_KEY}`;
      fetch(`${BASE_URL}${endpoint}`).then(res => res.json()).then(data => setMovies(data.results.slice(0, 5))); 
  }, [isPrimeOnly]);

  useEffect(() => {
      if (!movies.length) return;
      setShowVideo(false); setTrailerKey(null); clearTimeout(playTimeout.current);
      const movie = movies[currentSlide];
      fetch(`${BASE_URL}/${movie.media_type || 'movie'}/${movie.id}/videos?api_key=${TMDB_API_KEY}`).then(r => r.json()).then(d => {
            const t = d.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
            if (t) { setTrailerKey(t.key); playTimeout.current = setTimeout(() => setShowVideo(true), 4000); }
      });
  }, [currentSlide, movies]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % movies.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + movies.length) % movies.length);

  if (!movies.length) return <div className="h-[85vh] w-full bg-[#00050D]" />;
  const movie = movies[currentSlide];

  return (
    <div className="relative w-full h-[85vh] overflow-hidden group">
      <div className={`absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`}><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" /></div>
      {showVideo && trailerKey && <div className="absolute inset-0 animate-in pointer-events-none"><iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} className="w-full h-full scale-[1.3]" allow="autoplay; encrypted-media" frameBorder="0"></iframe></div>}
      <div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/40 to-transparent" />
      <div className="absolute top-[25%] left-[4%] max-w-[600px] z-30 animate-row-enter">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-tight leading-tight">{movie.title || movie.name}</h1>
        <p className="text-lg text-white font-medium line-clamp-3 mb-8 opacity-90 drop-shadow-md text-shadow-sm">{movie.overview}</p>
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} ${theme.hoverBg} text-white h-14 pl-8 pr-8 rounded-md font-bold text-lg flex items-center gap-3 transition transform hover:scale-105 ${theme.shadow}`}><Play fill="white" size={24} /> {isPrimeOnly ? "Play" : "Rent or Play"}</button>
            <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] hover:border-white transition backdrop-blur-sm group"><Info size={28} className="text-gray-200 group-hover:text-white" /></button>
        </div>
      </div>
      <button onClick={() => setIsMuted(!isMuted)} className="absolute top-32 right-[4%] z-40 w-12 h-12 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 hover:border-white transition">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
      <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition"><ChevronLeft size={40} /></button>
      <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition"><ChevronRight size={40} /></button>
    </div>
  );
};

// --- MOVIE CARD & ROW COMPONENTS ---
const MovieCard = ({ movie, variant, itemType, onHover, onLeave, isHovered, rank, isFirst, isLast }) => {
  const navigate = useNavigate();
  const imageUrl = movie.poster_path || movie.backdrop_path;
  const isRanked = variant === 'ranked';
  const baseWidth = 'w-[160px] md:w-[200px]';
  const aspectRatio = 'aspect-[2/3]'; 
  const cardMargin = isRanked ? 'ml-[100px]' : '';
  const originClass = isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center';

  return (
    <div className={`relative flex-shrink-0 ${baseWidth} ${aspectRatio} ${cardMargin} group transition-all duration-300`} onMouseEnter={() => onHover(movie.id)} onMouseLeave={onLeave} onClick={() => navigate(`/detail/${movie.media_type || itemType || 'movie'}/${movie.id}`)} style={{ zIndex: isHovered ? 100 : 10 }}>
      {isRanked && <span className="rank-number">{rank}</span>}
      <div className={`relative w-full h-full rounded-xl overflow-hidden cursor-pointer bg-[#19222b] shadow-xl transform transition-all duration-[400ms] cubic-bezier(0.2, 0.8, 0.2, 1) border border-white/5 ring-1 ring-white/5 ${originClass}`} style={{ transform: isHovered ? 'scale(1.5)' : 'scale(1)', boxShadow: isHovered ? '0 25px 50px rgba(0,0,0,0.8)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
        <img src={`${IMAGE_BASE_URL}${imageUrl}`} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
        <div className={`absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/50 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <h3 className="text-[10px] font-bold text-white mb-2 line-clamp-2">{movie.title || movie.name}</h3>
            <div className="flex gap-2"><button className="bg-white text-black p-1 rounded-full"><Play size={10} fill="black" /></button></div>
        </div>
        {variant === 'netflix' && <div className="absolute top-2 left-2 text-[8px] font-black text-[#E50914] bg-black/50 px-1 rounded">N</div>}
        {variant === 'star' && <div className="absolute top-2 left-2 text-[8px] font-black text-[#FFD700] bg-black/50 px-1 rounded">STAR+</div>}
      </div>
    </div>
  );
};

const StaticRow = ({ title, data, type }) => (
    <div className="mb-8 pl-4 md:pl-12 relative z-20">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex gap-4 overflow-x-scroll scrollbar-hide py-4 px-2">
            {data.map((item) => (
                <div key={item.id} className={`relative flex-shrink-0 cursor-pointer overflow-hidden rounded-lg group hover:scale-105 transition-transform duration-300 ${type === 'mood' ? 'w-[200px] h-[120px]' : type === 'collection' ? 'w-[300px] h-[170px]' : 'w-[240px] h-[140px]'}`}>
                    {type === 'mood' ? (<div className={`w-full h-full bg-gradient-to-br ${item.color} flex items-center justify-center`}><span className="text-4xl">{item.icon}</span></div>) : (<img src={item.image} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition" alt="" />)}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition flex flex-col justify-end p-4"><h4 className="text-white font-bold text-lg drop-shadow-md">{item.label || item.title}</h4>{item.subtitle && <p className="text-gray-300 text-xs">{item.subtitle}</p>}</div>
                </div>
            ))}
        </div>
    </div>
);

const Row = ({ title, fetchUrl, variant = 'standard', itemType = 'movie', subLabel }) => {
  const [movies, setMovies] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const rowRef = useRef(null);
  useEffect(() => { fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(data => setMovies((data.results || []).filter(m => m.poster_path))).catch(err => console.error(err)); }, [fetchUrl]);
  const slide = (offset) => { if(rowRef.current) rowRef.current.scrollBy({ left: offset, behavior: 'smooth' }); };
  return (
    <div className="mb-6 pl-4 md:pl-12 relative z-20 group/row">
      <div className="flex items-end gap-3 mb-2"><h3 className={`font-bold text-white ${variant === 'ranked' ? 'text-2xl' : 'text-xl'}`}>{title}</h3>{subLabel && <span className="text-[#00A8E1] text-sm font-bold uppercase tracking-wider mb-1">{subLabel}</span>}</div>
      <div className="relative">
          <button onClick={() => slide(-800)} className="absolute left-0 top-1/2 -translate-y-1/2 z-50 w-12 h-full bg-black/60 opacity-0 group-hover/row:opacity-100 transition text-white flex items-center justify-center hover:bg-black/80"><ChevronLeft size={32}/></button>
          <div ref={rowRef} className="row-container scrollbar-hide">{movies.map((movie, index) => ( <MovieCard key={movie.id} movie={movie} variant={variant} itemType={itemType} rank={index + 1} isHovered={hoveredId === movie.id} onHover={setHoveredId} onLeave={() => setHoveredId(null)} isFirst={index === 0} isLast={index === movies.length - 1} /> ))}</div>
          <button onClick={() => slide(800)} className="absolute right-0 top-1/2 -translate-y-1/2 z-50 w-12 h-full bg-black/60 opacity-0 group-hover/row:opacity-100 transition text-white flex items-center justify-center hover:bg-black/80"><ChevronRight size={32}/></button>
      </div>
    </div>
  );
};

const SearchResults = ({ isPrimeOnly }) => { 
  const [movies, setMovies] = useState([]); 
  const [loading, setLoading] = useState(false);
  const query = new URLSearchParams(useLocation().search).get('q'); 
  const theme = getTheme(isPrimeOnly);
  const navigate = useNavigate();
   
  useEffect(() => { 
      if (query) {
          setLoading(true); setMovies([]); 
          fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}`).then(res => res.json()).then(async (data) => {
                let results = data.results || [];
                setMovies(results.filter(m => m.media_type === 'movie' || m.media_type === 'tv'));
                setLoading(false);
            });
      } 
  }, [query]); 

  return (
    <div className="pt-28 px-8 min-h-screen">
        <h2 className="text-white text-2xl mb-6 flex items-center gap-2">Results for "{query}" {loading && <Loader className="animate-spin ml-2" size={20} />}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">{movies.map(m => (m.poster_path && (<div key={m.id} className="cursor-pointer" onClick={() => navigate(`/detail/${m.media_type || 'movie'}/${m.id}`)}><img src={`${IMAGE_BASE_URL}${m.poster_path}`} className={`rounded-md hover:scale-105 transition-transform border-2 border-transparent hover:${theme.border}`} alt={m.title} /></div>)))}</div>
    </div>
  ); 
};

// --- MOVIE DETAIL COMPONENT ---
const MovieDetail = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [relatedMovies, setRelatedMovies] = useState([]);
    const [credits, setCredits] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [showVideo, setShowVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    useEffect(() => {
        setMovie(null); setRelatedMovies([]); setTrailerKey(null); setShowVideo(false); window.scrollTo(0,0);
        fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`).then(r=>r.json()).then(setMovie);
        fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`).then(r=>r.json()).then(setCredits);
        fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`).then(r=>r.json()).then(d => {
            const t = d.results?.find(v=>v.site==="YouTube" && v.type==="Trailer");
            if(t) { setTrailerKey(t.key); setTimeout(()=>setShowVideo(true),3000); }
        });
        const fetchRelated = async () => {
             const r1 = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`);
             const d1 = await r1.json();
             if(d1.results?.length) setRelatedMovies(d1.results.slice(0,10));
             else { const r2 = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}`); const d2 = await r2.json(); if(d2.results) setRelatedMovies(d2.results.slice(0,10)); }
        };
        fetchRelated();
    }, [type, id]);

    if(!movie) return <div className="min-h-screen bg-[#0f171e]" />;
    
    return (
        <div className="min-h-screen bg-[#0f171e] text-white">
            <div className="relative h-[85vh] w-full overflow-hidden">
                <div className={`absolute inset-0 transition-opacity duration-1000 ${showVideo?'opacity-0':'opacity-100'}`}><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt=""/></div>
                {showVideo && trailerKey && <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted?1:0}&controls=0&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} className="absolute inset-0 w-full h-full scale-[1.5] pointer-events-none" allow="autoplay; encrypted-media"/>}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/80 to-transparent w-[70%]" />
                <div className="absolute inset-0 flex flex-col justify-center px-16 z-20 max-w-2xl pt-20">
                    <h1 className="text-6xl font-extrabold mb-4 drop-shadow-2xl">{movie.title || movie.name}</h1>
                    <div className="flex items-center gap-4 mb-8">
                        <button onClick={()=>navigate(`/watch/${type}/${id}`)} className="bg-white text-black px-8 py-4 rounded font-bold text-xl flex items-center gap-3 hover:scale-105 transition"><Play fill="black" /> Play</button>
                        <button onClick={()=>setIsMuted(!isMuted)} className="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md">{isMuted?<VolumeX/>:<Volume2/>}</button>
                    </div>
                    <p className="text-lg text-gray-300 line-clamp-3">{movie.overview}</p>
                </div>
            </div>
            <div className="px-16 -mt-20 relative z-30 mb-20">
                <h3 className="text-xl font-bold mb-4">Customers also watched</h3>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
                    {relatedMovies.map(m => (
                        <div key={m.id} onClick={()=>navigate(`/detail/${m.media_type||type}/${m.id}`)} className="w-[220px] aspect-video flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition shadow-lg bg-gray-800">
                            {m.backdrop_path ? <img src={`${IMAGE_BASE_URL}${m.backdrop_path}`} className="w-full h-full object-cover" alt=""/> : <div className="p-4 text-xs">{m.title}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Player = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const getSourceUrl = () => { return type === 'tv' ? `${VIDFAST_BASE}/tv/${id}/1/1?autoPlay=true&theme=00A8E1&nextButton=true` : `${VIDFAST_BASE}/movie/${id}?autoPlay=true&theme=00A8E1`; };
  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[120] bg-black/50 p-3 rounded-full text-white"><ArrowLeft size={24} /></button>
      <iframe src={getSourceUrl()} className="w-full h-full border-none" allowFullScreen allow="encrypted-media" title="Player"></iframe>
    </div>
  );
};

// --- STATIC HOMEPAGE LAYOUT ---
const Home = () => {
    return (
        <div className="pb-20">
            <Hero isPrimeOnly={true} />
            <div className="-mt-10 relative z-20">
                <Row title="Now Playing" fetchUrl={`/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US`} subLabel="Trending" />
                <Row title="TOP 10" subLabel="MOVIES" fetchUrl={`/movie/top_rated?api_key=${TMDB_API_KEY}`} variant="ranked" />
                <Row title="TOP 10" subLabel="TV SHOWS" fetchUrl={`/tv/top_rated?api_key=${TMDB_API_KEY}`} variant="ranked" itemType="tv" />
                <Row title="Popular" subLabel="on STAR+" fetchUrl={`/tv/popular?api_key=${TMDB_API_KEY}`} variant="star" itemType="tv" />
                <StaticRow title="Collections" data={COLLECTIONS} type="collection" />
                <StaticRow title="Discover by Mood" data={MOODS} type="mood" />
                <StaticRow title="Explore by Decade" data={DECADES} type="decade" />
                <Row title="Netflix TV Shows" fetchUrl={`/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213`} variant="netflix" itemType="tv" />
                <Row title="Popular TV Shows" fetchUrl={`/tv/popular?api_key=${TMDB_API_KEY}&page=2`} itemType="tv" />
                <Row title="Comedy Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35`} />
                <Row title="Action Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`} />
                <Row title="Korean Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ko`} />
                <Row title="Romance Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749`} />
                <Row title="Scary Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27`} />
                <Row title="Adventure Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=12`} />
                <Row title="Fantasy Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=14`} />
                <Row title="Mystery Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=9648`} />
                <Row title="War Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10752`} />
            </div>
        </div>
    );
};

// --- APP ROUTING ---
export default function App() {
  return (
    <BrowserRouter>
      <GlobalStyles />
      <ScrollToTop />
      <div className="bg-[#00050D] min-h-screen text-white font-sans selection:bg-[#00A8E1] selection:text-white">
        <Routes>
          <Route path="/" element={<><Navbar isPrimeOnly={true} /><Home /></>} />
          <Route path="/everything" element={<><Navbar isPrimeOnly={false} /><Home /></>} />
          <Route path="/detail/:type/:id" element={<><Navbar isPrimeOnly={true} /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
          <Route path="/sports" element={<><Navbar isPrimeOnly={true} /><SportsPage /></>} />
          <Route path="/watch/sport/:id" element={<SportsPlayer />} />
          <Route path="/search" element={<><Navbar isPrimeOnly={true} /><SearchResults isPrimeOnly={true} /></>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
