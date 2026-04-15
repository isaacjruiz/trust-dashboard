import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/cases': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
      '/metrics': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
      '/ingest': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
      '/export': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
      '/agent': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
      '/health': { target: process.env.VITE_API_URL || 'http://localhost:4111', changeOrigin: true },
    },
  },
})
