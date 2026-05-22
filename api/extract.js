import { extractFromUrl } from '../server/extract.mjs'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const url = req.query?.url || req.body?.url
  if (!url) return sendJson(res, 400, { error: 'Параметр url обязателен' })

  try {
    const result = await extractFromUrl(url)
    if (result.error) return sendJson(res, 422, result)
    return sendJson(res, 200, result)
  } catch (e) {
    return sendJson(res, 500, {
      error: e instanceof Error ? e.message : 'Ошибка извлечения',
    })
  }
}
