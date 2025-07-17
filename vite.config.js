import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/FranceRoadTrip/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
