import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost', // Only bind to localhost (not exposed on network)
    port: 3000,
    strictPort: true,
    open: false, // Don't try to open browser in headless env
  },
})
