import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { Client, Storage, ID, Permission, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'

const MAX_BYTES = 100 * 1024 * 1024

function loadEnvSync() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvSync()

function getStorageClient() {
  const apiKey = process.env.APPWRITE_API_KEY
  const projectId =
    process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  if (!apiKey || !projectId) return null

  const client = new Client()
    .setEndpoint(
      process.env.APPWRITE_ENDPOINT ||
        process.env.VITE_APPWRITE_ENDPOINT ||
        'https://cloud.appwrite.io/v1'
    )
    .setProject(projectId)
    .setKey(apiKey)

  return new Storage(client)
}

export function getMediaBucketId() {
  return (
    process.env.APPWRITE_MEDIA_BUCKET ||
    process.env.VITE_APPWRITE_MEDIA_BUCKET ||
    'media'
  )
}

export function getFileViewUrl(fileId) {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ||
    process.env.VITE_APPWRITE_ENDPOINT ||
    'https://cloud.appwrite.io/v1'
  const projectId =
    process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  const bucket = getMediaBucketId()
  return `${endpoint}/storage/buckets/${bucket}/files/${fileId}/view?project=${projectId}`
}

export function isAppwriteUploadConfigured() {
  const apiKey = process.env.APPWRITE_API_KEY
  const projectId =
    process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID
  return Boolean(apiKey && projectId)
}

export async function downloadToBuffer(url, maxBytes = MAX_BYTES) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Atelier/1.0' },
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    throw new Error(`Не удалось скачать файл (${res.status})`)
  }

  const len = Number(res.headers.get('content-length') || 0)
  if (len > maxBytes) {
    throw new Error('Файл слишком большой (лимит 100 МБ)')
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) throw new Error('Файл слишком большой (лимит 100 МБ)')
    return buf
  }

  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) throw new Error('Файл слишком большой (лимит 100 МБ)')
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function uploadBuffer(buffer, filename, mimeType) {
  const storage = getStorageClient()
  if (!storage) {
    throw new Error('APPWRITE_API_KEY не настроен для загрузки в Storage')
  }

  const bucketId = getMediaBucketId()
  const file = InputFile.fromBuffer(buffer, filename)

  const created = await storage.createFile({
    bucketId,
    fileId: ID.unique(),
    file,
    permissions: [Permission.read(Role.any())],
  })

  return {
    fileId: created.$id,
    viewUrl: getFileViewUrl(created.$id),
    mimeType,
  }
}
