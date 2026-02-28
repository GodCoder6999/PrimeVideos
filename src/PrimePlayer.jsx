import React, { useState } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrimePlayer = ({ tmdbId, title, mediaType, season, episode }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    // We use VidKing as the ultimate source. It bypasses CORS naturally, 
    // has deep regional libraries (including Indian series), and accepts our Prime Video HEX color.
    const iframeUrl = mediaType === 'tv'
        ? `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=00A8E1&autoPlay=true&nextEpisode=true`
        : `https://www.vidking.net/embed/movie/${tmdbId}?color=00A8E1&autoPlay=true`;

    return (
        <div className="w-full h-screen bg-black relative overflow-hidden flex flex-col font-sans">
            
            {/* --- PRIME VIDEO UI OVERLAY --- */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/90 to-transparent pointer-events-none z-[100] flex items-center px-6 transition-opacity duration-300">
                <button 
                    onClick={() => navigate(-1)} 
                    className="pointer-events-auto bg-black/40 hover:bg-[#00A8E1] text-white w-12 h-12 rounded-full backdrop-blur-md border border-white/10 transition-all flex items-center justify-center shadow-[0_0_15px_rgba(0,168,225,0.3)] group"
                >
                    <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <h1 className="ml-4 text-white text-xl font-bold tracking-wide drop-shadow-md pointer-events-auto">
                    {title}
                </h1>
            </div>

            {/* --- PRIME VIDEO LOADING SCREEN --- */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f171e]">
                    <Loader size={48} className="animate-spin text-[#00A8E1] mb-4" />
                    <p className="text-white font-bold tracking-widest uppercase text-sm animate-pulse">
                        Loading Prime Stream...
                    </p>
                </div>
            )}

            {/* --- THE PLAYER --- */}
            <div className="flex-1 relative w-full h-full bg-black">
                <iframe
                    src={iframeUrl}
                    className="w-full h-full border-none absolute inset-0 z-10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    onLoad={() => setIsLoading(false)}
                    title="Prime Player"
                ></iframe>
            </div>
            
        </div>
    );
};

export default PrimePlayer;
