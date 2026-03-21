import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Clock, Ban, Eye, Bookmark, TrendingUp, Monitor } from 'lucide-react';
import ShakaPlayerUI from './ShakaPlayerUI';
import PrimePlayer from './PrimePlayer';

// --- GLOBAL HLS REFERENCE ---
const Hls = window.Hls;

// --- CONFIGURATION ---
const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
const BASE_URL = `/api/proxy?url=${encodeURIComponent("https://api.themoviedb.org/3")}`;
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
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(baseUrl)}`;
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
// Separate decks for Prime and Everything modes to avoid repetition
const PRIME_CATEGORY_DECK = [
  { type: 'movie', label: "Action-Packed Thrillers", genre: 28, variant: 'standard' },
  { type: 'tv', label: "Binge-Worthy TV Dramas", genre: 18, variant: 'standard' },
  { type: 'movie', label: "Laugh Out Loud", genre: 35, variant: 'vertical' },
  { type: 'movie', label: "Sci-Fi Masterpieces", genre: 878, variant: 'standard' },
  { type: 'movie', label: "Horror Nights", genre: 27, variant: 'vertical' },
  { type: 'tv', label: "Animated Adventures", genre: 16, variant: 'standard' },
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
  { type: 'tv', label: "Reality & Talk Shows", genre: 10764, variant: 'standard' },
  { type: 'movie', label: "Award-Winning Films", sort: 'vote_average.desc', variant: 'standard' },
];

const EVERYTHING_CATEGORY_DECK = [
  { type: 'movie', label: "Trending Movies", endpoint: 'trending/movie/day', variant: 'standard' },
  { type: 'tv', label: "Trending TV Shows", endpoint: 'trending/tv/day', variant: 'standard' },
  { type: 'movie', label: "Action Blockbusters", genre: 28, variant: 'standard' },
  { type: 'tv', label: "Drama Series", genre: 18, variant: 'standard' },
  { type: 'movie', label: "Comedy Gold", genre: 35, variant: 'vertical' },
  { type: 'movie', label: "Sci-Fi Universe", genre: 878, variant: 'standard' },
  { type: 'movie', label: "Spine-Chilling Horror", genre: 27, variant: 'vertical' },
  { type: 'tv', label: "Animated Worlds", genre: 16, variant: 'standard' },
  { type: 'movie', label: "Golden Classics", year: 1995, variant: 'vertical' },
  { type: 'movie', label: "Critically Acclaimed", sort: 'vote_average.desc', variant: 'standard' },
  { type: 'movie', label: "Fantasy & Adventure", genre: 14, variant: 'standard' },
  { type: 'movie', label: "Crime Thrillers", genre: 80, variant: 'standard' },
  { type: 'movie', label: "Romantic Films", genre: 10749, variant: 'vertical' },
  { type: 'tv', label: "Mystery & Thriller Shows", genre: 9648, variant: 'standard' },
  { type: 'movie', label: "War Epics", genre: 10752, variant: 'standard' },
  { type: 'movie', label: "Western Adventures", genre: 37, variant: 'vertical' },
  { type: 'movie', label: "Documentaries", genre: 99, variant: 'standard' },
  { type: 'movie', label: "Family Favorites", genre: 10751, variant: 'standard' },
  { type: 'movie', label: "Korean Cinema", region: 'KR', variant: 'standard' },
  { type: 'movie', label: "Superhero Films", genre: 28, sort: 'revenue.desc', variant: 'standard' },
  { type: 'tv', label: "Talk & Variety Shows", genre: 10767, variant: 'standard' },
  { type: 'movie', label: "Animated Features", genre: 16, variant: 'vertical' },
  { type: 'tv', label: "Crime TV Shows", genre: 80, variant: 'standard' },
  { type: 'movie', label: "History & Biopics", genre: 36, variant: 'standard' },
  { type: 'movie', label: "Music Films", genre: 10402, variant: 'vertical' },
];

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
  // nextIdx tracks position in the shuffled deck — never resets mid-session
  const nextIdxRef = useRef(0);
  const deckRef = useRef([]);
  const modeKeyRef = useRef(''); // detect mode/type changes to reset

  const modeKey = `${type}-${isPrimeOnly}`;

  // Build the TMDB fetch URL for a category (always includes Prime filter when isPrimeOnly)
  const buildUrl = (category, targetType, pageNum = 1) => {
    if (category.endpoint) {
      // Direct endpoint (e.g. trending) — no provider filter needed, it's not Prime mode
      return `/${category.endpoint}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
    }
    if (isPrimeOnly) {
      // STRICT: every discover call must include watch provider filter
      let base = `/discover/${targetType}?api_key=${TMDB_API_KEY}`
        + `&with_watch_providers=9%7C119`  // 9=Prime, 119=Prime India
        + `&watch_region=IN`
        + `&page=${pageNum}`;
      if (category.sort) base += `&sort_by=${category.sort}`;
      else if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
      else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
      else base += `&sort_by=popularity.desc`;
      return base;
    } else {
      let base = `/discover/${targetType}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
      if (category.year) base += `&primary_release_year=${category.year}&sort_by=popularity.desc`;
      else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
      else base += `&sort_by=${category.sort || 'popularity.desc'}`;
      return base;
    }
  };

  // Reset and rebuild deck whenever mode/type changes
  if (modeKeyRef.current !== modeKey) {
    modeKeyRef.current = modeKey;
    nextIdxRef.current = 0;

    const fullDeck = isPrimeOnly ? [...PRIME_CATEGORY_DECK] : [...EVERYTHING_CATEGORY_DECK];
    const filteredDeck = type === 'all' ? fullDeck : fullDeck.filter(item => item.type === type);
    // Fisher-Yates shuffle for true randomness
    for (let i = filteredDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredDeck[i], filteredDeck[j]] = [filteredDeck[j], filteredDeck[i]];
    }
    deckRef.current = filteredDeck;
  }

  // Initialize rows on mount / mode change
  useEffect(() => {
    nextIdxRef.current = 0;
    const heroType = type === 'all' ? 'movie' : type;

    const heroUrl = isPrimeOnly
      ? `/discover/${heroType}?api_key=${TMDB_API_KEY}&with_watch_providers=9%7C119&watch_region=IN&sort_by=popularity.desc&page=1`
      : `/trending/${heroType}/day?api_key=${TMDB_API_KEY}`;

    const topUrl = isPrimeOnly
      ? `/discover/${heroType}?api_key=${TMDB_API_KEY}&with_watch_providers=9%7C119&watch_region=IN&sort_by=popularity.desc&page=2`
      : `/${heroType}/top_rated?api_key=${TMDB_API_KEY}`;

    const heroTitle = type === 'tv' ? "New on Prime TV" : type === 'movie' ? "New on Prime Movies" : "New on Prime";
    const top10Title = isPrimeOnly ? "Top 10 on Prime India" : "Top 10 Globally";

    setRows([
      { id: 'trending_hero', title: heroTitle, fetchUrl: heroUrl, variant: 'standard', itemType: heroType },
      { id: 'top_10', title: top10Title, fetchUrl: topUrl, variant: 'ranked', itemType: heroType },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, isPrimeOnly]);

  const loadMore = useCallback(() => {
    if (loading) return;
    const deck = deckRef.current;
    const idx = nextIdxRef.current;
    if (idx >= deck.length) return; // exhausted all unique categories

    setLoading(true);
    const batch = deck.slice(idx, idx + 3);
    nextIdxRef.current = idx + 3;

    const newRows = batch.map((category, i) => {
      const targetType = category.type || (type === 'all' ? 'movie' : type);
      return {
        id: `row-${modeKey}-${idx + i}`,   // stable unique id — no Date.now() drift
        title: category.label,
        fetchUrl: buildUrl(category, targetType, 1),
        variant: category.variant,
        itemType: targetType,
      };
    });

    setRows(prev => [...prev, ...newRows]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, type, isPrimeOnly]);

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

// --- NAVBAR COMPONENT ---
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
    const handleScroll = () => {
      if (window.scrollY > 10) setIsScrolled(true);
      else setIsScrolled(false);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
      return "text-white font-bold bg-white/10 backdrop-blur-md border border-white/10 rounded-lg px-5 py-2 text-[15px] transition-all duration-300 ease-in-out shadow-[0_0_15px_rgba(0,168,225,0.4)]";
    }
    return "text-[#c7cbd1] font-medium text-[15px] hover:text-white hover:bg-white/5 hover:backdrop-blur-sm rounded-lg px-4 py-2 transition-all duration-300 ease-in-out cursor-pointer hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]";
  };

  const navClasses = isScrolled
    ? "fixed top-0 left-0 w-full z-[1000] flex items-center px-[24px] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-xl bg-[#0f171e]/90 rounded-b-[24px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.1)] border-b border-white/5"
    : "fixed top-0 left-0 w-full z-[1000] flex items-center px-[24px] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-transparent bg-gradient-to-b from-black/80 to-transparent rounded-none border-transparent";

  return (
    <nav
      className={navClasses}
      style={{ height: '64px', fontFamily: '"Amazon Ember", "Inter", "Segoe UI", sans-serif', gap: '28px' }}
    >
      <Link to={isPrimeOnly ? "/" : "/everything"} className="text-[#ffffff] font-bold text-[21px] tracking-[-0.2px] no-underline leading-none drop-shadow-md">
        {theme.logoText}
      </Link>
      <div className="flex items-center gap-[6px]">
        <Link to={isPrimeOnly ? "/" : "/everything"} className={getNavLinkClass(isPrimeOnly ? "/" : "/everything")}>Home</Link>
        <Link to={isPrimeOnly ? "/movies" : "/everything/movies"} className={getNavLinkClass(isPrimeOnly ? "/movies" : "/everything/movies")}>Movies</Link>
        <Link to={isPrimeOnly ? "/tv" : "/everything/tv"} className={getNavLinkClass(isPrimeOnly ? "/tv" : "/everything/tv")}>TV Shows</Link>
        <Link to="/sports" className={`${getNavLinkClass("/sports")} flex items-center gap-2`}>
          <Trophy size={16} className={location.pathname === "/sports" ? "text-[#00A8E1]" : "opacity-80"} />Live TV
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <div ref={searchRef} className="relative">
          <form onSubmit={handleSearch} className={`px-3 py-1.5 rounded-md flex items-center group focus-within:border-white/30 transition-all w-[300px] md:w-[400px] ${isScrolled ? 'bg-[#19222b]/50 border border-white/10' : 'bg-[#19222b]/60 backdrop-blur-sm border border-white/20'}`}>
            <Search size={18} className="text-[#c7cbd1]" />
            <input className="bg-transparent border-none outline-none text-white text-sm font-medium ml-2 w-full placeholder-[#5a6069]" placeholder={isPrimeOnly ? "Search Prime..." : "Search Everything..."} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { if(query.length > 1) setShowSuggestions(true); }} />
            {query && <X size={16} className="text-[#c7cbd1] cursor-pointer hover:text-white" onClick={handleClear} />}
          </form>
          {showSuggestions && (suggestions.text.length > 0 || suggestions.visual.length > 0) && (
            <div className="absolute top-12 right-0 w-full bg-[#19222b]/95 backdrop-blur-xl border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in z-[160]">
              {suggestions.text.map((text, idx) => ( <div key={idx} onClick={() => { setQuery(text); handleSearch({preventDefault:()=>{}}); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-[#333c46] hover:text-white cursor-pointer flex items-center gap-2 border-b border-white/5 last:border-0"><Search size={14} /> {text}</div> ))}
              {suggestions.visual.length > 0 && ( <div className="px-4 pt-3 pb-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Top Results</div> )}
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
        
        {/* --- WATCHLIST BUTTON --- */}
        <Link to="/watchlist" className="relative group flex items-center justify-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer border ${isScrolled ? 'border-transparent' : 'border-transparent'} hover:border-white/10`}>
               <Bookmark size={24} className="text-[#c7cbd1] group-hover:text-white transition-colors" />
            </div>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">Watchlist</span>
        </Link>

        <div className="relative" ref={dropdownRef}>
          <div className={`w-9 h-9 rounded-full bg-[#3d464f]/80 backdrop-blur-sm flex items-center justify-center border border-white/10 hover:border-white transition-all cursor-pointer`} onClick={() => setMenuOpen(!menuOpen)}><Grip size={20} className="text-[#c7cbd1]" /></div>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-[#19222b]/95 backdrop-blur-xl border border-gray-700 rounded-lg shadow-2xl p-2 z-[150] animate-in">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 pt-2">Switch Mode</div>
              <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${isPrimeOnly ? 'bg-[#00A8E1] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Prime Video</div><div className="text-[10px] opacity-80">Included with Prime only</div></div></Link>
              <Link to="/everything" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md transition-colors ${!isPrimeOnly ? 'bg-[#E50914] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={18} className={!isPrimeOnly ? "text-white" : "opacity-0"} /><div><div className="font-bold">Literally Everything!</div><div className="text-[10px] opacity-80">All streaming services</div></div></Link>
            </div>
          )}
        </div>
        <div className={`w-9 h-9 rounded-full ${theme.bg} flex items-center justify-center text-white font-bold text-sm cursor-pointer border border-white/10 shadow-lg`}>U</div>
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
        const [type, id] = key.split('-');
        if (!type || !id) return null;
        try {
          const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`);
          const data = await res.json();
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
    <div className="pt-10 px-6 md:px-12 min-h-screen pb-20">
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

// --- SPORTS / LIVE TV COMPONENTS ---
const SportsPage = () => {
  const ALL_DLHD_CHANNELS = [
    { name: "ABC USA", id: "51" }, { name: "AHC (American Heroes Channel)", id: "206" }, { name: "Antenna TV USA", id: "283" }, { name: "A&E USA", id: "302" },
    { name: "AMC USA", id: "303" }, { name: "Animal Planet", id: "304" }, { name: "Astro SuperSport 1", id: "123" }, { name: "Astro SuperSport 2", id: "124" },
    { name: "Astro SuperSport 3", id: "125" }, { name: "Astro SuperSport 4", id: "126" }, { name: "Arena Sport 1 Premium", id: "134" }, { name: "Arena Sport 2 Premium", id: "135" },
    { name: "ESPN USA", id: "44" }, { name: "ESPN2 USA", id: "45" }, { name: "beIN Sports MENA English 1", id: "61" }, { name: "beIN Sports MENA English 2", id: "90" },
    { name: "Sky Sports Football UK", id: "35" }, { name: "Sky Sports Main Event", id: "38" }, { name: "Sky Sports F1 UK", id: "60" }, { name: "Sky Sports Cricket", id: "65" },
    { name: "TNT Sports 1 UK", id: "31" }, { name: "TNT Sports 2 UK", id: "32" }, { name: "TNT Sports 3 UK", id: "33" }, { name: "TNT Sports 4 UK", id: "34" },
    { name: "SONY TEN 1", id: "885" }, { name: "SONY TEN 2", id: "886" }, { name: "SONY TEN 3", id: "887" },
    { name: "Star Sports 1 IN", id: "267" }, { name: "Star Sports Hindi IN", id: "268" },
    { name: "Fox Sports 1 USA", id: "39" }, { name: "Fox Sports 2 USA", id: "758" },
    { name: "NBC USA", id: "53" }, { name: "CBS USA", id: "52" }, { name: "FOX USA", id: "54" },
    { name: "CNN USA", id: "345" }, { name: "BBC News Channel HD", id: "349" }, { name: "BBC One UK", id: "356" },
    { name: "Willow Cricket", id: "346" }, { name: "Willow 2 Cricket", id: "598" },
    { name: "NBA TV USA", id: "404" }, { name: "NFL Network", id: "405" }, { name: "MLB Network USA", id: "399" },
    { name: "beIN SPORTS 1 Turkey", id: "62" }, { name: "beIN SPORTS 2 Turkey", id: "63" }, { name: "beIN SPORTS 3 Turkey", id: "64" },
    { name: "Canal+ France", id: "121" }, { name: "Canal+ Sport France", id: "122" },
    { name: "Eurosport 1 France", id: "772" }, { name: "Eurosport 2 France", id: "773" },
    { name: "LaLigaTV UK", id: "276" }, { name: "DAZN 1 UK", id: "230" },
    { name: "T Sports BD", id: "270" }, { name: "TSN1", id: "111" }, { name: "TSN2", id: "112" }, { name: "TSN3", id: "113" },
  ];

  const SPECIAL_STREAM = {
    name: "ICC T20 WC Live (Bengali)",
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-sN5te7jsC9YTazKRH6RgQCxTAqs60oWZMw&s",
    group: "Cricket",
    parentGroup: "Sports",
    url: "",
  };

  const CATEGORIES_TREE = {
    'All': [],
    'General Entertainment': ['Entertainment', 'GEC (General Entertainment Channels)', 'Lifestyle', 'Music', 'Comedy'],
    'News': ['News', 'News (International)', 'News (National)', 'News (Regional)', 'Business News', 'Political News'],
    'Sports': ['Sports', 'Live Sports', 'Cricket', 'Football (Soccer)', 'Basketball', 'Tennis', 'Motorsports', 'Wrestling (WWE / AEW / UFC)', 'Sports Events (PPV)']
  };

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

  const [activeTab, setActiveTab] = useState('iptv');
  const [dlhdQuery, setDlhdQuery] = useState("");

  const PLAYLIST_URL = `/api/proxy?url=${encodeURIComponent('https://iptv-org.github.io/iptv/index.m3u')}`;
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

  const getDlhdChannels = () => {
    if (!dlhdQuery) return ALL_DLHD_CHANNELS;
    return ALL_DLHD_CHANNELS.filter(c => c.name.toLowerCase().includes(dlhdQuery.toLowerCase()));
  };
  const dlhdChannels = getDlhdChannels();

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
            {activeTab === 'iptv' 
              ? (loading ? "Scanning frequencies..." : `${channels.length} Channels Available`) 
              : `${ALL_DLHD_CHANNELS.length} Premium Channels`
            }
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder={activeTab === 'iptv' ? "Find free channel..." : "Search premium channels..."}
              className="w-full bg-[#19222b] border border-white/10 rounded-lg px-4 py-3 pl-10 text-white focus:border-[#00A8E1] outline-none font-medium transition-all duration-300 focus:shadow-[0_0_15px_rgba(0,168,225,0.4)]"
              value={activeTab === 'iptv' ? searchQuery : dlhdQuery}
              onChange={e => activeTab === 'iptv' ? setSearchQuery(e.target.value) : setDlhdQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
            {(activeTab === 'iptv' ? searchQuery : dlhdQuery) && <X onClick={() => activeTab === 'iptv' ? setSearchQuery('') : setDlhdQuery('')} className="absolute right-3 top-3.5 text-gray-400 cursor-pointer hover:text-white" size={18} />}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8 border-b border-white/10 pb-1">
        <button 
          onClick={() => setActiveTab('iptv')}
          className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'iptv' ? 'border-[#00A8E1] text-[#00A8E1]' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Live Sports (Free)
        </button>
        <button 
          onClick={() => setActiveTab('dlhd')}
          className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'dlhd' ? 'border-[#00A8E1] text-[#00A8E1]' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Literally Every Channel
        </button>
      </div>

      {activeTab === 'iptv' && (
        <>
            {!loading && !error && (
            <div className="flex flex-col gap-4 mb-8">
               <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2">
                 {['All', ...Object.keys(CATEGORIES_TREE).filter(k => k !== 'All')].map(cat => (
                   <button key={cat} onClick={() => { setActiveMainCategory(cat); setActiveSubCategory('All'); }} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-300 border relative overflow-hidden group ${activeMainCategory === cat ? 'bg-[#00A8E1] text-white border-transparent shadow-[0_0_20px_rgba(0,168,225,0.6)] scale-105' : 'bg-[#19222b] text-gray-400 border-transparent hover:text-white hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105'}`}><span className="relative z-10">{cat}</span></button>
                 ))}
               </div>
               {activeMainCategory !== 'All' && CATEGORIES_TREE[activeMainCategory] && (
                 <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 px-2 animate-in fade-in slide-in-from-top-2">
                   <button onClick={() => setActiveSubCategory('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border hover:scale-105 ${activeSubCategory === 'All' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-transparent text-gray-400 border-gray-700 hover:border-white hover:text-white'}`}>All {activeMainCategory}</button>
                   {CATEGORIES_TREE[activeMainCategory].map(sub => (<button key={sub} onClick={() => setActiveSubCategory(sub)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border hover:scale-105 ${activeSubCategory === sub ? 'bg-[#00A8E1] text-white border-[#00A8E1] shadow-[0_0_15px_rgba(0,168,225,0.5)]' : 'bg-[#19222b] text-gray-400 border-gray-800 hover:border-[#00A8E1] hover:text-[#00A8E1]'}`}>{sub}</button>))}
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
                          <div key={idx} onClick={() => navigate('/watch/sport/iptv', { state: { streamUrl: channel.url, title: channel.name, logo: channel.logo, group: channel.group } })} className="bg-[#19222b] hover:bg-[#232d38] rounded-xl overflow-hidden cursor-pointer group hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_rgba(0,168,225,0.3)] relative glow-card border border-white/5">
                            <div className="aspect-video bg-black/40 flex items-center justify-center p-4 relative group-hover:bg-black/20 transition-colors">
                              {channel.logo ? (<img src={channel.logo} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" alt={channel.name} onError={e => e.target.style.display = 'none'} />) : (<Signal className="text-gray-700 group-hover:text-[#00A8E1] transition-colors" size={32} />)}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-sm">
                                <div className="bg-[#00A8E1] p-3 rounded-full shadow-[0_0_20px_#00A8E1] transform scale-50 group-hover:scale-100 transition-transform duration-300">
                                  <Play fill="white" className="text-white" size={20} />
                                </div>
                              </div>
                            </div>
                            <div className="p-3 bg-[#19222b] group-hover:bg-[#1f2933] transition-colors border-t border-white/5">
                              <h3 className="text-gray-200 text-xs font-bold truncate group-hover:text-[#00A8E1] transition-colors">{channel.name}</h3>
                              <div className="flex items-center gap-1.5 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></span><p className="text-gray-500 text-[10px] font-bold truncate uppercase group-hover:text-white transition-colors">{channel.group}</p></div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="flex justify-center items-center gap-4 mt-12 mb-8">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all duration-300"><ChevronLeft size={24} /></button>
                        <div className="flex gap-2 overflow-x-auto max-w-[300px] scrollbar-hide px-2 items-center">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum = currentPage - 2 + i;
                            if (pageNum <= 0) pageNum = i + 1;
                            if (pageNum > totalPages) return null;
                            return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-10 h-10 rounded-full font-bold text-sm transition-all duration-300 ${currentPage === pageNum ? 'bg-[#00A8E1] text-white scale-110 shadow-[0_0_15px_#00A8E1]' : 'bg-[#19222b] text-gray-400 hover:text-white hover:bg-[#333c46] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`}>{pageNum}</button>);
                          })}
                        </div>
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-3 rounded-full bg-[#19222b] hover:bg-[#333c46] hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all duration-300"><ChevronRight size={24} /></button>
                    </div>
                </>
            )}
        </>
      )}

      {activeTab === 'dlhd' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-500">
          {dlhdChannels.map((channel, idx) => (
            <div
              key={channel.id}
              onClick={() => navigate('/watch/sport/iptv', { 
                state: { 
                  streamUrl: channel.id,
                  title: channel.name, 
                  logo: null, 
                  group: "DLHD Premium",
                  type: 'dlhd'
                } 
              })}
              className="bg-[#19222b] hover:bg-[#232d38] rounded-xl overflow-hidden cursor-pointer group hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_rgba(0,168,225,0.3)] relative glow-card border border-white/5"
            >
              <div className="aspect-video bg-black/40 flex items-center justify-center p-4 relative group-hover:bg-black/20 transition-colors">
                <div className="w-full h-full flex items-center justify-center text-[#00A8E1] font-black text-2xl opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all">
                   TV
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-sm">
                  <div className="bg-[#00A8E1] p-3 rounded-full shadow-[0_0_20px_#00A8E1] transform scale-50 group-hover:scale-100 transition-transform duration-300">
                    <Play fill="white" className="text-white" size={20} />
                  </div>
                </div>
              </div>
              <div className="p-3 bg-[#19222b] group-hover:bg-[#1f2933] transition-colors border-t border-white/5">
                <h3 className="text-gray-200 text-xs font-bold truncate group-hover:text-[#00A8E1] transition-colors">{channel.name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_5px_#3b82f6]"></span>
                  <p className="text-gray-500 text-[10px] font-bold truncate uppercase group-hover:text-white transition-colors">Premium</p>
                </div>
              </div>
            </div>
          ))}
          {dlhdChannels.length === 0 && (
             <div className="col-span-full text-center text-gray-500 py-20">No channels found matching "{dlhdQuery}"</div>
          )}
        </div>
      )}
    </div>
  );
};

