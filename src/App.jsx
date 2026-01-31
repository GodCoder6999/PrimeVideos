import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Play, Info, Search, Home, Tv, Film, MonitorPlay, Menu, X, Star, ChevronRight, Server, ChevronDown, Check, Download, Bell, Filter, Eye, Bookmark, Calendar, Clock, ArrowLeft, Settings, Volume2, Maximize, MessageCircle } from 'lucide-react';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed"; 
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

// --- VIDEO SOURCES ---
const VIDEO_SOURCES = [
  { name: 'VidSrc', label: 'HD', url: 'https://vidsrc.xyz/embed', type: 'standard' },
  { name: 'VidLink', label: 'HD', url: 'https://vidlink.pro', type: 'standard' },
  { name: 'SuperFlix', label: 'HD', url: 'https://superflix.co/embed', type: 'standard' },
  { name: 'Vidnest', label: 'HD', url: 'https://vidnest.com/embed', type: 'standard' },
  { name: 'Vidify', label: 'Multi', url: 'https://vidify.net/embed', type: 'standard' }, 
  { name: 'MoviesAPI', label: 'HD', url: 'https://moviesapi.club/movie', type: 'custom' },
  // Your custom Vercel API
  { name: 'My Stream', label: 'Serverless', url: '/api/stream', type: 'custom' } 
];

// --- COMPONENTS ---

const RatingCircle = ({ rating }) => {
  const safeRating = rating || 0;
  const percentage = (safeRating / 10) * 100;
  const strokeDasharray = `${percentage} ${100 - percentage}`;
  
  return (
    <div className="relative w-8 h-8 flex items-center justify-center bg-[#1a1d24]/80 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white shadow-lg overflow-hidden">
      <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle cx="18" cy="18" r="16" fill="transparent" stroke="#22c55e" strokeWidth="3" strokeDasharray={strokeDasharray} strokeDashoffset="0" strokeLinecap="round" />
      </svg>
      <span className="relative z-10">{safeRating.toFixed(1)}</span>
    </div>
  );
};

