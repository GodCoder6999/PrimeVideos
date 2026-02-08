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

const VIDFAST_ORIGINS = [
  'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io',
  'https://vidfast.me', 'https://vidfast.net', 'https://vidfast.pm', 'https://vidfast.xyz'
];

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
      "https://www.zxcstream.xyz",
      "https://slime403heq.com", // Added new source
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
      if (!document.querySelector(`link[rel="dns-prefetch"][href="${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = domain;
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

    /* --- HUGE GLOWING NUMBERS --- */
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
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 10px rgba(0, 168, 225, 0.2); border-color: rgba(0, 168, 225, 0.3); }
      50% { box-shadow: 0 0 20px rgba(0, 168, 225, 0.6); border-color: rgba(0, 168, 225, 0.8); }
    }
    .animate-glow { animation: pulse-glow 2s infinite; }

    /* Cinematic Border Glow */
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

    .text-gradient {
      background: linear-gradient(to bottom, #ffffff 0%, #e0e0e0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
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
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const searchKey = normalize(title);

  try {
    const baseDir = mediaType === 'tv' ? 'tvs' : 'movies';
    const baseUrl = `https://a.111477.xyz/${baseDir}/`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(baseUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Directory fetch failed");
    const html = await response.text();
    const linkRegex = /<a href="([^"]+)">([^<]+)<\/a>/g;
    let match, bestLink = null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = decodeURIComponent(match[2]);
      if (text === '../' || text === 'Name' || text === 'Size') continue;
      const normText = normalize(text);
      if (mediaType === 'tv') {
        if (normText === searchKey) { bestLink = href; break; }
        if (!bestLink && normText.includes(searchKey)) { bestLink = href; }
      } else {
        if (normText.includes(searchKey) && year && normText.includes(year)) { bestLink = href; break; }
        if (!bestLink && normText.includes(searchKey)) { bestLink = href; }
      }
    }

    let finalUrl = bestLink ? (bestLink.startsWith('http') ? bestLink : `${baseUrl}${bestLink}`) : null;
    if (!finalUrl) {
      if (mediaType === 'tv') finalUrl = `${baseUrl}${encodeURIComponent(title)}/`;
      else finalUrl = `${baseUrl}${encodeURIComponent(title)}%20(${year})/`;
    }
    if (!finalUrl.endsWith('/')) finalUrl += '/';

    return [{ source: '111477 Index', label: `Open ${mediaType === 'tv' ? 'Series' : 'Movie'} Index`, url: finalUrl, type: 'external' }];
  } catch (error) {
    const baseDir = mediaType === 'tv' ? 'tvs' : 'movies';
    let guessUrl = mediaType === 'tv' ? `https://a.111477.xyz/${baseDir}/${encodeURIComponent(title)}/` : `https://a.111477.xyz/${baseDir}/${encodeURIComponent(title)}%20(${year})/`;
    return [{ source: '111477 (Guess)', label: 'Open Index Folder', url: guessUrl, type: 'external' }];
  }
}

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
    const targetType = category.type || (type === 'all' ? 'movie' : type);
    if (isPrimeOnly) {
      let base = `/discover/${targetType}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&page=${pageNum}`;
      if (category.variant === 'ranked' || category.sort) base += `&sort_by=${category.sort || 'popularity.desc'}`;
      else if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
      else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
      else base += `&sort_by=popularity.desc`;
      return base;
    }
    else {
      let base = `/discover/${targetType}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
      if (category.endpoint) return `/${category.endpoint}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
      if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
      else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
      else base += `&sort_by=${category.sort || 'popularity.desc'}`;
      return base;
    }
  };

  useEffect(() => {
    const filteredDeck = type === 'all' ? [...CATEGORY_DECK] : CATEGORY_DECK.filter(item => item.type === type);
    const initialDeck = shuffleDeck(filteredDeck);
    setDeck(initialDeck);
    let heroUrl, topUrl, heroTitle;
    const getBaseHeroUrl = (t) => isPrimeOnly
      ? `/discover/${t}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc&page=1`
      : `/trending/${t}/day?api_key=${TMDB_API_KEY}`;
    const getBaseTopUrl = (t) => isPrimeOnly
      ? `/discover/${t}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc&page=1`
      : `/${t}/top_rated?api_key=${TMDB_API_KEY}`;

    if (type === 'tv') {
      heroTitle = "Trending TV Shows";
      heroUrl = getBaseHeroUrl('tv');
      topUrl = getBaseTopUrl('tv');
    } else if (type === 'movie') {
      heroTitle = "Trending Movies";
      heroUrl = getBaseHeroUrl('movie');
      topUrl = getBaseTopUrl('movie');
    } else {
      heroTitle = isPrimeOnly ? "Prime - Recommended" : "Trending Now";
      heroUrl = getBaseHeroUrl('movie');
      topUrl = getBaseTopUrl('movie');
    }

    const initialRows = [
      { id: 'trending_hero', title: heroTitle, fetchUrl: heroUrl, variant: 'standard', itemType: type === 'all' ? 'movie' : type },
      { id: 'top_10', title: isPrimeOnly ? "Top 10 on Prime" : "Top 10 Globally", fetchUrl: topUrl, variant: 'ranked', itemType: type === 'all' ? 'movie' : type },
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
  }, [loading, deck, deckIndex, isPrimeOnly, type]);
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

// --- NAVBAR COMPONENT (Glitch-Free, Spaced, Floating Effect) ---
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

  // --- SCROLL LISTENER (Optimized) ---
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setIsScrolled(scrolled);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isScrolled]);

  // --- CLICK OUTSIDE LISTENER ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- SEARCH LOGIC ---
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
          setSuggestions({ text: filtered.map(i => i.title || i.name).slice(0, 3), visual: filtered });
        } else {
          setSuggestions({ text: results.map(i => i.title || i.name).slice(0, 3), visual: results.slice(0, 4) });
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

  const getNavLinkClass = (path) => {
    const isActive = location.pathname === path;
    if (isActive) {
      return "text-white font-bold bg-white/20 backdrop-blur-md rounded-[20px] px-5 py-2 text-[15px] transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    }
    return "text-[#aaaaaa] font-bold text-[15px] hover:text-white px-4 py-2 transition-colors duration-300";
  };

  // --- DYNAMIC NAV CLASSES ---
  // Glitch Fix: Added 'will-change-transform' and consistent flex behavior
  const navContainerClass = isScrolled
    ? "fixed top-0 left-1/2 -translate-x-1/2 w-[1521px] max-w-[95%] h-[66px] z-[1000] rounded-b-[16px] backdrop-blur-xl bg-[#0f171e]/95 shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.1)] border-b border-white/5 transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
    : "fixed top-0 left-1/2 -translate-x-1/2 w-full h-[66px] z-[1000] bg-gradient-to-b from-black/90 to-transparent transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]";

  return (
    <nav className={navContainerClass} style={{ fontFamily: '"Amazon Ember", "Inter", sans-serif' }}>
      {/* Inner Content with INCREASED Padding (px-16 = 64px) */}
      <div className="w-full h-full flex items-center justify-between px-16">
        
        {/* LEFT SECTION */}
        <div className="flex items-center gap-8">
          <Link to={isPrimeOnly ? "/" : "/everything"} className="text-[#ffffff] font-bold text-[22px] tracking-tight no-underline leading-none hover:text-[#00A8E1] transition-colors">
            {theme.logoText}
          </Link>

          <div className="flex items-center gap-2">
            <Link to={isPrimeOnly ? "/" : "/everything"} className={getNavLinkClass(isPrimeOnly ? "/" : "/everything")}>Home</Link>
            <Link to={isPrimeOnly ? "/movies" : "/everything/movies"} className={getNavLinkClass(isPrimeOnly ? "/movies" : "/everything/movies")}>Movies</Link>
            <Link to={isPrimeOnly ? "/tv" : "/everything/tv"} className={getNavLinkClass(isPrimeOnly ? "/tv" : "/everything/tv")}>TV shows</Link>
            <Link to="/sports" className={getNavLinkClass("/sports")}>Live TV</Link>
            
            {/* Vertical Separator */}
            <div className="w-[1px] h-5 bg-gray-600 mx-3"></div>

            <Link to="/subscriptions" className="text-[#aaaaaa] font-bold text-[15px] hover:text-white px-2 flex items-center gap-2 transition-colors">
               <Grip size={18} className="rotate-45" /> Subscriptions
            </Link>
            <Link to="/store" className="text-[#aaaaaa] font-bold text-[15px] hover:text-white px-2 flex items-center gap-2 transition-colors">
               <Monitor size={18} /> Store
            </Link>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-6">
          
          {/* 1. Search Icon (Expandable) */}
          <div ref={searchRef} className="relative group">
            <div className={`flex items-center ${query ? 'bg-[#19222b] border border-white/20 w-[260px]' : 'w-auto'} transition-all duration-300 rounded-[4px]`}>
               {query ? (
                  <>
                    <Search size={20} className="text-[#c7cbd1] ml-2" />
                    <form onSubmit={handleSearch} className="flex-1">
                      <input 
                        className="bg-transparent border-none outline-none text-white text-[15px] font-medium px-2 w-full h-9 placeholder-[#5a6069]" 
                        placeholder="Search..." 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        autoFocus
                      />
                    </form>
                    <X size={18} className="text-[#c7cbd1] mr-2 cursor-pointer" onClick={handleClear} />
                  </>
               ) : (
                  <Search size={24} className="text-[#aaaaaa] hover:text-white cursor-pointer transition-colors" onClick={() => setQuery(" ")} />
               )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (suggestions.text.length > 0 || suggestions.visual.length > 0) && (
              <div className="absolute top-12 right-0 w-[300px] bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-[160]">
                 {suggestions.text.map((text, idx) => (<div key={idx} onClick={() => { setQuery(text); handleSearch({preventDefault:()=>{}}); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-[#333c46] cursor-pointer flex items-center gap-2"><Search size={14} /> {text}</div>))}
                 <div className="flex gap-2 p-2 overflow-x-auto scrollbar-hide bg-[#00050D]/50">
                    {suggestions.visual.map((item) => (
                      <div key={item.id} onClick={() => { setShowSuggestions(false); navigate(`/detail/${item.media_type}/${item.id}`); }} className="w-[80px] flex-shrink-0 cursor-pointer"><img src={`${IMAGE_BASE_URL}${item.poster_path}`} className="rounded-sm opacity-80 hover:opacity-100" alt="" /></div>
                    ))}
                 </div>
              </div>
            )}
          </div>

          {/* 2. Grid/Menu Icon */}
          <div className="relative" ref={dropdownRef}>
            <div className="cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
              <Grip size={24} className="text-[#aaaaaa] hover:text-white transition-colors" />
            </div>
            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-[#19222b] border border-gray-700 rounded-lg shadow-2xl p-2 z-[150] animate-in fade-in">
                 <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 pt-2">Switch Mode</div>
                 <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${isPrimeOnly ? 'bg-[#00A8E1] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Prime Video</div><div className="text-[10px] opacity-80">Included with Prime only</div></div></Link>
                 <Link to="/everything" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${!isPrimeOnly ? 'bg-[#E50914] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={!isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Literally Everything!</div><div className="text-[10px] opacity-80">All streaming services</div></div></Link>
              </div>
            )}
          </div>

          {/* 3. Watchlist (Bookmark) */}
          <Link to="/watchlist">
            <Bookmark size={24} className="text-[#aaaaaa] hover:text-white transition-colors" />
          </Link>

          {/* 4. User Profile */}
          <div className="w-9 h-9 rounded-full bg-[#232f3e] flex items-center justify-center cursor-pointer border border-transparent hover:border-white/50 transition-all overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-tr from-[#1A92B6] to-[#6DD5FA] opacity-80"></div>
             <div className="relative z-10 w-3 h-3 bg-white rounded-full mb-1"></div>
             <div className="absolute bottom-0 w-6 h-3 bg-white rounded-t-full z-10"></div>
          </div>

          {/* 5. Join Prime Button */}
          <button className="bg-[#007185] hover:bg-[#006476] text-white text-[15px] font-bold px-4 py-2 rounded-[4px] transition-colors shadow-sm">
            Join Prime
          </button>

        </div>
      </div>
    </nav>
  );
};

// --- WATCHLIST PAGE COMPONENT ---
const WatchlistPage = ({ isPrimeOnly }) => {
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWatchlist = async () => {
      setLoading(true);
      const savedList = JSON.parse(localStorage.getItem('watchlist')) || [];
      
      if (savedList.length === 0) {
        setWatchlistItems([]);
        setLoading(false);
        return;
      }

      const promises = savedList.map(async (key) => {
        // Key format: "type-id" (e.g., "movie-12345")
        const [type, id] = key.split('-');
        if (!type || !id) return null;
        try {
          const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`);
          const data = await res.json();
          // Inject the type back into the object for the card component to use
          return { ...data, media_type: type };
        } catch (e) {
          console.error("Failed to load watchlist item", e);
          return null;
        }
      });

      const results = await Promise.all(promises);
      setWatchlistItems(results.filter(item => item !== null));
      setLoading(false);
    };

    fetchWatchlist();
  }, []);

  return (
    <div className="pt-28 px-6 md:px-12 min-h-screen pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Bookmark className="text-[#00A8E1]" size={32} />
        <h2 className="text-3xl font-bold text-white">Your Watchlist</h2>
      </div>

      {loading ? (
        <div className="h-60 flex items-center justify-center">
          <Loader className="animate-spin text-[#00A8E1]" size={40} />
        </div>
      ) : watchlistItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {watchlistItems.map((item) => (
            <div 
                key={item.id} 
                onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)}
                className="relative group cursor-pointer transition-transform duration-300 hover:scale-105"
            >
                <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 group-hover:border-white/50 relative shadow-lg">
                   {item.poster_path ? (
                       <img src={`${IMAGE_BASE_URL}${item.poster_path}`} alt={item.title || item.name} className="w-full h-full object-cover" />
                   ) : (
                       <div className="w-full h-full bg-[#19222b] flex items-center justify-center text-gray-500">No Image</div>
                   )}
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Play fill="white" size={30} className="text-white drop-shadow-lg" />
                   </div>
                </div>
                <div className="mt-3">
                    <h4 className="text-white font-bold text-sm truncate">{item.title || item.name}</h4>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <span className="uppercase border border-white/20 px-1 rounded text-[10px]">{item.media_type}</span>
                        <span>{item.vote_average?.toFixed(1)} ★</span>
                    </div>
                </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <Bookmark size={64} className="text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-gray-300 mb-2">Your watchlist is empty</h3>
          <p className="text-gray-500 mb-6 max-w-md">Content you add to your watchlist will appear here.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-[#00A8E1] text-white font-bold rounded-md hover:bg-[#008ebf] transition">
            Browse Movies
          </button>
        </div>
      )}
    </div>
  );
};

// --- PLAYER COMPONENT (WITH BOLLYWOOD/INDIAN SERVER SUPPORT) ---
const Player = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- STATE ---
  const [activeServer, setActiveServer] = useState('vidfast'); 
  const [isIndian, setIsIndian] = useState(false); // Track if content is Indian
  const [imdbId, setImdbId] = useState(null); // Required for Slime player
  
  // Episode & Season State
  const queryParams = new URLSearchParams(location.search);
  const [season, setSeason] = useState(Number(queryParams.get('season')) || 1);
  const [episode, setEpisode] = useState(Number(queryParams.get('episode')) || 1);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [seasonData, setSeasonData] = useState(null);
  const [totalSeasons, setTotalSeasons] = useState(1);

  // --- 1. FETCH METADATA & LANGUAGE DETECTION ---
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        // Append external_ids to get IMDB ID in one go
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const data = await res.json();
        
        // 1. Get IMDB ID
        // For movies, it's often at root level or inside external_ids
        const foundImdbId = data.imdb_id || data.external_ids?.imdb_id;
        setImdbId(foundImdbId);

        // 2. Check for Indian Languages (Hindi, Bengali, Tamil, Telugu, etc)
        const indianLanguages = ['hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'pa', 'gu'];
        const isIndianContent = indianLanguages.includes(data.original_language);
        setIsIndian(isIndianContent);

        // 3. Auto-Switch Server Logic
        if (isIndianContent) {
          setActiveServer('slime'); // Switch to new Bollywood server
        } else {
          setActiveServer('vidfast'); // Default for others
        }

        // 4. Set Total Seasons (TV Only)
        if (type === 'tv' && data.number_of_seasons) {
          setTotalSeasons(data.number_of_seasons);
        }
      } catch (e) {
        console.error("Error fetching details:", e);
      }
    };
    fetchDetails();
  }, [type, id]);

  // --- 2. FETCH SEASONS (TV ONLY) ---
  useEffect(() => {
    if (type === 'tv') {
      fetch(`${BASE_URL}/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => setSeasonData(data));
    }
  }, [type, id, season]);

  // --- 3. SOURCE GENERATOR ---
  const getSourceUrl = () => {
    // A. Slime (Bollywood/Indian) - Uses IMDb ID
    if (activeServer === 'slime') {
      const targetId = imdbId || id; // Fallback to TMDB ID if IMDb missing
      if (type === 'tv') {
         // Assuming standard query param format for TV on this player
         return `https://slime403heq.com/play/${targetId}?season=${season}&episode=${episode}`;
      } else {
         return `https://slime403heq.com/play/${targetId}`;
      }
    }
    
    // B. VidRock (Bengali Fallback / Older Logic)
    if (activeServer === 'vidrock') {
      const identifier = imdbId || id;
      if (type === 'tv') {
        return `https://vidrock.net/tv/${identifier}/${season}/${episode}`;
      } else {
        return `https://vidrock.net/movie/${identifier}`;
      }
    }

    // C. VidFast (Standard Global)
    if (activeServer === 'vidfast') {
      const themeParam = "theme=00A8E1";
      if (type === 'tv') {
        return `${VIDFAST_BASE}/tv/${id}/${season}/${episode}?autoPlay=true&${themeParam}&nextButton=true&autoNext=true`;
      } else {
        return `${VIDFAST_BASE}/movie/${id}?autoPlay=true&${themeParam}`;
      }
    }

    // D. Multi-Audio (Zxcstream)
    else {
      if (type === 'tv') {
        return `https://www.zxcstream.xyz/player/tv/${id}/${season}/${episode}?autoplay=false&back=true&server=0`;
      } else {
        return `https://www.zxcstream.xyz/player/movie/${id}?autoplay=false&back=true&server=0`;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-hidden flex flex-col" style={{ transform: 'translateZ(0)' }}>
      {/* TOP CONTROLS LAYER */}
      <div className="absolute top-0 left-0 w-full h-20 pointer-events-none z-[120] flex items-center justify-between px-6">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto bg-black/50 hover:bg-[#00A8E1] text-white p-3 rounded-full backdrop-blur-md border border-white/10 transition-all shadow-lg group"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        {/* SERVER SWITCHER */}
        <div className="pointer-events-auto flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-2xl transform translate-y-2">
          <div className="flex bg-[#19222b] rounded-lg p-1 gap-1">
            
            {/* NEW BOLLYWOOD SERVER BUTTON */}
            <button
              onClick={() => setActiveServer('slime')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeServer === 'slime' ? 'bg-[#E50914] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              {isIndian && <CheckCircle2 size={12} />} Bollywood / Indian
            </button>

            <button
              onClick={() => setActiveServer('vidfast')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeServer === 'vidfast' ? 'bg-[#00A8E1] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              VidFast
            </button>
            
            <button
              onClick={() => setActiveServer('zxcstream')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeServer === 'zxcstream' ? 'bg-[#00A8E1] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Multi-Audio
            </button>
          </div>
          {activeServer === 'zxcstream' && (
            <div className="text-[10px] text-[#00A8E1] font-bold animate-pulse">Select Audio Language in Player Settings</div>
          )}
        </div>

        {/* EPISODE LIST TOGGLE (For TV) */}
        {type === 'tv' ? (
          <button
            onClick={() => setShowEpisodes(!showEpisodes)}
            className={`pointer-events-auto p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${showEpisodes ? 'bg-[#00A8E1] text-white' : 'bg-black/50 hover:bg-[#333c46] text-gray-200'}`}
          >
            <List size={24} />
          </button>
        ) : (
          <div className="w-12"></div>
        )}
      </div>

      {/* PLAYER FRAME */}
      <div className="flex-1 relative w-full h-full bg-black">
        <iframe
          key={activeServer + season + episode}
          src={getSourceUrl()}
          className="w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          loading="eager"
          fetchPriority="high"
          referrerPolicy="origin"
          allowFullScreen
          title="Player"
        ></iframe>
      </div>

      {/* EPISODE SIDEBAR (TV Only) */}
      {type === 'tv' && (
        <div className={`fixed right-0 top-0 h-full bg-[#00050D]/95 backdrop-blur-xl border-l border-white/10 transition-all duration-500 ease-in-out z-[110] flex flex-col ${showEpisodes ? 'w-[350px] translate-x-0 shadow-2xl' : 'w-[350px] translate-x-full shadow-none'}`}>
          <div className="pt-24 px-6 pb-4 border-b border-white/10 flex items-center justify-between bg-[#1a242f]/50">
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
                </div>
              </div>
            ))) : (<div className="text-center text-gray-500 mt-10 flex flex-col items-center"><Loader className="animate-spin mb-2" /><span>Loading Season {season}...</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
};

// --- SPORTS / LIVE TV COMPONENTS ---
const SportsPage = () => {
  const [channels, setChannels] = useState([]);
  const [displayedChannels, setDisplayedChannels] = useState([]);
  const SPECIAL_STREAM = {
    name: "ICC T20 WC Live (Bengali)",
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-sN5te7jsC9YTazKRH6RgQCxTAqs60oWZMw&s",
    group: "Cricket",
    parentGroup: "Sports",
    url: "https://corsproxy.io/?" + encodeURIComponent("https://live15p.hotstar.com/hls/live/2116748/inallow-icct20wc-2026/ben/1540062322/15mindvrm0118ba48ab59034e4b9dbc9285e29e083507february2026/master_apmf_360_1.m3u8")
  };

  const CATEGORIES_TREE = {
    'All': [],
    'General Entertainment': ['Entertainment', 'GEC (General Entertainment Channels)', 'Lifestyle', 'Music', 'Comedy'],
    'News': ['News', 'News (International)', 'News (National)', 'News (Regional)', 'Business News', 'Political News'],
    'Sports': ['Sports', 'Live Sports', 'Cricket', 'Football (Soccer)', 'Basketball', 'Tennis', 'Motorsports', 'Wrestling (WWE / AEW / UFC)', 'Sports Events (PPV)']
  };

  const [activeMainCategory, setActiveMainCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 60;
  const navigate = useNavigate();

  const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
  const normalizeCategory = (groupName) => {
    if (!groupName) return 'Entertainment';
    const lower = groupName.toLowerCase();
    if (lower.includes('cricket')) return 'Cricket';
    if (lower.includes('football') || lower.includes('soccer') || lower.includes('premier league') || lower.includes('laliga') || lower.includes('bundesliga')) return 'Football (Soccer)';
    if (lower.includes('basket') || lower.includes('nba')) return 'Basketball';
    if (lower.includes('tennis') || lower.includes('wimbledon') || lower.includes('atp')) return 'Tennis';
    if (lower.includes('motor') || lower.includes('racing') || lower.includes('f1') || lower.includes('formula') || lower.includes('nascar')) return 'Motorsports';
    if (lower.includes('wwe') || lower.includes('ufc') || lower.includes('wrestling') || lower.includes('boxing') || lower.includes('fight') || lower.includes('aew') || lower.includes('mma')) return 'Wrestling (WWE / AEW / UFC)';
    if (lower.includes('ppv') || lower.includes('event')) return 'Sports Events (PPV)';
    if (lower.includes('sport')) return 'Live Sports';

    if (lower.includes('business') || lower.includes('finance') || lower.includes('market') || lower.includes('bloomberg') || lower.includes('cnbc')) return 'Business News';
    if (lower.includes('politics') || lower.includes('parliament') || lower.includes('c-span')) return 'Political News';
    if (lower.includes('international') || lower.includes('world') || lower.includes('global') || lower.includes('cnn') || lower.includes('bbc') || lower.includes('al jazeera')) return 'News (International)';
    if (lower.includes('national')) return 'News (National)';
    if (lower.includes('regional') || lower.includes('local')) return 'News (Regional)';
    if (lower.includes('news')) return 'News';

    if (lower.includes('music') || lower.includes('hits') || lower.includes('mtv') || lower.includes('vh1')) return 'Music';
    if (lower.includes('comedy') || lower.includes('funny') || lower.includes('standup')) return 'Comedy';
    if (lower.includes('lifestyle') || lower.includes('fashion') || lower.includes('travel') || lower.includes('food') || lower.includes('cooking') || lower.includes('tlc')) return 'Lifestyle';
    if (lower.includes('gec') || lower.includes('sony') || lower.includes('star') || lower.includes('colors') || lower.includes('zee') || lower.includes('hbo') || lower.includes('amc')) return 'GEC (General Entertainment Channels)';
    return 'Entertainment';
  };

  const getParentCategory = (subCat) => {
    for (const [main, subs] of Object.entries(CATEGORIES_TREE)) {
      if (subs.includes(subCat)) return main;
    }
    return 'General Entertainment';
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(PLAYLIST_URL)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load playlist");
        return res.text();
      })
      .then(data => {
        const lines = data.split('\n');
        const parsed = [];
        let current = {};

        parsed.push(SPECIAL_STREAM);

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const name = line.split(',').pop().trim();
            const rawGroup = groupMatch ? groupMatch[1].trim() : 'Uncategorized';
            const normalizedGroup = normalizeCategory(rawGroup);

            current = {
              name,
              logo: logoMatch ? logoMatch[1] : null,
              group: normalizedGroup,
              parentGroup: getParentCategory(normalizedGroup)
            };
          } else if (line.startsWith('http') && current.name) {
            current.url = line;
            parsed.push(current);
            current = {};
          }
        }

        if (parsed.length === 0) {
          throw new Error("No channels found in playlist.");
        }
        setChannels(parsed);
        setLoading(false);
      })
      .catch(e => {
        console.error("Playlist Error:", e);
        setChannels([SPECIAL_STREAM]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let filtered = channels;

    if (activeMainCategory !== 'All') {
      filtered = filtered.filter(c => c.parentGroup === activeMainCategory);
    }

    if (activeSubCategory !== 'All') {
      filtered = filtered.filter(c => c.group === activeSubCategory);
    }

    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(lowerQ));
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedChannels(filtered.slice(startIndex, endIndex));
  }, [activeMainCategory, activeSubCategory, searchQuery, channels, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeMainCategory, activeSubCategory, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setCurrentPage(p => p + 1);
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalPages = Math.ceil(
    (activeMainCategory === 'All' && activeSubCategory === 'All' && !searchQuery
      ? channels.length
      : channels.filter(c => {
        const matchMain = activeMainCategory === 'All' || c.parentGroup === activeMainCategory;
        const matchSub = activeSubCategory === 'All' || c.group === activeSubCategory;
        const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchMain && matchSub && matchSearch;
      }).length
    ) / itemsPerPage
  );

  return (
    <div className="pt-24 px-4 md:px-12 min-h-screen pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2 glow-text">
            <Monitor className="text-[#00A8E1]" /> Live TV
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? "Scanning frequencies..." : `${channels.length} Channels Available`}
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Find channel..."
              className="w-full bg-[#19222b] border border-white/10 rounded-lg px-4 py-3 pl-10 text-white focus:border-[#00A8E1] outline-none font-medium transition-all duration-300 focus:shadow-[0_0_15px_rgba(0,168,225,0.4)]"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
            {searchQuery && <X onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-gray-400 cursor-pointer hover:text-white" size={18} />}
          </div>
        </div>
      </div>

      {!loading && !error && (
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2">
            {['All', ...Object.keys(CATEGORIES_TREE).filter(k => k !== 'All')].map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveMainCategory(cat); setActiveSubCategory('All'); }}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-300 border relative overflow-hidden group ${activeMainCategory === cat
                    ? 'bg-[#00A8E1] text-white border-transparent shadow-[0_0_20px_rgba(0,168,225,0.6)] scale-105'
                    : 'bg-[#19222b] text-gray-400 border-transparent hover:text-white hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105'
                  }`}
              >
                <span className="relative z-10">{cat}</span>
                {activeMainCategory === cat && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
              </button>
            ))}
          </div>

          {activeMainCategory !== 'All' && CATEGORIES_TREE[activeMainCategory] && (
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => setActiveSubCategory('All')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border hover:scale-105 ${activeSubCategory === 'All'
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-white hover:text-white'
                  }`}
              >
                All {activeMainCategory}
              </button>
              {CATEGORIES_TREE[activeMainCategory].map(sub => (
                <button
                  key={sub}
                  onClick={() => setActiveSubCategory(sub)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border hover:scale-105 ${activeSubCategory === sub
                      ? 'bg-[#00A8E1] text-white border-[#00A8E1] shadow-[0_0_15px_rgba(0,168,225,0.5)]'
                      : 'bg-[#19222b] text-gray-400 border-gray-800 hover:border-[#00A8E1] hover:text-[#00A8E1]'
                    }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-80 flex flex-col items-center justify-center text-[#00A8E1] gap-4">
          <Loader className="animate-spin" size={48} />
          <div className="text-gray-400 text-sm font-medium animate-pulse">Fetching global channels feed...</div>
        </div>
      ) : error ? (
        <div className="h-60 flex flex-col items-center justify-center text-red-500 gap-2 border border-dashed border-white/10 rounded-xl">
          <Ban size={48} />
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="text-white underline mt-2">Retry Connection</button>
        </div>
      ) : displayedChannels.length === 0 ? (
        <div className="h-60 flex flex-col items-center justify-center text-gray-500 gap-3 border border-dashed border-white/10 rounded-xl">
          <Monitor size={48} className="opacity-20" />
          <p>No channels found for this search.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-500">
            {displayedChannels.map((channel, idx) => (
              <div
                key={idx}
                onClick={() => navigate('/watch/sport/iptv', { state: { streamUrl: channel.url, title: channel.name, logo: channel.logo, group: channel.group } })}
                className="bg-[#19222b] hover:bg-[#232d38] rounded-xl overflow-hidden cursor-pointer group hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_rgba(0,168,225,0.3)] relative glow-card border border-white/5"
              >
                <div className="aspect-video bg-black/40 flex items-center justify-center p-4 relative group-hover:bg-black/20 transition-colors">
                  {channel.logo ? (
                    <img src={channel.logo} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" alt={channel.name} onError={e => e.target.style.display = 'none'} />
                  ) : (
                    <Signal className="text-gray-700 group-hover:text-[#00A8E1] transition-colors" size={32} />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-sm">
                    <div className="bg-[#00A8E1] p-3 rounded-full shadow-[0_0_20px_#00A8E1] transform scale-50 group-hover:scale-100 transition-transform duration-300">
                      <Play fill="white" className="text-white" size={20} />
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-[#19222b] group-hover:bg-[#1f2933] transition-colors border-t border-white/5">
                  <h3 className="text-gray-200 text-xs font-bold truncate group-hover:text-[#00A8E1] transition-colors">{channel.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></span>
                    <p className="text-gray-500 text-[10px] font-bold truncate uppercase group-hover:text-white transition-colors">{channel.group}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center items-center gap-4 mt-12 mb-8">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all duration-300"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2 overflow-x-auto max-w-[300px] scrollbar-hide px-2 items-center">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage - 2 + i;
                if (pageNum <= 0) pageNum = i + 1;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-full font-bold text-sm transition-all duration-300 ${currentPage === pageNum
                        ? 'bg-[#00A8E1] text-white scale-110 shadow-[0_0_15px_#00A8E1]'
                        : 'bg-[#19222b] text-gray-400 hover:text-white hover:bg-[#333c46] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p + 1)}
              className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all duration-300"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="text-center text-gray-500 text-xs pb-8 animate-pulse">
            Page {currentPage} of {totalPages} • Use Arrow Keys &larr; &rarr; to navigate
          </div>
        </>
      )}
    </div>
  );
};

// --- MAIN WRAPPERS ---
const Home = ({ isPrimeOnly }) => {
  const { rows, loadMore } = useInfiniteRows('all', isPrimeOnly);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // READ FROM 'vidFastProgress'
    const rawProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
    // Convert Dictionary to Array & STRICT SORT by 'last_updated'
    const historyArray = Object.values(rawProgress)
      .filter(item => item && item.last_updated) // Filter out broken entries
      .sort((a, b) => b.last_updated - a.last_updated) // Latest first
      .map(item => ({
        ...item,
        id: item.id,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        media_type: item.type,
        vote_average: item.vote_average
      }));
    // OPTIONAL: Fetch missing details if they weren't saved by the player
    const enrichHistory = async () => {
      const enriched = await Promise.all(historyArray.map(async (h) => {
        // If we don't have an image, fetch it from TMDB
        if(!h.poster_path) {
          try {
            const res = await fetch(`${BASE_URL}/${h.type}/${h.id}?api_key=${TMDB_API_KEY}`);
            const data = await res.json();
            return { ...h, ...data, media_type: h.type };
          } catch(e) { return h; }
        }
        return h;
      }));
      setHistory(enriched);
    };
    if(historyArray.length > 0) {
      enrichHistory();
    } else {
      setHistory([]);
    }

  }, []);
  return (
    <>
      <Hero isPrimeOnly={isPrimeOnly} />
      <div className="-mt-10 relative z-20 pb-20">
        {history.length > 0 && (
          <Row key="continue_watching" title="Continue Watching" data={history} variant="standard" itemType="history" isPrimeOnly={isPrimeOnly} />
        )}
        {rows.map(row => ( <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} /> ))}
        <InfiniteScrollTrigger onIntersect={loadMore} />
      </div>
    </>
  );
};

const MoviesPage = ({ isPrimeOnly }) => {
  const { rows, loadMore } = useInfiniteRows('movie', isPrimeOnly);
  return (
    <>
      <Hero isPrimeOnly={isPrimeOnly} />
      <div className="-mt-10 relative z-20 pb-20">
        {rows.map(row => (
          <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />
        ))}
        <InfiniteScrollTrigger onIntersect={loadMore} />
      </div>
    </>
  );
};
const TVPage = ({ isPrimeOnly }) => {
  const { rows, loadMore } = useInfiniteRows('tv', isPrimeOnly);
  return (
    <>
      <Hero isPrimeOnly={isPrimeOnly} />
      <div className="-mt-10 relative z-20 pb-20">
        {rows.map(row => (
          <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />
        ))}
        <InfiniteScrollTrigger onIntersect={loadMore} />
      </div>
    </>
  );
};
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
