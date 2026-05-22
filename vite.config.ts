// @ts-nocheck
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { Readable } from 'stream'
import { extractFromUrl } from './server/extract.mjs'
import {
  decodeProxyUrl,
  proxyAudioRequest,
  setProxyResponseHeaders,
} from './server/audio-proxy.mjs'

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const urlObj = new URL(req.url, 'http://localhost')

        if (urlObj.pathname === '/api/extract') {
          const videoUrl = urlObj.searchParams.get('url') || ''
          const origin = 'http://localhost:5173'
          try {
            const result = await extractFromUrl(videoUrl, origin)
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = result.error ? 422 : 200
            res.end(JSON.stringify(result))
          } catch (e) {
            res.statusCode = 500
            res.end(
              JSON.stringify({ error: e instanceof Error ? e.message : 'Ошибка' })
            )
          }
          return
        }

        if (urlObj.pathname === '/api/audio-proxy') {
          const target = decodeProxyUrl(urlObj.searchParams.get('u'))
          if (!target?.startsWith('http')) {
            res.statusCode = 400
            res.end('Bad request')
            return
          }
          try {
            const upstream = await proxyAudioRequest(target, {
              range: req.headers.range as string | undefined,
            })
            setProxyResponseHeaders(res as unknown as import('http').ServerResponse, upstream)
            res.statusCode = upstream.status
            if (!upstream.body) {
              res.end()
              return
            }
            Readable.fromWeb(upstream.body as ReadableStream).pipe(
              res as unknown as NodeJS.WritableStream
            )
          } catch {
            res.statusCode = 502
            res.end('Proxy error')
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
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
