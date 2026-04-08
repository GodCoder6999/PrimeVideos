import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In local dev, /api/* and /proxy/* are forwarded to the Python backend (port 8888).
// Run `python python-backend/main.py` before starting the dev server.
// For Vercel deployment, /api/* still hits the serverless functions in the api/ folder.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
      '/proxy': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
