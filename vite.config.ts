import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose on all network interfaces
    port: 5173,
    strictPort: true,
    open: false, // Don't try to open browser in headless env
  },
})
