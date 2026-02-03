import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, User, Play, Info, Plus, ChevronRight, X, ArrowLeft, Download, Share2, MessageCircle, Check, Loader, Ban } from 'lucide-react';
import Hls from 'hls.js'; 
import './App.css';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

const FALLBACK_MOVIE = {
  backdrop_path: "/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",
  title: "The Dark Knight",
  overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.",
  id: 155,
  media_type: "movie",
  vote_average: 8.5,
  release_date: "2008-07-14"
};

// --- HELPERS ---
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// --- COMPONENTS ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const NavLink = ({ to, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`text-gray-300 hover:text-white text-[15px] font-semibold transition-colors px-1 py-4 border-b-2 ${isActive ? 'border-white text-white' : 'border-transparent'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#1a242f]' : 'nav-gradient'}`}>
      <div className="flex items-center justify-between px-8 md:px-12 h-[72px]">
        {/* Left: Logo & Links */}
        <div className="flex items-center gap-10">
          <Link to="/" className="text-white font-extrabold text-xl tracking-tighter">prime video</Link>
          <div className="hidden md:flex gap-6">
            <NavLink to="/" label="Home" />
            <NavLink to="/store" label="Store" />
            <NavLink to="/live" label="Live TV" />
            <NavLink to="/categories" label="Categories" />
            <NavLink to="/mystuff" label="My Stuff" />
          </div>
        </div>

        {/* Right: Search & Profile */}
        <div className="flex items-center gap-6">
          <div className={`flex items-center border border-transparent transition-all duration-300 ${searchActive || query ? 'bg-[rgba(0,0,0,0.5)] border-white/50 px-2 py-1 rounded' : ''}`}>
             <Search size={20} className="text-gray-300 cursor-pointer" onClick={() => setSearchActive(true)} />
             <form onSubmit={handleSearch}>
               <input 
                 className={`bg-transparent border-none outline-none text-white text-sm ml-2 transition-all duration-300 ${searchActive || query ? 'w-48' : 'w-0'}`}
                 placeholder="Search"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 onBlur={() => !query && setSearchActive(false)}
               />
             </form>
          </div>
          
          <div className="flex items-center gap-2 cursor-pointer opacity-90 hover:opacity-100">
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
              <User size={18} className="text-gray-300" />
            </div>
            <span className="text-sm font-semibold text-gray-300 hidden sm:block">User</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}&language=en-US`)
      .then(res => res.json())
      .then(data => {
        // SAFETY CHECK: Ensure results exist before accessing
        if (data.results && data.results.length > 0) {
            const random = data.results[Math.floor(Math.random() * data.results.length)];
            setMovie(random);
        } else {
            console.warn("API Error or No Results", data);
            setMovie(FALLBACK_MOVIE);
        }
      })
      .catch((err) => {
          console.error("Hero Fetch Error:", err);
          setMovie(FALLBACK_MOVIE);
      });
  }, []);

  if (!movie) return <div className="h-[85vh] w-full bg-[#0f171e] animate-pulse" />;

  return (
    <div className="relative w-full h-[85vh] md:h-[95vh]">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} 
          alt={movie.title} 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 hero-vignette" />

      {/* Content */}
      <div className="absolute top-[30%] left-[5%] md:left-[60px] max-w-[600px] z-10">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight drop-shadow-lg">
          {movie.title || movie.name}
        </h1>
        
        {/* Metadata Badges */}
        <div className="flex items-center gap-4 text-[#8197a4] font-semibold text-sm mb-6">
           <span className="text-[#00A8E1] font-bold tracking-widest uppercase">Included with Prime</span>
           <span className="border border-gray-500 px-1 rounded text-xs">UHD</span>
           <span className="border border-gray-500 px-1 rounded text-xs">HDR</span>
           <span>2024</span>
        </div>

        <p className="text-lg text-gray-200 line-clamp-3 mb-8 drop-shadow-md">
          {movie.overview}
        </p>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/watch/${movie.media_type === 'tv' ? 'tv' : 'movie'}/${movie.id}`)}
            className="flex items-center gap-3 bg-[#00A8E1] hover:bg-[#008ebf] text-white px-8 py-4 rounded-full font-bold text-lg transition transform hover:scale-105"
          >
            <Play fill="white" size={24} /> Play
          </button>
          
          <button 
            onClick={() => navigate(`/detail/${movie.media_type === 'tv' ? 'tv' : 'movie'}/${movie.id}`)}
            className="flex items-center gap-3 bg-[#3d464f]/60 hover:bg-[#4d5863]/80 backdrop-blur-sm text-white px-8 py-4 rounded-full font-bold text-lg transition"
          >
            <Plus size={24} /> Details
          </button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ title, fetchUrl, isVertical = false }) => {
  const [movies, setMovies] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}${fetchUrl}`)
      .then(res => res.json())
      .then(data => setMovies(data.results || []))
      .catch(err => console.error(err));
  }, [fetchUrl]);

  return (
    <div className="mb-8 pl-8 md:pl-12">
      <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-[#00A8E1]">Prime</span> {title}
      </h3>
      
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8">
        {movies.map(movie => (
          (movie.backdrop_path || (isVertical && movie.poster_path)) && (
            <div 
              key={movie.id} 
              className={`relative flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-20 group
                ${isVertical ? 'w-[160px] md:w-[200px]' : 'w-[260px] md:w-[300px]'}`}
              onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)}
            >
              <img 
                src={`${IMAGE_BASE_URL}${isVertical ? movie.poster_path : movie.backdrop_path}`} 
                alt={movie.name}
                className="w-full h-full object-cover rounded-lg shadow-lg border-2 border-transparent group-hover:border-gray-100" 
              />
              
              {!isVertical && (
                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                   <h4 className="text-white font-bold text-sm truncate">{movie.title || movie.name}</h4>
                   <div className="flex items-center gap-2 mt-1">
                      <Play fill="white" size={12} className="text-white"/>
                      <span className="text-[10px] text-gray-300">Watch Now</span>
                   </div>
                </div>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const MovieDetail = () => {
  const { type, id } = useParams();
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`)
      .then(res => res.json())
      .then(data => setMovie(data))
      .catch(err => console.error(err));
  }, [type, id]);

  if (!movie) return <div className="h-screen w-full bg-[#0f171e]" />;

  return (
    <div className="min-h-screen bg-[#0f171e] relative">
      {/* Backdrop */}
      <div className="fixed inset-0 h-screen z-0">
         <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} className="w-full h-full object-cover opacity-60" alt="" />
         <div className="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-[#0f171e]/80 to-transparent" />
         <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/50 to-transparent" />
      </div>

      <div className="relative z-10 pt-[120px] px-8 md:px-16 max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-4">{movie.title || movie.name}</h1>
        
        <div className="flex items-center gap-4 text-gray-400 font-semibold mb-8">
           {movie.vote_average && <span className="text-white">IMDb {movie.vote_average.toFixed(1)}</span>}
           <span>{movie.release_date?.split('-')[0]}</span>
           <span className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded">X-Ray</span>
           <span className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded">HDR</span>
           <span className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded">UHD</span>
        </div>

        <div className="flex gap-4 mb-8">
           <button onClick={() => navigate(`/watch/${type}/${id}`)} className="bg-[#00A8E1] hover:bg-[#008ebf] text-white rounded-full w-16 h-16 flex items-center justify-center transition hover:scale-110">
              <Play fill="white" size={32} className="ml-1"/>
           </button>
           
           <div className="flex gap-4">
              <ActionButton icon={<Plus size={24} />} label="Watchlist" />
              <ActionButton icon={<Download size={24} />} label="Download" />
              <ActionButton icon={<Share2 size={24} />} label="Share" />
           </div>
        </div>

        <p className="text-lg text-gray-300 max-w-2xl leading-relaxed mb-12">
           {movie.overview}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-gray-400">
           <div>
              <span className="block text-gray-500 font-bold mb-1">Genres</span>
              <span className="text-white">{movie.genres?.map(g => g.name).join(", ")}</span>
           </div>
           <div>
              <span className="block text-gray-500 font-bold mb-1">Studio</span>
              <span className="text-white">{movie.production_companies?.[0]?.name}</span>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ icon, label }) => (
  <button className="flex flex-col items-center gap-1 group">
    <div className="w-14 h-14 rounded-full border-2 border-gray-500 group-hover:bg-white/10 group-hover:border-white transition flex items-center justify-center text-gray-300 group-hover:text-white">
      {icon}
    </div>
    <span className="text-xs text-gray-400 font-semibold group-hover:text-white">{label}</span>
  </button>
);

