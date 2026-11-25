import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import { applyOverlay } from './src/practice/overlay.js'

// On the development server only: answer /api/library from the files in
// library/, so the practice page works without Vercel. (Every set is sent
// here, with the curated overlay joined; the real api/library.js keeps the
// second half of each collection for Pro.)
function devLibrary() {
  return {
    name: 'mnemoq-dev-library',
    apply: 'serve',
    configureServer(server) {
      // A canned AI coach analysis, so the report page can be previewed offline.
      server.middlewares.use('/api/coach', (req, res, next) => {
        if (req.method !== 'POST') return next()

        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              analysis: {
                summary: 'Preview analysis: you are strongest in English and losing most marks in maths word problems. Fixing two algebra habits is the fastest way up.',
                strengths: [{ area: 'Vocabulary', detail: 'You got every meaning-in-context question right.' }],
                weaknesses: [
                  { section: 'english', area: 'Since vs for', detail: 'You chose "for" with a starting point ("for 2015").', fix: 'Use "since" with a point in time, "for" with a length of time. Review the card daily this week.' },
                  { section: 'bmath', area: 'Percent change', detail: 'You divided by the new price instead of the original.', fix: 'Always divide the change by the starting value. Do 10 percent-change drills.' },
                ],
                focus: ['Review your 12 new cards every day', 'Do one Mathematics practice set', 'Retake the diagnostic next Friday'],
              },
              remaining: 29,
            })
          )
        }, 1200)
      })

      server.middlewares.use('/api/library', (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const id = (url.searchParams.get('c') || '').replace(/[^a-z0-9-]/g, '')
        const n = Number(url.searchParams.get('n'))

        try {
          const file = `${Number.isInteger(n) ? n : 0}.json`
          let overlay = null

          try {
            overlay = JSON.parse(readFileSync(join(process.cwd(), 'library', 'overlay', id, file), 'utf8'))
          } catch {
            // No overlay for this set.
          }

          const questions = applyOverlay(JSON.parse(readFileSync(join(process.cwd(), 'library', 'sets', id, file), 'utf8')), overlay)

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
