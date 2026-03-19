import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Point this to your local backend server
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
