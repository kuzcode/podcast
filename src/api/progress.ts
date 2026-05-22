import { databases, DB_ID, COL, Query, isAppwriteConfigured } from '@/lib/appwrite'
import type { ListeningProgress, HistoryEntry } from '@/types'

export async function getProgress(
  userId: string,
  podcastId: string
): Promise<ListeningProgress | null> {
  if (!isAppwriteConfigured()) return null
  const res = await databases.listDocuments(DB_ID, COL.progress, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.limit(1),
  ])
  return res.total > 0 ? (res.documents[0] as unknown as ListeningProgress) : null
}

export async function getAllProgress(userId: string): Promise<ListeningProgress[]> {
  if (!isAppwriteConfigured()) return []
  const res = await databases.listDocuments(DB_ID, COL.progress, [
    Query.equal('userId', userId),
    Query.orderDesc('updatedAt'),
    Query.limit(50),
  ])
  return res.documents as unknown as ListeningProgress[]
}

export async function saveProgress(
  userId: string,
  podcastId: string,
  position: number,
  duration: number
): Promise<void> {
  if (!isAppwriteConfigured()) return

  const completed = duration > 0 && position / duration >= 0.95
  const now = new Date().toISOString()

  const existing = await databases.listDocuments(DB_ID, COL.progress, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.limit(1),
  ])

  const data = { position, completed, updatedAt: now }

  if (existing.total > 0) {
    await databases.updateDocument(DB_ID, COL.progress, existing.documents[0].$id, data)
  } else {
    await databases.createDocument(DB_ID, COL.progress, 'unique()', {
      userId,
      podcastId,
      ...data,
    })
  }

  await addHistoryEntry(userId, podcastId, Math.min(position, duration))
}

async function addHistoryEntry(
  userId: string,
  podcastId: string,
  duration: number
): Promise<void> {
  const recent = await databases.listDocuments(DB_ID, COL.history, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.orderDesc('listenedAt'),
    Query.limit(1),
  ])

  const now = new Date().toISOString()
  if (recent.total > 0) {
    const last = recent.documents[0] as unknown as HistoryEntry
    const lastDate = new Date(last.listenedAt).getTime()
    if (Date.now() - lastDate < 60000) {
      await databases.updateDocument(DB_ID, COL.history, last.$id, {
        listenedAt: now,
        duration,
      })
      return
    }
  }

  await databases.createDocument(DB_ID, COL.history, 'unique()', {
    userId,
    podcastId,
    listenedAt: now,
    duration,
  })
}

export async function getHistory(userId: string): Promise<HistoryEntry[]> {
  if (!isAppwriteConfigured()) return []
  const res = await databases.listDocuments(DB_ID, COL.history, [
    Query.equal('userId', userId),
    Query.orderDesc('listenedAt'),
    Query.limit(100),
  ])
  return res.documents as unknown as HistoryEntry[]
}
