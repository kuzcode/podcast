import { extractFromUrl } from '../server/extract.mjs'

/** Конвертация + загрузка в Storage может занять до ~60 с */
export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const url = req.query?.url || req.body?.url
  if (!url) return res.status(400).json({ error: 'Параметр url обязателен' })

  try {
    const result = await extractFromUrl(url)
    if (result.error) return res.status(422).json(result)
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Ошибка извлечения',
    })
  }
}
