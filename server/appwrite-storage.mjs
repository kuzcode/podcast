/**
 * Загрузка аудио и обложки в Appwrite Storage (server API key).
 */

import { Client, Storage, ID, Permission, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'

function env(primary, fallback = '') {
  const viteKey = primary.startsWith('VITE_') ? primary : `VITE_${primary}`
  return (process.env[primary] || process.env[viteKey] || fallback).trim()
}

export function isStorageUploadConfigured() {
  return Boolean(env('APPWRITE_API_KEY') && env('APPWRITE_PROJECT_ID'))
}

function getStorage() {
  const endpoint = env('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1')
  const projectId = env('APPWRITE_PROJECT_ID')
  const apiKey = env('APPWRITE_API_KEY')
  const bucketId = env('APPWRITE_MEDIA_BUCKET', 'media')

  if (!apiKey || !projectId) {
    throw new Error('Appwrite Storage: задайте APPWRITE_API_KEY и APPWRITE_PROJECT_ID')
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  return { storage: new Storage(client), bucketId, projectId, endpoint }
}

function fileViewUrl(endpoint, bucketId, projectId, fileId) {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`
}

async function fetchBytes(url, maxBytes = 100 * 1024 * 1024) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Atelier-Podcast/1.0' },
    signal: AbortSignal.timeout(120000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Не удалось скачать файл (${res.status})`)

  const len = Number(res.headers.get('content-length') || 0)
  if (len > maxBytes) throw new Error('Файл слишком большой для загрузки в Storage')

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new Error('Файл слишком большой для загрузки в Storage')

  const type = (res.headers.get('content-type') || '').toLowerCase()
  if (type.includes('text/html')) {
    throw new Error('Получена страница вместо файла — проверьте VIDEO_DOWNLOAD_API_KEY')
  }

  return { buffer: buf, mime: res.headers.get('content-type') || '' }
}

/**
 * @param {{ audioUrl: string, coverUrl: string, videoId: string }}
 */
export async function uploadPodcastMedia({ audioUrl, coverUrl, videoId }) {
  const { storage, bucketId, projectId, endpoint } = getStorage()
  const permissions = [Permission.read(Role.any())]

  const { buffer: audioBuf, mime: audioMime } = await fetchBytes(audioUrl)
  const audioName = `audio_${videoId}.mp3`
  const audioFile = await storage.createFile(
    bucketId,
    ID.unique(),
    InputFile.fromBuffer(audioBuf, audioName),
    permissions
  )

  let coverFileId = ''
  let coverViewUrl = coverUrl

  try {
    const { buffer: coverBuf } = await fetchBytes(coverUrl, 10 * 1024 * 1024)
    const coverName = `cover_${videoId}.jpg`
    const coverFile = await storage.createFile(
      bucketId,
      ID.unique(),
      InputFile.fromBuffer(coverBuf, coverName),
      permissions
    )
    coverFileId = coverFile.$id
    coverViewUrl = fileViewUrl(endpoint, bucketId, projectId, coverFileId)
  } catch {
    /* обложка опциональна — остаётся внешний URL */
  }

  return {
    audioFileId: audioFile.$id,
    audioUrl: fileViewUrl(endpoint, bucketId, projectId, audioFile.$id),
    coverFileId,
    coverUrl: coverViewUrl,
  }
}
