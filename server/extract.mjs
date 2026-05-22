/** Извлечение метаданных и аудио-ссылки (YouTube через Piped API). */

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
]

export function extractYoutubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0]
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([^/?]+)/)
    return m?.[1] || null
  } catch {
    return null
  }
}

async function fetchPiped(videoId) {
  let lastError
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Atelier/1.0' },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`Piped ${res.status}`)
      return await res.json()
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Piped недоступен')
}

export async function extractFromUrl(url) {
  const trimmed = url?.trim()
  if (!trimmed?.startsWith('http')) {
    return { error: 'Некорректная ссылка' }
  }

  const videoId = extractYoutubeId(trimmed)
  if (!videoId) {
    return {
      error: 'Сейчас поддерживается только YouTube (видео, Shorts, youtu.be)',
    }
  }

  const data = await fetchPiped(videoId)
  const streams = data.audioStreams || []
  if (!streams.length) {
    return { error: 'Не найдено аудио для этого видео' }
  }

  const best = streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]

  return {
    title: (data.title || 'Без названия').slice(0, 200),
    description: (data.description || '').slice(0, 500),
    coverUrl: data.thumbnail || '',
    audioUrl: best.url,
    duration: Math.floor(data.duration || 0),
    sourcePlatform: 'youtube',
    authorName: data.uploader || data.uploaderUrl || '',
  }
}
