/**
 * Извлечение аудио из YouTube через RapidAPI + сохранение в Appwrite Storage.
 *
 * Провайдер по умолчанию: YouTube to Mp4/Mp3 (RapidAPI, openapis)
 * — бесплатно ~100 запросов/день, стабильные CDN-ссылки.
 *
 * Переменные окружения (Vercel + локальный .env):
 *   RAPIDAPI_KEY          — обязательно
 *   RAPIDAPI_HOST         — опционально (по умолчанию youtube-to-mp4-mp3.p.rapidapi.com)
 *   APPWRITE_API_KEY      — для загрузки в bucket media
 *   APPWRITE_PROJECT_ID   — или VITE_APPWRITE_PROJECT_ID
 */

import {
  downloadToBuffer,
  uploadBuffer,
  isAppwriteUploadConfigured,
} from './appwrite-upload.mjs'

const DEFAULT_RAPID_HOST = 'youtube-to-mp4-mp3.p.rapidapi.com'
const FALLBACK_RAPID_HOST = 'youtube-to-mp315.p.rapidapi.com'

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

function getRapidApiKey() {
  return process.env.RAPIDAPI_KEY?.trim() || ''
}

function rapidHeaders(host) {
  const key = getRapidApiKey()
  if (!key) {
    throw new Error(
      'Не настроен RAPIDAPI_KEY. Получите бесплатный ключ: https://rapidapi.com/openapis/api/youtube-to-mp4-mp3'
    )
  }
  return {
    'x-rapidapi-key': key,
    'x-rapidapi-host': host,
    Accept: 'application/json',
  }
}

