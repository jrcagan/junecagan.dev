import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createSongApi } from './server/song-api.js'

// Runs the shared-song API inside the dev and preview servers, so `npm run dev`
// behaves like the production server in server.js.
const songApi = (): Plugin => ({
  name: 'song-api',
  configureServer(server) {
    server.middlewares.use(createSongApi('data'))
  },
  configurePreviewServer(server) {
    server.middlewares.use(createSongApi('data'))
  },
})

// `base: './'` keeps asset paths relative so the build works from any path.
export default defineConfig({
  base: './',
  plugins: [react(), songApi()],
  server: { port: 5173 },
})
