import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

// On the development server only: answer /api/library from the files in
// library/, so the practice page works without Vercel. (Every set is sent
// here; the real api/library.js keeps sets after the first for Pro.)
function devLibrary() {
  return {
    name: 'mnemoq-dev-library',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/library', (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const id = (url.searchParams.get('c') || '').replace(/[^a-z0-9-]/g, '')
        const n = Number(url.searchParams.get('n'))

        try {
          const questions = JSON.parse(readFileSync(join(process.cwd(), 'library', 'sets', id, `${Number.isInteger(n) ? n : 0}.json`), 'utf8'))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ collection: id, n, questions }))
        } catch {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'That practice set does not exist.', code: 'missing' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devLibrary()],
  // Tests cover pure logic only; these stand in for the real Supabase settings.
  test: {
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key' },
  },
})
