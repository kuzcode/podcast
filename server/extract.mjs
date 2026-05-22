/** YouTube → аудио. Приоритет: звук. Обложка — запасной URL с i.ytimg.com */

const PIPED = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.syncpundit.io',
  'https://pipedapi.r4fo.com',
  'https://api.piped.privacydev.net',
]

const INVIDIOUS = [
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
  'https://vid.puffyan.us',
  'https://invidious.jing.rocks',
  'https://yt.artemislena.eu',
]

export function extractYoutubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0]
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(?:shorts|embed|v|live)\/([^/?]+)/)
    return m?.[1] || null
  } catch {
    return null
  }
}

export function youtubeThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

async function fetchJson(url, timeoutMs = 25000) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Atelier/1.0 (Telegram Mini App)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function pickAudioUrl(streams) {
  if (!streams?.length) return null
  const sorted = [...streams].sort(
    (a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0)
  )
  for (const s of sorted) {
    if (s.url) return s.url
  }
  return null
}

async function extractViaPiped(videoId) {
  let lastErr
  for (const base of PIPED) {
    try {
      const data = await fetchJson(`${base}/streams/${videoId}`)
      const url = pickAudioUrl(data.audioStreams)
      if (!url) throw new Error('no audio streams')
      return {
        title: data.title,
        description: data.description,
        audioUrl: url,
        duration: data.duration,
        authorName: data.uploader,
        coverUrl: data.thumbnail,
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Piped недоступен')
}

async function extractViaInvidious(videoId) {
  let lastErr
  for (const base of INVIDIOUS) {
    try {
      const data = await fetchJson(`${base}/api/v1/videos/${videoId}`)
      const adaptive = data.adaptiveFormats || []
      const audioFormats = adaptive.filter(
        (f) => f.type?.startsWith('audio/') && f.url
      )
      const url = pickAudioUrl(
        audioFormats.map((f) => ({
          url: f.url,
          bitrate: Number(f.bitrate) || 0,
        }))
      )
      if (!url) throw new Error('no audio in invidious')
      return {
        title: data.title,
        description: data.description,
        audioUrl: url,
        duration: data.lengthSeconds,
        authorName: data.author,
        coverUrl: data.videoThumbnails?.[0]?.url,
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Invidious недоступен')
}

/** oEmbed — только название (если аудио уже есть) */
async function fetchOEmbed(videoId) {
  try {
    const watch = `https://www.youtube.com/watch?v=${videoId}`
    const data = await fetchJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      10000
    )
    return { title: data.title, authorName: data.author_name }
  } catch {
    return {}
  }
}

/** Прямая ссылка → наш прокси (обход CORS в плеере) */
export function wrapAudioProxy(directUrl, publicOrigin = '') {
  const b = Buffer.from(directUrl, 'utf8').toString('base64url')
  const origin = (publicOrigin || '').replace(/\/$/, '')
  return `${origin}/api/audio-proxy?u=${b}`
}

export async function extractFromUrl(url, publicOrigin = '') {
  const trimmed = url?.trim()
  if (!trimmed?.startsWith('http')) {
    return { error: 'Некорректная ссылка' }
  }

  const videoId = extractYoutubeId(trimmed)
  if (!videoId) {
    return { error: 'Поддерживается только YouTube (видео, Shorts, youtu.be)' }
  }

  const fallbackCover = youtubeThumbnail(videoId)
  const errors = []

  for (const fn of [extractViaPiped, extractViaInvidious]) {
    try {
      const raw = await fn(videoId)
      if (!raw.audioUrl) continue

      let title = raw.title
      let authorName = raw.authorName
      if (!title) {
        const meta = await fetchOEmbed(videoId)
        title = meta.title
        authorName = authorName || meta.authorName
      }

      return {
        title: (title || 'Подкаст с YouTube').slice(0, 200),
        description: (raw.description || '').slice(0, 500),
        coverUrl: raw.coverUrl || fallbackCover,
        audioUrl: wrapAudioProxy(raw.audioUrl, publicOrigin),
        duration: Math.floor(Number(raw.duration) || 0),
        sourcePlatform: 'youtube',
        authorName: authorName || '',
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    error:
      'Не удалось получить аудио. Попробуйте другое видео или позже.\n' +
      errors.slice(0, 2).join(' · '),
  }
}