const MovieCard = ({ item, onClick }) => {
  const views = ((item.popularity || 100) * 2.5).toFixed(0).slice(0, 3);
  
  return (
    <div 
      onClick={() => onClick(item)}
      className="group relative flex-shrink-0 w-[160px] md:w-[190px] cursor-pointer transition-all duration-500 ease-out hover:scale-110 hover:z-40"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0a0d14] shadow-2xl transition-all duration-500 group-hover:ring-2 group-hover:ring-blue-500/50">
        <img 
          src={item.poster_path ? `${POSTER_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Image'} 
          alt={item.title || item.name}
          className="w-full h-full object-cover transition-all duration-500 group-hover:opacity-20 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 z-20 transition-opacity duration-300 group-hover:opacity-0">
           <RatingCircle rating={item.vote_average} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-[#3466f2] py-1.5 px-3 flex items-center justify-between z-20 transition-all duration-300 group-hover:translate-y-full group-hover:opacity-0">
           <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate">PrimeVideos</span>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ onSearch }) => {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false); // Close mobile menu on route change
  }, [location]);

  const handleSearch = (e) => { 
    e.preventDefault(); 
    if (query.trim()) {
        onSearch(query);
        navigate('/search');
        setSearchOpen(false);
    } 
  };

  const navItems = [
    { id: '/', label: 'Home', icon: Home },
    { id: '/trending', label: 'Trending', icon: Star },
    { id: '/movies', label: 'Movies', icon: Film },
    { id: '/series', label: 'TV Shows', icon: Tv },
    { id: '/sports', label: 'Sports', icon: MonitorPlay },
  ];

  return (
    <>
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#060b16]/95 backdrop-blur-xl shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
      <div className="container mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        
        {/* Mobile Menu Toggle */}
        <button className="lg:hidden text-white mr-4" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>

        <Link to="/" className="flex items-center gap-2 cursor-pointer mr-10">
          <div className="text-3xl font-black tracking-tighter text-white">
            Prime<span className="text-blue-500">Videos</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.id}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                location.pathname === item.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={15} strokeWidth={2.5} />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <form onSubmit={handleSearch} className="relative hidden xl:block">
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-[#131720]/80 border border-[#232b39] text-white text-sm rounded-full px-5 py-2.5 pl-11 w-80 focus:w-96 transition-all duration-500 focus:outline-none focus:border-blue-500/50 backdrop-blur-md placeholder-gray-500"
            />
            <Search size={16} className="absolute left-4 top-3 text-gray-500" />
          </form>
          <Search size={22} className="xl:hidden text-white cursor-pointer" onClick={() => setSearchOpen(!searchOpen)} />
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black text-white">U</div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-4 bg-[#060b16] border-b border-white/10">
          <form onSubmit={handleSearch} className="relative">
             <input type="text" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-[#131a27] text-white px-4 py-3 rounded-lg focus:outline-none border border-white/10" />
          </form>
        </div>
      )}
    </nav>

    {/* Mobile Side Menu */}
    <div className={`fixed inset-y-0 left-0 w-64 bg-[#060b16] z-[60] transform transition-transform duration-300 border-r border-white/10 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
            <div className="text-2xl font-black text-white mb-8">Menu</div>
            <div className="flex flex-col gap-4">
                {navItems.map((item) => (
                    <Link key={item.id} to={item.id} className="flex items-center gap-4 text-gray-400 hover:text-white font-bold text-lg">
                        <item.icon size={20} /> {item.label}
                    </Link>
                ))}
            </div>
        </div>
    </div>
    {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-[55]" onClick={() => setMobileMenuOpen(false)}></div>}
    </>
  );
};

const Hero = ({ onPlay, onMore }) => {
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    async function fetchFeatured() {
      const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US`);
      const data = await res.json();
      setFeaturedMovies(data.results?.slice(0, 6) || []); 
    }
    fetchFeatured();
  }, []);

  useEffect(() => {
    if (featuredMovies.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % featuredMovies.length);
    }, 8000); 
    return () => clearInterval(interval);
  }, [featuredMovies]);

  const movie = featuredMovies[activeIndex];
  if (!movie) return <div className="h-screen bg-[#060b16] animate-pulse"></div>;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div key={movie.id} className="absolute inset-0 transition-all duration-1000 ease-in-out">
        <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} alt={movie.title} className="w-full h-full object-cover scale-105 animate-slow-zoom" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-[#060b16]/30 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#060b16] via-[#060b16]/70 to-transparent"></div>
      </div>
      <div className="absolute inset-0 container mx-auto px-4 md:px-8 flex items-center z-10">
        <div className="max-w-3xl pt-20">
          <h1 className="text-5xl md:text-8xl font-black text-white leading-[0.85] mb-6 drop-shadow-2xl">{movie.title}</h1>
          <p className="text-gray-300 text-sm md:text-lg mb-8 line-clamp-3 max-w-2xl">{movie.overview}</p>
          <div className="flex items-center gap-4">
            <button onClick={() => onPlay(movie)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-black text-lg transition-all">
              <Play size={20} fill="currentColor" /> Play
            </button>
            <button onClick={() => onMore(movie)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-black text-lg transition-all border border-white/10">
              <Info size={20} /> Info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoPlayer = ({ movie, onClose }) => {
  const [source, setSource] = useState(VIDEO_SOURCES[0]);
  const [loading, setLoading] = useState(true);
  const type = movie.media_type || (movie.name ? 'tv' : 'movie');

  const getSourceUrl = (src) => {
    let url = src.url;
    if (src.type === 'custom') {
        return `${url}?id=${movie.id}&type=${type}`; // Updated for your API query params
    }
    if (type === 'tv') {
       return `${url}/${type}/${movie.id}/1/1`;
    }
    return `${url}/${type}/${movie.id}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white bg-black/50 p-2 rounded-full hover:bg-white/20"><X size={30} /></button>
      <iframe 
        key={source.name}
        src={getSourceUrl(source)} 
        className="absolute inset-0 w-full h-full z-0" 
        frameBorder="0" 
        allowFullScreen 
        allow="autoplay; encrypted-media; fullscreen"
        onLoad={() => setLoading(false)}
      ></iframe>
      {loading && (
         <div className="absolute inset-0 flex items-center justify-center bg-black z-10 pointer-events-none text-white font-bold">Loading...</div>
      )}
      {/* Source Selector */}
      <div className="absolute bottom-10 right-10 z-50 group">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Server size={16}/> Servers</button>
          <div className="absolute bottom-full right-0 mb-2 bg-[#0f1014] border border-white/10 rounded-lg p-2 w-48 hidden group-hover:block">
              {VIDEO_SOURCES.map((src) => (
                  <button key={src.name} onClick={() => { setSource(src); setLoading(true); }} className={`block w-full text-left px-3 py-2 rounded text-xs font-bold ${source.name === src.name ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}>
                      {src.name}
                  </button>
              ))}
          </div>
      </div>
    </div>
  );
};

const MovieDetail = ({ movie, onBack, onPlay }) => {
  const [cast, setCast] = useState([]);
  const [trailer, setTrailer] = useState(null);
  const type = movie.media_type || (movie.name ? 'tv' : 'movie');

  useEffect(() => {
    const fetchData = async () => {
        const creditsRes = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/credits?api_key=${TMDB_API_KEY}`);
        const creditsData = await creditsRes.json();
        setCast(creditsData.cast?.slice(0, 6) || []);
        
        const videoRes = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/videos?api_key=${TMDB_API_KEY}`);
        const videoData = await videoRes.json();
        const officialTrailer = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        setTrailer(officialTrailer);
    };
    fetchData();
    window.scrollTo(0,0);
  }, [movie, type]);

  return (
    <div className="min-h-screen bg-[#060b16]">
       <div className="relative w-full h-[70vh] md:h-[85vh]">
          <div className="absolute inset-0">
             <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} alt={movie.title} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-[#060b16]/70 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-r from-[#060b16] via-[#060b16]/80 to-transparent"></div>
          </div>

          <div className="absolute inset-0 container mx-auto px-4 md:px-8 flex items-center z-10 pt-20">
             <div className="flex flex-col md:flex-row gap-8 md:gap-12 w-full">
                <div className="hidden md:block w-[250px] lg:w-[300px] shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                   <img src={`${POSTER_BASE_URL}${movie.poster_path}`} className="w-full h-full object-cover" alt="poster" />
                </div>
                <div className="flex-1 max-w-4xl">
                   {/* BACK BUTTON */}
                   <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest cursor-pointer">
                        <ArrowLeft size={20} /> Back to Browse
                   </button>

                   <h1 className="text-4xl md:text-7xl font-black text-white mb-4 leading-tight">{movie.title || movie.name}</h1>
                   <div className="flex items-center gap-4 text-gray-300 text-sm font-bold mb-6">
                      <span className="flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> {movie.release_date || movie.first_air_date}</span>
                      <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Rating: {movie.vote_average?.toFixed(1)}</span>
                   </div>
                   <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-8 max-w-2xl line-clamp-4 md:line-clamp-none">{movie.overview}</p>
                   <button onClick={onPlay} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-full font-black text-lg flex items-center gap-3 transition-all shadow-xl shadow-blue-600/30">
                         <Play size={20} fill="currentColor" /> Watch Now
                   </button>
                </div>
             </div>
          </div>
       </div>
       <div className="container mx-auto px-4 md:px-8 py-10">
          <h3 className="text-xl font-bold text-white mb-6">Cast</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
             {cast.map(person => (
                <div key={person.id} className="flex flex-col items-center min-w-[80px]">
                   <div className="w-14 h-14 rounded-full overflow-hidden border border-white/20 mb-2">
                      <img src={person.profile_path ? `${POSTER_BASE_URL}${person.profile_path}` : 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                   </div>
                   <div className="text-center text-white text-[10px] font-bold truncate w-20">{person.name}</div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}

const MovieDetailWrapper = () => {
    const { type, id } = useParams();
    const [movie, setMovie] = useState(null);
    const [playing, setPlaying] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchDetails() {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`);
                const data = await res.json();
                setMovie(data);
            } catch (e) { console.error("Error loading movie"); }
        }
        fetchDetails();
    }, [type, id]);

    if (!movie) return <div className="h-screen bg-[#060b16] flex items-center justify-center text-white">Loading...</div>;
    if (playing) return <VideoPlayer movie={movie} onClose={() => setPlaying(false)} />;

    return <MovieDetail movie={movie} onBack={() => navigate(-1)} onPlay={() => setPlaying(true)} />;
};

const ContentRow = ({ title, fetchUrl, onMovieClick }) => {
  const [movies, setMovies] = useState([]);
  const rowRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      let url = `https://api.themoviedb.org/3${fetchUrl}`;
      if (!url.includes('?')) url += '?';
      url += `&api_key=${TMDB_API_KEY}`;
      const request = await fetch(url);
      const data = await request.json();
      setMovies(data.results || []);
    }
    fetchData();
  }, [fetchUrl]);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { current } = rowRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth + 200 : current.offsetWidth - 200;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!movies.length) return null;
  
  return (
    <div className="mb-10 px-4 md:px-8 group/row">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4">{title}</h2>
      <div className="relative">
        <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-0 z-30 w-10 bg-black/50 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity text-white hover:text-blue-400"><ChevronDown className="transform rotate-90" size={30} /></button>
        <div ref={rowRef} className="flex gap-4 overflow-x-auto scrollbar-hide py-4 px-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
          {movies.map((movie) => (<MovieCard key={movie.id} item={movie} onClick={onMovieClick} />))}
        </div>
        <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-0 z-30 w-10 bg-black/50 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity text-white hover:text-blue-400"><ChevronRight size={30} /></button>
      </div>
    </div>
  );
};

