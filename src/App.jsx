import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, Search, Home, Tv, Film, MonitorPlay, Menu, X, Star, ChevronRight, Server, ChevronDown, Check, Download, Bell, Filter, Eye, Bookmark, Plus, Clock, Calendar, Settings, Volume2, Maximize, SkipForward, Rewind, FastForward, ArrowLeft, MessageCircle } from 'lucide-react';

// --- CONFIGURATION ---
const TMDB_API_KEY = "09ca3ca71692ba80b848d268502d24ed"; 
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

// --- VIDEO SOURCES (RESTORED REAL SOURCES) ---
const VIDEO_SOURCES = [
  { name: 'VidSrc', label: 'HD', url: 'https://vidsrc.xyz/embed', type: 'standard' },
  { name: 'VidLink', label: 'HD', url: 'https://vidlink.pro', type: 'standard' },
  { name: 'SuperFlix', label: 'HD', url: 'https://superflix.co/embed', type: 'standard' },
  { name: 'Vidnest', label: 'HD', url: 'https://vidnest.com/embed', type: 'standard' },
  { name: 'Vidify', label: 'Multi', url: 'https://vidify.net/embed', type: 'standard' }, 
  { name: 'MoviesAPI', label: 'HD', url: 'https://moviesapi.club/movie', type: 'custom' },
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
        
        <div className="absolute top-2 right-2 z-20 transition-opacity duration-300 group-hover:opacity-0">
           <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
              <Eye size={10} className="text-gray-400" />
              <span>{views}K</span>
           </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-[#3466f2] py-1.5 px-3 flex items-center justify-between z-20 transition-all duration-300 group-hover:translate-y-full group-hover:opacity-0">
           <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate">Most Viewed on PrimeVideos</span>
           <Star size={10} className="text-white fill-white" />
        </div>

        <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-t from-black via-black/40 to-transparent">
            <div className="flex justify-between items-start translate-y-[-10px] group-hover:translate-y-0 transition-transform duration-500">
                <span className="bg-yellow-500 text-black text-[11px] font-black px-1.5 py-0.5 rounded shadow-lg">
                    {item.vote_average?.toFixed(1)}
                </span>
                <span className="bg-black/80 text-gray-200 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 border border-white/10 backdrop-blur-md">
                    <Eye size={12} className="text-blue-400" /> {views}K
                </span>
            </div>

            <div className="translate-y-[20px] group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="text-white font-black text-lg leading-tight mb-2 drop-shadow-lg uppercase line-clamp-2">
                    {item.title || item.name}
                </h3>
                <p className="text-gray-400 text-[11px] line-clamp-2 mb-4 leading-relaxed font-medium">
                    {item.overview || "No description available."}
                </p>

                <div className="flex gap-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/30">
                        Details
                    </button>
                    <button className="bg-[#1a2332] hover:bg-white/10 text-blue-500 p-2.5 rounded-lg transition-all border border-blue-500/20">
                        <Bookmark size={16} className="fill-current" />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ activeTab, setActiveTab, onSearch }) => {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e) => { e.preventDefault(); if (query.trim()) onSearch(query); };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'trending', label: 'Trending', icon: Star },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'tv', label: 'TV Shows', icon: Tv },
    { id: 'sports', label: 'Sports', icon: MonitorPlay },
    { id: 'discord', label: 'Discord', icon: Server },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#060b16]/95 backdrop-blur-xl shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
      <div className="container mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer mr-10" onClick={() => setActiveTab('home')}>
          <div className="text-3xl font-black tracking-tighter text-white">
            Prime<span className="text-blue-500">Videos</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={15} strokeWidth={2.5} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <form onSubmit={handleSearch} className="relative hidden xl:block">
            <input
              type="text"
              placeholder="Search movies, tv shows, actors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-[#131720]/80 border border-[#232b39] text-white text-sm rounded-full px-5 py-2.5 pl-11 w-80 focus:w-96 transition-all duration-500 focus:outline-none focus:border-blue-500/50 backdrop-blur-md placeholder-gray-500"
            />
            <Search size={16} className="absolute left-4 top-3 text-gray-500" />
            <Filter size={16} className="absolute right-4 top-3 text-gray-500 cursor-pointer hover:text-blue-400" />
          </form>

          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer text-gray-400 hover:text-white transition-colors p-2">
               <Bell size={22} />
               <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#060b16]"></div>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-sm font-black text-white ring-2 ring-white/10 hover:ring-blue-500 transition-all cursor-pointer">
              U
            </div>
          </div>
        </div>
      </div>
      {searchOpen && (
        <div className="md:hidden px-4 pb-4 bg-[#060b16] border-b border-white/10">
          <form onSubmit={handleSearch} className="relative">
             <input type="text" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-[#131a27] text-white px-4 py-3 rounded-lg focus:outline-none border border-white/10" />
          </form>
        </div>
      )}
    </nav>
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
        <div className="max-w-3xl">
           <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
             <span className="px-3 py-1 text-[11px] font-black tracking-widest text-white bg-blue-600 rounded-md">MOVIE</span>
             <span className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10 text-[11px] font-bold text-white"><Star size={12} className="text-yellow-500 fill-yellow-500" /> {movie.vote_average.toFixed(1)}</span>
             <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10 text-[11px] font-bold text-white">{movie.release_date?.split('-')[0]}</span>
           </div>
          
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-white leading-[0.85] mb-8 drop-shadow-2xl animate-fade-in-up delay-100 tracking-tighter">{movie.title}</h1>
          <p className="text-gray-300 text-base md:text-lg mb-10 line-clamp-3 leading-relaxed max-w-2xl opacity-80 font-medium animate-fade-in-up delay-200">{movie.overview}</p>
          
          <div className="flex items-center gap-4 animate-fade-in-up delay-300">
            <button onClick={() => onPlay(movie)} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full font-black text-lg transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-600/50">
              <Play size={24} fill="currentColor" /> Play Now
            </button>
            <button onClick={() => onMore(movie)} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-10 py-4 rounded-full font-black text-lg transition-all border border-white/10">
              <Info size={24} /> More Info
            </button>
          </div>
        </div>

        <div className="hidden lg:flex absolute right-8 bottom-16 gap-4 z-20 items-end">
            {featuredMovies.map((m, index) => (
                <div key={m.id} onClick={() => setActiveIndex(index)} className={`relative cursor-pointer transition-all duration-500 rounded-xl overflow-hidden border-2 shadow-2xl ${index === activeIndex ? 'w-36 h-52 border-blue-500 scale-110 -translate-y-4 ring-4 ring-blue-500/20' : 'w-24 h-36 border-transparent opacity-40 hover:opacity-100'}`}>
                    <img src={`${POSTER_BASE_URL}${m.poster_path}`} alt={m.title} className="w-full h-full object-cover" />
                    {index === activeIndex && (<div className="absolute inset-0 bg-gradient-to-t from-blue-600/40 to-transparent"></div>)}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// 5. Custom X-Ray Player Interface
const VideoPlayer = ({ movie, onClose }) => {
  const [source, setSource] = useState(VIDEO_SOURCES[0]);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [cast, setCast] = useState([]);
  const type = movie.name ? 'tv' : 'movie';
  const controlTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchCast = async () => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/credits?api_key=${TMDB_API_KEY}`);
            const data = await res.json();
            setCast(data.cast?.slice(0, 3) || []);
        } catch(e) {}
    };
    fetchCast();
  }, [movie.id, type]);

  useEffect(() => {
    const handleMouseMove = () => {
        setShowControls(true);
        clearTimeout(controlTimeoutRef.current);
        controlTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        clearTimeout(controlTimeoutRef.current);
    };
  }, []);

  const getSourceUrl = (src) => {
    let url = src.url;
    if (src.type === 'custom') {
        return `${url}/${movie.id}`;
    }
    if (type === 'tv') {
       return `${url}/${type}/${movie.id}/1/1`;
    }
    return `${url}/${type}/${movie.id}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden group">
      {/* Underlying Iframe */}
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
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 pointer-events-none">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading {source.name}...</p>
         </div>
      )}

      {/* Custom X-Ray Overlay (UI Shell) - POINTER EVENTS NONE */}
      <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
          
          {/* Top Bar - Pointer Events Auto */}
          <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
              <div className="flex gap-12">
                  <div className="text-white">
                      <div className="flex items-center gap-2 font-bold text-lg mb-1">X-Ray <ChevronDown size={16} /> <span className="text-gray-400 text-sm font-normal">View All</span></div>
                  </div>
                  <div className="text-center">
                      <h2 className="text-white text-2xl font-bold">{movie.title || movie.name}</h2>
                      {type === 'tv' && <p className="text-gray-300 text-lg">Season 1, Ep. 1</p>}
                  </div>
              </div>
              <div className="flex items-center gap-6 text-white relative">
                  <div className="relative">
                      <Server size={24} className="cursor-pointer hover:text-gray-300" onClick={() => setShowSourceSelector(!showSourceSelector)} />
                      
                      {showSourceSelector && (
                          <div className="absolute top-10 right-0 bg-[#0f1014] border border-white/10 rounded-lg p-2 w-64 shadow-2xl z-50">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">Select Server</div>
                              <div className="flex flex-col gap-1">
                                  {VIDEO_SOURCES.map((src) => (
                                      <button
                                          key={src.name}
                                          onClick={() => { setSource(src); setShowSourceSelector(false); setLoading(true); }}
                                          className={`flex justify-between items-center px-4 py-3 rounded-md text-sm font-bold transition-all ${
                                              source.name === src.name 
                                              ? 'bg-blue-600 text-white' 
                                              : 'bg-[#151921] text-gray-300 hover:bg-[#252f40] hover:text-white'
                                          }`}
                                      >
                                          <span>{src.name}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${source.name === src.name ? 'bg-white/20' : 'bg-black/40 text-gray-400'}`}>{src.label}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
                  <MessageCircle size={24} />
                  <Settings size={24} />
                  <Volume2 size={24} />
                  <Maximize size={24} />
                  <X size={32} className="cursor-pointer hover:text-gray-300" onClick={onClose} />
              </div>
          </div>

          {/* Left X-Ray Sidebar - Pointer Events Auto */}
          <div className="absolute left-8 top-1/3 flex flex-col gap-4 w-64 pointer-events-auto">
              <div className="bg-black/60 backdrop-blur-md p-4 rounded-lg border-l-4 border-white text-white mb-4">
                  <h4 className="font-bold text-sm mb-1">General Trivia</h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                      {movie.overview ? movie.overview.slice(0, 100) + "..." : "Trivia unavailable."}
                  </p>
              </div>
              {cast.map(actor => (
                  <div key={actor.id} className="flex items-center gap-3 group cursor-pointer">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent group-hover:border-white transition-all">
                          <img src={actor.profile_path ? `${POSTER_BASE_URL}${actor.profile_path}` : 'https://via.placeholder.com/50'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                          <div className="text-white font-bold text-sm">{actor.name}</div>
                          <div className="text-gray-400 text-xs">{actor.character}</div>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

// 6. Movie Detail View
const MovieDetail = ({ movie, onBack, onPlay }) => {
  const [cast, setCast] = useState([]);
  const [trailer, setTrailer] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const type = movie.name ? 'tv' : 'movie';

  useEffect(() => {
    const fetchData = async () => {
        const creditsRes = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/credits?api_key=${TMDB_API_KEY}`);
        const creditsData = await creditsRes.json();
        setCast(creditsData.cast?.slice(0, 6) || []);

        const videoRes = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/videos?api_key=${TMDB_API_KEY}`);
        const videoData = await videoRes.json();
        const officialTrailer = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        setTrailer(officialTrailer);

        const recRes = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        const recData = await recRes.json();
        setRecommendations(recData.results?.slice(0, 6) || []);
    };
    fetchData();
    window.scrollTo(0,0);
  }, [movie, type]);

  return (
    <div className="min-h-screen bg-[#060b16]">
       <div className="relative w-full h-[85vh]">
          <div className="absolute inset-0">
             <img src={`${IMAGE_BASE_URL}${movie.backdrop_path}`} alt={movie.title} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-[#060b16]/70 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-r from-[#060b16] via-[#060b16]/80 to-transparent"></div>
          </div>

          <div className="absolute inset-0 container mx-auto px-4 md:px-8 flex items-center z-10 pt-20">
             <div className="flex gap-12 w-full">
                <div className="hidden lg:block w-[300px] shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/10 rotate-1 transform">
                   <img src={`${POSTER_BASE_URL}${movie.poster_path}`} className="w-full h-full object-cover" alt="poster" />
                </div>
                <div className="flex-1 max-w-4xl">
                   <div className="inline-block bg-[#22c55e] text-white text-xs font-bold px-2 py-1 rounded mb-4 shadow-lg shadow-green-500/20">{movie.vote_average?.toFixed(1)}</div>
                   <h1 className="text-5xl md:text-7xl font-black text-white mb-4 leading-tight uppercase tracking-tight">{movie.title || movie.name}</h1>
                   <div className="flex items-center gap-6 text-gray-300 text-sm font-bold mb-8">
                      <span className="flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> {movie.release_date || movie.first_air_date}</span>
                      <span className="flex items-center gap-2"><Clock size={16} className="text-blue-500" /> {type === 'movie' ? '2h 35m' : '45m'}</span>
                   </div>
                   <h3 className="text-white font-bold text-lg mb-2">Overview</h3>
                   <p className="text-gray-400 text-base leading-relaxed mb-8 max-w-3xl">{movie.overview}</p>
                   <div className="flex gap-4">
                      <button onClick={onPlay} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-full font-black text-lg flex items-center gap-3 transition-all shadow-xl shadow-blue-600/30">
                         <Play size={20} fill="currentColor" /> Watch Now
                      </button>
                      <button className="bg-[#1a2332] hover:bg-[#253045] text-white px-8 py-3.5 rounded-full font-bold text-lg flex items-center gap-3 transition-all border border-white/10">
                         <Download size={20} /> Download
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
       <div className="bg-[#0f1218] border-y border-white/5 py-4">
          <div className="container mx-auto px-4 md:px-8 flex gap-12 text-sm">
             <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-[10px]">Status</span><span className="text-white font-bold">Released</span></div>
             <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-[10px]">Budget</span><span className="text-white font-bold">$25,000,000</span></div>
             <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-[10px]">Revenue</span><span className="text-white font-bold">$281,000,000</span></div>
          </div>
       </div>
       <div className="container mx-auto px-4 md:px-8 py-16">
          <h3 className="text-2xl font-black text-white mb-8">Costs & Credits</h3>
          <div className="flex gap-6 mb-16 overflow-x-auto pb-4 scrollbar-hide">
             {cast.map(person => (
                <div key={person.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                   <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10">
                      <img src={person.profile_path ? `${POSTER_BASE_URL}${person.profile_path}` : 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                   </div>
                   <div className="text-center"><div className="text-white text-xs font-bold truncate w-20">{person.name}</div><div className="text-gray-500 text-[10px] truncate w-20">{person.character}</div></div>
                </div>
             ))}
          </div>
          <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-2"><Play size={24} className="fill-white" /> Trailer</h3>
          {trailer ? (
             <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 mb-16 relative">
                <iframe src={`https://www.youtube.com/embed/${trailer.key}`} title="Trailer" className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
             </div>
          ) : <div className="w-full h-64 bg-[#0f1218] rounded-2xl flex items-center justify-center text-gray-500 mb-16">No Trailer Available</div>}
          <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-2">Recommended Movies You May Like</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
             {recommendations.map(item => (<MovieCard key={item.id} item={item} onClick={() => {}} />))}
          </div>
       </div>
    </div>
  );
}

// 7. Content Row
const ContentRow = ({ title, fetchUrl, onMovieClick }) => {
  const [movies, setMovies] = useState([]);
  const rowRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      let url = `https://api.themoviedb.org/3${fetchUrl}`;
      if (!fetchUrl.includes('with_networks') && !fetchUrl.includes('trending') && !fetchUrl.includes('search') && !fetchUrl.includes('now_playing')) {
          url += "&with_watch_providers=9|119&watch_region=US";
      }
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}api_key=${TMDB_API_KEY}`;
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

  const isTopSection = title.startsWith("TOP");
  
  return (
    <div className="mb-14 px-4 md:px-8 group/row">
      <div className="flex items-end justify-between mb-6 px-1">
        <div className="flex items-baseline gap-3">
           {isTopSection ? (
              <div className="flex items-baseline gap-3">
                <h2 className="text-5xl md:text-7xl font-black text-blue-600 tracking-tighter leading-none italic">TOP</h2>
                <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">{title.replace("TOP", "").trim()}</span>
              </div>
           ) : (
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase">{title}</h2>
           )}
        </div>
        <button className="text-blue-500 text-sm font-black hover:text-blue-400 flex items-center gap-1 transition-all uppercase tracking-tighter border-b-2 border-transparent hover:border-blue-500">View all <ChevronRight size={18} /></button>
      </div>
      <div className="relative">
        <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-0 z-30 w-16 bg-gradient-to-r from-[#060b16] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity text-white hover:text-blue-400"><ChevronDown className="transform rotate-90" size={48} /></button>
        <div ref={rowRef} className="flex gap-5 overflow-x-auto scrollbar-hide py-8 px-4 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {movies.map((movie) => (<MovieCard key={movie.id} item={movie} onClick={onMovieClick} />))}
        </div>
        <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-0 z-30 w-16 bg-gradient-to-l from-[#060b16] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity text-white hover:text-blue-400"><ChevronRight size={48} /></button>
      </div>
    </div>
  );
};

// 8. Main App
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const handleSearch = async (query) => {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${query}`);
    const data = await res.json();
    setSearchResults(data.results.filter(item => item.media_type !== 'person'));
    setActiveTab('search');
  };

  const handleMovieClick = (movie) => {
      setSelectedMovie(movie);
      setPlaying(false); 
  };

  const renderContent = () => {
    if (playing && selectedMovie) return <VideoPlayer movie={selectedMovie} onClose={() => setPlaying(false)} />;
    if (selectedMovie) return <MovieDetail movie={selectedMovie} onBack={() => setSelectedMovie(null)} onPlay={() => setPlaying(true)} />;
    
    if (activeTab === 'search') {
      return (
        <div className="pt-32 px-8 min-h-screen bg-[#060b16]">
          <h2 className="text-4xl text-white font-black mb-10 tracking-tighter uppercase">Results for "{searchResults ? 'Your Search' : ''}"</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8 pb-20">
            {searchResults?.map(item => (<MovieCard key={item.id} item={item} onClick={handleMovieClick} />))}
          </div>
        </div>
      );
    }
    
    if (['movies', 'tv', 'trending', 'sports'].includes(activeTab)) {
        const endpoint = activeTab === 'tv' ? '/discover/tv' : '/discover/movie';
        return (
            <div className="pt-32 px-4 md:px-8 min-h-screen bg-[#060b16]">
                <h2 className="text-6xl text-white font-black mb-4 capitalize tracking-tighter">{activeTab}</h2>
                <div className="space-y-16 mt-12 pb-20">
                     <ContentRow title="Now Trending" fetchUrl={`${endpoint}?sort_by=popularity.desc`} onMovieClick={handleMovieClick} />
                     <ContentRow title="Highly Rated" fetchUrl={`${endpoint}?sort_by=vote_average.desc&vote_count.gte=500`} onMovieClick={handleMovieClick} />
                     <ContentRow title="Explosive Action" fetchUrl={`${endpoint}?with_genres=28`} onMovieClick={handleMovieClick} />
                </div>
            </div>
        )
    }

    return (
      <div className="bg-[#060b16] min-h-screen">
        <Hero onPlay={(m) => { setSelectedMovie(m); setPlaying(true); }} onMore={handleMovieClick} />
        <div className="relative z-20 -mt-24 space-y-4">
          <ContentRow title="Now Playing" fetchUrl="/movie/now_playing?language=en-US&page=1" onMovieClick={handleMovieClick} />
          <ContentRow title="TOP MOVIES TODAY" fetchUrl="/trending/movie/day?" onMovieClick={handleMovieClick} />
          <ContentRow title="TOP RATED SHOWS" fetchUrl="/discover/tv?sort_by=vote_average.desc&vote_count.gte=800" onMovieClick={handleMovieClick} />
          <ContentRow title="Marvel Cinematic Universe" fetchUrl="/discover/movie?with_companies=420&sort_by=popularity.desc" onMovieClick={handleMovieClick} />
          <ContentRow title="Action Blockbusters" fetchUrl="/discover/movie?with_genres=28&sort_by=popularity.desc" onMovieClick={handleMovieClick} />
          <ContentRow title="Netflix Originals" fetchUrl="/discover/tv?with_networks=213&sort_by=popularity.desc" onMovieClick={handleMovieClick} />
          <ContentRow title="Sci-Fi Thrillers" fetchUrl="/discover/movie?with_genres=878&sort_by=popularity.desc" onMovieClick={handleMovieClick} />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#060b16] text-white font-sans selection:bg-blue-500 selection:text-white antialiased">
      {!playing && <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onSearch={handleSearch} />}
      {renderContent()}
      {!selectedMovie && !playing && (
        <footer className="bg-[#02050a] border-t border-white/5 py-20 px-8">
           <div className="container mx-auto grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
              <div className="col-span-2">
                <div className="text-4xl font-black tracking-tighter text-white mb-6">Prime<span className="text-blue-500">Videos</span></div>
                <p className="text-gray-500 text-sm max-w-sm font-medium leading-relaxed">The ultimate destination for premium cinema and television. Powered by global streaming infrastructure for zero-buffer high definition experiences.</p>
              </div>
              <div><h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Explore</h4><ul className="space-y-3 text-sm text-gray-500 font-bold"><li>Premium Originals</li><li>Trending 100</li><li>Live Sports</li><li>Kids Zone</li></ul></div>
              <div><h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Company</h4><ul className="space-y-3 text-sm text-gray-500 font-bold"><li>About Us</li><li>Careers</li><li>Press</li><li>Privacy</li></ul></div>
              <div><h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Community</h4><ul className="space-y-3 text-sm text-gray-500 font-bold"><li>Discord Server</li><li>Twitter</li><li>Instagram</li></ul></div>
           </div>
           <div className="text-center text-[10px] text-gray-700 border-t border-white/5 pt-10 font-black tracking-[0.2em] uppercase">© 2026 PRIMEVIDEOS MEDIA. ALL RIGHTS RESERVED. DATA PROVIDED BY THE MOVIEDB.</div>
        </footer>
      )}
    </div>
  );
}