async function rapidFetch(path, host, query = {}) {
  const qs = new URLSearchParams(query).toString()
  const url = `https://${host}${path}${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: rapidHeaders(host),
    signal: AbortSignal.timeout(45000),
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.msg ||
      (typeof data?.error === 'object' ? data.error?.message : null) ||
      `RapidAPI ${res.status}`
    throw new Error(String(msg))
  }

  return data
}

async function rapidPost(path, host, body) {
  const res = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      ...rapidHeaders(host),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('audio') || contentType.includes('octet-stream')) {
    if (!res.ok) throw new Error(`RapidAPI ${res.status}`)
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType }
  }

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `RapidAPI ${res.status}`
    throw new Error(String(msg))
  }

  return { json: data }
}

function pickUrl(obj, depth = 0) {
  if (!obj || depth > 4) return null
  if (typeof obj === 'string' && obj.startsWith('http')) return obj

  const keys = [
    'downloadUrl',
    'download_url',
    'url',
    'link',
    'audioUrl',
    'audio_url',
    'mp3',
    'file',
    'src',
  ]

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of keys) {
      const v = obj[k]
      if (typeof v === 'string' && v.startsWith('http')) return v
    }
    for (const v of Object.values(obj)) {
      const found = pickUrl(v, depth + 1)
      if (found) return found
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = pickUrl(item, depth + 1)
      if (found) return found
    }
  }

  return null
}

function pickTitle(data, oembed) {
  return (
    data?.title ||
    data?.videoTitle ||
    data?.name ||
    oembed?.title ||
    'Без названия'
  )
}

function pickDuration(data, oembed) {
  const d =
    data?.duration ||
    data?.durationSeconds ||
    data?.lengthSeconds ||
    data?.length ||
    oembed?.duration
  const n = Number(d)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function pickThumbnail(data, oembed, videoId) {
  return (
    data?.thumbnail ||
    data?.thumbnailUrl ||
    data?.image ||
    data?.thumb ||
    oembed?.thumbnail_url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  )
}

function pickAuthor(data, oembed) {
  return (
    data?.channel ||
    data?.channelName ||
    data?.author ||
    data?.uploader ||
    oembed?.author_name ||
    ''
  )
}

async function fetchOEmbed(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Основной провайдер: audio-info + video-info */
async function extractViaMp4Mp3Api(youtubeUrl, videoId) {
  const host = process.env.RAPIDAPI_HOST?.trim() || DEFAULT_RAPID_HOST
  const oembed = await fetchOEmbed(youtubeUrl)

  let videoData = {}
  let audioData = {}

  try {
    audioData = await rapidFetch('/api/audio-info', host, { url: youtubeUrl })
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    if (!err.includes('404')) throw e
  }

  try {
    videoData = await rapidFetch('/api/video-info', host, { url: youtubeUrl })
  } catch {
    /* video-info опционален */
  }

  const merged = { ...videoData, ...audioData }
  let audioUrl = pickUrl(audioData) || pickUrl(videoData) || pickUrl(merged)

  if (!audioUrl) {
    throw new Error('API не вернул ссылку на аудио. Попробуйте другое видео.')
  }

  return {
    title: pickTitle(merged, oembed).slice(0, 200),
    description: (merged?.description || oembed?.author_name || '').slice(0, 500),
    coverUrl: pickThumbnail(merged, oembed, videoId),
    audioUrl,
    duration: pickDuration(merged, oembed),
    sourcePlatform: 'youtube',
    authorName: pickAuthor(merged, oembed),
  }
}

/** Запасной провайдер: прямой MP3-стрим */
async function extractViaMp315Api(youtubeUrl, videoId) {
  const host = FALLBACK_RAPID_HOST
  const oembed = await fetchOEmbed(youtubeUrl)

  const result = await rapidPost('/download', host, { url: youtubeUrl })
  const { buffer, json, contentType } = result

  if (buffer) {
    if (!isAppwriteUploadConfigured()) {
      throw new Error(
        'Прямой MP3 от API требует APPWRITE_API_KEY для сохранения в Storage'
      )
    }
    const uploaded = await uploadBuffer(
      buffer,
      `audio_${videoId}.mp3`,
      contentType || 'audio/mpeg'
    )
    return {
      title: pickTitle(json || {}, oembed).slice(0, 200),
      description: (oembed?.author_name || '').slice(0, 500),
      coverUrl: pickThumbnail({}, oembed, videoId),
      audioUrl: uploaded.viewUrl,
      audioFileId: uploaded.fileId,
      duration: pickDuration(json || {}, oembed),
      sourcePlatform: 'youtube',
      authorName: pickAuthor({}, oembed),
    }
  }

  const audioUrl = pickUrl(json)
  if (!audioUrl) throw new Error('Запасной API не вернул аудио')

  return {
    title: pickTitle(json, oembed).slice(0, 200),
    description: (json?.description || '').slice(0, 500),
    coverUrl: pickThumbnail(json, oembed, videoId),
    audioUrl,
    duration: pickDuration(json, oembed),
    sourcePlatform: 'youtube',
    authorName: pickAuthor(json, oembed),
  }
}

async function persistToAppwrite(extract, videoId) {
  if (!isAppwriteUploadConfigured()) {
    return extract
  }

  let audioUrl = extract.audioUrl
  let audioFileId = extract.audioFileId || ''
  let coverUrl = extract.coverUrl
  let coverFileId = extract.coverFileId || ''

  if (!audioFileId && audioUrl) {
    try {
      const ext = audioUrl.includes('.webm') ? 'webm' : 'm4a'
      const mime = ext === 'webm' ? 'audio/webm' : 'audio/mp4'
      const buf = await downloadToBuffer(audioUrl)
      const up = await uploadBuffer(buf, `audio_${videoId}.${ext}`, mime)
      audioUrl = up.viewUrl
      audioFileId = up.fileId
    } catch (e) {
      console.warn('[extract] audio upload failed:', e)
    }
  }

  if (coverUrl && !coverFileId && coverUrl.startsWith('http')) {
    try {
      const buf = await downloadToBuffer(coverUrl, 5 * 1024 * 1024)
      const up = await uploadBuffer(buf, `cover_${videoId}.jpg`, 'image/jpeg')
      coverUrl = up.viewUrl
      coverFileId = up.fileId
    } catch (e) {
      console.warn('[extract] cover upload failed:', e)
    }
  }

  return { ...extract, audioUrl, audioFileId, coverUrl, coverFileId }
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

  if (!getRapidApiKey()) {
    return {
      error:
        'Не настроен RAPIDAPI_KEY. Бесплатный ключ: rapidapi.com → YouTube to Mp4/Mp3',
    }
  }

  let extract
  let lastError

  try {
    extract = await extractViaMp4Mp3Api(trimmed, videoId)
  } catch (e) {
    lastError = e
    try {
      extract = await extractViaMp315Api(trimmed, videoId)
    } catch (e2) {
      const msg1 = lastError instanceof Error ? lastError.message : 'Ошибка API'
      const msg2 = e2 instanceof Error ? e2.message : 'Ошибка запасного API'
      return { error: `${msg1}. ${msg2}` }
    }
  }

  try {
    extract = await persistToAppwrite(extract, videoId)
  } catch (e) {
    console.warn('[extract] persist:', e)
  }

  if (!extract.audioUrl) {
    return { error: 'Не удалось получить аудио' }
  }

  return extract
}
