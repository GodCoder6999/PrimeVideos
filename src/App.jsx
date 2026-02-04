import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Clock, Ban, Eye, Bookmark, TrendingUp } from 'lucide-react';

// --- CSS STYLES ---
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .nav-gradient { background: linear-gradient(180deg, rgba(0,5,13,0.7) 10%, transparent); }
    
    /* Adjusted padding for 360x440px expansion (Vertical overflow ~100px) */
    .row-container { 
        display: flex; 
        overflow-y: hidden; 
        overflow-x: scroll; 
        padding: 100px 4%; /* Optimized padding for this specific scale */
        margin-top: -60px;
        margin-bottom: -20px;
        gap: 16px; 
        scroll-behavior: smooth; 
        position: relative;
    }

    .rank-number { position: absolute; left: -70px; bottom: 0; font-size: 100px; font-weight: 900; color: #19222b; -webkit-text-stroke: 2px #5a6069; z-index: 0; font-family: sans-serif; letter-spacing: -5px; line-height: 0.8; }
    .glow-hover:hover { box-shadow: 0 0 20px rgba(255, 255, 255, 0.1); }
    @keyframes row-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-row-enter { animation: row-enter 0.6s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-in { animation: fadeIn 0.3s ease-out forwards; }
    
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
// Target: 360px x 440px | Image Only (No Trailer) | Smart Origin
const MovieCard = ({ movie, variant, itemType, onHover, onLeave, isHovered, rank, isPrimeOnly, isFirst, isLast }) => {
  const navigate = useNavigate();
  // REMOVED: trailerKey state and fetching logic completely

  const imageUrl = movie.poster_path || movie.backdrop_path;
  
  // Dimensions
  const baseWidth = 'w-[160px] md:w-[200px]';
  const aspectRatio = 'aspect-[360/440]'; 
  const cardMargin = variant === 'ranked' ? 'ml-[70px]' : ''; 
  const originClass = isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center';

  // Mock Metadata
  const rating = movie.vote_average ? Math.round(movie.vote_average * 10) + "%" : "98%";
  const year = movie.release_date?.split('-')[0] || "2024";
  const duration = movie.media_type === 'tv' ? '1 Season' : '2h 15m';

  return (
    <div 
      className={`relative flex-shrink-0 ${baseWidth} ${aspectRatio} ${cardMargin} group transition-all duration-300`}
      onMouseEnter={() => onHover(movie.id)}
      onMouseLeave={onLeave}
      onClick={() => navigate(`/detail/${movie.media_type || itemType || 'movie'}/${movie.id}`)}
      style={{ zIndex: isHovered ? 100 : 10 }} 
    >
      {variant === 'ranked' && <span className="rank-number">{rank}</span>}
      
      {/* CARD CONTAINER */}
      <div 
        className={`
            relative w-full h-full rounded-xl overflow-hidden cursor-pointer bg-[#19222b] shadow-xl
            transform transition-all duration-[400ms] cubic-bezier(0.2, 0.8, 0.2, 1)
            border border-white/5 ring-1 ring-white/5
            ${originClass}
        `}
        style={{
            transform: isHovered ? 'scale(1.8)' : 'scale(1)',
            boxShadow: isHovered ? '0 25px 50px rgba(0,0,0,0.8)' : '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        {/* MEDIA LAYER - Image Only */}
        <div className={`w-full h-full relative bg-black transition-transform duration-[400ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isHovered ? 'scale-[1.02]' : 'scale-100'}`}>
            <img src={`${IMAGE_BASE_URL}${imageUrl}`} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
        </div>

        {/* OVERLAY LAYER */}
        <div 
            className={`
                absolute inset-0 flex flex-col justify-end px-4 py-5 text-white
                bg-gradient-to-t from-[#0f171e] via-[#0f171e]/95 to-transparent
                transition-all duration-300 ease-out z-30
                ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}
        >
            <div className="mb-2 opacity-90">
               <span className="text-[5px] font-black tracking-[0.2em] text-[#00A8E1] uppercase bg-[#00A8E1]/10 px-1 py-0.5 rounded-sm">Prime</span>
            </div>

            <h3 className="font-extrabold text-[10px] leading-[1.2] text-white drop-shadow-md line-clamp-2 mb-2 w-[90%]">
                {movie.title || movie.name}
            </h3>

            <div className="flex items-center gap-2 mb-3">
                <button className="bg-white hover:bg-[#d6d6d6] text-black text-[6px] font-bold h-6 px-3 rounded-[3px] transition-colors flex items-center justify-center gap-1 uppercase tracking-wider">
                    <Play fill="black" size={6} /> Play
                </button>
                <button className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white transition flex items-center justify-center">
                    <Plus size={8} className="text-white" />
                </button>
            </div>

            <div className="flex items-center gap-1.5 text-[6px] font-medium text-gray-300 mb-1">
                <span className="text-[#46d369] font-bold">{rating} Match</span>
                <span className="text-gray-600 text-[5px]">•</span>
                <span className="text-white">{year}</span>
                <span className="text-gray-600 text-[5px]">•</span>
                <span>{duration}</span>
                <span className="ml-auto border border-white/20 px-1 rounded-[2px] text-[5px] text-gray-400">U/A 13+</span>
            </div>

            <div className="flex items-center gap-1 mb-2 opacity-80">
                <span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">4K UHD</span>
                <span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">HDR10</span>
                <span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">Dolby Atmos</span>
            </div>

            <p className="text-[5.5px] text-gray-400 line-clamp-2 leading-relaxed font-medium">
                {movie.overview || "Stream this title now on Prime Video."}
            </p>
        </div>
      </div>
    </div>
  );
};

const Row = ({ title, fetchUrl, variant = 'standard', itemType = 'movie', isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const rowRef = useRef(null); // Ref for scrolling
  const timeoutRef = useRef(null);
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { 
      fetch(`${BASE_URL}${fetchUrl}`)
        .then(res => res.json())
        .then(data => {
            const validResults = (data.results || []).filter(m => m.backdrop_path || m.poster_path);
            setMovies(validResults);
        })
        .catch(err => console.error(err)); 
  }, [fetchUrl]);

  const handleHover = (id) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setHoveredId(id), 400); };
  const handleLeave = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setHoveredId(null); };

  // Scroll Handlers
  const slideLeft = () => {
      if (rowRef.current) rowRef.current.scrollBy({ left: -800, behavior: 'smooth' });
  };
  const slideRight = () => {
      if (rowRef.current) rowRef.current.scrollBy({ left: 800, behavior: 'smooth' });
  };

  return (
    <div className="mb-6 pl-4 md:pl-12 relative z-20 group/row animate-row-enter hover:z-30 transition-all duration-300">
      
      {/* Title */}
      <h3 className="text-[19px] font-bold text-white mb-2 flex items-center gap-2">
          {variant === 'ranked' ? <span className={theme.color}>Top 10</span> : <span className={theme.color}>{theme.name}</span>} 
          {title}
          <ChevronRight size={18} className="text-[#8197a4] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"/>
      </h3>

      {/* Container Wrapper for Buttons */}
      <div className="relative">
          
          {/* Left Arrow Button (Dynamic Show/Hide on Hover) */}
          <button 
            onClick={slideLeft}
            className="absolute left-0 top-[40%] -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-start pl-3 hover:w-16 cursor-pointer"
          >
             <ChevronLeft size={40} className="text-white hover:scale-125 transition-transform" />
          </button>

          {/* Scrollable Row */}
          <div ref={rowRef} className={`row-container ${variant === 'vertical' ? 'vertical' : ''} scrollbar-hide`}>
            {movies.map((movie, index) => ( 
               <MovieCard 
                   key={movie.id} 
                   movie={movie} 
                   variant={variant} 
                   itemType={itemType} 
                   rank={index + 1} 
                   isHovered={hoveredId === movie.id} 
                   onHover={handleHover} 
                   onLeave={handleLeave} 
                   isPrimeOnly={isPrimeOnly}
                   isFirst={index === 0}
                   isLast={index === movies.length - 1}
               /> 
            ))}
          </div>

          {/* Right Arrow Button */}
          <button 
            onClick={slideRight}
            className="absolute right-0 top-[40%] -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-end pr-3 hover:w-16 cursor-pointer"
          >
             <ChevronRight size={40} className="text-white hover:scale-125 transition-transform" />
          </button>

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

// --- MOVIE DETAIL COMPONENT ---
// Integrated Trailer Button & Modal
const MovieDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  
  // Data State
  const [movie, setMovie] = useState(null);
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [credits, setCredits] = useState(null);
  
  // Playback State
  const [trailerKey, setTrailerKey] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    // 1. Reset States to prevent "ghost" content during navigation
    setShowVideo(false);
    setTrailerKey(null);
    setIsMuted(true);
    setMovie(null);
    setRelatedMovies([]); // Clear previous related items immediately
    window.scrollTo(0, 0);

    // 2. Fetch Core Details
    fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`)
        .then(res => res.json())
        .then(data => setMovie(data))
        .catch(err => console.error(err));

    // 3. Fetch Credits (Cast/Crew)
    fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => setCredits(data));

    // 4. Fetch Related Content (Robust Logic)
    const fetchRelated = async () => {
        try {
            // First try "Recommendations" (Algorithm based)
            const recRes = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`);
            const recData = await recRes.json();
            
            if (recData.results && recData.results.length > 0) {
                setRelatedMovies(recData.results.slice(0, 10));
            } else {
                // Fallback to "Similar" (Genre/Keyword based) if no recommendations
                const simRes = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=en-US`);
                const simData = await simRes.json();
                if (simData.results) {
                    setRelatedMovies(simData.results.slice(0, 10));
                }
            }
        } catch (e) {
            console.error("Failed to fetch related content", e);
        }
    };
    fetchRelated();

    // 5. Fetch Trailer & Init Auto-Play
    fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => {
            const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results?.find(v => v.site === 'YouTube');
            if (trailer) {
                setTrailerKey(trailer.key);
                setTimeout(() => setShowVideo(true), 3000); // 3s Delay
            }
        });
  }, [type, id]);

  if (!movie) return <div className="min-h-screen w-full bg-[#0f171e]" />;

  // Derived Data
  const director = credits?.crew?.find(c => c.job === 'Director')?.name || "Unknown Director";
  const cast = credits?.cast?.slice(0, 5).map(c => c.name).join(", ") || "N/A";
  const studio = movie.production_companies?.[0]?.name || "Prime Studios";
  const year = movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0] || "2024";
  const runtime = movie.runtime ? `${Math.floor(movie.runtime/60)}h ${movie.runtime%60}min` : `${movie.number_of_seasons} Seasons`;
  const genres = movie.genres?.slice(0, 3).map(g => g.name).join(" • ");
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";

  return (
    <div className="min-h-screen bg-[#0f171e] text-white font-sans selection:bg-[#00A8E1] selection:text-white pb-20">
      
      {/* ============================================
          HERO SECTION (Top Half) 
      ============================================ */}
      <div className="relative w-full h-[85vh] overflow-hidden">
          
          {/* Background Media */}
          <div className="absolute inset-0 w-full h-full">
               <div className={`absolute inset-0 transition-opacity duration-1000 ${showVideo ? 'opacity-0' : 'opacity-100'}`}>
                   <img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover object-top md:object-right-top" alt="" />
               </div>
               {showVideo && trailerKey && (
                  <div className="absolute inset-0 animate-in fade-in duration-1000 pointer-events-none">
                     <iframe 
                        src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`}
                        className="w-full h-full scale-[1.5] origin-center" 
                        allow="autoplay; encrypted-media"
                        frameBorder="0"
                        title="Hero Background"
                     />
                  </div>
               )}
          </div>

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/90 to-transparent w-[90%] md:w-[65%] z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-transparent to-transparent z-10" />

          {/* Hero Content */}
          <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-3xl pt-20">
              <div className="mb-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                  <span className="text-[11px] font-black tracking-[0.2em] text-[#00A8E1] uppercase bg-[#00A8E1]/10 px-2 py-1 rounded">
                      INCLUDED WITH PRIME
                  </span>
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-4 leading-[0.95] tracking-tight drop-shadow-2xl opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  {movie.title || movie.name}
              </h1>

              <div className="flex items-center flex-wrap gap-3 text-sm font-medium text-gray-300 mb-8 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <span className="text-[#00A8E1] font-bold">IMDb {rating}</span>
                  <span>•</span>
                  <span>{runtime}</span>
                  <span>•</span>
                  <span>{year}</span>
                  <span>•</span>
                  <span className="border border-gray-500 px-1 rounded text-xs">X-Ray</span>
                  <span className="border border-gray-500 px-1 rounded text-xs">UHD</span>
                  <span className="border border-gray-500 px-1 rounded text-xs bg-gray-800">16+</span>
              </div>

              <div className="flex items-center gap-4 mb-8 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                  <button onClick={() => navigate(`/watch/${type}/${id}`)} className="h-14 px-8 rounded bg-white text-black font-bold text-lg hover:bg-gray-200 transition-transform transform hover:scale-105 flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                      <Play fill="black" size={24} /> 
                      Play {type === 'tv' ? 'S1 E1' : 'Movie'}
                  </button>

                  <div className="flex gap-3">
                      <button className="w-12 h-12 rounded-full bg-[#2a333d]/60 border-2 border-[#4a5561] hover:border-white hover:bg-[#2a333d] flex items-center justify-center transition text-gray-200 hover:text-white"><Plus size={22} /></button>
                      <button className="w-12 h-12 rounded-full bg-[#2a333d]/60 border-2 border-[#4a5561] hover:border-white hover:bg-[#2a333d] flex items-center justify-center transition text-gray-200 hover:text-white"><ThumbsUp size={20} /></button>
                      <button className="w-12 h-12 rounded-full bg-[#2a333d]/60 border-2 border-[#4a5561] hover:border-white hover:bg-[#2a333d] flex items-center justify-center transition text-gray-200 hover:text-white"><Share2 size={20} /></button>
                  </div>
              </div>

              <div className="text-gray-300 text-lg leading-relaxed line-clamp-3 max-w-2xl opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                  {movie.overview}
              </div>
          </div>

          {/* Volume Control */}
          {showVideo && trailerKey && (
              <div className="absolute top-[35%] right-8 z-50">
                  <button 
                    onClick={() => setIsMuted(!isMuted)} 
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 hover:border-white flex items-center justify-center text-white transition"
                  >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
              </div>
          )}
      </div>

      {/* ============================================
          RELATED CONTENT STRIP (Customers also watched)
      ============================================ */}
      <div className="relative z-30 -mt-24 px-6 md:px-16 mb-16">
          <h3 className="text-xl font-bold text-white mb-4 drop-shadow-md">Customers also watched</h3>
          
          {relatedMovies.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
                  {relatedMovies.map((m) => (
                      <div 
                        key={m.id} 
                        onClick={() => { 
                            // FIX: Determine correct type fallback.
                            // If API doesn't give media_type (common in 'similar' endpoint), assume same as current page.
                            const targetType = m.media_type || type;
                            navigate(`/detail/${targetType}/${m.id}`); 
                        }}
                        className="flex-shrink-0 w-[200px] aspect-video bg-gray-800 rounded-lg overflow-hidden relative group cursor-pointer border border-transparent hover:border-white/50 transition-all shadow-lg"
                      >
                          {m.backdrop_path || m.poster_path ? (
                              <img src={`${IMAGE_BASE_URL}${m.backdrop_path || m.poster_path}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#232d38] text-gray-500 font-bold text-xs p-2 text-center">{m.title || m.name}</div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <div className="bg-white rounded-full p-2"><Play fill="black" size={16} /></div>
                          </div>
                          <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black to-transparent">
                              <p className="text-xs font-bold truncate text-gray-200 group-hover:text-white">{m.title || m.name}</p>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="text-gray-500 italic text-sm py-4">
                  No related titles found for this content.
              </div>
          )}
      </div>

      {/* ============================================
          DETAIL INFO SECTION (Lower Half)
      ============================================ */}
      <div className="px-6 md:px-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* LEFT COLUMN: Content Details */}
          <div className="lg:col-span-2 space-y-8">
              <div className="bg-[#19222b] p-6 rounded-lg border border-white/5">
                  <h4 className="text-lg font-bold text-white mb-3">Synopsis</h4>
                  <p className={`text-gray-300 leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
                      {movie.overview || "No synopsis available."}
                  </p>
                  <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="mt-3 text-[#00A8E1] font-bold text-sm hover:underline">
                      {isDescriptionExpanded ? "Show Less" : "More..."}
                  </button>
              </div>

              <div className="bg-[#19222b] p-6 rounded-lg border border-white/5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <span className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Director</span>
                          <span className="text-[#00A8E1] hover:underline cursor-pointer">{director}</span>
                      </div>
                      <div>
                          <span className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Starring</span>
                          <div className="flex flex-wrap gap-2 text-[#00A8E1]">
                              {cast.split(", ").map((actor, i) => (
                                  <span key={i} className="hover:underline cursor-pointer">{actor}{i < 4 ? ',' : ''}</span>
                              ))}
                          </div>
                      </div>
                      <div>
                          <span className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Genres</span>
                          <span className="text-gray-300">{genres}</span>
                      </div>
                      <div>
                          <span className="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Studio</span>
                          <span className="text-gray-300">{studio}</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Advisory & Tech Info */}
          <div className="space-y-6">
              <div className="bg-[#19222b] p-6 rounded-lg border border-white/5">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Content Advisory</h4>
                  <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl font-bold border border-white/20 px-2 py-1 rounded bg-[#0f171e]">16+</span>
                      <span className="text-gray-400 text-sm">Teens</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>Violence</li>
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>Foul Language</li>
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>Substance Use</li>
                  </ul>
                  <div className="mt-4 pt-4 border-t border-white/10">
                      <a href="#" className="text-[#00A8E1] text-xs hover:underline">Rating Policy</a>
                  </div>
              </div>

              <div className="bg-[#19222b] p-6 rounded-lg border border-white/5">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Audio Languages</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                      English [Audio Description], English, Hindi, Tamil, Telugu, Spanish, French, German
                  </p>
                  <div className="mt-3 flex gap-2">
                      <span className="text-[10px] border border-gray-600 px-1.5 rounded text-gray-400">AAC</span>
                      <span className="text-[10px] border border-gray-600 px-1.5 rounded text-gray-400">Dolby Digital</span>
                  </div>
              </div>
          </div>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-20 px-6 md:px-16 pt-8 border-t border-white/10 text-center md:text-left">
          <p className="text-xs text-gray-500 mb-4">
              By clicking play, you agree to our <a href="#" className="text-[#00A8E1] hover:underline">Terms of Use</a>.
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white hover:underline">Terms and Privacy Notice</a>
              <a href="#" className="hover:text-white hover:underline">Send us feedback</a>
              <a href="#" className="hover:text-white hover:underline">Help</a>
              <span className="text-gray-600">© 1996-2024, PrimeShows.com, Inc. or its affiliates</span>
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
