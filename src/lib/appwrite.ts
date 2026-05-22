import { Client, Databases, Storage, Query, ID } from 'appwrite'

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || ''

export const client = new Client().setEndpoint(endpoint).setProject(projectId)

export const databases = new Databases(client)
export const storage = new Storage(client)

export const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'podcast_db'
export const COL = {
  users: import.meta.env.VITE_APPWRITE_USERS_COLLECTION || 'users',
  podcasts: import.meta.env.VITE_APPWRITE_PODCASTS_COLLECTION || 'podcasts',
  favorites: import.meta.env.VITE_APPWRITE_FAVORITES_COLLECTION || 'favorites',
  history: import.meta.env.VITE_APPWRITE_HISTORY_COLLECTION || 'history',
  progress: import.meta.env.VITE_APPWRITE_PROGRESS_COLLECTION || 'progress',
}

/** Один bucket для всего: audio_*, cover_* в имени файла при загрузке */
export const MEDIA_BUCKET = import.meta.env.VITE_APPWRITE_MEDIA_BUCKET || 'media'

export { Query, ID }

export function getFileView(fileId: string): string {
  return `${endpoint}/storage/buckets/${MEDIA_BUCKET}/files/${fileId}/view?project=${projectId}`
}

export function isAppwriteConfigured(): boolean {
  return Boolean(projectId && projectId !== 'your_project_id')
}
