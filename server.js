// dash-server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Allow your Vercel frontend to request the video chunks
app.use(cors({
    origin: '*', // Change this to your Vercel domain in production
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range', 'Accept']
}));

// Serve DASH files with correct MIME types
app.use('/video', express.static(path.join(__dirname, 'output'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mpd')) {
      res.setHeader('Content-Type', 'application/dash+xml');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.m4s') || filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/iso.segment');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`DASH Server running at http://localhost:${PORT}`);
  console.log(`Manifest URL: http://localhost:${PORT}/video/output.mpd`);
});
