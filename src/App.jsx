import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, CheckCircle2, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX, Trophy, Signal, Ban, Monitor } from 'lucide-react';

// --- GLOBAL HLS REFERENCE ---
// Ensure <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script> is in your HTML
const Hls = window.Hls;

// --- CONFIGURATION ---
const TMDB_API_KEY = "cb1dc311039e6ae85db0aa200345cbc5";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
const VIDFAST_BASE = "https://vidfast.pro";

// FILTERS
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

// --- OPTIMIZATION HOOK ---
const useConnectionOptimizer = () => {
  useEffect(() => {
    const domains = [
      "https://vidfast.pro", "https://zxcstream.xyz", "https://api.themoviedb.org",
      "https://image.tmdb.org", "https://iptv-org.github.io", "https://corsproxy.io"
    ];
    domains.forEach(domain => {
      if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect'; link.href = domain; link.crossOrigin = "anonymous";
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
    .row-container { display: flex; overflow-y: hidden; overflow-x: scroll; padding: 20px 4%; margin-top: -10px; gap: 16px; scroll-behavior: smooth; }
    
    .rank-number { position: absolute; left: -15px; bottom: 0; font-size: 100px; font-weight: 900; color: #19222b; -webkit-text-stroke: 2px #5a6069; z-index: -1; font-family: fantasy; letter-spacing: -10px; line-height: 0.8; text-shadow: 2px 2px 10px rgba(0,0,0,0.5); }
    
    @keyframes neon-pulse { 0%, 100% { text-shadow: 0 0 10px rgba(0,168,225,0.3); } 50% { text-shadow: 0 0 20px rgba(0,168,225,0.8); transform: scale(1.05); } }
    .animate-neon-pulse { animation: neon-pulse 3s infinite ease-in-out; }

    .glow-card { transition: all 0.3s ease; }
    .glow-card:hover { box-shadow: 0 0 20px rgba(0, 168, 225, 0.4); border-color: rgba(0, 168, 225, 0.5); }
    
    @keyframes row-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-row-enter { animation: row-enter 0.6s ease-out forwards; }
    
    .animate-in { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    
    .animate-modal-pop { animation: pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes pop { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
  `}</style>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// --- CATEGORY DECK ---
const CATEGORY_DECK = [
    { type: 'movie', label: "Action Thrillers", genre: 28, variant: 'standard' },
    { type: 'tv', label: "Binge-Worthy TV", genre: 18, variant: 'standard' },
    { type: 'movie', label: "Top 10 India", variant: 'ranked' }, 
    { type: 'movie', label: "Comedy Hits", genre: 35, variant: 'standard' },
    { type: 'movie', label: "Sci-Fi & Fantasy", genre: 878, variant: 'standard' },
    { type: 'movie', label: "Horror", genre: 27, variant: 'standard' },
    { type: 'tv', label: "Animation", genre: 16, variant: 'standard' },
    { type: 'movie', label: "Romance", genre: 10749, variant: 'standard' },
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
      let base = `/discover/${targetType}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
      if (isPrimeOnly) base += `&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}`;
      if (category.genre) base += `&with_genres=${category.genre}`;
      return base + '&sort_by=popularity.desc';
  };

  useEffect(() => {
      setDeck(shuffleDeck(type === 'all' ? [...CATEGORY_DECK] : CATEGORY_DECK.filter(item => item.type === type)));
      const baseApi = isPrimeOnly 
        ? `/discover/${type === 'all' ? 'movie' : type}?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc`
        : `/trending/${type === 'all' ? 'all' : type}/day?api_key=${TMDB_API_KEY}`;
      
      setRows([{ 
          id: 'trending_hero', 
          title: isPrimeOnly ? "Recommended for You" : "Trending Now", 
          fetchUrl: baseApi, 
          variant: 'standard', 
          itemType: type === 'all' ? 'movie' : type 
      }]);
  }, [type, isPrimeOnly]);

  const loadMore = useCallback(() => {
    if (loading || deck.length === 0) return;
    setLoading(true);
    const nextBatch = [];
    for(let i=0; i<2; i++) {
        const idx = (deckIndex + i) % deck.length;
        const cat = deck[idx];
        nextBatch.push({
            id: `row-${Date.now()}-${i}`,
            title: cat.label,
            fetchUrl: getUrl(cat, Math.floor(deckIndex / deck.length) + 1), 
            variant: cat.variant,
            itemType: cat.type
        });
    }
    setTimeout(() => { 
        setRows(prev => [...prev, ...nextBatch]); 
        setDeckIndex(prev => prev + 2); 
        setLoading(false); 
    }, 500);
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
  return <div ref={triggerRef} className="h-20 w-full flex justify-center p-4"><div className="w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"></div></div>;
};

// --- COMPONENTS ---

const Navbar = ({ isPrimeOnly }) => {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = getTheme(isPrimeOnly);

  const handleSearch = (e) => { 
      e.preventDefault(); 
      if (query.trim()) navigate(isPrimeOnly ? `/search?q=${query}` : `/everything/search?q=${query}`);
      setShowSuggestions(false);
  };

  const getNavLinkClass = (path) => location.pathname === path 
    ? "text-white font-bold bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-sm transition-all"
    : "text-gray-400 font-medium text-sm hover:text-white px-4 py-2 transition-all";

  return (
    <nav className="sticky top-0 w-full z-[1000] flex items-center px-6 h-[60px] bg-[#0f171e] gap-6 border-b border-white/5">
      <Link to={isPrimeOnly ? "/" : "/everything"} className="text-white font-bold text-xl tracking-tighter">{theme.logoText}</Link>
      <div className="flex items-center gap-2 hidden md:flex">
        <Link to={isPrimeOnly ? "/" : "/everything"} className={getNavLinkClass(isPrimeOnly ? "/" : "/everything")}>Home</Link>
        <Link to={isPrimeOnly ? "/movies" : "/everything/movies"} className={getNavLinkClass(isPrimeOnly ? "/movies" : "/everything/movies")}>Movies</Link>
        <Link to={isPrimeOnly ? "/tv" : "/everything/tv"} className={getNavLinkClass(isPrimeOnly ? "/tv" : "/everything/tv")}>TV</Link>
        <Link to="/sports" className={`${getNavLinkClass("/sports")} flex items-center gap-2`}><Trophy size={14} className="text-[#00A8E1]" />Live TV</Link>
      </div>
      <div className="ml-auto flex items-center gap-4">
          <form onSubmit={handleSearch} className="bg-[#19222b] border border-white/10 px-3 py-1.5 rounded-md flex items-center focus-within:border-[#00A8E1] transition-colors w-[200px] md:w-[300px]">
             <Search size={16} className="text-gray-400" />
             <input className="bg-transparent border-none outline-none text-white text-sm ml-2 w-full placeholder-gray-500" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
          <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full bg-[#333c46] flex items-center justify-center hover:bg-[#424d58]"><Grip size={16} className="text-white" /></button>
              {menuOpen && (
                  <div className="absolute right-0 top-10 w-56 bg-[#19222b] border border-gray-700 rounded-lg shadow-xl p-2 z-[150] animate-in">
                      <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md mb-1 ${isPrimeOnly ? 'bg-[#00A8E1] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={16} className={isPrimeOnly ? "opacity-100" : "opacity-0"} />Prime Video</Link>
                      <Link to="/everything" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-md ${!isPrimeOnly ? 'bg-[#E50914] text-white' : 'hover:bg-[#333c46] text-gray-300'}`}><CheckCircle2 size={16} className={!isPrimeOnly ? "opacity-100" : "opacity-0"} />Everything</Link>
                  </div>
              )}
          </div>
          <div className={`w-8 h-8 rounded-full ${theme.bg} flex items-center justify-center text-white font-bold text-xs`}>U</div>
      </div>
    </nav>
  );
};

// --- SPORTS / LIVE TV ---
const SportsPage = () => {
    // --- SPECIAL STREAM DEFINITION ---
    const SPECIAL_STREAM = {
        name: "Star Sports 1 HD",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Star_Sports_logo.svg/1200px-Star_Sports_logo.svg.png",
        group: "Cricket",
        parentGroup: "Sports",
        // Valid live stream URL (often geo-locked, but proxy handles it)
        url: "https://prod-sports-eng-cf.jiocinema.com/hls/live/2109255/hd_akamai_star_sports_1_hindi_voot_cp_in/master.m3u8"
    };

    const [channels, setChannels] = useState([]);
    const [displayedChannels, setDisplayedChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        fetch('https://iptv-org.github.io/iptv/index.m3u')
            .then(res => res.text())
            .then(data => {
                const lines = data.split('\n');
                const parsed = [SPECIAL_STREAM]; // Start with our manual stream
                let current = {};
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith('#EXTINF:')) {
                        const logo = line.match(/tvg-logo="([^"]*)"/)?.[1];
                        const group = line.match(/group-title="([^"]*)"/)?.[1] || "General";
                        const name = line.split(',').pop();
                        current = { name, logo, group, parentGroup: "Live TV" };
                    } else if (line.startsWith('http')) {
                        current.url = line;
                        parsed.push(current);
                        current = {};
                    }
                });
                setChannels(parsed);
                setDisplayedChannels(parsed.slice(0, 100)); // Limit for perf
                setLoading(false);
            })
            .catch(() => {
                setChannels([SPECIAL_STREAM]);
                setDisplayedChannels([SPECIAL_STREAM]);
                setLoading(false);
            });
    }, []);

    return (
        <div className="pt-10 px-6 min-h-screen">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Monitor className="text-[#00A8E1]"/> Live TV & Sports</h2>
            {loading ? <div className="text-center text-[#00A8E1] pt-20"><Loader className="animate-spin inline mr-2"/>Loading Channels...</div> : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {displayedChannels.map((c, i) => (
                        <div key={i} onClick={() => navigate('/watch/sport/iptv', { state: { streamUrl: c.url, title: c.name, logo: c.logo } })} className="bg-[#19222b] rounded-lg overflow-hidden cursor-pointer hover:bg-[#232d38] hover:scale-105 transition-all shadow-lg group relative border border-white/5">
                           <div className="aspect-video bg-black/50 flex items-center justify-center p-4">
                               {c.logo ? <img src={c.logo} className="h-full object-contain" onError={(e)=>e.target.style.display='none'}/> : <Signal size={30} className="text-gray-600"/>}
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Play fill="white" size={30} /></div>
                           </div>
                           <div className="p-3">
                               <h3 className="text-white text-xs font-bold truncate">{c.name}</h3>
                               <p className="text-gray-500 text-[10px] mt-1">{c.group}</p>
                           </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- SPORTS PLAYER WITH "EXTENSION-LIKE" PROXY HACK ---
const SportsPlayer = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const videoRef = useRef(null);
    const { streamUrl, title, logo } = location.state || {};
    const hlsRef = useRef(null);

    useEffect(() => {
        if (!streamUrl) return;
        if (hlsRef.current) hlsRef.current.destroy();

        if (Hls.isSupported()) {
            // --- THE MAGIC: INTERCEPT EVERY REQUEST AND WRAP IN PROXY ---
            class ProxyHlsLoader extends Hls.DefaultConfig.loader {
                constructor(config) {
                    super(config);
                    const load = this.load.bind(this);
                    this.load = function (context, config, callbacks) {
                        // Check if URL is already proxied
                        if (!context.url.includes('corsproxy.io')) {
                            // Wrap the URL (manifest, key, or chunk) in the proxy
                            context.url = `https://corsproxy.io/?${encodeURIComponent(context.url)}`;
                        }
                        load(context, config, callbacks);
                    };
                }
            }

            const hls = new Hls({
                loader: ProxyHlsLoader, // Inject our interceptor
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });

            hlsRef.current = hls;
            
            // Clean URL before initial load just in case
            const cleanUrl = streamUrl.replace('https://corsproxy.io/?', '');
            // Load manifest via proxy immediately
            hls.loadSource(`https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current.play().catch(e => console.log("Autoplay failed", e));
            });

            // Error Recovery
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log("Network error, recovering...");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log("Media error, recovering...");
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari (Native HLS) - We still try to proxy the main URL
            videoRef.current.src = `https://corsproxy.io/?${encodeURIComponent(streamUrl)}`;
            videoRef.current.addEventListener('loadedmetadata', () => videoRef.current.play());
        }

        return () => { if (hlsRef.current) hlsRef.current.destroy(); };
    }, [streamUrl]);

    if (!streamUrl) return null;

    return (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col">
            <div className="absolute top-0 left-0 w-full p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><ArrowLeft className="text-white" /></button>
                    {logo && <img src={logo} className="h-8" alt="" />}
                    <h1 className="text-white font-bold text-lg drop-shadow-md">{title}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-red-500 font-bold text-xs">LIVE</span>
                </div>
            </div>
            <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline></video>
        </div>
    );
};

// --- HERO COMPONENT ---
const Hero = ({ isPrimeOnly }) => {
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { 
      const endpoint = isPrimeOnly 
        ? `/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}&sort_by=popularity.desc`
        : `/trending/all/day?api_key=${TMDB_API_KEY}`;
      fetch(`${BASE_URL}${endpoint}`).then(res => res.json()).then(data => setMovie(data.results[0])); 
  }, [isPrimeOnly]);

  if (!movie) return <div className="h-[70vh] bg-[#00050D]"></div>;

  return (
    <div className="relative w-full h-[75vh] group">
      <div className="absolute inset-0"><img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" /></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#00050D] via-[#00050D]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-transparent to-transparent" />
      <div className="absolute bottom-[15%] left-[6%] max-w-[600px] z-30 animate-row-enter">
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg">{movie.title || movie.name}</h1>
        <p className="text-lg text-gray-200 line-clamp-3 mb-6 drop-shadow-md">{movie.overview}</p>
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} ${theme.hoverBg} text-white px-8 py-3 rounded-md font-bold text-lg flex items-center gap-2 transition hover:scale-105 shadow-lg`}><Play fill="white" size={20} /> Play</button>
            <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="px-8 py-3 rounded-md bg-gray-600/60 hover:bg-gray-600/80 text-white font-bold text-lg flex items-center gap-2 transition backdrop-blur-md"><Info size={20} /> Details</button>
        </div>
      </div>
    </div>
  );
};

// --- CARD & ROW ---
const MovieCard = ({ movie, variant, isPrimeOnly, rank }) => {
    const navigate = useNavigate();
    const type = movie.media_type || 'movie';
    const percent = Math.floor(Math.random() * 100); // Mock progress for UI demo
    const isRanked = variant === 'ranked';

    return (
        <div className={`relative flex-shrink-0 ${isRanked ? 'w-[180px] ml-[60px]' : 'w-[200px]'} aspect-[2/3] group transition-all duration-300 z-10 hover:z-50 hover:scale-110`} onClick={() => navigate(`/detail/${type}/${movie.id}`)}>
            {isRanked && <span className="rank-number">{rank}</span>}
            <div className="w-full h-full rounded-md overflow-hidden bg-gray-800 shadow-xl glow-card relative">
                <img src={`${IMAGE_BASE_URL}${movie.poster_path}`} className="w-full h-full object-cover" loading="lazy" alt=""/>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-3">
                    <h4 className="text-white text-xs font-bold mb-1">{movie.title || movie.name}</h4>
                    <div className="flex gap-2 mb-2"><div className="bg-white/20 p-1 rounded-full"><Play size={10} fill="white" className="text-white"/></div><div className="bg-white/20 p-1 rounded-full"><Plus size={10} className="text-white"/></div></div>
                    <div className="h-0.5 bg-gray-600 w-full"><div className="h-full bg-[#00A8E1]" style={{width: `${percent}%`}}></div></div>
                </div>
            </div>
        </div>
    );
};

const Row = ({ title, fetchUrl, data, variant, isPrimeOnly }) => {
  const [movies, setMovies] = useState(data || []);
  const rowRef = useRef(null);

  useEffect(() => { 
      if (!data && fetchUrl) fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(d => setMovies(d.results || [])); 
  }, [fetchUrl, data]);

  const slide = (offset) => { if(rowRef.current) rowRef.current.scrollBy({ left: offset, behavior: 'smooth' }); };

  if(movies.length === 0) return null;

  return (
    <div className="mb-8 pl-6 relative group/row">
      <h3 className={`text-xl font-bold text-white mb-3 ${isPrimeOnly ? 'text-[#00A8E1]' : 'text-white'}`}>{title}</h3>
      <div className="relative">
          <button onClick={()=>slide(-800)} className="absolute left-0 top-0 bottom-0 z-50 bg-black/50 w-12 hidden group-hover/row:flex items-center justify-center text-white"><ChevronLeft/></button>
          <div ref={rowRef} className="row-container scrollbar-hide">
             {movies.map((m, i) => <MovieCard key={m.id} movie={m} variant={variant} isPrimeOnly={isPrimeOnly} rank={i+1} />)}
          </div>
          <button onClick={()=>slide(800)} className="absolute right-0 top-0 bottom-0 z-50 bg-black/50 w-12 hidden group-hover/row:flex items-center justify-center text-white"><ChevronRight/></button>
      </div>
    </div>
  );
};

// --- PAGES ---
const Home = ({ isPrimeOnly }) => { 
  const { rows, loadMore } = useInfiniteRows('all', isPrimeOnly);
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
     try {
         const raw = JSON.parse(localStorage.getItem('vidFastProgress')) || {};
         const arr = Object.values(raw).sort((a,b) => b.last_updated - a.last_updated).map(i => ({...i, media_type: i.type, poster_path: i.poster_path || i.backdrop_path}));
         setHistory(arr);
     } catch(e) {}
  }, []);

  return (
    <>
      <Hero isPrimeOnly={isPrimeOnly} />
      <div className="-mt-16 relative z-20 pb-20">
        {history.length > 0 && <Row title="Continue Watching" data={history} isPrimeOnly={isPrimeOnly} />}
        {rows.map(row => <Row key={row.id} {...row} isPrimeOnly={isPrimeOnly} />)}
        <InfiniteScrollTrigger onIntersect={loadMore} />
      </div>
    </>
  ); 
};

// --- PLAYER (Simplified for brevity, keeps core iframe logic) ---
const Player = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const isTv = type === 'tv';
    const [season, setSeason] = useState(1);
    const [episode, setEpisode] = useState(1);
    
    // VidFast Source
    const src = isTv 
        ? `${VIDFAST_BASE}/tv/${id}/${season}/${episode}?autoPlay=true&theme=00A8E1`
        : `${VIDFAST_BASE}/movie/${id}?autoPlay=true&theme=00A8E1`;

    return (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col">
            <button onClick={()=>navigate(-1)} className="absolute top-4 left-4 z-50 bg-black/50 p-2 rounded-full text-white"><ArrowLeft/></button>
            <iframe src={src} className="w-full h-full border-none" allowFullScreen allow="autoplay; encrypted-media"></iframe>
        </div>
    );
};

// --- DETAIL (Placeholder for brevity) ---
const Detail = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    return <div className="pt-20 px-10 text-white"><button onClick={()=>navigate(-1)} className="mb-4 text-[#00A8E1]">Back</button><h1 className="text-3xl">Detail Page {type}/{id}</h1><button onClick={()=>navigate(`/watch/${type}/${id}`)} className="mt-4 bg-[#00A8E1] px-6 py-2 rounded font-bold text-white">Play Now</button></div>;
};

// --- APP ---
function App() {
  useConnectionOptimizer(); 
  return (
    <BrowserRouter>
      <GlobalStyles />
      <ScrollToTop />
      <div className="bg-[#00050D] min-h-screen text-white font-sans">
        <Routes>
          <Route path="/" element={<><Navbar isPrimeOnly={true} /><Home isPrimeOnly={true} /></>} />
          <Route path="/everything" element={<><Navbar isPrimeOnly={false} /><Home isPrimeOnly={false} /></>} />
          <Route path="/movies" element={<><Navbar isPrimeOnly={true} /><Home isPrimeOnly={true} /></>} /> {/* Reusing Home for brevity */}
          <Route path="/watch/:type/:id" element={<Player />} />
          <Route path="/detail/:type/:id" element={<><Navbar isPrimeOnly={true}/><Detail/></>} />
          <Route path="/sports" element={<><Navbar isPrimeOnly={true} /><SportsPage /></>} />
          <Route path="/watch/sport/iptv" element={<SportsPlayer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
