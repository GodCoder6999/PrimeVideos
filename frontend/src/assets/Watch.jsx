// File: src/pages/Watch.jsx (or wherever your viewing screen is)
import React from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';

const Watch = () => {
    // Assuming your URL looks like /watch/movie/550
    // and you grab the ID from React Router
    const { id } = useParams(); 

    return (
        <div className="min-h-screen bg-gray-900 pt-20 px-4">
            <h1 className="text-white text-2xl font-bold mb-6 text-center">Now Playing</h1>
            
            {/* Render the new player component */}
            <VideoPlayer tmdbId={id} type="movie" />
            
        </div>
    );
};

export default Watch;
