import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { Search, Play, Info, Bell, User, Home as HomeIcon, Film, Tv, Activity, ChevronRight, ChevronLeft, Trophy } from 'lucide-react';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

// --- COMPONENTS ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled ? 'nav-glass py-2' : 'bg-transparent py-4'}`}>
      <div className="px-4 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
             <div className="text-2xl font-black tracking-tighter italic bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                PRIMESHOWS
             </div>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-sm font-medium text-blue-500"><HomeIcon size={18} /> Home</Link>
            <Link to="/movies" className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white"><Film size={18} /> Movies</Link>
            <Link to="/tv" className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white"><Tv size={18} /> TV Shows</Link>
            <Link to="/sports" className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white"><Activity size={18} /> Sports</Link>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden md:flex relative items-center bg-[#1a1d26]/80 border border-white/10 rounded-full px-4 py-2 w-64 focus-within:border-blue-500/50 transition-colors">
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Find movies..." 
              className="bg-transparent border-none outline-none text-xs text-white ml-2 w-full placeholder-gray-500"
              onKeyDown={(e) => { if(e.key === 'Enter') navigate(`/search?q=${e.target.value}`) }}
            />
          </div>
          <div className="flex items-center gap-4 text-gray-300">
            <Bell size={20} className="hover:text-white cursor-pointer" />
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
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`)
      .then(res => res.json())
      .then(data => {
        const results = data.results.filter(m => m.backdrop_path);
        setMovies(results);
        setFeatured(results[0]);
      });
  }, []);

  if (!featured) return <div className="h-screen w-full bg-[#00040a] animate-pulse" />;

  return (
    <div className="relative w-full h-[90vh] md:h-screen overflow-hidden flex flex-col justify-end group">
      {/* Background */}
      <div key={featured.id} className="absolute inset-0 animate-in">
        <img 
            src={`${IMAGE_ORIGINAL_URL}${featured.backdrop_path}`} 
            className="w-full h-full object-cover opacity-60" 
            alt={featured.title} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#00040a] via-[#00040a]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#00040a] via-[#00040a]/50 to-transparent" />
      </div>

      {/* Content Area */}
      <div className="relative z-30 w-full px-4 md:px-12 pb-16 flex flex-col lg:flex-row items-end justify-between gap-8">
        
        {/* Left: Text Info */}
        <div className="max-w-3xl mb-6 lg:mb-0">
            <div className="flex items-center gap-2 mb-3">
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {featured.media_type === 'tv' ? 'TV Series' : 'Movie'}
                </span>
                <span className="bg-[#001845]/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10">
                    <Trophy size={10} className="text-yellow-400" /> {featured.vote_average?.toFixed(1)}
                </span>
            </div>

            <h1 className="text-4xl md:text-7xl font-black text-white mb-4 leading-tight text-shadow drop-shadow-xl">
                {featured.title || featured.name}
            </h1>

            <p className="text-gray-300 text-sm md:text-base line-clamp-2 mb-6 max-w-xl leading-relaxed drop-shadow-md">
                {featured.overview}
            </p>

            <div className="flex items-center gap-4">
                <button onClick={() => navigate(`/watch/${featured.media_type || 'movie'}/${featured.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-105">
                    <Play fill="currentColor" size={16} /> Play Now
                </button>
                <button className="bg-[#001845]/40 hover:bg-[#001845]/60 border border-blue-500/30 backdrop-blur-md text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all hover:scale-105">
                    <Info size={18} /> More Info
                </button>
            </div>
        </div>

        {/* Right: HORIZONTAL Thumbnails (The "Image" look) */}
        <div className="hidden lg:flex flex-row gap-4 pb-2">
            {movies.slice(1, 5).map((movie) => (
                <div 
                  key={movie.id} 
                  onClick={() => setFeatured(movie)}
                  className={`
                      relative w-40 h-24 rounded-lg overflow-hidden hero-thumb border-2 
                      ${featured.id === movie.id ? 'border-blue-500' : 'border-transparent opacity-70'}
                  `}
                >
                    <img 
                      src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} 
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-black/60 backdrop-blur-sm">
                       <p className="text-[10px] font-bold text-white truncate">{movie.title || movie.name}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const MovieCard = ({ movie, variant, index }) => {
    const navigate = useNavigate();
    const isRanked = variant === 'ranked';
    
    // Card Dimensions
    const cardClass = isRanked 
        ? "w-[160px] md:w-[180px] h-[240px] md:h-[270px] relative ml-10 flex-shrink-0"
        : "w-[160px] md:w-[200px] h-[240px] md:h-[300px] relative flex-shrink-0";

    return (
        <div 
            className={`${cardClass} group cursor-pointer inline-block`}
            onClick={() => navigate(`/detail/${movie.media_type || 'movie'}/${movie.id}`)}
        >
            {isRanked && <span className="rank-number">{index + 1}</span>}

            <div className="w-full h-full rounded-xl overflow-hidden relative border border-white/5 bg-[#1a1d26] movie-card group-hover:border-blue-500/50">
                <img 
                    src={`${IMAGE_BASE_URL}${movie.poster_path}`} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                    alt={movie.title}
                />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform">
                        <Play fill="black" className="ml-1 text-black" size={24} />
                    </div>
                </div>
            </div>
            
            {!isRanked && (
                <div className="mt-2 px-1">
                    <h3 className="text-sm font-bold text-gray-200 truncate group-hover:text-blue-400 transition-colors">{movie.title || movie.name}</h3>
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
      .then(data => setMovies(data.results || []));
  }, [fetchUrl]);

  if(movies.length === 0) return null;

  return (
    <div className="pl-4 md:pl-10 mb-8 relative z-20">
      <div className="flex items-center gap-4 mb-4">
         {variant === 'ranked' ? (
             <div className="flex flex-col">
                 <h2 className="text-5xl md:text-6xl font-black text-blue-500 leading-none tracking-tighter">TOP 10</h2>
                 <span className="text-white font-bold tracking-widest text-xs md:text-sm ml-1">MOVIES TODAY</span>
             </div>
         ) : (
             <>
                <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h3>
                <div className="h-6 w-[1px] bg-blue-500/50"></div>
                <a href="#" className="text-blue-500 text-xs font-bold uppercase tracking-wider hover:text-white">View All</a>
             </>
         )}
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
            <div className="relative z-20 space-y-2">
                <Row title="Now Playing" fetchUrl={`/movie/now_playing?api_key=${TMDB_API_KEY}`} />
                <Row title="Top Rated" fetchUrl={`/movie/top_rated?api_key=${TMDB_API_KEY}`} variant="ranked" />
                <Row title="Trending TV" fetchUrl={`/trending/tv/week?api_key=${TMDB_API_KEY}`} />
                <Row title="Action Movies" fetchUrl={`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`} />
            </div>
        </div>
    );
};

const Placeholder = ({ title }) => (
    <div className="pt-32 px-10 min-h-screen text-center">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-gray-400">Page under construction.</p>
    </div>
);

function App() {
  return (
    <BrowserRouter>
      <div className="bg-[#00040a] min-h-screen text-white selection:bg-blue-500 selection:text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Placeholder title="Movies" />} />
          <Route path="/tv" element={<Placeholder title="TV Shows" />} />
          <Route path="/sports" element={<Placeholder title="Live Sports" />} />
          <Route path="/search" element={<Placeholder title="Search Results" />} />
          {/* Detail and Player routes would go here */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
