import { Readable } from 'stream'
import {
  decodeProxyUrl,
  proxyAudioRequest,
  setProxyResponseHeaders,
} from '../server/audio-proxy.mjs'

export const config = {
  api: {
    responseLimit: false,
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Range')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const target = decodeProxyUrl(req.query?.u)
  if (!target?.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid audio URL' })
  }

  try {
    const upstream = await proxyAudioRequest(target, {
      range: req.headers.range,
    })

    setProxyResponseHeaders(res, upstream)
    res.status(upstream.status)

    if (!upstream.body) {
      res.end()
      return
    }

    const nodeStream = Readable.fromWeb(upstream.body)
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(502)
      res.end()
    })
    nodeStream.pipe(res)
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Proxy failed',
      })
    }
  }
}
