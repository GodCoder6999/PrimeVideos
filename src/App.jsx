import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Clock, Ban, Eye, Bookmark, TrendingUp } from 'lucide-react';

// --- CSS STYLES ---
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .nav-gradient { background: linear-gradient(180deg, rgba(0,5,13,0.7) 10%, transparent); }
    /* Increased vertical padding to allow cards to scale up without clipping */
    .row-container { display: flex; overflow-y: hidden; overflow-x: scroll; padding: 40px 0 60px 0; gap: 16px; scroll-behavior: smooth; }
    .rank-number { position: absolute; left: -70px; bottom: 0; font-size: 100px; font-weight: 900; color: #19222b; -webkit-text-stroke: 2px #5a6069; z-index: 0; font-family: sans-serif; letter-spacing: -5px; line-height: 0.8; }
    .glow-hover:hover { box-shadow: 0 0 20px rgba(255, 255, 255, 0.1); }
    @keyframes row-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-row-enter { animation: row-enter 0.6s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-in { animation: fadeIn 0.3s ease-out forwards; }
    
    /* Text Gradient for Titles */
    .text-gradient {
        background: linear-gradient(to bottom, #ffffff 0%, #e0e0e0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
  `}</style>
);

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
const VIDFAST_BASE = "https://vidfast.pro";
// IMPORTANT: Leave empty to use the vite.config.js / vercel.json proxy
const LIVESPORT_BASE = ""; 

// STRICT PRIME FILTERS
const PRIME_PROVIDER_IDS = "9|119"; 
const PRIME_REGION = "IN";      

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// --- CATEGORY DECK ---
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
    { type: 'movie', label: "Fantasy Worlds", genre: 14, variant: 'standard' },
    { type: 'movie', label: "Crime & Punishment", genre: 80, variant: 'standard' },
    { type: 'movie', label: "Romance & Heartbreak", genre: 10749, variant: 'vertical' },
    { type: 'tv', label: "Mystery & Suspense", genre: 9648, variant: 'standard' },
    { type: 'movie', label: "War & Peace", genre: 10752, variant: 'standard' },
    { type: 'movie', label: "Western Classics", genre: 37, variant: 'vertical' },
    { type: 'movie', label: "Documentaries", genre: 99, variant: 'standard' },
    { type: 'movie', label: "Family Fun Night", genre: 10751, variant: 'standard' },
    { type: 'movie', label: "Mind-Bending Movies", genre: 9648, variant: 'standard' },
    { type: 'movie', label: "Asian Cinema Hits", region: 'KR', variant: 'standard' },
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

const getTheme = (isPrimeOnly) => ({
    color: isPrimeOnly ? "text-[#00A8E1]" : "text-[#E50914]",
    bg: isPrimeOnly ? "bg-[#00A8E1]" : "bg-[#E50914]",
    hoverBg: isPrimeOnly ? "hover:bg-[#008ebf]" : "hover:bg-[#b20710]",
    border: isPrimeOnly ? "border-[#00A8E1]" : "border-[#E50914]",
    shadow: isPrimeOnly ? "shadow-[0_0_30px_rgba(0,168,225,0.5)]" : "shadow-[0_0_30px_rgba(229,9,20,0.5)]",
    name: isPrimeOnly ? "Prime" : "Every",
    logoText: isPrimeOnly ? "prime video" : "literally everything!"
});

// --- HOOKS ---
const useInfiniteRows = (type = 'movie', isPrimeOnly = true) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState([]); 
  const [deckIndex, setDeckIndex] = useState(0); 

  const getUrl = (category, pageNum) => {
      if (isPrimeOnly) {
          let base = `/discover/${category.type || type}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&page=${pageNum}`;
          if (category.variant === 'ranked' || category.sort) base += `&sort_by=${category.sort || 'popularity.desc'}`;
          else if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
          else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
          else base += `&sort_by=popularity.desc`;
          return base;
      } 
      else {
          let base = `/discover/${category.type || type}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
          if (category.endpoint) return `/${category.endpoint}?api_key=${TMDB_API_KEY}&page=${pageNum}`; 
          if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
          else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
          else base += `&sort_by=${category.sort || 'popularity.desc'}`;
          return base;
      }
  };

  useEffect(() => {
      const initialDeck = shuffleDeck([...CATEGORY_DECK]);
      setDeck(initialDeck);
      const initialRows = [
          { 
              id: 'trending_hero', 
              title: isPrimeOnly ? "Prime - Recommended for you" : "Trending Now", 
              fetchUrl: getUrl({ type, variant: 'standard' }, 1), 
              variant: 'standard', 
              itemType: type 
          },
          { 
              id: 'top_10', 
              title: isPrimeOnly ? "Top 10 on Prime" : "Top 10 Globally", 
              fetchUrl: getUrl({ type, variant: 'ranked' }, 1), 
              variant: 'ranked', 
              itemType: type 
          },
      ];
      setRows(initialRows);
  }, [type, isPrimeOnly]);

  const loadMore = useCallback(() => {
    if (loading || deck.length === 0) return;
    setLoading(true);
    const nextThree = [];
    for(let i=0; i<3; i++) {
        const idx = (deckIndex + i) % deck.length;
        nextThree.push(deck[idx]);
    }
    const nextBatch = nextThree.map((category, i) => ({
        id: `row-${Date.now()}-${i}`,
        title: category.label,
        fetchUrl: getUrl(category, Math.floor(deckIndex / deck.length) + 1), 
        variant: category.variant,
        itemType: category.type
    }));
    setTimeout(() => { 
        setRows(prev => [...prev, ...nextBatch]); 
        setDeckIndex(prev => prev + 3); 
        setLoading(false); 
    }, 600);
  }, [loading, deck, deckIndex, isPrimeOnly]);
   
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

              if (isPrimeOnly) {
                  const filtered = [];
                  for (const item of results) {
                      if (filtered.length >= 4) break; 
                      try {
                          const pRes = await fetch(`${BASE_URL}/${item.media_type}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`);
                          const pData = await pRes.json();
                          const providers = pData.results?.[PRIME_REGION]?.flatrate || [];
                          if (providers.some(p => p.provider_id.toString() === "9" || p.provider_id.toString() === "119")) {
                              filtered.push(item);
                          }
                      } catch(e) {}
                  }
                  setSuggestions({
                      text: filtered.map(i => i.title || i.name).slice(0, 3), 
                      visual: filtered 
                  });
              } else {
                  setSuggestions({
                      text: results.map(i => i.title || i.name).slice(0, 3),
                      visual: results.slice(0, 4)
                  });
              }
              setShowSuggestions(true);
          } catch (e) { console.error("Search Error", e); }
      };
      const timeoutId = setTimeout(() => { if (query) fetchSuggestions(); else setShowSuggestions(false); }, 300);
      return () => clearTimeout(timeoutId);
  }, [query, isPrimeOnly]);

  const handleSearch = (e) => { 
      e.preventDefault(); 
      setShowSuggestions(false);
      if (query.trim()) {
          const searchPath = isPrimeOnly ? '/search' : '/everything/search';
          navigate(`${searchPath}?q=${encodeURIComponent(query)}`);
      }
  };

  const handleClear = () => { setQuery(""); setShowSuggestions(false); };

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
              <form onSubmit={handleSearch} className={`bg-[#19222b] border border-white/10 px-3 py-1.5 rounded-md flex items-center group focus-within:${theme.border} transition-all w-[300px] md:w-[400px]`}>
                 <Search size={18} className={`text-gray-400 group-focus-within:${theme.color}`} />
                 <input className="bg-transparent border-none outline-none text-white text-sm font-semibold ml-2 w-full placeholder-gray-500" placeholder={isPrimeOnly ? "Search Prime..." : "Search Everything..."} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if(query.length > 1) setShowSuggestions(true); }} />
                 {query && <X size={16} className="text-gray-400 cursor-pointer hover:text-white" onClick={handleClear} />}
              </form>
              {showSuggestions && (suggestions.text.length > 0 || suggestions.visual.length > 0) && (
                  <div className="absolute top-12 left-0 w-full bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in z-[160]">
                      {suggestions.text.map((text, idx) => ( <div key={idx} onClick={() => { setQuery(text); handleSearch({preventDefault:()=>{}}); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-[#333c46] hover:text-white cursor-pointer flex items-center gap-2 border-b border-white/5 last:border-0"><Search size={14} /> {text}</div> ))}
                      {suggestions.visual.length > 0 && ( <div className="px-4 pt-3 pb-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Top Results</div> )}
                      <div className="flex gap-3 p-3 overflow-x-auto scrollbar-hide bg-[#00050D]/50">
                          {suggestions.visual.map((item) => (
                              <div key={item.id} onClick={() => { setShowSuggestions(false); navigate(`/detail/${item.media_type}/${item.id}`); }} className="w-[100px] flex-shrink-0 cursor-pointer group">
                                  <div className="aspect-video rounded-md overflow-hidden bg-gray-800 relative"><img src={`${IMAGE_BASE_URL}${item.backdrop_path || item.poster_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" />{isPrimeOnly && <div className="absolute bottom-1 left-1"><CheckCircle2 size={12} className={`${theme.color} fill-current`} /></div>}</div>
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

// --- SPORTS COMPONENTS ---

const SportsPage = () => {
    const [sports, setSports] = useState([]);
    const [matches, setMatches] = useState([]);
    const [activeCategory, setActiveCategory] = useState('live'); 
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${LIVESPORT_BASE}/api/sports`)
            .then(res => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setSports(data);
                else setSports([]);
            })
            .catch(e => console.error("Error fetching sports:", e));
    }, []);

    useEffect(() => {
        setLoading(true);
        setMatches([]); 
        let endpoint = "";
        if (activeCategory === 'live') endpoint = "/api/matches/live";
        else if (activeCategory === 'popular') endpoint = "/api/matches/popular";
        else endpoint = `/api/matches/${activeCategory}`;

        fetch(`${LIVESPORT_BASE}${endpoint}`)
            .then(res => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setMatches(data);
                } else {
                    console.warn("API returned non-array for matches:", data);
                    setMatches([]);
                }
                setLoading(false);
            })
            .catch(e => {
                console.error("Error fetching matches:", e);
                setMatches([]);
                setLoading(false);
            });
    }, [activeCategory]);

    const formatTime = (timestamp) => {
        if (!timestamp) return "TBD";
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isLive = (date) => {
        const now = Date.now();
        return activeCategory === 'live' || (date && date < now && date + 7200000 > now); 
    };

    return (
        <div className="pt-24 px-4 md:px-12 min-h-screen pb-20">
            <div className="flex items-center gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2">
                <button onClick={() => setActiveCategory('live')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeCategory === 'live' ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}>
                    <Signal size={16} className={activeCategory === 'live' ? "animate-pulse" : ""} /> Live Now
                </button>
                <button onClick={() => setActiveCategory('popular')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeCategory === 'popular' ? 'bg-[#00A8E1] text-white shadow-lg shadow-blue-900/40' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}>
                    <Trophy size={16} /> Popular
                </button>
                <div className="w-px h-6 bg-gray-700 mx-2"></div>
                {sports.map(sport => (
                    <button key={sport.id} onClick={() => setActiveCategory(sport.id)} className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap capitalize ${activeCategory === sport.id ? 'bg-white text-black' : 'bg-[#19222b] text-gray-300 hover:bg-[#333c46] hover:text-white'}`}>
                        {sport.name}
                    </button>
                ))}
            </div>

            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                {activeCategory === 'live' ? "Live Matches" : activeCategory === 'popular' ? "Trending Matches" : `${sports.find(s=>s.id === activeCategory)?.name || 'Sport'} Matches`}
                {loading && <Loader className="animate-spin ml-3 text-[#00A8E1]" size={20} />}
            </h2>

            {loading ? (
                <div className="h-60 flex items-center justify-center text-gray-500">Loading matches...</div>
            ) : matches.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-gray-500 flex-col gap-2">
                    <Trophy size={48} className="opacity-20" />
                    <p>No matches found in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {matches.map((match, idx) => (
                        <div key={match.id || idx} onClick={() => navigate(`/watch/sport/${match.id}`)} className="bg-[#19222b] hover:bg-[#232d38] rounded-xl p-0 overflow-hidden cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl border border-transparent hover:border-[#00A8E1]/30">
                            <div className="h-32 bg-gradient-to-br from-[#0f171e] to-[#1a242f] relative p-4 flex items-center justify-between">
                                <div className="flex flex-col items-center gap-2 w-[40%] text-center">
                                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center p-2 backdrop-blur-sm">
                                        {match.teams?.home?.badge ? <img src={match.teams.home.badge} className="w-full h-full object-contain" alt="" /> : <span className="text-xs font-bold">{match.teams?.home?.name?.[0] || 'H'}</span>}
                                    </div>
                                    <span className="text-xs font-bold text-gray-300 line-clamp-1">{match.teams?.home?.name || "Home"}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-1 w-[20%]">
                                    <span className="text-xs font-black text-[#5a6b7c]">VS</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 w-[40%] text-center">
                                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center p-2 backdrop-blur-sm">
                                        {match.teams?.away?.badge ? <img src={match.teams.away.badge} className="w-full h-full object-contain" alt="" /> : <span className="text-xs font-bold">{match.teams?.away?.name?.[0] || 'A'}</span>}
                                    </div>
                                    <span className="text-xs font-bold text-gray-300 line-clamp-1">{match.teams?.away?.name || "Away"}</span>
                                </div>
                                {isLive(match.date) && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#E50914] text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest animate-pulse">
                                        LIVE
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5">
                                <h3 className="font-bold text-white text-sm mb-2 line-clamp-1 group-hover:text-[#00A8E1] transition">{match.title || "Unknown Match"}</h3>
                                <div className="flex items-center justify-between text-xs text-[#8197a4] font-medium">
                                    <span className="capitalize flex items-center gap-1"><Trophy size={12} /> {match.category || "Sport"}</span>
                                    <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(match.date)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SportsPlayer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [streams, setStreams] = useState([]);
    const [activeStream, setActiveStream] = useState(null);
    const [loading, setLoading] = useState(true);
    const [matchTitle, setMatchTitle] = useState("Loading Match...");
    const [showStreamList, setShowStreamList] = useState(false);

    useEffect(() => {
        fetch(`${LIVESPORT_BASE}/api/matches/${id}/detail`)
            .then(res => {
                if (!res.ok) throw new Error("Match not found");
                return res.json();
            })
            .then(data => {
                if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
                    setStreams(data.sources);
                    setActiveStream(data.sources[0]);
                }
                setLoading(false);
            })
            .catch(e => {
                console.error("Error loading stream:", e);
                setLoading(false);
            });
        
        fetch(`${LIVESPORT_BASE}/api/matches/live`)
            .then(res => res.json())
            .then(matches => {
                if(Array.isArray(matches)) {
                    const found = matches.find(m => m.id === id);
                    if (found) setMatchTitle(found.title);
                    else {
                          fetch(`${LIVESPORT_BASE}/api/matches/popular`).then(r=>r.json()).then(pop => {
                             if(Array.isArray(pop)) {
                                 const pFound = pop.find(m => m.id === id);
                                 if (pFound) setMatchTitle(pFound.title);
                                 else setMatchTitle("Live Sport Stream");
                             }
                          });
                     }
                }
            })
            .catch(() => setMatchTitle("Live Sport Stream"));

    }, [id]);

    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
            <div className="h-16 bg-[#19222b] flex items-center px-4 justify-between shrink-0 border-b border-white/10 relative z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition"><ArrowLeft size={24} /></button>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-tight">{matchTitle}</h1>
                        <div className="text-[#00A8E1] text-xs font-bold flex items-center gap-1">LIVE BROADCAST</div>
                    </div>
                </div>
                
                {streams.length > 1 && (
                    <button onClick={() => setShowStreamList(!showStreamList)} className="flex items-center gap-2 bg-[#00A8E1] hover:bg-[#008ebf] text-white px-4 py-2 rounded-md text-sm font-bold transition">
                        <Signal size={16} /> Switch Stream
                    </button>
                )}
            </div>

            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {loading ? (
                    <div className="text-white flex flex-col items-center gap-3">
                        <Loader className="animate-spin text-[#00A8E1]" size={40} />
                        <p className="text-sm text-gray-400">Locating secure stream...</p>
                    </div>
                ) : activeStream ? (
                    <iframe 
                        src={activeStream.embedUrl} 
                        className="w-full h-full border-0" 
                        allowFullScreen 
                        allow="autoplay; encrypted-media"
                        title="Sports Player"
                    />
                ) : (
                    <div className="text-center text-gray-500">
                        <Ban size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No active streams found for this match.</p>
                        <button onClick={() => navigate(-1)} className="mt-4 text-[#00A8E1] hover:underline">Go Back</button>
                    </div>
                )}

                {showStreamList && (
                    <div className="absolute top-4 right-4 w-72 bg-[#19222b]/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-10 z-[60]">
                        <div className="p-3 border-b border-white/10 flex justify-between items-center">
                            <span className="font-bold text-white text-sm">Select Source</span>
                            <X size={16} className="text-gray-400 cursor-pointer hover:text-white" onClick={() => setShowStreamList(false)} />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            {streams.map((stream, idx) => (
                                <div 
                                    key={stream.id || idx} 
                                    onClick={() => { setActiveStream(stream); setShowStreamList(false); }}
                                    className={`p-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition flex items-center justify-between ${activeStream === stream ? 'bg-[#00A8E1]/10 border-l-4 border-l-[#00A8E1]' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div>
                                        <div className="text-white font-bold text-sm">Stream {stream.streamNo}</div>
                                        <div className="text-xs text-gray-400 capitalize">{stream.language || 'Unknown Language'}</div>
                                    </div>
                                    {stream.hd && <span className="bg-[#333] text-xs text-white px-1.5 py-0.5 rounded border border-gray-600">HD</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- HERO SECTION WITH HOVER PLAYBACK LOGIC ---
const Hero = ({ isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
   
  const playTimeout = useRef(null);
  const stopTimeout = useRef(null);
  const isHovering = useRef(false);
   
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { 
      const endpoint = isPrimeOnly 
        ? `/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc`
        : `/trending/all/day?api_key=${TMDB_API_KEY}`;
      
      fetch(`${BASE_URL}${endpoint}`)
        .then(res => res.json())
        .then(data => setMovies(data.results.slice(0, 5))); 
  }, [isPrimeOnly]);

  useEffect(() => {
      if (movies.length === 0) return;
      
      setShowVideo(false);
      setTrailerKey(null);
      clearTimeout(playTimeout.current);
      clearTimeout(stopTimeout.current);

      const movie = movies[currentSlide];
      const mediaType = movie.media_type || 'movie';

      fetch(`${BASE_URL}/${mediaType}/${movie.id}/videos?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => {
            const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results?.find(v => v.site === 'YouTube');
            if (trailer) {
                setTrailerKey(trailer.key);
                if (isHovering.current) {
                    playTimeout.current = setTimeout(() => setShowVideo(true), 4000);
                }
            }
        });
  }, [currentSlide, movies]);

  const handleMouseEnter = () => {
      isHovering.current = true;
      clearTimeout(stopTimeout.current);
      clearTimeout(playTimeout.current);
      playTimeout.current = setTimeout(() => setShowVideo(true), 4000);
  };

  const handleMouseLeave = () => {
      isHovering.current = false;
      clearTimeout(playTimeout.current);
      clearTimeout(stopTimeout.current);
      stopTimeout.current = setTimeout(() => setShowVideo(false), 1000);
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % movies.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + movies.length) % movies.length);

  if (movies.length === 0) return <div className="h-[85vh] w-full bg-[#00050D]" />;

  const movie = movies[currentSlide];

  return (
    <div 
        className="relative w-full h-[85vh] overflow-hidden group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
    >
      <div className={`absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`}>
        <img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" />
      </div>

      {showVideo && trailerKey && (
          <div className="absolute inset-0 animate-in pointer-events-none">
             <iframe 
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`}
                className="w-full h-full scale-[1.3]" 
                allow="autoplay; encrypted-media"
                frameBorder="0"
                title="Hero Trailer"
             ></iframe>
          </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-transparent to-transparent" />

      <div className="absolute top-[25%] left-[4%] max-w-[600px] z-30 animate-row-enter">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-tight leading-tight">
            {movie.title || movie.name}
        </h1>
        
        <div className="flex items-center gap-3 text-[#a9b7c1] font-bold text-sm mb-6">
           {isPrimeOnly && <span className={`${theme.color} tracking-wide`}>Included with Prime</span>}
           <span className="bg-[#33373d]/80 text-white px-1.5 py-0.5 rounded text-xs border border-gray-600 backdrop-blur-md">UHD</span>
           <span className="bg-[#33373d]/80 text-white px-1.5 py-0.5 rounded text-xs border border-gray-600 backdrop-blur-md">16+</span>
        </div>
        
        <p className="text-lg text-white font-medium line-clamp-3 mb-8 opacity-90 drop-shadow-md text-shadow-sm">{movie.overview}</p>
        
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} ${theme.hoverBg} text-white h-14 pl-8 pr-8 rounded-md font-bold text-lg flex items-center gap-3 transition transform hover:scale-105 ${theme.shadow}`}>
                <Play fill="white" size={24} /> 
                {isPrimeOnly ? "Play" : "Rent or Play"}
            </button>
            <button className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] hover:border-white transition backdrop-blur-sm group">
                <Plus size={28} className="text-gray-200 group-hover:text-white" />
            </button>
            <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] hover:border-white transition backdrop-blur-sm group">
                <Info size={28} className="text-gray-200 group-hover:text-white" />
            </button>
        </div>
      </div>

      <div className="absolute top-32 right-[4%] z-40">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="w-12 h-12 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 hover:border-white transition"
          >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
      </div>

      <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition backdrop-blur-sm border border-transparent hover:border-white/30">
          <ChevronLeft size={40} />
      </button>
      <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition backdrop-blur-sm border border-transparent hover:border-white/30">
          <ChevronRight size={40} />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40">
          {movies.map((_, idx) => (
              <div key={idx} className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-white w-4' : 'bg-gray-500'}`} />
          ))}
      </div>
    </div>
  );
};

// --- MOVIE CARD COMPONENT ---
// Re-engineered to fix neighbor shifting and overflow issues.
const MovieCard = ({ movie, variant, itemType, onHover, onLeave, isHovered, rank, isPrimeOnly }) => {
  const navigate = useNavigate();
  const [trailerKey, setTrailerKey] = useState(null);
  const theme = getTheme(isPrimeOnly);

  const isPoster = variant === 'vertical';
  const isRanked = variant === 'ranked';
  const imageUrl = isPoster || isRanked ? movie.poster_path : movie.backdrop_path;
  
  // Base Dimensions (Fixed Layout Placeholders)
  const baseWidth = isPoster ? 'w-[160px] md:w-[200px]' : isRanked ? 'w-[180px]' : 'w-[240px] md:w-[280px]';
  const aspectRatio = isPoster || isRanked ? 'aspect-[2/3]' : 'aspect-video';
  const cardMargin = isRanked ? 'ml-[70px]' : ''; 

  // Mock Data for Badges
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const views = movie.popularity ? `${Math.floor(movie.popularity * 100)}` : "10K"; 

  // Fetch trailer only when hovered and appropriate type
  useEffect(() => {
    if (isHovered && !isPoster && !isRanked) { 
        const mediaType = movie.media_type || itemType || 'movie';
        fetch(`${BASE_URL}/${mediaType}/${movie.id}/videos?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => {
              const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results?.find(v => v.site === 'YouTube');
              if (trailer) setTrailerKey(trailer.key);
          }).catch(err => console.error(err));
    } else { setTrailerKey(null); }
  }, [isHovered, movie, itemType, isPoster, isRanked]);

  return (
    <div 
      className={`relative flex-shrink-0 ${baseWidth} ${aspectRatio} ${cardMargin}`}
      onMouseEnter={() => onHover(movie.id)}
      onMouseLeave={onLeave}
    >
      {/* Rank Number (Outside the animated card to stay fixed) */}
      {isRanked && <span className="rank-number">{rank}</span>}
      
      {/* Animated Card Content */}
      <div 
        className={`
            absolute top-0 left-0 w-full rounded-lg bg-[#0f1014] shadow-xl border border-white/5 
            transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
            origin-center cursor-pointer overflow-hidden
            ${isHovered ? 'z-50 scale-110 shadow-[0_30px_60px_rgba(0,0,0,0.8)] border-[#3B82F6]/50' : 'z-10 scale-100 hover:border-white/20 h-full'}
        `}
        style={{ 
            // When hovered, allow height to expand naturally. When not, force full height of container.
            height: isHovered ? 'auto' : '100%',
            minHeight: '100%'
        }}
        onClick={() => navigate(`/detail/${movie.media_type || itemType || 'movie'}/${movie.id}`)}
      >
        {/* Media Container */}
        <div className={`relative w-full ${aspectRatio} overflow-hidden`}>
            {/* Horizontal Video or Image */}
            {!isPoster && !isRanked && isHovered && trailerKey ? (
               <iframe className="w-full h-full object-cover pointer-events-none scale-125" src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} title="Trailer" allow="autoplay; encrypted-media" frameBorder="0"></iframe>
            ) : (
               <img src={`${IMAGE_BASE_URL}${imageUrl}`} alt={movie.title} className="w-full h-full object-cover transition-opacity" loading="lazy" />
            )}
            
            {/* Overlays */}
            <div className={`absolute inset-0 bg-gradient-to-t from-[#0f1014] via-transparent to-transparent transition-opacity ${isHovered ? 'opacity-80' : 'opacity-60'}`} />

            {/* Badges */}
            {(isPoster || isRanked || isHovered) && (
                <>
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-white/10 shadow-sm">
                        <span className="text-[#FFD700] text-xs font-bold">{rating}</span>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-white/10 shadow-sm">
                        <Eye size={12} className="text-white/70" />
                        <span className="text-white text-xs font-bold">{views}</span>
                    </div>
                </>
            )}

            {/* Prime Tag (Horizontal Standard) */}
            {!isHovered && !isPoster && !isRanked && isPrimeOnly && (
                <div className="absolute bottom-2 left-3"><span className={`text-[10px] font-black tracking-widest ${theme.color} uppercase drop-shadow-md`}>PRIME</span></div>
            )}

            {/* Title (Collapsed State) */}
            {!isHovered && (
                <div className="absolute bottom-0 left-0 w-full p-3">
                    <h3 className="text-white font-black text-sm uppercase leading-tight truncate text-shadow-sm text-gradient">{movie.title || movie.name}</h3>
                </div>
            )}
        </div>

        {/* Expanded Details (Visible on Hover) */}
        {isHovered && (
            <div className="p-4 flex flex-col gap-3 bg-[#0f1014] animate-in fade-in slide-in-from-bottom-2 h-auto">
                
                {/* Title */}
                <h3 className="text-white font-bold text-base leading-tight drop-shadow-md">{movie.title || movie.name}</h3>

                {/* Platform/Provider Line */}
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#00A8E1]">
                    <CheckCircle2 size={14} className="fill-current" />
                    <span>Included with Prime</span>
                </div>

                {/* Interactive Controls Row */}
                <div className="flex items-center gap-3">
                    <button className="flex-1 bg-white hover:bg-gray-200 text-black text-xs font-extrabold py-3 rounded-md transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                        <Play fill="black" size={16} /> Play
                    </button>
                    <button className="w-10 h-10 rounded-full border border-gray-600 hover:border-white hover:bg-white/10 flex items-center justify-center transition-all bg-transparent group/btn">
                        <List size={20} className="text-white group-hover/btn:text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full border border-gray-600 hover:border-white hover:bg-white/10 flex items-center justify-center transition-all bg-transparent group/btn">
                        <Plus size={20} className="text-white group-hover/btn:text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full border border-gray-600 hover:border-white hover:bg-white/10 flex items-center justify-center transition-all bg-transparent group/btn">
                        <Ban size={18} className="text-white group-hover/btn:text-white" />
                    </button>
                </div>

                {/* Ranking / Category Indicator */}
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#46d369]">
                    <TrendingUp size={14} />
                    <span>#{rank || Math.floor(Math.random() * 10) + 1} in Movies</span>
                </div>

                {/* Content Classification & Runtime */}
                <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-300">
                    <span className="bg-[#33373d] text-[#d6d6d6] px-1.5 py-0.5 rounded-[3px] border border-white/10">U/A 13+</span>
                    <span>{movie.release_date?.split('-')[0] || "2024"}</span>
                    <span className="text-gray-400">2h 15m</span>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-[11px] line-clamp-3 leading-relaxed font-normal">
                    {movie.overview || "No description available."}
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

const Row = ({ title, fetchUrl, variant = 'standard', itemType = 'movie', isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const timeoutRef = useRef(null);
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(data => setMovies(data.results || [])).catch(err => console.error(err)); }, [fetchUrl]);

  const handleHover = (id) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setHoveredId(id), 400); };
  const handleLeave = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setHoveredId(null); };

  return (
    <div className="mb-6 pl-4 md:pl-12 relative z-20 group/row animate-row-enter hover:z-30 transition-all duration-300">
      <h3 className="text-[19px] font-bold text-white mb-2 flex items-center gap-2">
          {variant === 'ranked' ? <span className={theme.color}>Top 10</span> : <span className={theme.color}>{theme.name}</span>} 
          {title}
          <ChevronRight size={18} className="text-[#8197a4] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"/>
      </h3>
      <div className={`row-container ${variant === 'vertical' ? 'vertical' : ''} scrollbar-hide`}>
        {movies.length > 0 && movies.map((movie, index) => ( 
           (movie.backdrop_path || movie.poster_path) && 
           <MovieCard key={movie.id} movie={movie} variant={variant} itemType={itemType} rank={index + 1} isHovered={hoveredId === movie.id} onHover={handleHover} onLeave={handleLeave} isPrimeOnly={isPrimeOnly} /> 
        ))}
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
          setLoading(true);
          setMovies([]); 

          fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}`)
            .then(res => res.json())
            .then(async (data) => {
                let results = data.results || [];

                if (isPrimeOnly) {
                    const filteredResults = [];
                    for (const item of results) {
                        const mediaType = item.media_type || 'movie'; 
                        if (mediaType !== 'movie' && mediaType !== 'tv') continue;

                        try {
                            const providerRes = await fetch(`${BASE_URL}/${mediaType}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`);
                            const providerData = await providerRes.json();
                            const inProviders = providerData.results?.[PRIME_REGION]?.flatrate || [];
                            
                            const isOnPrime = inProviders.some(p => p.provider_id.toString() === "9" || p.provider_id.toString() === "119");
                            if (isOnPrime) {
                                filteredResults.push(item);
                            }
                            await new Promise(r => setTimeout(r, 50)); 
                        } catch (e) { console.error("Error checking provider", e); }
                    }
                    setMovies(filteredResults);
                } else {
                    setMovies(results);
                }
                setLoading(false);
            });
      } 
  }, [query, isPrimeOnly]); 

  return (
    <div className="pt-28 px-8 min-h-screen">
        <h2 className="text-white text-2xl mb-6 flex items-center gap-2">
            Results for "{query}" 
            {loading && <Loader className="animate-spin ml-2" size={20} />}
            {!loading && isPrimeOnly && <span className={`${theme.color} text-sm font-bold border border-[#00A8E1] px-2 py-0.5 rounded`}>Prime Video Only</span>}
        </h2>
        
        {!loading && movies.length === 0 && (
            <div className="text-gray-500 mt-10">No results found {isPrimeOnly ? "on Prime Video." : "."}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.map(m => (m.poster_path && (
                <div key={m.id} className="cursor-pointer" onClick={() => navigate(`/detail/${m.media_type || 'movie'}/${m.id}`)}>
                    <img src={`${IMAGE_BASE_URL}${m.poster_path}`} className={`rounded-md hover:scale-105 transition-transform border-2 border-transparent hover:${theme.border}`} alt={m.title} />
                </div>
            )))}
        </div>
    </div>
  ); 
};

const MovieDetail = () => {
  const { type, id } = useParams();
  const [movie, setMovie] = useState(null);
  const [activeTab, setActiveTab] = useState('related');
  const [seasonData, setSeasonData] = useState(null);
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`).then(res => res.json()).then(data => { setMovie(data); if (type === 'tv') setActiveTab('episodes'); else setActiveTab('related'); }).catch(err => console.error(err));
    fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`).then(res => res.json()).then(data => { if (data.results.length > 0) setRelatedMovies(data.results); else return fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=en-US`); }).then(res => { if (res) return res.json(); }).then(data => { if (data && data.results) setRelatedMovies(data.results); }).catch(err => console.error(err));
  }, [type, id]);

  useEffect(() => { if (type === 'tv' && id) { fetch(`${BASE_URL}/tv/${id}/season/${selectedSeason}?api_key=${TMDB_API_KEY}&language=en-US`).then(res => res.json()).then(data => setSeasonData(data)).catch(err => console.error(err)); } }, [type, id, selectedSeason]);

  if (!movie) return <div className="min-h-screen w-full bg-[#00050D]" />;

  return (
    <div className="min-h-screen bg-[#00050D] relative text-white font-sans overflow-x-hidden">
      <div className="absolute inset-0 h-[100vh] w-full z-0"><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-[#00050D]/60 to-transparent" /><div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/80 to-transparent" /></div>
      <div className="relative z-10 pt-[140px] px-8 md:px-16 max-w-[1400px]">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight drop-shadow-2xl max-w-4xl leading-tight">{movie.title || movie.name}</h1>
        <div className="flex items-center flex-wrap gap-4 text-[#99a7b1] font-bold text-[15px] mb-8">{movie.vote_average && <span className="text-white flex items-center gap-1"><span className="text-[#00A8E1] font-extrabold">IMDb</span> {movie.vote_average.toFixed(1)}</span>}<span>{movie.runtime ? `${Math.floor(movie.runtime/60)} h ${movie.runtime%60} min` : 'Season 1'}</span><span>{movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0] || "2024"}</span><span className="bg-[#33373d] text-[#d6d6d6] text-[12px] px-1.5 py-0.5 rounded-sm border border-[#5a6069]">UHD</span><span className="bg-[#33373d] text-[#d6d6d6] text-[12px] px-1.5 py-0.5 rounded-sm border border-[#5a6069]">16+</span></div>
        <div className="flex items-center gap-4 mb-8"><button onClick={() => navigate(`/watch/${type}/${id}`)} className="bg-[#00A8E1] hover:bg-[#008ebf] text-white h-[56px] pl-8 pr-9 rounded-md font-bold text-[17px] flex items-center gap-3 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(0,168,225,0.3)]"><Play fill="white" size={24} /> <span>Play {type === 'tv' && 'S1 E1'}</span></button><div className="flex gap-4"><button className="w-[56px] h-[56px] rounded-full bg-[#42474d]/60 border border-[#8197a4]/30 flex flex-col items-center justify-center hover:bg-[#42474d] hover:border-white transition group backdrop-blur-sm"><Plus size={26} className="text-white" /></button><button className="w-[56px] h-[56px] rounded-full bg-[#42474d]/60 border border-[#8197a4]/30 flex flex-col items-center justify-center hover:bg-[#42474d] hover:border-white transition group backdrop-blur-sm"><Download size={24} className="text-white" /></button><button className="w-[56px] h-[56px] rounded-full bg-[#42474d]/60 border border-[#8197a4]/30 flex flex-col items-center justify-center hover:bg-[#42474d] hover:border-white transition group backdrop-blur-sm"><Share2 size={24} className="text-white" /></button></div></div>
        <p className="text-[17px] text-white font-medium leading-relaxed drop-shadow-md max-w-3xl mb-12">{movie.overview}</p>
        <div className="border-t border-white/10 pt-4 pb-20">
             <div className="flex gap-8 mb-8">{type === 'tv' && <button onClick={() => setActiveTab('episodes')} className={`text-[18px] font-bold pb-2 transition border-b-2 ${activeTab === 'episodes' ? 'text-white border-white' : 'text-[#8197a4] border-transparent hover:text-white'}`}>Episodes</button>}<button onClick={() => setActiveTab('related')} className={`text-[18px] font-bold pb-2 transition border-b-2 ${activeTab === 'related' ? 'text-white border-white' : 'text-[#8197a4] border-transparent hover:text-white'}`}>Related</button><button onClick={() => setActiveTab('details')} className={`text-[18px] font-bold pb-2 transition border-b-2 ${activeTab === 'details' ? 'text-white border-white' : 'text-[#8197a4] border-transparent hover:text-white'}`}>More Details</button></div>
             {activeTab === 'episodes' && type === 'tv' && seasonData && (<div className="animate-in"><div className="flex items-center gap-4 mb-6"><span className="font-bold text-lg text-white">Season</span><div className="relative"><select value={selectedSeason} onChange={(e) => setSelectedSeason(Number(e.target.value))} className="bg-[#1a242f] text-white border border-gray-600 rounded-md py-2 pl-4 pr-10 font-bold appearance-none outline-none hover:bg-[#25303b] cursor-pointer">{Array.from({length: movie.number_of_seasons || 1}, (_, i) => i + 1).map(s => (<option key={s} value={s}>Season {s}</option>))}</select><ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></div><span className="text-[#8197a4] text-sm ml-2">{seasonData.episodes?.length} Episodes</span></div><div className="flex flex-col gap-2">{seasonData.episodes?.map(ep => (<div key={ep.id} className="flex flex-col md:flex-row gap-5 p-4 rounded-lg hover:bg-[#1a242f] transition group cursor-pointer border border-transparent hover:border-white/5" onClick={() => navigate(`/watch/tv/${id}?season=${selectedSeason}&episode=${ep.episode_number}`)}><div className="relative w-full md:w-[280px] aspect-video flex-shrink-0 bg-[#00050D] rounded-md overflow-hidden">{ep.still_path ? (<img src={`${IMAGE_BASE_URL}${ep.still_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt={ep.name} />) : (<div className="w-full h-full flex items-center justify-center text-gray-600 font-bold">No Image</div>)}<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40"><div className="w-12 h-12 bg-[#00A8E1] rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition"><Play fill="white" className="ml-1" size={24} /></div></div></div><div className="flex flex-col justify-center flex-grow py-2"><h4 className="font-bold text-white text-[17px] mb-1 group-hover:text-[#00A8E1] transition">{ep.episode_number}. {ep.name}</h4><p className="text-[#8197a4] text-[14px] font-medium mb-3">{ep.air_date} • {ep.runtime ? `${ep.runtime} min` : 'N/A'}</p><p className="text-[#d6d6d6] text-[15px] leading-relaxed line-clamp-2 md:line-clamp-3 text-gray-400">{ep.overview}</p></div></div>))}</div></div>)}
             {activeTab === 'related' && (<div className="relative animate-in"><h3 className="text-white font-bold text-xl mb-4">Customers also watched</h3><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">{relatedMovies.length > 0 ? relatedMovies.map(m => (<div key={m.id} onClick={() => navigate(`/detail/${m.media_type || 'movie'}/${m.id}`)} className="cursor-pointer group"><div className="rounded-md overflow-hidden aspect-video bg-[#1a242f] relative shadow-lg group-hover:shadow-[0_0_20px_rgba(0,168,225,0.4)] transition duration-300"><img src={`${IMAGE_BASE_URL}${m.backdrop_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt={m.title} /><div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div></div><h4 className="text-sm font-bold text-gray-300 mt-2 group-hover:text-white truncate">{m.title || m.name}</h4></div>)) : (<div className="text-gray-500">No related titles found.</div>)}</div></div>)}
             {activeTab === 'details' && (<div className="text-[#8197a4] animate-in grid grid-cols-1 md:grid-cols-2 gap-8"><div><h4 className="font-bold text-white mb-2">Audio Languages</h4><p>English, Hindi, Tamil, Telugu, Spanish, French</p></div><div><h4 className="font-bold text-white mb-2">Subtitles</h4><p>English [CC], Hindi, Tamil, Telugu, Spanish, French</p></div><div><h4 className="font-bold text-white mb-2">Cast</h4><p>{movie.credits?.cast?.slice(0,5).map(c => c.name).join(", ")}</p></div><div><h4 className="font-bold text-white mb-2">Studio</h4><p>{movie.production_companies?.[0]?.name || "Amazon Studios"}</p></div></div>)}
        </div>
      </div>
    </div>
  );
};

const Player = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse query parameters to get the specific season/episode if clicked from Detail page
  // Default to 1 if not present
  const queryParams = new URLSearchParams(location.search);
  
  // State for playback
  const [season, setSeason] = useState(Number(queryParams.get('season')) || 1);
  const [episode, setEpisode] = useState(Number(queryParams.get('episode')) || 1);
  
  // State for UI
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [seasonData, setSeasonData] = useState(null);
  const [totalSeasons, setTotalSeasons] = useState(1);

  // Fetch Total Seasons
  useEffect(() => {
    if (type === 'tv') {
        fetch(`${BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`)
          .then(res => res.json())
          .then(data => { if(data.number_of_seasons) setTotalSeasons(data.number_of_seasons); });
    }
  }, [type, id]);

  // Fetch Season Data
  useEffect(() => {
    if (type === 'tv') {
        fetch(`${BASE_URL}/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`)
          .then(res => res.json())
          .then(data => setSeasonData(data));
    }
  }, [type, id, season]);

  // Handle watch progress syncing (Updated for VIDFAST format)
  useEffect(() => {
    const vidfastOrigins = [
        'https://vidfast.pro',
        'https://vidfast.in',
        'https://vidfast.io',
        'https://vidfast.me',
        'https://vidfast.net',
        'https://vidfast.pm',
        'https://vidfast.xyz'
    ];

    const handleMessage = (event) => {
      // Validate origin
      if (!vidfastOrigins.includes(event.origin) || !event.data) {
          return;
      }
      
      // Handle MEDIA_DATA event for progress saving (per docs)
      if (event.data.type === 'MEDIA_DATA') {
          // Store data exactly as received from VidFast
          localStorage.setItem('vidFastProgress', JSON.stringify(event.data.data));
          
          // Optional: Sync to our internal format 'watch_progress' if needed for other app features
          try {
             const STORAGE_KEY = 'watch_progress';
             const currentProgress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
             const contentId = event.data.data[Object.keys(event.data.data)[0]].id || id; // extracting ID from the nested structure
             
             // Simple fallback to ensure at least some ID matches
             if(contentId) {
                currentProgress[contentId] = {
                   ...currentProgress[contentId],
                   ...event.data.data,
                   last_updated: Date.now()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProgress));
             }
          } catch(e) {
             // fail silently if internal sync fails
          }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id]);

  const getSourceUrl = () => {
    // Prime Blue Hex for VidFast theme (no #)
    const themeParam = "theme=00A8E1";
    
    if (type === 'tv') {
      // Structure: https://vidfast.pro/tv/{id}/{season}/{episode}?autoPlay=true&theme=...&nextButton=true&autoNext=true
      return `${VIDFAST_BASE}/tv/${id}/${season}/${episode}?autoPlay=true&${themeParam}&nextButton=true&autoNext=true`;
    } else {
      // Structure: https://vidfast.pro/movie/{id}?autoPlay=true&theme=...
      return `${VIDFAST_BASE}/movie/${id}?autoPlay=true&${themeParam}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-hidden flex flex-col">
      {/* Back Button Overlay */}
      <div className="absolute top-6 left-6 z-[120]">
        <button 
          onClick={() => navigate(-1)} 
          className="bg-black/50 hover:bg-[#00A8E1] text-white p-3 rounded-full backdrop-blur-md border border-white/10 transition-all"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Episode List Toggle */}
      {type === 'tv' && (
        <div className="absolute top-6 right-6 z-[120]">
            <button onClick={() => setShowEpisodes(!showEpisodes)} className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${showEpisodes ? 'bg-[#00A8E1] text-white' : 'bg-black/50 hover:bg-[#333c46] text-gray-200'}`}>
                <List size={24} />
            </button>
        </div>
      )}

      {/* Video Player Iframe */}
      <div className="flex-1 relative w-full h-full bg-black">
        <iframe
          src={getSourceUrl()}
          className="w-full h-full border-none"
          allowFullScreen
          allow="encrypted-media"
          title="Player"
        ></iframe>
      </div>

      {/* Episode Sidebar */}
      {type === 'tv' && (
        <div className={`fixed right-0 top-0 h-full bg-[#00050D]/95 backdrop-blur-xl border-l border-white/10 transition-all duration-500 ease-in-out z-[110] flex flex-col ${showEpisodes ? 'w-[350px] translate-x-0 shadow-2xl' : 'w-[350px] translate-x-full shadow-none'}`}>
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1a242f]/50">
                <h2 className="font-bold text-white text-lg">Episodes</h2>
                <div className="relative">
                    <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="appearance-none bg-[#00A8E1] text-white font-bold py-1.5 pl-3 pr-8 rounded cursor-pointer text-sm outline-none hover:bg-[#008ebf] transition">
                        {Array.from({length: totalSeasons}, (_, i) => i + 1).map(s => (<option key={s} value={s} className="bg-[#1a242f]">Season {s}</option>))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                {seasonData?.episodes ? (seasonData.episodes.map(ep => (
                        <div key={ep.id} onClick={() => setEpisode(ep.episode_number)} className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all group ${episode === ep.episode_number ? 'bg-[#333c46] border border-[#00A8E1]' : 'hover:bg-[#333c46] border border-transparent'}`}>
                            <div className="relative w-28 h-16 flex-shrink-0 bg-black rounded overflow-hidden">
                                {ep.still_path ? (<img src={`${IMAGE_BASE_URL}${ep.still_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" />) : (<div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Img</div>)}
                                {episode === ep.episode_number && (<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Play size={16} fill="white" className="text-white" /></div>)}
                            </div>
                            <div className="flex flex-col justify-center min-w-0">
                                <span className={`text-xs font-bold mb-0.5 ${episode === ep.episode_number ? 'text-[#00A8E1]' : 'text-gray-400'}`}>Episode {ep.episode_number}</span>
                                <h4 className={`text-sm font-medium truncate leading-tight ${episode === ep.episode_number ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{ep.name}</h4>
                                <span className="text-[10px] text-gray-500 mt-1">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                            </div>
                        </div>
                ))) : (<div className="text-center text-gray-500 mt-10 flex flex-col items-center"><Loader className="animate-spin mb-2" /><span>Loading Season {season}...</span></div>)}
            </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN WRAPPERS ---
const Home = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('movie', isPrimeOnly); return <><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />)}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>; };
const MoviesPage = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('movie', isPrimeOnly); return <><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />)}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>; };
const TVPage = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('tv', isPrimeOnly); return <><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />)}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>; };
const LiveTV = () => <div className="pt-32 px-12 text-white">Live TV</div>;
const StorePage = () => <div className="pt-32 px-12 text-white">Store</div>;

function App() {
  return (
    <BrowserRouter>
      <GlobalStyles />
      <ScrollToTop />
      <div className="bg-[#00050D] min-h-screen text-white font-sans selection:bg-[#00A8E1] selection:text-white">
        <Routes>
          <Route path="/" element={<><Navbar isPrimeOnly={true} /><Home isPrimeOnly={true} /></>} />
          <Route path="/movies" element={<><Navbar isPrimeOnly={true} /><MoviesPage isPrimeOnly={true} /></>} />
          <Route path="/tv" element={<><Navbar isPrimeOnly={true} /><TVPage isPrimeOnly={true} /></>} />
          
          <Route path="/sports" element={<><Navbar isPrimeOnly={true} /><SportsPage /></>} />
          <Route path="/watch/sport/:id" element={<SportsPlayer />} />

          <Route path="/live" element={<><Navbar isPrimeOnly={true} /><LiveTV /></>} />
          <Route path="/store" element={<><Navbar isPrimeOnly={true} /><StorePage /></>} />
          <Route path="/search" element={<><Navbar isPrimeOnly={true} /><SearchResults isPrimeOnly={true} /></>} />

          <Route path="/everything" element={<><Navbar isPrimeOnly={false} /><Home isPrimeOnly={false} /></>} />
          <Route path="/everything/movies" element={<><Navbar isPrimeOnly={false} /><MoviesPage isPrimeOnly={false} /></>} />
          <Route path="/everything/tv" element={<><Navbar isPrimeOnly={false} /><TVPage isPrimeOnly={false} /></>} />
          <Route path="/everything/search" element={<><Navbar isPrimeOnly={false} /><SearchResults isPrimeOnly={false} /></>} />

          <Route path="/detail/:type/:id" element={<><Navbar isPrimeOnly={true} /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
