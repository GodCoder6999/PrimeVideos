import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, ThumbsUp, Ban, ChevronDown, Grip, Loader, List, ArrowLeft, X, Volume2, VolumeX } from 'lucide-react';
import './App.css';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
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
    { type: 'movie', label: "Critical Acclaim", sort: 'vote_average.desc', variant: 'standard' },
    { type: 'movie', label: "Family Fun Night", genre: 10751, variant: 'standard' },
    { type: 'movie', label: "Mind-Bending Movies", genre: 9648, variant: 'standard' },
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
      let base = `/discover/${category.type || type}?api_key=${TMDB_API_KEY}&page=${pageNum}`;
      if (isPrimeOnly) base += `&with_watch_providers=${PRIME_PROVIDER_IDS}&watch_region=${PRIME_REGION}`;
      
      if (category.variant === 'ranked') base += `&sort_by=popularity.desc`;
      else if (category.genre) base += `&with_genres=${category.genre}&sort_by=popularity.desc`;
      else base += `&sort_by=${category.sort || 'popularity.desc'}`;
      
      return base;
  };

  useEffect(() => {
      const initialDeck = shuffleDeck([...CATEGORY_DECK]);
      setDeck(initialDeck);
      setRows([
          { id: 'hero', title: isPrimeOnly ? "Recommended for you" : "Trending", fetchUrl: getUrl({ type, variant: 'standard' }, 1), variant: 'standard', itemType: type },
          { id: 'top10', title: "Top 10", fetchUrl: getUrl({ type, variant: 'ranked' }, 1), variant: 'ranked', itemType: type },
      ]);
  }, [type, isPrimeOnly]);

  const loadMore = useCallback(() => {
    if (loading || deck.length === 0) return;
    setLoading(true);
    const nextBatch = [];
    for(let i=0; i<2; i++) {
        const idx = (deckIndex + i) % deck.length;
        nextBatch.push({
            id: `row-${Date.now()}-${i}`,
            title: deck[idx].label,
            fetchUrl: getUrl(deck[idx], Math.floor(deckIndex / deck.length) + 1), 
            variant: deck[idx].variant,
            itemType: deck[idx].type
        });
    }
    setTimeout(() => { 
        setRows(prev => [...prev, ...nextBatch]); 
        setDeckIndex(prev => prev + 2); 
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
  return <div ref={triggerRef} className="h-20 w-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"></div></div>;
};

// --- COMPONENTS ---
const Navbar = ({ isPrimeOnly }) => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  const handleSearch = (e) => { 
      e.preventDefault(); 
      if (query.trim()) navigate(isPrimeOnly ? `/search?q=${query}` : `/everything/search?q=${query}`);
  };

  return (
    <nav className="fixed top-0 w-full z-[100] bg-[#00050D] border-b border-[#1f2a33] h-[72px] flex items-center justify-between px-6">
        <Link to={isPrimeOnly ? "/" : "/everything"} className={`font-extrabold text-xl ${theme.color}`}>{theme.logoText}</Link>
        <form onSubmit={handleSearch} className="bg-[#19222b] border border-white/10 px-3 py-1.5 rounded-md flex items-center w-[300px]">
            <Search size={18} className="text-gray-400" />
            <input className="bg-transparent border-none outline-none text-white text-sm ml-2 w-full" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
    </nav>
  );
};

const Hero = ({ isPrimeOnly }) => {
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { 
      fetch(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => setMovie(data.results[0])); 
  }, []);

  if (!movie) return <div className="h-[80vh] w-full bg-[#00050D]" />;

  return (
    <div className="relative w-full h-[80vh] overflow-hidden">
      <img src={`${IMAGE_ORIGINAL_URL}${movie.backdrop_path}`} className="w-full h-full object-cover opacity-60" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00050D] via-transparent to-transparent" />
      <div className="absolute bottom-[20%] left-10 max-w-[600px]">
        <h1 className="text-5xl font-extrabold text-white mb-4">{movie.title || movie.name}</h1>
        <p className="text-lg text-white mb-6 line-clamp-3">{movie.overview}</p>
        <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className={`${theme.bg} text-white h-14 px-8 rounded-md font-bold text-lg flex items-center gap-3 hover:scale-105 transition`}>
            <Play fill="white" size={24} /> Play
        </button>
      </div>
    </div>
  );
};

const MovieCard = ({ movie, variant, itemType, isPrimeOnly }) => {
  const navigate = useNavigate();
  const imageUrl = variant === 'vertical' || variant === 'ranked' ? movie.poster_path : movie.backdrop_path;
  const sizeClass = variant === 'vertical' || variant === 'ranked' ? 'w-[160px] h-[240px]' : 'w-[280px] h-[160px]';

  return (
    <div onClick={() => navigate(`/detail/${movie.media_type || itemType || 'movie'}/${movie.id}`)} className={`flex-shrink-0 cursor-pointer transition transform hover:scale-110 ${sizeClass} relative rounded-md overflow-hidden`}>
       <img src={`${IMAGE_BASE_URL}${imageUrl}`} className="w-full h-full object-cover" alt="" />
       {isPrimeOnly && <div className="absolute top-2 left-2 bg-[#00A8E1] text-white text-[10px] font-bold px-1 rounded">PRIME</div>}
    </div>
  );
};