// --- CUSTOM PLAYER COMPONENT (HLS) ---
const Player = () => { 
  const { type, id } = useParams(); 
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
      const fetchStream = async () => {
          setLoading(true);
          setError(null);
          try {
              const apiUrl = `/api/stream?id=${id}&type=${type}`;
              const res = await fetch(apiUrl);
              const data = await res.json();

              if (res.ok && data.streamUrl) {
                  setStreamUrl(data.streamUrl);
              } else {
                  throw new Error(data.details || "Stream not found");
              }
          } catch (err) {
              console.error(err);
              setError(err.message); 
          } finally {
              setLoading(false);
          }
      };
      fetchStream();
  }, [id, type]);

  useEffect(() => {
      if (!streamUrl || !videoRef.current) return;
      if (hlsRef.current) hlsRef.current.destroy();

      if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current.play().catch(e => console.log(e));
          });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = streamUrl;
          videoRef.current.play();
      }
      return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [streamUrl]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[120] bg-black/50 p-2 rounded-full text-white hover:bg-[#00A8E1] transition-colors">
          <ArrowLeft size={24} />
        </button>
        
        {loading && (
          <div className="text-[#00A8E1] flex flex-col items-center">
            <Loader className="animate-spin mb-4" size={48} />
            <p className="font-bold text-lg">Loading Stream...</p>
          </div>
        )}
        
        {error && (
          <div className="text-red-500 flex flex-col items-center">
            <Ban size={48} className="mb-4" />
            <p className="font-bold text-xl mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
            <video ref={videoRef} className="w-full h-full object-contain focus:outline-none" controls autoPlay crossOrigin="anonymous" />
        )}
    </div>
  ); 
};

