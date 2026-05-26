import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// Get base path from environment or repository name
const getBase = () => {
  // For GitHub Pages deployment
  if (process.env.GITHUB_REPOSITORY) {
    return `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  }
  // Check for BASE_URL environment variable (set in GitHub Actions)
  if (process.env.BASE_URL) {
    return process.env.BASE_URL
  }
  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable, offline-capable PWA. autoUpdate keeps the service worker fresh; the app
    // shell + assets are precached so the lab opens offline. Icons reuse the existing SVG mark.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['particles.svg'],
      manifest: {
        name: 'Particle Lab',
        short_name: 'Particle Lab',
        description: 'A GPU-accelerated educational particle physics lab.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        icons: [{ src: 'particles.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        // The three.js/WebGPU bundle is large; raise the precache size cap so it's cached.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  base: getBase(),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
