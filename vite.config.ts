import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

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
  plugins: [react()],
  base: getBase(),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
