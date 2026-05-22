import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function extractApiPlugin(): Plugin {
  return {
    name: 'extract-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/extract')) return next()

        const url = new URL(req.url, 'http://localhost').searchParams.get('url') || ''
        res.setHeader('Content-Type', 'application/json; charset=utf-8')

        try {
          // @ts-expect-error — ESM без типов
          const { extractFromUrl } = await import('./server/extract.mjs')
          const result = await extractFromUrl(url)
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
