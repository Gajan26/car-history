import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Only used by `npm run dev:vite-only`. Normal local dev should use
    // `vercel dev` (npm run dev) so /api/mot runs as a real serverless
    // function; this proxy is a fallback for UI-only work when you don't
    // need live API calls.
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
