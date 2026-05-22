import {
  databases,
  DB_ID,
  COL,
  Query,
  ID,
  getFileView,
  isAppwriteConfigured,
} from '@/lib/appwrite'
import type { Podcast } from '@/types'

export interface ExtractResult {
  title: string
  description?: string
  coverUrl: string
  audioUrl: string
  duration: number
  sourcePlatform: string
  authorName: string
  error?: string
}

function parsePodcast(doc: Record<string, unknown>): Podcast {
  const p = doc as unknown as Podcast
  if (p.audioFileId && !p.audioUrl) {
    p.audioUrl = getFileView(p.audioFileId)
  }
  if (p.coverFileId && !p.coverUrl) {
    p.coverUrl = getFileView(p.coverFileId)
  }
  if (typeof p.tags === 'string') {
    try {
      p.tags = JSON.parse(p.tags as unknown as string)
    } catch {
      p.tags = []
    }
  }
  if (!Array.isArray(p.tags)) p.tags = []
  return p
}

export async function getPodcast(id: string): Promise<Podcast | null> {
  if (!isAppwriteConfigured()) return null
  try {
    const doc = await databases.getDocument(DB_ID, COL.podcasts, id)
    return parsePodcast(doc as unknown as Record<string, unknown>)
  } catch {
    return null
  }
}

export async function listPodcasts(
  queries: string[] = [],
  limit = 20
): Promise<Podcast[]> {
  if (!isAppwriteConfigured()) return []
  const res = await databases.listDocuments(DB_ID, COL.podcasts, [
    Query.equal('isPublic', true),
    Query.orderDesc('createdAt'),
    Query.limit(limit),
    ...queries,
  ])
  return res.documents.map((d) =>
    parsePodcast(d as unknown as Record<string, unknown>)
  )
}

export async function listUserPodcasts(userId: string): Promise<Podcast[]> {
  return listPodcasts([Query.equal('userId', userId)], 50)
}

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  if (!query.trim()) return []
  const q = query.trim()
  const res = await databases.listDocuments(DB_ID, COL.podcasts, [
    Query.equal('isPublic', true),
    Query.or([
      Query.search('title', q),
      Query.search('description', q),
      Query.search('tags', q),
      Query.search('authorName', q),
    ]),
    Query.limit(30),
  ])
  return res.documents.map((d) =>
    parsePodcast(d as unknown as Record<string, unknown>)
  )
}

export async function getTrendingPodcasts(): Promise<Podcast[]> {
  return listPodcasts([Query.orderDesc('playCount')], 15)
}

/** Метаданные + ссылка на аудио через /api/extract (Vercel или Vite dev). */
export async function fetchExtract(url: string): Promise<ExtractResult> {
  const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`)
  const data = (await res.json()) as ExtractResult
  if (!res.ok) throw new Error(data.error || 'Ошибка извлечения')
  if (data.error) throw new Error(data.error)
  return data
}

/** Сохранить подкаст в Appwrite (ссылки на аудио/обложку — без загрузки в Storage). */
export async function createPodcastFromExtract(
  url: string,
  extract: ExtractResult,
  userId: string
): Promise<Podcast> {
  const doc = await databases.createDocument(DB_ID, COL.podcasts, ID.unique(), {
    title: extract.title,
    description: extract.description || `Из ${extract.sourcePlatform}`,
    coverUrl: extract.coverUrl,
    coverFileId: '',
    audioUrl: extract.audioUrl,
    audioFileId: '',
    sourceUrl: url,
    sourcePlatform: extract.sourcePlatform,
    duration: extract.duration,
    tags: JSON.stringify([extract.sourcePlatform, 'imported']),
    userId,
    authorName: extract.authorName,
    isPublic: true,
    playCount: 0,
    likeCount: 0,
    chapters: '[]',
    createdAt: new Date().toISOString(),
  })
  return parsePodcast(doc as unknown as Record<string, unknown>)
}

export async function createPodcastFromUrl(
  url: string,
  userId: string
): Promise<Podcast> {
  const extract = await fetchExtract(url)
  return createPodcastFromExtract(url, extract, userId)
}

export async function incrementPlayCount(podcastId: string): Promise<void> {
  try {
    const podcast = await getPodcast(podcastId)
    if (!podcast) return
    await databases.updateDocument(DB_ID, COL.podcasts, podcastId, {
      playCount: (podcast.playCount || 0) + 1,
    })
  } catch {
    /* non-critical */
  }
}

export function getDemoPodcasts(): Podcast[] {
  const now = new Date().toISOString()
  return [
    {
      $id: 'demo-1',
      title: 'Ренессанс и современность',
      description: 'Философский подкаст о вечных идеях',
      coverUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop',
      audioUrl: '',
      duration: 3600,
      tags: ['философия', 'история', 'культура'],
      userId: 'demo',
      authorName: 'Atelier',
      isPublic: true,
      playCount: 1200,
      likeCount: 89,
      createdAt: now,
    },
    {
      $id: 'demo-2',
      title: 'Музыка эпохи Возрождения',
      description: 'Путешествие по звукам XV–XVI веков',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
      audioUrl: '',
      duration: 2400,
      tags: ['музыка', 'история'],
      userId: 'demo',
      authorName: 'Atelier',
      isPublic: true,
      playCount: 890,
      likeCount: 56,
      createdAt: now,
    },
  ]
}
