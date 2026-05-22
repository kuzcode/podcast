/**
 * Video Download API (https://video-download-api.com)
 * REST: создать job → poll progress → получить MP3 URL.
 * Бесплатный старт, pay-as-you-go (~$0.0003/MP3), не RapidAPI, не yt-dlp.
 */

const DEFAULT_HOST = 'https://p.savenow.to'
const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 45

function apiHost() {
  return (process.env.VIDEO_DOWNLOAD_API_HOST || DEFAULT_HOST).replace(/\/$/, '')
}

function apiKey() {
  const key = process.env.VIDEO_DOWNLOAD_API_KEY?.trim()
  if (!key) {
    throw new Error(
      'Не задан VIDEO_DOWNLOAD_API_KEY. Получите бесплатный ключ: https://video-download-api.com/get-api-key'
    )
  }
  return key
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function apiFetch(path, { timeout = 30000 } = {}) {
  const res = await fetch(`${apiHost()}${path}`, {
    headers: { 'User-Agent': 'Atelier-Podcast/1.0' },
    signal: AbortSignal.timeout(timeout),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Сервис конвертации вернул некорректный ответ')
  }
  return { res, data }
}

/**
 * @param {string} youtubeUrl
 * @returns {Promise<{ title: string, duration: number, coverUrl: string, audioUrl: string }>}
 */
export async function convertYoutubeToMp3(youtubeUrl) {
  const params = new URLSearchParams({
    format: 'mp3',
    url: youtubeUrl,
    apikey: apiKey(),
    add_info: '1',
  })

  const { data: job } = await apiFetch(`/ajax/download.php?${params}`, { timeout: 60000 })

  if (!job?.success) {
    throw new Error(job?.error || job?.message || 'Не удалось начать конвертацию')
  }

  const meta = job.additional_info || {}
  const title = (job.title || meta.title || 'Без названия').slice(0, 200)
  const coverUrl =
    meta.thumbnail || job.info?.image || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`
  const duration = Math.floor(meta.duration || 0)

  const jobId = job.id
  if (!jobId) {
    if (job.download_url) {
      return { title, duration, coverUrl, audioUrl: job.download_url }
    }
    throw new Error('Сервис не вернул идентификатор задачи')
  }

  const progressPath = job.progress_url
    ? new URL(job.progress_url).pathname + new URL(job.progress_url).search
    : `/ajax/progress?id=${encodeURIComponent(jobId)}`

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS)

    const { data: progress } = await apiFetch(progressPath, { timeout: 30000 })

    if (progress?.success === false || progress?.error) {
      throw new Error(progress.error || progress.text || 'Ошибка конвертации')
    }

    if (progress?.progress === 1000 && progress?.download_url) {
      const audioUrl = pickDownloadUrl(progress)
      if (!audioUrl) throw new Error('Ссылка на аудио не получена')
      return { title, duration, coverUrl, audioUrl }
    }
  }

  throw new Error('Превышено время ожидания конвертации. Попробуйте короче видео или позже')
}

function pickDownloadUrl(progress) {
  const primary = progress.download_url
  if (primary && typeof primary === 'string') return primary

  const alts = progress.alternative_download_urls
  if (Array.isArray(alts)) {
    const withSsl = alts.find((a) => a?.has_ssl && a?.url)
    if (withSsl?.url) return withSsl.url
    if (alts[0]?.url) return alts[0].url
  }
  return null
}
