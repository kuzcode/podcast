/** YouTube → аудио. Сначала ytdl (надёжно с Vercel), затем Piped/Invidious. */

import { extractViaYtdl } from './extract-ytdl.mjs'

const PIPED = [
  'https://pipedapi.syncpundit.io',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.r4fo.com',
]

const INVIDIOUS = [
  'https://yewtu.be',
  'https://vid.puffyan.us',
  'https://invidious.fdn.fr',
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

async function fetchJson(url, timeoutMs = 20000) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

export function wrapAudioProxy(directUrl, publicOrigin = '') {
  const b = Buffer.from(directUrl, 'utf8').toString('base64url')
  const origin = (publicOrigin || '').replace(/\/$/, '')
  return `${origin}/api/audio-proxy?u=${b}`
}

function formatError(e) {
  if (e instanceof Error) return e.message
  return String(e)
}

function finalizeExtract(raw, videoId, publicOrigin) {
  const fallbackCover = youtubeThumbnail(videoId)
  return {
    title: (raw.title || 'Подкаст с YouTube').slice(0, 200),
    description: (raw.description || '').slice(0, 500),
    coverUrl: raw.coverUrl || fallbackCover,
    audioUrl: wrapAudioProxy(raw.audioUrl, publicOrigin),
    duration: Math.floor(Number(raw.duration) || 0),
    sourcePlatform: 'youtube',
    authorName: raw.authorName || '',
  }
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

  const watchUrl = trimmed.includes('youtube') || trimmed.includes('youtu.be')
    ? trimmed
    : `https://www.youtube.com/watch?v=${videoId}`

  const errors = []

  // 1) Основной способ — работает с Vercel
  try {
    const raw = await extractViaYtdl(videoId, watchUrl)
    if (raw.audioUrl) return finalizeExtract(raw, videoId, publicOrigin)
  } catch (e) {
    errors.push(`ytdl: ${formatError(e)}`)
  }

  // 2) Запасные
  for (const fn of [extractViaPiped, extractViaInvidious]) {
    try {
      const raw = await fn(videoId)
      if (!raw.audioUrl) continue

      if (!raw.title) {
        const meta = await fetchOEmbed(videoId)
        raw.title = meta.title
        raw.authorName = raw.authorName || meta.authorName
      }

      return finalizeExtract(raw, videoId, publicOrigin)
    } catch (e) {
      errors.push(formatError(e))
    }
  }

  return {
    error:
      'Не удалось получить аудио. Попробуйте другое видео (короче 30 мин).\n' +
      errors.slice(0, 3).join(' | '),
  }
}
