import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // REST API traffic
      '/api': {
        target:'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Real-Time AI Mobility Assistant — WebSocket gateway
      // Forwards ws://localhost:3000/ws → ws://localhost:5000/ws
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