const SportsPlayer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const { streamUrl, title, logo, group, type } = location.state || {};
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!streamUrl || type === 'dlhd') return;
    
    let hls;
    if (Hls && Hls.isSupported()) {
      hls = new Hls(); 
      hls.loadSource(streamUrl); 
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { videoRef.current.play().catch(e => console.log("Auto-play prevented", e)); });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = streamUrl; 
      videoRef.current.addEventListener('loadedmetadata', () => { videoRef.current.play(); });
    }
    return () => { if (hls) hls.destroy(); };
  }, [streamUrl, type]);

  if (!streamUrl) return <div className="text-white pt-20 text-center">No stream selected. <button onClick={() => navigate(-1)} className="text-[#00A8E1] ml-2 hover:underline">Go Back</button></div>;

  return (
    <div className="fixed inset-0 bg-[#0f171e] z-[200] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center px-6 justify-between pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button onClick={() => navigate(-1)} className="w-12 h-12 rounded-full bg-black/40 hover:bg-[#00A8E1] backdrop-blur-md flex items-center justify-center text-white transition border border-white/10 group">
             <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
               {logo && <img src={logo} className="h-8 w-auto object-contain bg-white/10 rounded px-1" alt="" onError={(e) => e.target.style.display = 'none'} />}
               <h1 className="text-white font-bold text-xl leading-tight drop-shadow-md">{title || "Live Stream"}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]"></span>
               <span className="text-[#00A8E1] text-xs font-bold tracking-widest uppercase">{group || "LIVE BROADCAST"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        {type === 'dlhd' ? (
           <iframe 
             src={`https://dlhd.link/stream/stream-${streamUrl}.php`}
             width="100%" 
             height="100%" 
             style={{ border: 0 }} 
             allowFullScreen 
             allow="encrypted-media"
             title="DLHD Player"
           ></iframe>
        ) : (
           <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline preload="auto"></video>
        )}
      </div>
    </div>
  );
};

