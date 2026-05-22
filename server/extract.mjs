/** YouTube → MP3 через Video Download API + сохранение в Appwrite Storage. */

import { convertYoutubeToMp3 } from './video-download-api.mjs'

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

function canUploadToStorage() {
  const key = process.env.APPWRITE_API_KEY?.trim()
  const project =
    process.env.APPWRITE_PROJECT_ID?.trim() ||
    process.env.VITE_APPWRITE_PROJECT_ID?.trim()
  return Boolean(key && project)
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

  try {
    const converted = await convertYoutubeToMp3(trimmed)

    let audioUrl = converted.audioUrl
    let coverUrl = converted.coverUrl
    let audioFileId = ''
    let coverFileId = ''

    if (canUploadToStorage()) {
      try {
        const { uploadPodcastMedia } = await import('./appwrite-storage.mjs')
        const stored = await uploadPodcastMedia({
          audioUrl: converted.audioUrl,
          coverUrl: converted.coverUrl,
          videoId,
        })
        audioUrl = stored.audioUrl
        coverUrl = stored.coverUrl
        audioFileId = stored.audioFileId
        coverFileId = stored.coverFileId
      } catch (uploadErr) {
        console.error('[extract] Appwrite upload failed:', uploadErr)
        return {
          error:
            uploadErr instanceof Error
              ? uploadErr.message
              : 'Не удалось сохранить файлы в Storage',
        }
      }
    }

    return {
      title: converted.title,
      description: '',
      coverUrl,
      coverFileId,
      audioUrl,
      audioFileId,
      duration: converted.duration,
      sourcePlatform: 'youtube',
      authorName: '',
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка извлечения'
    return { error: message }
  }
}
