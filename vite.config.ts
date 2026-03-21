import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '127.0.0.1', // Only bind to IPv4 localhost (not exposed on network)
    port: 3000,
    strictPort: true,
    open: false, // Don't try to open browser in headless env
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into separate chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-revenuecat': ['@revenuecat/purchases-js'],
          'vendor-motion': ['motion'],
        },
      },
    },
  },
})
