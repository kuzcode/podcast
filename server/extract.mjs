/**
 * YouTube → аудио через RapidAPI + Appwrite Storage.
 *
 * Провайдеры (по очереди, пока один не сработает):
 *   1. YouTube to mp3 — POST /download  (marcocollatina)
 *   2. Youtube Mp3 — GET с url          (mp37)
 *   3. youtube-mp310 — GET /download/mp3
 *
 * Подписка: https://rapidapi.com/marcocollatina/api/youtube-to-mp315
 * (или любой из списка — тот же RAPIDAPI_KEY, разные Subscribe)
 *
 * Env: RAPIDAPI_KEY, опционально RAPIDAPI_HOST, APPWRITE_API_KEY
 */

import {
  downloadToBuffer,
  uploadBuffer,
  isAppwriteUploadConfigured,
} from './appwrite-upload.mjs'

const PROVIDERS = [
  {
    id: 'youtube-to-mp315',
    host: 'youtube-to-mp315.p.rapidapi.com',
    subscribeUrl: 'https://rapidapi.com/marcocollatina/api/youtube-to-mp315',
    extract: extractViaMp315,
  },
  {
    id: 'youtube-mp37',
    host: 'youtube-mp37.p.rapidapi.com',
    subscribeUrl: 'https://rapidapi.com/codyseller99payme-Tsqa1Mnw8FL/api/youtube-mp37',
    extract: extractViaMp37,
  },
  {
    id: 'youtube-mp310',
    host: 'youtube-mp310.p.rapidapi.com',
    subscribeUrl: 'https://rapidapi.com/eli7300/api/youtube-mp310',
    extract: extractViaMp310,
  },
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

function getRapidApiKey() {
  return process.env.RAPIDAPI_KEY?.trim() || ''
}

function rapidHeaders(host) {
  const key = getRapidApiKey()
  if (!key) {
    throw new Error(
      `Не настроен RAPIDAPI_KEY. Подпишитесь на API: ${PROVIDERS[0].subscribeUrl}`
    )
  }
  return {
    'x-rapidapi-key': key,
    'x-rapidapi-host': host,
    Accept: 'application/json',
  }
}

function isNotSubscribedError(msg) {
  return /not subscribed|does not exist|not found on the API/i.test(msg)
}

function formatRapidError(data, status, subscribeUrl) {
  const msg =
    data?.msg ||
    data?.message ||
    data?.error ||
    (typeof data?.error === 'object' ? data.error?.message : null) ||
    `RapidAPI ${status}`
  const s = String(msg)
  if (isNotSubscribedError(s)) {
    return `${s}. Подпишитесь (Basic Free): ${subscribeUrl}`
  }
  return s
}

function pickUrl(obj, depth = 0) {
  if (!obj || depth > 5) return null
  if (typeof obj === 'string' && obj.startsWith('http')) return obj.trim()

  const keys = [
    'link',
    'file',
    'downloadUrl',
    'download_url',
    'url',
    'audioUrl',
    'mp3',
    'downloadLink',
  ]

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of keys) {
      const v = obj[k]
      if (typeof v === 'string' && v.startsWith('http')) return v.trim()
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
  return (data?.title || data?.videoTitle || oembed?.title || 'Без названия').slice(
    0,
    200
  )
}

function pickDuration(data, oembed) {
  const d = data?.duration || data?.durationSeconds || oembed?.duration
  const n = Number(d)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function pickThumbnail(videoId, oembed) {
  return oembed?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
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

function baseMeta(videoId, oembed, data = {}) {
  return {
    title: pickTitle(data, oembed),
    description: (data?.description || oembed?.author_name || '').slice(0, 500),
    coverUrl: pickThumbnail(videoId, oembed),
    duration: pickDuration(data, oembed),
    sourcePlatform: 'youtube',
    authorName: oembed?.author_name || data?.channel || '',
  }
}

/** POST /download { url, format: "mp3" } */
async function extractViaMp315(youtubeUrl, videoId, host) {
  const oembed = await fetchOEmbed(youtubeUrl)
  const subscribeUrl = PROVIDERS[0].subscribeUrl

  const res = await fetch(`https://${host}/download`, {
    method: 'POST',
    headers: {
      ...rapidHeaders(host),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: youtubeUrl, format: 'mp3' }),
    signal: AbortSignal.timeout(120000),
  })

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('audio') || contentType.includes('octet-stream')) {
    if (!res.ok) throw new Error(formatRapidError({}, res.status, subscribeUrl))
    if (!isAppwriteUploadConfigured()) {
      throw new Error('Нужен APPWRITE_API_KEY для сохранения MP3')
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const uploaded = await uploadBuffer(
      buffer,
      `audio_${videoId}.mp3`,
      contentType || 'audio/mpeg'
    )
    return {
      ...baseMeta(videoId, oembed),
      audioUrl: uploaded.viewUrl,
      audioFileId: uploaded.fileId,
    }
  }

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Некорректный ответ API')
  }

  if (!res.ok) {
    throw new Error(formatRapidError(data, res.status, subscribeUrl))
  }

  const audioUrl = pickUrl(data)
  if (!audioUrl) {
    throw new Error(data?.msg || data?.message || 'API не вернул ссылку на аудио')
  }

  return { ...baseMeta(videoId, oembed, data), audioUrl }
}

/** youtube-mp37 — JSON { status, file } */
async function extractViaMp37(youtubeUrl, videoId, host) {
  const oembed = await fetchOEmbed(youtubeUrl)
  const subscribeUrl = PROVIDERS[1].subscribeUrl
  const paths = [
    `/?url=${encodeURIComponent(youtubeUrl)}`,
    `/download?url=${encodeURIComponent(youtubeUrl)}`,
    `/convert?url=${encodeURIComponent(youtubeUrl)}`,
  ]

  let lastErr
  for (const path of paths) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers: rapidHeaders(host),
        signal: AbortSignal.timeout(60000),
      })
      const text = await res.text()
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        if (res.ok && text.startsWith('http')) {
          return { ...baseMeta(videoId, oembed), audioUrl: text.trim() }
        }
        continue
      }

      if (!res.ok) {
        lastErr = new Error(formatRapidError(data, res.status, subscribeUrl))
        continue
      }

      if (data?.status === 'fail' || data?.status === 'error') {
        lastErr = new Error(data?.message || 'Конвертация не удалась')
        continue
      }

      const audioUrl = pickUrl(data)
      if (audioUrl) {
        return { ...baseMeta(videoId, oembed, data), audioUrl }
      }
      lastErr = new Error('Нет ссылки в ответе')
    } catch (e) {
      lastErr = e
    }
  }

  throw lastErr || new Error('youtube-mp37 недоступен')
}

