export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
}

export interface UserSettings {
  playbackSpeed: number
  skipForwardSec: number
  skipBackwardSec: number
  autoPlayNext: boolean
  sleepTimerMinutes: number
  trimSilence: boolean
  theme: 'renaissance' | 'light'
}

export interface User {
  $id: string
  telegramId: string
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
  languageCode?: string
  isPremium?: boolean
  settings: UserSettings
  createdAt: string
}

export interface Podcast {
  $id: string
  title: string
  description?: string
  coverUrl?: string
  coverFileId?: string
  audioUrl?: string
  audioFileId?: string
  sourceUrl?: string
  sourcePlatform?: string
  duration: number
  tags: string[]
  userId: string
  authorName?: string
  isPublic: boolean
  playCount: number
  likeCount: number
  chapters?: Chapter[]
  createdAt: string
}

export interface Chapter {
  title: string
  startSec: number
}

export interface Favorite {
  $id: string
  userId: string
  podcastId: string
  createdAt: string
}

export interface ListeningProgress {
  $id: string
  userId: string
  podcastId: string
  position: number
  completed: boolean
  updatedAt: string
}

export interface HistoryEntry {
  $id: string
  userId: string
  podcastId: string
  listenedAt: string
  duration: number
}

export type SortOption = 'recent' | 'popular' | 'duration' | 'title'
