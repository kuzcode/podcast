import { databases, DB_ID, COL, Query, isAppwriteConfigured } from '@/lib/appwrite'
import type { Favorite } from '@/types'

export async function getFavorites(userId: string): Promise<Favorite[]> {
  if (!isAppwriteConfigured()) return []
  const res = await databases.listDocuments(DB_ID, COL.favorites, [
    Query.equal('userId', userId),
    Query.orderDesc('createdAt'),
    Query.limit(100),
  ])
  return res.documents as unknown as Favorite[]
}

export async function isFavorite(userId: string, podcastId: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COL.favorites, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.limit(1),
  ])
  return res.total > 0
}

export async function addFavorite(userId: string, podcastId: string): Promise<Favorite> {
  const existing = await databases.listDocuments(DB_ID, COL.favorites, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.limit(1),
  ])
  if (existing.total > 0) {
    return existing.documents[0] as unknown as Favorite
  }
  const doc = await databases.createDocument(DB_ID, COL.favorites, 'unique()', {
    userId,
    podcastId,
    createdAt: new Date().toISOString(),
  })
  return doc as unknown as Favorite
}

export async function removeFavorite(userId: string, podcastId: string): Promise<void> {
  const res = await databases.listDocuments(DB_ID, COL.favorites, [
    Query.equal('userId', userId),
    Query.equal('podcastId', podcastId),
    Query.limit(1),
  ])
  if (res.total > 0) {
    await databases.deleteDocument(DB_ID, COL.favorites, res.documents[0].$id)
  }
}
