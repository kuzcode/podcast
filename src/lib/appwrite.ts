import { Client, Account, Databases, Storage, Functions, Query } from 'appwrite'

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || ''

export const client = new Client().setEndpoint(endpoint).setProject(projectId)

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export const functions = new Functions(client)

export const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'podcast_db'
export const COL = {
  users: import.meta.env.VITE_APPWRITE_USERS_COLLECTION || 'users',
  podcasts: import.meta.env.VITE_APPWRITE_PODCASTS_COLLECTION || 'podcasts',
  favorites: import.meta.env.VITE_APPWRITE_FAVORITES_COLLECTION || 'favorites',
  history: import.meta.env.VITE_APPWRITE_HISTORY_COLLECTION || 'history',
  progress: import.meta.env.VITE_APPWRITE_PROGRESS_COLLECTION || 'progress',
}
export const BUCKETS = {
  audio: import.meta.env.VITE_APPWRITE_AUDIO_BUCKET || 'audio',
  covers: import.meta.env.VITE_APPWRITE_COVERS_BUCKET || 'covers',
}
export const FN = {
  auth: import.meta.env.VITE_APPWRITE_FN_AUTH || 'telegram-auth',
  extract: import.meta.env.VITE_APPWRITE_FN_EXTRACT || 'extract-audio',
}

export { Query }

export function getFileView(bucketId: string, fileId: string): string {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`
}

export function getFileDownload(bucketId: string, fileId: string): string {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/download?project=${projectId}`
}

export function isAppwriteConfigured(): boolean {
  return Boolean(projectId && projectId !== 'your_project_id')
}
