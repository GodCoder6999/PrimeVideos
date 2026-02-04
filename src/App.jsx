import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Search, Play, Info, Plus, ChevronRight, ChevronLeft, Download, Share2, CheckCircle2, Trophy, Signal, Clock, Ban, Eye, TrendingUp, Home as HomeIcon, Film, Tv, Activity, Gamepad2, Bell, User } from 'lucide-react';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
const VIDFAST_BASE = "https://vidfast.pro";
const LIVESPORT_BASE = ""; 

// --- COMPONENTS ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isActive ? 'text-blue-500' : 'text-gray-300 hover:text-white'}`}>
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled ? 'nav-glass py-2' : 'bg-transparent py-4'}`}>
      <div className="px-4 md:px-10 flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
             {/* Simulating the Primeshows Logo */}
             <div className="text-2xl font-black tracking-tighter italic bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                PRIMESHOWS
             </div>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-6">
            <NavItem to="/" icon={HomeIcon} label="Home" />
            <NavItem to="/movies" icon={Film} label="Movies" />
            <NavItem to="/tv" icon={Tv} label="TV Shows" />
            <NavItem to="/sports" icon={Activity} label="Sports" />
          </div>
        </div>

        {/* Right Section: Search & Profile */}
        <div className="flex items-center gap-5">
          {/* Search Bar */}
          <div className="hidden md:flex relative items-center bg-[#1a1d26]/80 border border-white/10 rounded-full px-4 py-2 w-64 focus-within:border-blue-500/50 transition-colors">
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Find movies, TV..." 
              className="bg-transparent border-none outline-none text-xs text-white ml-2 w-full placeholder-gray-500"
              onKeyDown={(e) => { if(e.key === 'Enter') navigate(`/search?q=${e.target.value}`) }}
            />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-4 text-gray-300">
            <div className="relative cursor-pointer hover:text-white">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#00040a]"></span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 p-[2px] cursor-pointer">
               <div className="w-full h-full rounded-full bg-[#00040a] flex items-center justify-center">
                  <User size={16} className="text-blue-400" />
               </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch Trending Content
  useEffect(() => {
    fetch(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`)
      .then(res => res.json())
      .then(data => {
        const results = data.results.filter(m => m.backdrop_path); // Ensure image exists
        setMovies(results);
        setFeatured(results[0]);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="h-screen w-full bg-[#00040a] animate-pulse" />;

  // Handler to switch the main featured movie when clicking sidebar items
  const handleSidebarClick = (movie) => {
    setFeatured(movie);
  };

  return (
    <div className="relative w-full h-[85vh] md:h-screen overflow-hidden group">
      {/* Background Image */}
      <div key={featured?.id} className="absolute inset-0 animate-in">
        <img 
            src={`${IMAGE_ORIGINAL_URL}${featured?.backdrop_path}`} 
            className="w-full h-full object-cover opacity-60" 
            alt={featured?.title || featured?.name} 
        />
        {/* Gradients to fade into background color */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#00040a] via-[#00040a]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#00040a] via-[#00040a]/60 to-transparent" />
      </div>

      {/* Main Content (Left Side) */}
      <div className="absolute bottom-20 left-4 md:left-12 max-w-2xl z-30">
        <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                {featured?.media_type === 'tv' ? 'TV Series' : 'Movie'}
            </span>
            <span className="bg-[#001845]/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10">
                <Trophy size={10} className="text-yellow-400" /> {featured?.vote_average?.toFixed(1)}
            </span>
            <span className="bg-[#001845]/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                {featured?.release_date?.split('-')[0] || featured?.first_air_date?.split('-')[0] || "2024"}
            </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 leading-tight text-shadow-lg drop-shadow-xl">
            {featured?.title || featured?.name}
        </h1>

        <p className="text-gray-300 text-sm md:text-base line-clamp-3 mb-6 max-w-xl leading-relaxed drop-shadow-md">
            {featured?.overview}
        </p>

        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/watch/${featured?.media_type || 'movie'}/${featured?.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-105">
                <Play fill="currentColor" size={16} /> Play Now
            </button>
            <button onClick={() => navigate(`/detail/${featured?.media_type || 'movie'}/${featured?.id}`)} className="bg-[#001845]/40 hover:bg-[#001845]/60 border border-blue-500/30 backdrop-blur-md text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all hover:scale-105">
                <Info size={18} /> More Info
            </button>
        </div>
      </div>

      {/* Sidebar List (Right Side) */}
      <div className="hidden lg:flex flex-col absolute right-8 bottom-12 z-30 gap-4">
          {movies.slice(1, 6).map((movie) => (
              <div 
                key={movie.id} 
                onClick={() => handleSidebarClick(movie)}
                className={`
                    relative w-20 h-28 md:w-24 md:h-36 rounded-xl overflow-hidden cursor-pointer 
                    hero-side-card border-2 
                    ${featured?.id === movie.id ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'border-transparent opacity-70 hover:opacity-100'}
                `}
              >
                  <img 
                    src={`${IMAGE_BASE_URL}${movie.poster_path}`} 
                    className="w-full h-full object-cover" 
                    alt="" 
                  />
                  {/* Dark overlay on inactive items */}
                  {featured?.id !== movie.id && <div className="absolute inset-0 bg-black/40 hover:bg-transparent transition-colors" />}
              </div>
          ))}
      </div>
    </div>
  );
};

const MovieCard = ({ movie, variant, index }) => {
    const navigate = useNavigate();
    const isRanked = variant === 'ranked';
    
    // Ranked Layout: Card needs margin to make room for number
    const cardClass = isRanked 
        ? "w-[160px] md:w-[180px] h-[240px] md:h-[270px] relative ml-8 flex-shrink-0"
        : "w-[160px] md:w-[200px] h-[240px] md:h-[300px] relative flex-shrink-0";

    return (
        <div 
            className={`${cardClass} group cursor-pointer`}
            onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)}
        >
            {/* Rank Number Behind */}
            {isRanked && (
                <span className="rank-number">
                    {index + 1}
                </span>
            )}

            {/* Card Image Container */}
            <div className="w-full h-full rounded-xl overflow-hidden relative border border-white/5 bg-[#1a1d26] movie-card group-hover:border-blue-500/50">
                <img 
                    src={`${IMAGE_BASE_URL}${movie.poster_path}`} 
                    className="w-full h-full object-cover" 
                    alt={movie.title} 
                    loading="lazy"
                />
                
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Rating Badge (Always visible or on hover) */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
                    <span className="text-yellow-400">★</span> {movie.vote_average?.toFixed(1)}
                </div>

                {/* Play Button on Hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <Play fill="black" className="ml-1 text-black" size={24} />
                    </div>
                </div>
            </div>
            
            {/* Title below card (Standard only) */}
            {!isRanked && (
                <div className="mt-2 px-1">
                    <h3 className="text-sm font-bold text-gray-200 truncate group-hover:text-blue-400 transition-colors">{movie.title || movie.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{movie.release_date?.split('-')[0] || "2024"}</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span>Movie</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const Row = ({ title, fetchUrl, variant = 'standard' }) => {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    fetch(`${BASE_URL}${fetchUrl}`)
      .then(res => res.json())
      .then(data => setMovies(data.results || []))
      .catch(err => console.error(err));
  }, [fetchUrl]);

  if(movies.length === 0) return null;

  return (
    <div className="pl-4 md:pl-10 mb-8 relative z-20">
      <div className="flex items-end justify-between mb-4 pr-10">
          <div className="flex items-center gap-4">
             {variant === 'ranked' ? (
                 <div className="flex flex-col">
                     <h2 className="text-6xl font-black text-blue-500 leading-none tracking-tighter">TOP 10</h2>
                     <span className="text-white font-bold tracking-widest text-sm ml-1">MOVIES TODAY</span>
                 </div>
             ) : (
                 <>
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h3>
                    <div className="h-6 w-[1px] bg-blue-500/50"></div>
                    <a href="#" className="text-blue-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">View All</a>
                 </>
             )}
          </div>
          
          {/* Navigation Arrows (Visual only for now) */}
          <div className="hidden md:flex gap-2">
              <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"><ChevronLeft size={20} /></button>
              <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"><ChevronRight size={20} /></button>
          </div>
      </div>

      <div className="row-container scrollbar-hide">
        {movies.map((movie, index) => (
           (movie.poster_path) && 
           <MovieCard key={movie.id} movie={movie} variant={variant} index={index} />
        ))}
      </div>
    </div>
  );
};

// --- PAGES ---
const Home = () => {
    return (
        <div className="pb-20">
            <Hero />
            <div className="-mt-16 relative z-20 space-y-4">
                <Row title="Now Playing" fetchUrl={`/movie/now_playing?api_key=${TMDB_API_KEY}`} />
                <Row title="Top Rated" fetchUrl={`/movie/top_rated?api_key=${TMDB_API_KEY}`} variant="ranked" />
                <Row title="Trending TV" fetchUrl={`/trending/tv/week?api_key=${TMDB_API_KEY}`} />
                <Row title="Action Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`} />
                <Row title="Comedy Hits" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35`} />
            </div>
        </div>
    );
};

// Placeholder components for routing completeness
const PlaceholderPage = ({ title }) => (
    <div className="pt-32 px-10 min-h-screen">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-gray-400">Content coming soon...</p>
    </div>
);

// Reuse the Player/Detail components from previous, simplified for brevity here (or keep original ones)
// For the sake of the "Home Page" task, I will include the minimal router wrapper.

function App() {
  return (
    <BrowserRouter>
      <div className="bg-[#00040a] min-h-screen text-white selection:bg-blue-500 selection:text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<PlaceholderPage title="Movies" />} />
          <Route path="/tv" element={<PlaceholderPage title="TV Shows" />} />
          <Route path="/sports" element={<PlaceholderPage title="Live Sports" />} />
          {/* Add other routes (Detail, Player) as needed from previous code */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
