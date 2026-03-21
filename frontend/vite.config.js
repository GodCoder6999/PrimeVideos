import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No dev proxy needed — /api/* calls go to Vercel serverless functions.
// In local dev, run `vercel dev` instead of `vite` so the functions are available.
export default defineConfig({
  plugins: [react()],
})
