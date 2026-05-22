import { extractFromUrl } from '../server/extract.mjs'

function getPublicOrigin(req) {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL.replace(/\/$/, '')
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return host ? `${proto}://${host}` : ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const url = req.query?.url
  if (!url) return res.status(400).json({ error: 'Параметр url обязателен' })

  try {
    const origin = getPublicOrigin(req)
    const result = await extractFromUrl(url, origin)
    if (result.error) return res.status(422).json(result)
    if (!result.audioUrl) {
      return res.status(422).json({ error: 'Аудио не найдено' })
    }
    return res.status(200).json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка извлечения'
    return res.status(500).json({ error: msg })
  }
}
