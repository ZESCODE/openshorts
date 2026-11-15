import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import seo from './vite-plugin-seo'

// Backend target for the dev proxy. Defaults to the docker-compose service
// name; set VITE_PROXY_TARGET=http://localhost:8000 to run the dev server on
// the host against a backend reachable at localhost (no CORS, same-origin).
const backend = process.env.VITE_PROXY_TARGET || 'http://backend:8000'
const renderer = process.env.VITE_RENDER_TARGET || 'http://renderer:3100'

// https://vitejs.dev/config/
export default defineConfig({
  // seo() runs on build only. It injects the crawler-visible homepage content
  // into #root and emits the static /alternatives pages, sitemap.xml and
  // llms.txt. See vite-plugin-seo.js.
  plugins: [react(), seo()],
  // The free tools (/youtube-transcript-generator and friends) are static
  // pages emitted by seo(); their behaviour ships as small standalone entries
  // with no React in them. vite-plugin-seo.js finds each entry's hashed file
  // name in the bundle and adds the <script> to its page.
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        'tool-transcript': 'tools/transcript.js',
        'tool-metadata': 'tools/metadata.js',
        'tool-vertical': 'tools/vertical.js',
        'tool-paste-link': 'tools/paste-link.js',
      },
    },
  },
  server: {
    allowedHosts: [
      'openshorts.app',
      'www.openshorts.app'
    ],
    proxy: {
      // Pollinations OAuth token exchange — server-side because
      // enter.pollinations.ai sends no CORS headers. The whop app (:3020)
      // owns the JSON→form conversion. Must precede '/api'.
      '/api/pollinations/token': {
        target: process.env.VITE_TOKEN_TARGET || 'http://127.0.0.1:3020',
        changeOrigin: true,
      },
      '/api': { target: backend, changeOrigin: true },
      // Image generation: free Pollinations models run through the ZES Mesh
      // Console's proxy (:7070 /api/image), which fetches server-side so the
      // browser Origin is not rejected. Gemini (BYOK) is called directly —
      // its API answers CORS. Must precede '/studio': the first matching
      // proxy wins.
      '/studio/api/image': {
        target: 'http://127.0.0.1:7070',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/studio/, '') || '/',
      },
      // merged ZES Studio (Pollinations + Remotion) served by :8090
      '/studio': { target: 'http://127.0.0.1:8090', changeOrigin: true, rewrite: (p) => p.replace(/^\/studio/, '') || '/' },
      '/videos': { target: backend, changeOrigin: true },
      '/thumbnails': { target: backend, changeOrigin: true },
      '/gallery': { target: backend, changeOrigin: true },
      '/video': { target: backend, changeOrigin: true },
      '/render': { target: renderer, changeOrigin: true },
    }
  }
})
