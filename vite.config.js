import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/FranceRoadTrip/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