const SearchResults = () => {
  const [movies, setMovies] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search).get('q');

  useEffect(() => {
    if (query) {
      fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}`)
        .then(res => res.json())
        .then(data => setMovies(data.results || []));
    }
  }, [query]);

  return (
    <div className="pt-24 px-8 min-h-screen">
      <h2 className="text-2xl font-bold text-white mb-6">Results for "{query}"</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {movies.map(movie => (
           movie.poster_path && (
            <div key={movie.id} onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="cursor-pointer hover:scale-105 transition-transform duration-200">
               <img src={`${IMAGE_BASE_URL}${movie.poster_path}`} className="w-full rounded-md" alt={movie.title} />
            </div>
           )
        ))}
      </div>
    </div>
  );
};

// --- APP ---
const Home = () => (
  <>
    <Hero />
    <div className="-mt-32 relative z-20">
      <Row title="Trending Movies" fetchUrl={`/trending/movie/day?api_key=${TMDB_API_KEY}`} />
      <Row title="Top Rated" fetchUrl={`/movie/top_rated?api_key=${TMDB_API_KEY}`} isVertical />
      <Row title="Action Thrillers" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`} />
      <Row title="Comedy Hits" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35`} />
      <Row title="Sci-Fi Adventures" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878`} />
    </div>
  </>
);

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="bg-[#0f171e] min-h-screen text-white">
        <Routes>
          <Route path="/" element={<><Navbar /><Home /></>} />
          <Route path="/search" element={<><Navbar /><SearchResults /></>} />
          <Route path="/detail/:type/:id" element={<><Navbar /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
          <Route path="/store" element={<><Navbar /><div className="pt-32 px-12 text-white">Store Page</div></>} />
          <Route path="/live" element={<><Navbar /><div className="pt-32 px-12 text-white">Live TV Page</div></>} />
          <Route path="/categories" element={<><Navbar /><div className="pt-32 px-12 text-white">Categories Page</div></>} />
          <Route path="/mystuff" element={<><Navbar /><div className="pt-32 px-12 text-white">My Stuff Page</div></>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;