// Global seen-IDs set — shared across ALL Row instances in a session
// so the same movie never appears in two different rows
const _seenIds = new Set();
const resetSeenIds = () => _seenIds.clear();

// --- ROW Component ---
const Row = ({ title, fetchUrl, data = null, variant = 'standard', itemType = 'movie', isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const rowRef = useRef(null);
  const timeoutRef = useRef(null);
  const theme = getTheme(isPrimeOnly);

  useEffect(() => {
    if (data) {
      // For "Continue Watching" passed data — no dedup/filter needed
      setMovies(data);
      return;
    }

    const fetchMovies = async () => {
      try {
        const res = await fetch(`${BASE_URL}${fetchUrl}`);
        const json = await res.json();
        let results = (json.results || []).filter(m => m.backdrop_path || m.poster_path);

        if (isPrimeOnly) {
          // Per-item Prime verification: check each result has Prime flatrate in IN
          // We batch-check in parallel (max 8 at once) for speed
          const verified = [];
          const BATCH = 8;
          for (let i = 0; i < results.length && verified.length < 20; i += BATCH) {
            const slice = results.slice(i, i + BATCH);
            const checks = await Promise.all(slice.map(async (item) => {
              const mType = item.media_type || itemType || 'movie';
              try {
                const r = await fetch(
                  `${BASE_URL}/${mType}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`
                );
                const d = await r.json();
                const flatrate = d.results?.IN?.flatrate || [];
                const hasPrime = flatrate.some(p => p.provider_id === 9 || p.provider_id === 119);
                return hasPrime ? item : null;
              } catch (_) {
                return null;
              }
            }));
            checks.forEach(item => { if (item) verified.push(item); });
          }
          results = verified;
        }

        // Deduplicate: skip items already shown in another row this session
        const fresh = results.filter(m => {
          if (_seenIds.has(m.id)) return false;
          _seenIds.add(m.id);
          return true;
        });

        setMovies(fresh);
      } catch (err) {
        console.error(err);
      }
    };

    fetchMovies();
  }, [fetchUrl, data, isPrimeOnly, itemType]);

  const handleHover = (id) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setHoveredId(id), 400); };
  const handleLeave = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setHoveredId(null); };
  const slideLeft = () => { if (rowRef.current) rowRef.current.scrollBy({ left: -800, behavior: 'smooth' }); };
  const slideRight = () => { if (rowRef.current) rowRef.current.scrollBy({ left: 800, behavior: 'smooth' }); };
  const displayMovies = variant === 'ranked' ? movies.slice(0, 10) : movies;

  if (displayMovies.length === 0) return null;

  return (
    <div className="mb-6 pl-4 md:pl-12 relative z-20 group/row animate-row-enter hover:z-30 transition-all duration-300">
      <h3 className="text-[19px] font-bold text-white mb-2 flex items-center gap-2">
        {variant === 'ranked' ? <span className={theme.color}>Top 10</span> : <span className={theme.color}>{theme.name}</span>}
        {' '}{title}
        <ChevronRight size={18} className="text-[#8197a4] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"/>
      </h3>
      <div className="relative">
        <button onClick={slideLeft} className="absolute left-0 top-[40%] -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-start pl-3 hover:w-16 cursor-pointer"><ChevronLeft size={40} className="text-white hover:scale-125 transition-transform" /></button>
        <div ref={rowRef} className={`row-container ${variant === 'vertical' ? 'vertical' : ''} scrollbar-hide`}>
          {displayMovies.map((movie, index) => ( <MovieCard key={movie.id} movie={movie} variant={variant} itemType={itemType} rank={index + 1} isHovered={hoveredId === movie.id} onHover={handleHover} onLeave={handleLeave} isPrimeOnly={isPrimeOnly} isFirst={index === 0} isLast={index === displayMovies.length - 1} /> ))}
        </div>
        <button onClick={slideRight} className="absolute right-0 top-[40%] -translate-y-1/2 z-[60] w-12 h-full bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-end pr-3 hover:w-16 cursor-pointer"><ChevronRight size={40} className="text-white hover:scale-125 transition-transform" /></button>
      </div>
    </div>
  );
};

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
    // Prime mode: only fetch Prime content for hero
    // Everything mode: use trending
    const endpoint = isPrimeOnly
      ? `/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc`
      : `/trending/all/day?api_key=${TMDB_API_KEY}`;
    fetch(`${BASE_URL}${endpoint}`).then(res => res.json()).then(data => setMovies(data.results.slice(0, 5)));
  }, [isPrimeOnly]);

  useEffect(() => {
    if (movies.length === 0) return;
    setShowVideo(false); setTrailerKey(null); clearTimeout(playTimeout.current); clearTimeout(stopTimeout.current);
    const movie = movies[currentSlide];
    const mediaType = movie.media_type || 'movie';
    fetch(`${BASE_URL}/${mediaType}/${movie.id}/videos?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(data => {
      const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results?.find(v => v.site === 'YouTube');
      if (trailer) { setTrailerKey(trailer.key); if (isHovering.current) { playTimeout.current = setTimeout(() => setShowVideo(true), 4000); } }
    });
  }, [currentSlide, movies]);

  const handleMouseEnter = () => { isHovering.current = true; clearTimeout(stopTimeout.current); clearTimeout(playTimeout.current); playTimeout.current = setTimeout(() => setShowVideo(true), 4000); };
  const handleMouseLeave = () => { isHovering.current = false; clearTimeout(playTimeout.current); clearTimeout(stopTimeout.current); stopTimeout.current = setTimeout(() => setShowVideo(false), 1000); };
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % movies.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + movies.length) % movies.length);

  if (movies.length === 0) return <div className="h-[85vh] w-full bg-[#00050D]" />;
  const movie = movies[currentSlide];

  return (
    <div className="relative w-full h-[85vh] overflow-hidden group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className={`absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`}><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" /></div>
      {showVideo && trailerKey && (
        <div className="absolute inset-0 animate-in pointer-events-none">
          <iframe 
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} 
            className="w-full h-full scale-[1.3]" 
            allow="autoplay; encrypted-media" 
            frameBorder="0" 
            referrerPolicy="strict-origin-when-cross-origin"
            title="Hero Trailer"
          ></iframe>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/40 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-transparent to-transparent" />
      <div className="absolute top-[25%] left-[4%] max-w-[600px] z-30 animate-row-enter">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-tight leading-tight">{movie.title || movie.name}</h1>
        <div className="flex items-center gap-3 text-[#a9b7c1] font-bold text-sm mb-6">
          {isPrimeOnly && <span className={`${theme.color} tracking-wide`}>Included with Prime</span>}
          <span className="bg-[#33373d]/80 text-white px-1.5 py-0.5 rounded text-xs border border-gray-600 backdrop-blur-md">UHD</span>
          <span className="bg-[#33373d]/80 text-white px-1.5 py-0.5 rounded text-xs border border-gray-600 backdrop-blur-md">16+</span>
        </div>
        <p className="text-lg text-white font-medium line-clamp-3 mb-8 opacity-90 drop-shadow-md text-shadow-sm">{movie.overview}</p>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} ${theme.hoverBg} text-white h-14 pl-8 pr-8 rounded-md font-bold text-lg flex items-center gap-3 transition transform hover:scale-105 ${theme.shadow}`}><Play fill="white" size={24} /> {isPrimeOnly ? "Play" : "Rent or Play"}</button>
          <button className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] hover:border-white transition backdrop-blur-sm group"><Plus size={28} className="text-gray-200 group-hover:text-white" /></button>
          <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="w-14 h-14 rounded-full bg-[#42474d]/60 border border-gray-400/50 flex items-center justify-center hover:bg-[#42474d] hover:border-white transition backdrop-blur-sm group"><Info size={28} className="text-gray-200 group-hover:text-white" /></button>
        </div>
      </div>
      <div className="absolute top-32 right-[4%] z-40"><button onClick={() => setIsMuted(!isMuted)} className="w-12 h-12 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 hover:border-white transition">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button></div>
      <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition backdrop-blur-sm border border-transparent hover:border-white/30"><ChevronLeft size={40} /></button>
      <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition backdrop-blur-sm border border-transparent hover:border-white/30"><ChevronRight size={40} /></button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40">{movies.map((_, idx) => (<div key={idx} className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-white w-4' : 'bg-gray-500'}`} />))}</div>
    </div>
  );
};

// --- MOVIE CARD ---
const MovieCard = ({ movie, variant, itemType, onHover, onLeave, isHovered, rank, isPrimeOnly, isFirst, isLast }) => {
  const navigate = useNavigate();
  const type = movie.media_type || itemType || 'movie';
  const id = movie.id;

  const progressData = getMediaProgress(type, id);
  const percent = progressData?.progress?.watched && progressData?.progress?.duration
    ? (progressData.progress.watched / progressData.progress.duration) * 100
    : 0;

  const imageUrl = movie.poster_path || movie.backdrop_path;
  const baseWidth = 'w-[160px] md:w-[200px]';
  const aspectRatio = 'aspect-[360/440]';
  const cardMargin = variant === 'ranked' ? 'ml-[110px]' : '';
  const originClass = isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center';

  const rating = movie.vote_average ? Math.round(movie.vote_average * 10) + "%" : "98%";
  const year = movie.release_date?.split('-')[0] || "2024";
  const duration = movie.media_type === 'tv' ? '1 Season' : '2h 15m';

  return (
    <div className={`relative flex-shrink-0 ${baseWidth} ${aspectRatio} ${cardMargin} group transition-all duration-300`} onMouseEnter={() => onHover(movie.id)} onMouseLeave={onLeave} onClick={() => navigate(`/detail/${type}/${id}`)} style={{ zIndex: isHovered ? 100 : 10 }}>
      {variant === 'ranked' && <span className="rank-number animate-neon-pulse">{rank}</span>}
      <div className={`relative w-full h-full rounded-xl overflow-hidden cursor-pointer bg-[#19222b] shadow-xl transform transition-all duration-[400ms] cubic-bezier(0.2, 0.8, 0.2, 1) border border-white/5 ring-1 ring-white/5 glow-card ${originClass}`} style={{ transform: isHovered ? 'scale(1.8)' : 'scale(1)', boxShadow: isHovered ? '0 25px 50px rgba(0,0,0,0.8)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div className={`w-full h-full relative bg-black transition-transform duration-[400ms] cubic-bezier(0.2, 0.8, 0.2, 1) ${isHovered ? 'scale-[1.02]' : 'scale-100'}`}>
          <img src={`${IMAGE_BASE_URL}${imageUrl}`} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
          {percent > 0 && percent < 95 && (<div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700 z-20"><div className="h-full bg-[#00A8E1]" style={{ width: `${percent}%` }} /></div>)}
        </div>
        <div className={`absolute inset-0 flex flex-col justify-end px-4 py-5 text-white bg-gradient-to-t from-[#0f171e] via-[#0f171e]/95 to-transparent transition-all duration-300 ease-out z-30 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="mb-2 opacity-90"><span className="text-[5px] font-black tracking-[0.2em] text-[#00A8E1] uppercase bg-[#00A8E1]/10 px-1 py-0.5 rounded-sm">Prime</span></div>
          <h3 className="font-extrabold text-[10px] leading-[1.2] text-white drop-shadow-md line-clamp-2 mb-2 w-[90%]">{movie.title || movie.name}</h3>
          {percent > 0 && percent < 95 && (<div className="text-[6px] text-[#00A8E1] font-bold mb-1">Resume {type === 'tv' && progressData.last_season_watched ? `S${progressData.last_season_watched} E${progressData.last_episode_watched}` : ''}</div>)}
          <div className="flex items-center gap-2 mb-3"><button className="bg-white hover:bg-[#d6d6d6] text-black text-[6px] font-bold h-6 px-3 rounded-[3px] transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"><Play fill="black" size={6} /> Play</button><button className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white transition flex items-center justify-center"><Plus size={8} className="text-white" /></button></div>
          <div className="flex items-center gap-1.5 text-[6px] font-medium text-gray-300 mb-1"><span className="text-[#46d369] font-bold">{rating} Match</span><span className="text-gray-600 text-[5px]">•</span><span className="text-white">{year}</span><span className="text-gray-600 text-[5px]">•</span><span>{duration}</span><span className="ml-auto border border-white/20 px-1 rounded-[2px] text-[5px] text-gray-400">U/A 13+</span></div>
          <div className="flex items-center gap-1 mb-2 opacity-80"><span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">4K UHD</span><span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">HDR10</span><span className="bg-white/10 text-[4.5px] font-bold px-1 py-0.5 rounded-[2px] text-gray-200">Dolby Atmos</span></div>
          <p className="text-[5.5px] text-gray-400 line-clamp-2 leading-relaxed font-medium">{movie.overview || "Stream this title now on Prime Video."}</p>
        </div>
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
        if (isPrimeOnly) {
          const filteredResults = [];
          for (const item of results) {
            const mediaType = item.media_type || 'movie'; if (mediaType !== 'movie' && mediaType !== 'tv') continue;
            try {
              const providerRes = await fetch(`${BASE_URL}/${mediaType}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`);
              const providerData = await providerRes.json();
              const inProviders = providerData.results?.[PRIME_REGION]?.flatrate || [];
              if (inProviders.some(p => p.provider_id.toString() === "9" || p.provider_id.toString() === "119")) { filteredResults.push(item); }
              await new Promise(r => setTimeout(r, 50));
            } catch (e) {}
          }
          setMovies(filteredResults);
        } else { setMovies(results); }
        setLoading(false);
      });
    }
  }, [query, isPrimeOnly]);

  return (
    <div className="pt-28 px-8 min-h-screen">
      <h2 className="text-white text-2xl mb-6 flex items-center gap-2">Results for "{query}" {loading && <Loader className="animate-spin ml-2" size={20} />}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {movies.map(m => (m.poster_path && (<div key={m.id} className="cursor-pointer" onClick={() => navigate(`/detail/${m.media_type || 'movie'}/${m.id}`)}><img src={`${IMAGE_BASE_URL}${m.poster_path}`} className={`rounded-md hover:scale-105 transition-transform border-2 border-transparent hover:${theme.border}`} alt={m.title} /></div>)))}
      </div>
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
  const [activeTab, setActiveTab] = useState('related');
  const [showVideo, setShowVideo] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hoveredRelatedId, setHoveredRelatedId] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState(null);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState([]);

  const relatedTimeoutRef = useRef(null);
  const relatedSliderRef = useRef(null); 
  const castSliderRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    setShowVideo(false); 
    setTrailerKey(null); 
    setIsMuted(true); 
    setMovie(null); 
    setRelatedMovies([]); 
    setActiveTab(type === 'tv' ? 'episodes' : 'related');
    
    const savedWatchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    setIsInWatchlist(savedWatchlist.includes(`${type}-${id}`));
    setIsLiked(false);
    setIsDisliked(false);

    const fetchData = async () => {
      try {
        const [movieRes, creditsRes, videoRes] = await Promise.all([
          fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`),
          fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`),
          fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`),
        ]);

        const movieData = await movieRes.json();
        setMovie(movieData);
        
        const creditsData = await creditsRes.json();
        setCredits(creditsData);

        const videoData = await videoRes.json();
        const trailer = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) {
           setTrailerKey(trailer.key); 
           setTimeout(() => setShowVideo(true), 3000); 
        }

        let recsRes = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`);
        let recsData = await recsRes.json();
        let validRecs = (recsData.results || []).filter(m => m.backdrop_path || m.poster_path);

        if (validRecs.length === 0) {
            recsRes = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=en-US`);
            recsData = await recsRes.json();
            validRecs = (recsData.results || []).filter(m => m.backdrop_path || m.poster_path);
        }
        
        setRelatedMovies(validRecs.slice(0, 15));

      } catch (e) { console.error("Fetch Error:", e); }
    };
    fetchData();
  }, [type, id]);

  useEffect(() => {
    if (type === 'tv' && selectedSeason) {
      setSeasonData(null);
      fetch(`${BASE_URL}/tv/${id}/season/${selectedSeason}?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => setSeasonData(data));
    }
  }, [type, id, selectedSeason]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleWatchlist = () => {
    const key = `${type}-${id}`;
    const current = JSON.parse(localStorage.getItem('watchlist')) || [];
    let updated;
    if (isInWatchlist) {
      updated = current.filter(k => k !== key);
      setIsInWatchlist(false);
      showToast("Removed from Watchlist");
    } else {
      updated = [...current, key];
      setIsInWatchlist(true);
      showToast("Added to Watchlist");
    }
    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  const handleLike = () => {
    if (isLiked) { setIsLiked(false); } 
    else { setIsLiked(true); setIsDisliked(false); showToast("Marked as Liked"); }
  };

  const handleDislike = () => {
    if (isDisliked) { setIsDisliked(false); } 
    else { setIsDisliked(true); setIsLiked(false); showToast("Marked as Disliked"); }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast("Link Copied to Clipboard");
  };

  const handleDownload = async () => {
    setLoadingDownloads(true);
    setActiveModal('download');
    try {
      const links = await get111477Downloads({ mediaItem: movie, mediaType: type });
      if (links.length > 0) { setDownloadLinks(links); } 
      else { setDownloadLinks([]); }
    } catch (e) { console.error(e); } 
    finally { setLoadingDownloads(false); }
  };

  const handleSearchPerson = (name) => {
    navigate(`/search?q=${encodeURIComponent(name)}`);
  };

  const scrollSection = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -800 : 800;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleRelatedHover = (id) => {
    if (relatedTimeoutRef.current) clearTimeout(relatedTimeoutRef.current);
    relatedTimeoutRef.current = setTimeout(() => setHoveredRelatedId(id), 400);
  };
  const handleRelatedLeave = () => {
    if (relatedTimeoutRef.current) clearTimeout(relatedTimeoutRef.current);
    setHoveredRelatedId(null);
  };

  if (!movie) return <div className="min-h-screen w-full bg-[#0f171e]" />;
  
  const savedProgress = getMediaProgress(type, id);
  const isResumable = savedProgress && savedProgress.progress?.watched > 0;
  let playLabel = isResumable 
    ? (type === 'tv' ? `Resume S${savedProgress.last_season_watched || 1} E${savedProgress.last_episode_watched || 1}` : `Resume`) 
    : (type === 'tv' ? 'Play S1 E1' : 'Play');

  const director = credits?.crew?.find(c => c.job === 'Director')?.name || "Unknown Director"; 
  const producers = credits?.crew?.filter(c => c.job === 'Producer').slice(0,3).map(c => c.name).join(", ") || "Producers N/A";
  const castList = credits?.cast?.slice(0, 15) || [];
  const runtime = movie.runtime ? `${Math.floor(movie.runtime/60)} h ${movie.runtime%60} min` : `${movie.number_of_seasons} Seasons`;
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const year = movie.release_date?.split('-')[0] || "2024";
  const genres = movie.genres?.map(g => g.name).join(" • ");

  return (
    <div className="min-h-screen bg-[#0f171e] text-white font-sans selection:bg-[#00A8E1] selection:text-white pb-20 relative">
      
      {toastMessage && (
        <div className="fixed top-24 right-6 z-[200] bg-white text-black px-6 py-3 rounded shadow-2xl font-bold animate-in fade-in slide-in-from-right duration-300 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-[#00A8E1]" /> {toastMessage}
        </div>
      )}

      <div className="relative w-full h-[85vh] overflow-hidden group">
        <div className="absolute inset-0 w-full h-full">
          <div className={`absolute inset-0 transition-opacity duration-1000 ${showVideo ? 'opacity-0' : 'opacity-100'}`}>
            <img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover object-top" alt="" />
          </div>
          {showVideo && trailerKey && (
            <div className="absolute inset-0 animate-in fade-in duration-1000 pointer-events-none">
              <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&origin=${window.location.origin}`} className="w-full h-full scale-[1.5] origin-center" allow="autoplay; encrypted-media" frameBorder="0" referrerPolicy="strict-origin-when-cross-origin" title="Hero" />
            </div>
          )}
        </div>
        
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/60 to-transparent w-[80%] z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-transparent to-transparent z-10" />

        {showVideo && (
           <button 
             onClick={() => setIsMuted(!isMuted)} 
             className="absolute bottom-12 right-12 z-50 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110"
           >
             {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
           </button>
        )}

        <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 md:px-16 lg:px-20 max-w-4xl pt-12">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-wide drop-shadow-lg uppercase text-white/90">{movie.title || movie.name}</h1>

          <div className="flex items-center gap-4 mb-6">
             <button onClick={() => { setShowVideo(true); setIsMuted(false); }} className="w-14 h-14 rounded-full bg-[#425265]/80 hover:bg-[#5f738a] flex items-center justify-center transition border-2 border-transparent hover:border-gray-400 text-white group">
                <Play size={24} fill="white" className="ml-1 group-hover:scale-110 transition-transform" />
             </button>
             <button onClick={handleWatchlist} className={`w-14 h-14 rounded-full bg-[#425265]/80 hover:bg-[#5f738a] flex items-center justify-center transition border-2 border-transparent hover:border-gray-400 ${isInWatchlist ? 'text-[#00A8E1]' : 'text-white'}`}>
                {isInWatchlist ? <CheckCircle2 size={28} /> : <Plus size={28} />}
             </button>
             <button onClick={handleLike} className={`w-14 h-14 rounded-full bg-[#425265]/80 hover:bg-[#5f738a] flex items-center justify-center transition border-2 border-transparent hover:border-gray-400 ${isLiked ? 'text-green-400' : 'text-white'}`}>
                <ThumbsUp size={24} fill={isLiked ? "currentColor" : "none"} />
             </button>
             <button onClick={handleDislike} className={`w-14 h-14 rounded-full bg-[#425265]/80 hover:bg-[#5f738a] flex items-center justify-center transition border-2 border-transparent hover:border-gray-400 ${isDisliked ? 'text-red-400' : 'text-white'}`}>
                <ThumbsUp size={24} className="transform rotate-180 mt-1" fill={isDisliked ? "currentColor" : "none"} /> 
             </button>
             <button onClick={handleShare} className="w-14 h-14 rounded-full bg-[#425265]/80 hover:bg-[#5f738a] flex items-center justify-center transition border-2 border-transparent hover:border-gray-400 text-white">
                <Share2 size={24} />
             </button>
          </div>

          <div className="flex flex-col gap-3 max-w-md mb-6">
            <button onClick={() => navigate(`/watch/${type}/${id}`)} className="h-14 w-full rounded-[4px] bg-white hover:bg-[#ffffffd0] text-black font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg">
              <Play fill="black" size={24} /> {playLabel}
            </button>
            <button onClick={handleDownload} className="h-14 w-full rounded-[4px] bg-[#323e4d] hover:bg-[#425265] text-white font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg">
              <Download size={24} /> Download
            </button>
            <button onClick={() => setActiveModal('ways')} className="h-14 w-full rounded-[4px] bg-[#323e4d] hover:bg-[#425265] text-white font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg">
              More ways to watch
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
             <CheckCircle2 size={18} className="text-[#00A8E1]" fill="#00A8E1" color="#0f171e" />
             <span>Included with Prime</span>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12 mt-4 border-b border-white/10 flex gap-8 text-lg font-bold">
         {type === 'tv' && (
           <div onClick={() => setActiveTab('episodes')} className={`pb-3 cursor-pointer transition border-b-[3px] ${activeTab === 'episodes' ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Episodes</div>
         )}
         <div onClick={() => setActiveTab('related')} className={`pb-3 cursor-pointer transition border-b-[3px] ${activeTab === 'related' ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Related</div>
         <div onClick={() => setActiveTab('details')} className={`pb-3 cursor-pointer transition border-b-[3px] ${activeTab === 'details' ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Details</div>
      </div>

      {activeTab === 'episodes' && type === 'tv' && (
        <div className="px-6 md:px-12 py-8 animate-in fade-in slide-in-from-right-4 relative z-30">
          <div className="relative inline-block mb-8 z-50">
            <button 
              onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)} 
              className="flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white font-bold shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:bg-white/20 hover:border-white/40 transition-all"
            >
               <span>Season {selectedSeason}</span>
               <ChevronDown size={18} className={`transition-transform duration-300 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSeasonDropdownOpen && (
              <div className="absolute top-full left-0 mt-3 w-64 bg-[#0f171e]/40 backdrop-blur-3xl border border-white/20 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-[100] max-h-72 overflow-y-auto scrollbar-hide">
                 {(movie?.seasons?.filter(s => s.season_number > 0) || []).map(s => (
                    <button 
                      key={s.season_number} 
                      onClick={() => { setSelectedSeason(s.season_number); setIsSeasonDropdownOpen(false); }} 
                      className={`w-full text-left px-5 py-4 font-bold transition-all border-b border-white/5 last:border-0 hover:bg-white/20 ${selectedSeason === s.season_number ? 'bg-white/10 text-white border-l-4 border-l-[#00A8E1]' : 'text-gray-300'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{s.name || `Season ${s.season_number}`}</span>
                        {s.episode_count && <span className="text-[10px] font-normal opacity-80 bg-black/40 px-2 py-1 rounded-md">{s.episode_count} Eps</span>}
                      </div>
                    </button>
                 ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
             {seasonData?.episodes ? seasonData.episodes.map(ep => (
                <div 
                  key={ep.id} 
                  onClick={() => navigate(`/watch/tv/${id}?season=${selectedSeason}&episode=${ep.episode_number}`)} 
                  className="group flex flex-col md:flex-row gap-5 p-4 bg-white/5 backdrop-blur-2xl border border-white/10 hover:border-white/30 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] cursor-pointer transition-all duration-300 hover:bg-white/10 hover:-translate-y-1"
                >
                  <div className="relative w-full md:w-64 aspect-[16/9] rounded-2xl overflow-hidden bg-black/40 flex-shrink-0 shadow-inner">
                     {ep.still_path ? (
                       <img src={`${IMAGE_BASE_URL}${ep.still_path}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={ep.name} />
                     ) : (
                       <div className="w-full h-full flex justify-center items-center text-gray-500 text-xs">No Image Available</div>
                     )}
                     <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center items-center backdrop-blur-[2px]">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex justify-center items-center border border-white/40">
                           <Play fill="white" size={20} className="ml-1 text-white"/>
                        </div>
                     </div>
                     <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-white border border-white/10">
                       {ep.runtime ? `${ep.runtime}m` : 'TBA'}
                     </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center py-1">
                     <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-3">
                           <span className="text-[#00A8E1] font-bold text-xs uppercase tracking-wider">Episode {ep.episode_number}</span>
                           {ep.vote_average > 0 && (
                             <span className="flex items-center gap-1 text-[10px] font-bold bg-[#f5c518] text-black px-1.5 py-0.5 rounded-sm">
                               ★ {ep.vote_average.toFixed(1)}
                             </span>
                           )}
                        </div>
                        {ep.air_date && <span className="text-gray-400 text-xs font-medium">{new Date(ep.air_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                     </div>
                     <h4 className="text-white font-bold text-xl mb-2 group-hover:text-[#00A8E1] transition-colors">{ep.name}</h4>
                     <p className="text-gray-300 text-sm line-clamp-2 md:line-clamp-3 leading-relaxed opacity-90">{ep.overview || "No overview available for this episode."}</p>
                  </div>
                </div>
             )) : (
                <div className="flex items-center gap-3 text-white/50 bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 justify-center">
                   <Loader className="animate-spin text-[#00A8E1]" size={28} /> 
                   <span className="font-medium tracking-wide">Fetching episodes...</span>
                </div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'related' && (
        <div className="relative z-30 pt-6 pb-6 animate-in fade-in slide-in-from-left-4 group/rel"> 
          <h3 className="text-[18px] font-bold text-white mb-4 px-6 md:px-12">Customers also watched</h3>
          
          <button onClick={() => scrollSection(relatedSliderRef, 'left')} className="absolute left-0 top-[60%] -translate-y-1/2 z-[40] w-12 h-32 bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/rel:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/40 cursor-pointer">
            <ChevronLeft size={40} className="text-white hover:scale-125 transition-transform" />
          </button>
          
          <div ref={relatedSliderRef} className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 py-10 scroll-smooth items-start">
            {relatedMovies.length > 0 ? (
              relatedMovies.map((m, index) => (
                 <MovieCard key={m.id} movie={m} variant="standard" itemType={m.media_type || type} rank={null} isHovered={hoveredRelatedId === m.id} onHover={handleRelatedHover} onLeave={handleRelatedLeave} isPrimeOnly={true} isFirst={index === 0} isLast={index === relatedMovies.length - 1} />
              ))
            ) : (
              <div className="text-gray-500 italic text-sm py-4 w-full text-center">No related titles found.</div>
            )}
          </div>

          <button onClick={() => scrollSection(relatedSliderRef, 'right')} className="absolute right-0 top-[60%] -translate-y-1/2 z-[40] w-12 h-32 bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/rel:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/40 cursor-pointer">
             <ChevronRight size={40} className="text-white hover:scale-125 transition-transform" />
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="px-6 md:px-12 py-8 grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-white/10 bg-[#0f171e] animate-in fade-in slide-in-from-right-4">
          <div className="lg:col-span-2">
             <h2 className="text-3xl font-bold mb-3">{movie.title || movie.name}</h2>
             <div className="flex items-center gap-3 text-sm font-medium text-gray-400 mb-4">
                <span className="text-white border-b border-gray-500">{genres}</span><span className="text-gray-500">•</span>
                <span className="text-gray-400">IMDb {rating}</span><span className="text-gray-500">•</span>
                <span>{year}</span><span className="text-gray-500">•</span>
                <span>{runtime}</span>
             </div>
             <p className="text-base leading-7 text-gray-300 mb-6">{movie.overview}</p>

             <div className="mb-8 relative group/cast">
               <h3 className="text-lg font-bold text-white mb-4">Cast & Crew</h3>
               
               {castList.length > 5 && (
                 <button onClick={() => scrollSection(castSliderRef, 'left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-24 bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/cast:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/40 cursor-pointer rounded-r-lg">
                    <ChevronLeft size={30} className="text-white hover:scale-110 transition-transform" />
                 </button>
               )}

               <div ref={castSliderRef} className="flex gap-6 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
                 {castList.length > 0 ? castList.map((person) => (
                   <div key={person.id} onClick={() => handleSearchPerson(person.name)} className="flex flex-col items-center min-w-[90px] cursor-pointer group">
                     <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#323e4d] mb-2 group-hover:border-[#00A8E1] transition-colors relative bg-gray-800">
                       {person.profile_path ? (
                         <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt={person.name} />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold uppercase">{person.name.charAt(0)}</div>
                       )}
                     </div>
                     <div className="text-sm font-bold text-white text-center leading-tight group-hover:text-[#00A8E1] transition-colors line-clamp-2">{person.name}</div>
                     <div className="text-xs text-gray-400 text-center leading-tight mt-0.5 line-clamp-1">{person.character}</div>
                   </div>
                 )) : <div className="text-gray-500 text-sm">Cast information unavailable.</div>}
               </div>

               {castList.length > 5 && (
                 <button onClick={() => scrollSection(castSliderRef, 'right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-24 bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/cast:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/40 cursor-pointer rounded-l-lg">
                    <ChevronRight size={30} className="text-white hover:scale-110 transition-transform" />
                 </button>
               )}
             </div>

             <div className="border-t border-white/10 py-6">
                <dl className="grid grid-cols-[150px_1fr] gap-y-4 text-sm">
                   <dt className="text-gray-400 font-medium">Directors</dt>
                   <dd onClick={() => handleSearchPerson(director)} className="text-[#00A8E1] hover:underline cursor-pointer">{director}</dd>
                   <dt className="text-gray-400 font-medium">Producers</dt>
                   <dd className="text-[#00A8E1]">{producers}</dd>
                   <dt className="text-gray-400 font-medium">Studio</dt>
                   <dd className="text-gray-300">TMDB Studios, Viacom 18 Motion Pictures</dd>
                </dl>
             </div>
             
             <div className="mt-8 text-sm text-gray-400">By clicking play, you agree to our <span className="text-[#00A8E1] cursor-pointer hover:underline">Terms of Use</span>.</div>

             <div className="mt-8">
               <div className="font-bold text-white mb-3">Feedback</div>
               <button onClick={() => setActiveModal('feedback')} className="bg-[#425265] hover:bg-[#5f738a] text-white text-sm py-2 px-6 rounded-[4px] transition font-medium shadow-md">Send us feedback</button>
             </div>
             <div className="mt-8">
               <div className="font-bold text-white mb-2">Support</div>
               <button onClick={() => setActiveModal('help')} className="text-[#00A8E1] text-sm hover:underline font-medium">Get Help</button>
             </div>
          </div>

          <div className="space-y-4">
             <div className="border border-gray-600 p-4 rounded-[4px]">
                <div className="font-bold text-white mb-2 text-lg">Content advisory</div>
                <div className="flex items-center gap-2 mb-3"><span className="border border-white/40 px-1.5 py-0.5 rounded-[2px] text-xs font-bold bg-[#33373d]">A</span></div>
                <p className="text-gray-400 text-sm leading-relaxed">substance use, alcohol use, foul language, sexual content, violence</p>
             </div>
             <div className="border border-gray-600 p-4 rounded-[4px]">
                <div className="font-bold text-white mb-2 text-lg">Audio languages</div>
                <div className="flex items-center gap-2 mb-3"><span className="border border-white/40 px-1.5 py-0.5 rounded-[2px] text-xs font-bold bg-[#33373d]">5.1</span><span className="border border-white/40 px-1.5 py-0.5 rounded-[2px] text-xs font-bold bg-[#33373d]">AD</span></div>
                <p className="text-gray-400 text-sm leading-relaxed">English, Hindi, Tamil, Telugu, Malayalam, Kannada</p>
             </div>
             <div className="border border-gray-600 p-4 rounded-[4px]">
                <div className="font-bold text-white mb-2 text-lg">Subtitles</div>
                <div className="flex items-center gap-2 mb-3"><span className="border border-white/40 px-1.5 py-0.5 rounded-[2px] text-xs font-bold bg-[#33373d]">CC</span></div>
                <p className="text-gray-400 text-sm leading-relaxed">English [CC], Español, Français, Português, Deutsch, Italiano, العربية, हिन्दी, தமிழ், తెలుగు</p>
             </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#19222b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-modal-pop">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>
            
            {activeModal === 'download' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Download className="text-[#00A8E1]" /> Download Options</h3>
                {loadingDownloads ? (
                  <div className="flex flex-col items-center py-8"><Loader className="animate-spin text-[#00A8E1] mb-2" size={32} /><span>Searching sources...</span></div>
                ) : downloadLinks.length > 0 ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-hide">
                    {downloadLinks.map((link, idx) => (
                      <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="block bg-[#232d38] hover:bg-[#00A8E1] border border-white/5 hover:border-transparent text-gray-200 hover:text-white p-4 rounded-xl transition-all group flex items-center justify-between">
                        <div className="flex flex-col"><span className="font-bold">{link.label}</span><span className="text-[10px] opacity-70 uppercase tracking-wider">{link.source}</span></div>
                        <Download size={20} className="opacity-50 group-hover:opacity-100" />
                      </a>
                    ))}
                  </div>
                ) : (
                   <div className="text-center py-6 text-gray-400">No direct download links found for this title.</div>
                )}
              </>
            )}

            {activeModal === 'ways' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Ways to Watch</h3>
                <div className="space-y-4">
                  <div className="bg-[#232d38] p-4 rounded-lg border border-white/5">
                    <div className="font-bold text-white">Prime Video</div>
                    <div className="text-sm text-gray-400">Included with your subscription</div>
                  </div>
                  <div className="bg-[#232d38] p-4 rounded-lg border border-white/5 opacity-50 cursor-not-allowed">
                    <div className="font-bold text-white">Rent / Buy</div>
                    <div className="text-sm text-gray-400">Not available in your region yet.</div>
                  </div>
                </div>
              </>
            )}

            {activeModal === 'feedback' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Send Feedback</h3>
                <textarea className="w-full bg-[#0f171e] border border-gray-600 rounded p-3 text-white h-32 mb-4 focus:border-[#00A8E1] outline-none" placeholder="Tell us what you think..."></textarea>
                <button onClick={() => { setActiveModal(null); showToast("Feedback Sent!"); }} className="w-full bg-[#00A8E1] text-white font-bold py-3 rounded hover:bg-[#008ebf]">Submit</button>
              </>
            )}

            {activeModal === 'help' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Help & Support</h3>
                <p className="text-gray-300 mb-4">Need assistance with playback? Contact our support team.</p>
                <div className="flex flex-col gap-3">
                  <button className="bg-[#232d38] hover:bg-[#333c46] text-white p-3 rounded flex items-center justify-between"><span>Playback Issues</span> <ChevronRight size={16}/></button>
                  <button className="bg-[#232d38] hover:bg-[#333c46] text-white p-3 rounded flex items-center justify-between"><span>Account & Billing</span> <ChevronRight size={16}/></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Player = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const season = Number(queryParams.get('season')) || 1;
  const episode = Number(queryParams.get('episode')) || 1;

  const [mediaDetails, setMediaDetails] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        setMediaDetails(data);
      } catch (e) {
        console.error("Error fetching details:", e);
      }
    };
    fetchDetails();
  }, [type, id]);

  if (!mediaDetails) {
    return (
      <div className="fixed inset-0 bg-black z-[200] flex items-center justify-center">
         <div className="w-12 h-12 border-4 border-[#00A8E1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const title = mediaDetails.title || mediaDetails.name;

  return (
    <div className="fixed inset-0 bg-black z-[200] overflow-hidden" style={{ transform: 'translateZ(0)' }}>
        <PrimePlayer 
            tmdbId={id}
            title={title} 
            mediaType={type} 
            season={season} 
            episode={episode} 
        />
    </div>
  );
};

// --- MAIN WRAPPERS ---
const Home = ({ isPrimeOnly }) => {
  const { rows, loadMore } = useInfiniteRows('all', isPrimeOnly);
  const [history, setHistory] = useState([]);

  useEffect(() => { resetSeenIds(); }, [isPrimeOnly]);

  useEffect(() => {
    const rawProgress = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
    const historyArray = Object.values(rawProgress)
      .filter(item => item && item.last_updated) 
      .sort((a, b) => b.last_updated - a.last_updated) 
      .map(item => ({
        ...item,
        id: item.id,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        media_type: item.type,
        vote_average: item.vote_average
      }));
    const enrichHistory = async () => {
      const enriched = await Promise.all(historyArray.map(async (h) => {
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
  useEffect(() => { resetSeenIds(); }, [isPrimeOnly]);
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
  useEffect(() => { resetSeenIds(); }, [isPrimeOnly]);
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
