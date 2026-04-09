import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    // Proxy API calls to the FastAPI backend during development
    // No CORS issues — vite handles the forwarding
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          query:    ['@tanstack/react-query'],
          charts:   ['recharts'],
          state:    ['zustand'],
          ui:       ['lucide-react', 'clsx', 'date-fns'],
        },
      },
    },
  },

  // When proxy is active, use relative paths so the vite server forwards them
  define: {
    __API_BASE__: JSON.stringify(''),
  },
})