const Row = ({ title, fetchUrl, variant, itemType, isPrimeOnly }) => {
  const [movies, setMovies] = useState([]);
  const theme = getTheme(isPrimeOnly);

  useEffect(() => { fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(data => setMovies(data.results || [])); }, [fetchUrl]);

  return (
    <div className="mb-8 pl-6">
      <h3 className={`text-xl font-bold text-white mb-3 ${theme.color}`}>{title}</h3>
      <div className="flex gap-4 overflow-x-scroll scrollbar-hide pb-4">
        {movies.map(movie => <MovieCard key={movie.id} movie={movie} variant={variant} itemType={itemType} isPrimeOnly={isPrimeOnly} />)}
      </div>
    </div>
  );
};

const MovieDetail = () => {
  const { type, id } = useParams();
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`).then(res => res.json()).then(setMovie); }, [type, id]);

  if (!movie) return null;

  return (
    <div className="min-h-screen bg-[#00050D] text-white pt-[80px] px-10">
      <div className="flex gap-10">
          <img src={`${IMAGE_BASE_URL}${movie.poster_path}`} className="w-[300px] rounded-lg shadow-2xl" alt="" />
          <div>
              <h1 className="text-5xl font-bold mb-4">{movie.title || movie.name}</h1>
              <p className="text-xl text-gray-400 mb-8">{movie.overview}</p>
              <button onClick={() => navigate(`/watch/${type}/${id}`)} className="bg-[#00A8E1] text-white px-8 py-4 rounded-md font-bold text-xl hover:bg-[#008ebf]">Watch Now</button>
          </div>
      </div>
    </div>
  );
};

// --- UPDATED PLAYER (CDN VERSION) ---
const Player = () => { 
  const { type, id } = useParams(); 
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [streamData, setStreamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // Keep track of HLS instance
  const navigate = useNavigate();

  // 1. Fetch Stream from API
  useEffect(() => {
      const fetchStream = async () => {
          setLoading(true); setError(null);
          
          if (hlsRef.current) {
              hlsRef.current.destroy(); // Clean up old HLS
              hlsRef.current = null;
          }

          try {
              const res = await fetch(`/api/stream?id=${id}&type=${type}&season=${season}&episode=${episode}`);
              const data = await res.json();
              if (!res.ok) throw new Error("Stream API Error");
              setStreamData(data);
          } catch (err) {
              console.error(err);
              setError("Failed to load stream. Please reload.");
          } finally {
              setLoading(false);
          }
      };
      fetchStream();
  }, [id, type, season, episode]);

  // 2. Play Stream (Using window.Hls from CDN)
  useEffect(() => {
      if (!streamData || !videoRef.current) return;

      if (streamData.type === 'hls' && window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls(); // Use CDN Global Hls
          hlsRef.current = hls;
          hls.loadSource(streamData.url);
          hls.attachMedia(videoRef.current);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current.play().catch(() => {});
          });
      } else if (streamData.type === 'hls' && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = streamData.url; // Safari
          videoRef.current.play();
      }
  }, [streamData]);

  return (
    <div className="fixed inset-0 bg-black z-[200] flex items-center justify-center">
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[210] text-white bg-black/50 p-3 rounded-full"><ArrowLeft /></button>
        
        {loading && <div className="text-white animate-pulse">Loading Stream...</div>}
        {error && <div className="text-red-500">{error}</div>}

        {!loading && !error && streamData?.type === 'hls' && (
            <video ref={videoRef} className="w-full h-full" controls autoPlay />
        )}

        {/* Fallback Iframe */}
        {!loading && !error && streamData?.type === 'iframe' && (
            <iframe src={streamData.url} className="w-full h-full border-none" allowFullScreen allow="autoplay; encrypted-media"></iframe>
        )}
    </div>
  ); 
};

// --- ROUTING ---
const Home = ({ isPrimeOnly }) => { const { rows, loadMore } = useInfiniteRows('movie', isPrimeOnly); return <><Hero isPrimeOnly={isPrimeOnly} /><div className="-mt-10 relative z-20 pb-20">{rows.map(row => <Row key={row.id} title={row.title} fetchUrl={row.fetchUrl} variant={row.variant} itemType={row.itemType} isPrimeOnly={isPrimeOnly} />)}<InfiniteScrollTrigger onIntersect={loadMore} /></div></>; };

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="bg-[#00050D] min-h-screen text-white font-sans">
        <Routes>
          <Route path="/" element={<><Navbar isPrimeOnly={true} /><Home isPrimeOnly={true} /></>} />
          <Route path="/everything" element={<><Navbar isPrimeOnly={false} /><Home isPrimeOnly={false} /></>} />
          <Route path="/detail/:type/:id" element={<><Navbar isPrimeOnly={true} /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;