/** GET /download/mp3?url= */
async function extractViaMp310(youtubeUrl, videoId, host) {
  const oembed = await fetchOEmbed(youtubeUrl)
  const subscribeUrl = PROVIDERS[2].subscribeUrl

  const res = await fetch(
    `https://${host}/download/mp3?url=${encodeURIComponent(youtubeUrl)}`,
    { headers: rapidHeaders(host), signal: AbortSignal.timeout(60000) }
  )

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('audio')) {
    if (!res.ok) throw new Error(formatRapidError({}, res.status, subscribeUrl))
    if (!isAppwriteUploadConfigured()) {
      throw new Error('Нужен APPWRITE_API_KEY для сохранения MP3')
    }
    const uploaded = await uploadBuffer(
      Buffer.from(await res.arrayBuffer()),
      `audio_${videoId}.mp3`,
      'audio/mpeg'
    )
    return {
      ...baseMeta(videoId, oembed),
      audioUrl: uploaded.viewUrl,
      audioFileId: uploaded.fileId,
    }
  }

  const text = await res.text()

  if (res.ok && text.trim().startsWith('http')) {
    return { ...baseMeta(videoId, oembed), audioUrl: text.trim() }
  }

  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(formatRapidError({}, res.status, subscribeUrl))
  }

  if (!res.ok) {
    throw new Error(formatRapidError(data, res.status, subscribeUrl))
  }

  const audioUrl = pickUrl(data)
  if (!audioUrl) throw new Error('youtube-mp310 не вернул ссылку')

  return { ...baseMeta(videoId, oembed, data), audioUrl }
}

async function persistToAppwrite(extract, videoId) {
  if (!isAppwriteUploadConfigured()) return extract

  let { audioUrl, audioFileId = '', coverUrl, coverFileId = '' } = extract

  if (!audioFileId && audioUrl) {
    try {
      const buf = await downloadToBuffer(audioUrl)
      const isMp3 = /\.mp3|mp3/i.test(audioUrl)
      const ext = isMp3 ? 'mp3' : 'm4a'
      const mime = isMp3 ? 'audio/mpeg' : 'audio/mp4'
      const up = await uploadBuffer(buf, `audio_${videoId}.${ext}`, mime)
      audioUrl = up.viewUrl
      audioFileId = up.fileId
    } catch (e) {
      console.warn('[extract] audio upload:', e)
    }
  }

  if (coverUrl && !coverFileId && coverUrl.startsWith('http')) {
    try {
      const buf = await downloadToBuffer(coverUrl, 5 * 1024 * 1024)
      const up = await uploadBuffer(buf, `cover_${videoId}.jpg`, 'image/jpeg')
      coverUrl = up.viewUrl
      coverFileId = up.fileId
    } catch (e) {
      console.warn('[extract] cover upload:', e)
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
      error: `Не настроен RAPIDAPI_KEY. Подписка: ${PROVIDERS[0].subscribeUrl}`,
    }
  }

  const customHost = process.env.RAPIDAPI_HOST?.trim()
  const providers = customHost
    ? [
        {
          id: 'custom',
          host: customHost,
          subscribeUrl: `https://rapidapi.com/search?q=${encodeURIComponent(customHost)}`,
          extract: (u, v, h) => extractViaMp315(u, v, h),
        },
      ]
    : PROVIDERS

  const errors = []

  for (const p of providers) {
    try {
      let extract = await p.extract(trimmed, videoId, p.host)
      extract = await persistToAppwrite(extract, videoId)
      if (!extract.audioUrl) {
        errors.push(`${p.id}: нет audioUrl`)
        continue
      }
      return extract
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${p.id}: ${msg}`)
    }
  }

  return {
    error: [
      'Не удалось получить аудио.',
      'Подпишитесь на один из API (Basic Free):',
      PROVIDERS.map((p) => p.subscribeUrl).join(' или '),
      errors.join(' | '),
    ].join(' '),
  }
}
