// Production server: serves the built site from dist/ plus the shared-song API.
// Build first (`npm run build`), then `npm start`. Set PORT to change the port.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSongApi } from './server/song-api.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = resolve(root, 'dist')
const songApi = createSongApi(process.env.DATA_DIR || resolve(root, 'data'))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

createServer((req, res) => {
  songApi(req, res, () => {
    const path = normalize(decodeURIComponent((req.url || '/').split('?')[0]))
    let file = join(dist, path)
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(dist, 'index.html')
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': file.includes(`${dist}/assets/`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    createReadStream(file).pipe(res)
  })
}).listen(process.env.PORT || 3000, () => {
  console.log(`Site running on http://localhost:${process.env.PORT || 3000}`)
})
