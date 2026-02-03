import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, User, Play, Info, Plus, ChevronRight, X, ArrowLeft, Download, Share2, Check, Loader, Ban } from 'lucide-react';
import Hls from 'hls.js'; 
import './App.css';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// --- COMPONENTS ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#1a242f]' : 'nav-gradient'}`}>
      <div className="flex items-center justify-between px-8 md:px-12 h-[72px]">
        <div className="flex items-center gap-10">
          <Link to="/" className="text-white font-extrabold text-xl tracking-tighter">prime video</Link>
          <div className="hidden md:flex gap-6 text-sm font-bold text-gray-300">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/store" className="hover:text-white">Store</Link>
            <Link to="/live" className="hover:text-white">Live TV</Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <form onSubmit={handleSearch} className="relative">
             <Search size={18} className="absolute left-2 top-1.5 text-gray-400" />
             <input className="bg-[#1a242f] border border-gray-600 rounded text-sm text-white pl-8 pr-2 py-1 focus:border-[#00A8E1] outline-none" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
          </form>
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center"><User size={18} className="text-gray-300" /></div>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  const [movie, setMovie] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`)
      .then(res => res.json())
      .then(data => setMovie(data.results[0]))
      .catch(() => {});
  }, []);

  if (!movie) return <div className="h-[85vh] w-full bg-[#0f171e]" />;

  return (
    <div className="relative w-full h-[85vh]">
      <div className="absolute inset-0">
        <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} className="w-full h-full object-cover" alt="" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-transparent to-transparent" />
      
      <div className="absolute top-[30%] left-[5%] max-w-[600px] z-10">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{movie.title || movie.name}</h1>
        <div className="flex items-center gap-4 text-gray-300 font-bold text-sm mb-6">
           <span className="text-[#00A8E1]">Included with Prime</span>
           <span className="bg-gray-700 px-1 rounded">UHD</span>
        </div>
        <p className="text-lg text-gray-200 line-clamp-3 mb-8">{movie.overview}</p>
        <div className="flex gap-4">
          <button onClick={() => navigate(`/watch/${movie.media_type || 'movie'}/${movie.id}`)} className="bg-[#00A8E1] hover:bg-[#008ebf] text-white px-8 py-3 rounded font-bold text-lg flex items-center gap-2"><Play fill="white" size={20} /> Play</button>
          <button onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="bg-gray-600/60 hover:bg-gray-600/80 text-white px-8 py-3 rounded font-bold text-lg flex items-center gap-2"><Info size={20} /> Details</button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ title, fetchUrl }) => {
  const [movies, setMovies] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}${fetchUrl}`).then(res => res.json()).then(data => setMovies(data.results || []));
  }, [fetchUrl]);

  return (
    <div className="mb-8 pl-8">
      <h3 className="text-xl font-bold text-white mb-4"><span className="text-[#00A8E1]">Prime</span> {title}</h3>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
        {movies.map(movie => movie.backdrop_path && (
            <div key={movie.id} onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)} className="min-w-[280px] cursor-pointer hover:scale-105 transition-transform relative group">
              <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} className="w-full rounded-lg" alt="" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><Play fill="white" className="text-white" size={32} /></div>
            </div>
        ))}
      </div>
    </div>
  );
};

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
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[120] bg-black/50 p-2 rounded-full text-white hover:bg-[#00A8E1]"><ArrowLeft /></button>
        
        {loading && <div className="text-[#00A8E1] flex flex-col items-center"><Loader className="animate-spin mb-2" size={40} /><p>Loading Stream...</p></div>}
        
        {error && <div className="text-red-500 flex flex-col items-center"><Ban size={40} className="mb-2" /><p>{error}</p><button onClick={() => window.location.reload()} className="mt-4 bg-white text-black px-4 py-2 rounded font-bold">Retry</button></div>}

        {!loading && !error && (
            <video ref={videoRef} className="w-full h-full" controls autoPlay crossOrigin="anonymous" />
        )}
    </div>
  ); 
};

// --- APP ---
const HomePage = () => (
  <>
    <Hero />
    <div className="-mt-32 relative z-20">
      <Row title="Trending Movies" fetchUrl={`/trending/movie/day?api_key=${TMDB_API_KEY}`} />
      <Row title="Top Rated" fetchUrl={`/movie/top_rated?api_key=${TMDB_API_KEY}`} />
    </div>
  </>
);

const MovieDetail = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    // Simplified Detail Component for brevity
    return <div className="text-white pt-32 px-10"><h1>Detail Page {id}</h1><button onClick={() => navigate(`/watch/${type}/${id}`)} className="bg-[#00A8E1] px-6 py-2 rounded mt-4">Play</button></div>;
};

const SearchResults = () => <div className="text-white pt-32 px-10">Search Results</div>;

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="bg-[#0f171e] min-h-screen text-white font-sans">
        <Routes>
          <Route path="/" element={<><Navbar /><HomePage /></>} />
          <Route path="/search" element={<><Navbar /><SearchResults /></>} />
          <Route path="/detail/:type/:id" element={<><Navbar /><MovieDetail /></>} />
          <Route path="/watch/:type/:id" element={<Player />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