export default function App() {
  const [searchResults, setSearchResults] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async (query) => {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${query}`);
    const data = await res.json();
    setSearchResults(data.results.filter(item => item.media_type !== 'person'));
  };

  const openDetail = (movie) => {
    const type = movie.media_type || (movie.name ? 'tv' : 'movie');
    navigate(`/title/${type}/${movie.id}`);
  };

  return (
    <div className="bg-[#060b16] text-white font-sans min-h-screen">
      <Navbar onSearch={handleSearch} />
      
      <Routes>
        <Route path="/" element={
          <div className="bg-[#060b16] min-h-screen">
             <Hero onPlay={openDetail} onMore={openDetail} />
             <div className="relative z-20 -mt-24 space-y-4 pb-20">
                <ContentRow title="Now Playing" fetchUrl="/movie/now_playing?language=en-US&page=1" onMovieClick={openDetail} />
                <ContentRow title="Trending Movies" fetchUrl="/trending/movie/day" onMovieClick={openDetail} />
                <ContentRow title="Top Rated TV" fetchUrl="/discover/tv?sort_by=vote_average.desc&vote_count.gte=800" onMovieClick={openDetail} />
             </div>
          </div>
        } />

        <Route path="/movies" element={
           <div className="pt-24 px-4 md:px-8 min-h-screen bg-[#060b16]">
              <h2 className="text-4xl text-white font-bold mb-8">Movies</h2>
              <div className="space-y-12 pb-20">
                   <ContentRow title="Popular" fetchUrl={`/discover/movie?sort_by=popularity.desc`} onMovieClick={openDetail} />
                   <ContentRow title="Top Rated" fetchUrl={`/discover/movie?sort_by=vote_average.desc&vote_count.gte=500`} onMovieClick={openDetail} />
                   <ContentRow title="Action" fetchUrl="/discover/movie?with_genres=28&sort_by=popularity.desc" onMovieClick={openDetail} />
              </div>
          </div>
        } />

        <Route path="/series" element={
           <div className="pt-24 px-4 md:px-8 min-h-screen bg-[#060b16]">
              <h2 className="text-4xl text-white font-bold mb-8">TV Series</h2>
              <div className="space-y-12 pb-20">
                   <ContentRow title="Trending" fetchUrl={`/discover/tv?sort_by=popularity.desc`} onMovieClick={openDetail} />
                   <ContentRow title="Top Rated" fetchUrl={`/discover/tv?sort_by=vote_average.desc&vote_count.gte=500`} onMovieClick={openDetail} />
                   <ContentRow title="Animation" fetchUrl="/discover/tv?with_genres=16&sort_by=popularity.desc" onMovieClick={openDetail} />
              </div>
          </div>
        } />

        <Route path="/search" element={
          <div className="pt-24 px-8 min-h-screen bg-[#060b16]">
            <h2 className="text-3xl text-white font-bold mb-8">Search Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pb-20">
              {searchResults && searchResults.length > 0 ? (
                searchResults.map(item => (<MovieCard key={item.id} item={item} onClick={openDetail} />))
              ) : (
                <div className="text-gray-500">No results found.</div>
              )}
            </div>
          </div>
        } />

        <Route path="/title/:type/:id" element={<MovieDetailWrapper />} />

        <Route path="*" element={<div className="pt-40 text-center text-2xl">Page Not Found</div>} />
      </Routes>
    </div>
  );
}