import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// @ts-expect-error — ESM helper без типов
import { extractFromUrl } from './server/extract.mjs'

function extractApiPlugin(): Plugin {
  return {
    name: 'extract-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/extract')) return next()

        const url = new URL(req.url, 'http://localhost').searchParams.get('url') || ''
        try {
          const result = await extractFromUrl(url)
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = result.error ? 422 : 200
          res.end(JSON.stringify(result))
        } catch (e) {
          res.statusCode = 500
          res.end(
            JSON.stringify({
              error: e instanceof Error ? e.message : 'Ошибка',
            })
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), extractApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
