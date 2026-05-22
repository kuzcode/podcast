import { listPodcasts, getTrendingPodcasts } from '@/api/podcasts'
import { getFavorites } from '@/api/favorites'
import { getAllProgress } from '@/api/progress'
import { getPodcast } from '@/api/podcasts'
import { Query } from '@/lib/appwrite'
import { RECOMMENDATION_LIMIT } from '@/lib/constants'
import type { Podcast } from '@/types'

function extractTags(podcasts: Podcast[]): string[] {
  const tagCounts = new Map<string, number>()
  for (const p of podcasts) {
    for (const tag of p.tags || []) {
      const t = tag.toLowerCase()
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)
}

export async function getRecommendations(userId: string): Promise<Podcast[]> {
  const [favorites, progress, trending] = await Promise.all([
    getFavorites(userId).catch(() => []),
    getAllProgress(userId).catch(() => []),
    getTrendingPodcasts().catch(() => []),
  ])

  const interactedIds = new Set([
    ...favorites.map((f) => f.podcastId),
    ...progress.map((p) => p.podcastId),
  ])

  const interactedPodcasts: Podcast[] = []
  for (const id of [...interactedIds].slice(0, 10)) {
    const p = await getPodcast(id)
    if (p) interactedPodcasts.push(p)
  }

  const topTags = extractTags(interactedPodcasts)

  let recommended: Podcast[] = []

  if (topTags.length > 0) {
    recommended = await listPodcasts(
      [Query.contains('tags', topTags)],
      RECOMMENDATION_LIMIT
    )
  }

  if (recommended.length < RECOMMENDATION_LIMIT) {
    const more = await listPodcasts([], RECOMMENDATION_LIMIT * 2)
    recommended = [...recommended, ...more]
  }

  const seen = new Set<string>()
  const result: Podcast[] = []

  for (const p of [...recommended, ...trending]) {
    if (seen.has(p.$id) || interactedIds.has(p.$id)) continue
    seen.add(p.$id)
    result.push(p)
    if (result.length >= RECOMMENDATION_LIMIT) break
  }

  return result
}

export async function getContinueListening(userId: string): Promise<
  Array<{ podcast: Podcast; progress: number }>
> {
  const progressList = await getAllProgress(userId)
  const inProgress = progressList.filter((p) => !p.completed && p.position > 10)

  const results: Array<{ podcast: Podcast; progress: number }> = []

  for (const prog of inProgress.slice(0, 10)) {
    const podcast = await getPodcast(prog.podcastId)
    if (podcast?.audioUrl) {
      results.push({ podcast, progress: prog.position })
    }
  }

  return results.sort((a, b) => {
    const pa = progressList.find((p) => p.podcastId === a.podcast.$id)
    const pb = progressList.find((p) => p.podcastId === b.podcast.$id)
    return (
      new Date(pb?.updatedAt || 0).getTime() - new Date(pa?.updatedAt || 0).getTime()
    )
  })
}
