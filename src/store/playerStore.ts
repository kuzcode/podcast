import { create } from 'zustand'
import { Howl } from 'howler'
import { saveProgress } from '@/api/progress'
import { incrementPlayCount } from '@/api/podcasts'
import { PROGRESS_SAVE_INTERVAL_MS } from '@/lib/constants'
import type { Podcast, Chapter } from '@/types'

interface PlayerState {
  current: Podcast | null
  howl: Howl | null
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  playbackRate: number
  volume: number
  queue: Podcast[]
  sleepTimerEnd: number | null
  isExpanded: boolean
  favoriteIds: Set<string>

  play: (podcast: Podcast, startAt?: number) => void
  pause: () => void
  resume: () => void
  toggle: () => void
  seek: (time: number) => void
  skip: (seconds: number) => void
  setRate: (rate: number) => void
  setVolume: (vol: number) => void
  setExpanded: (expanded: boolean) => void
  addToQueue: (podcast: Podcast) => void
  playNext: () => void
  setSleepTimer: (minutes: number) => void
  setFavoriteIds: (ids: Set<string>) => void
  toggleFavorite: (podcastId: string) => void
  destroy: () => void
}

let progressInterval: ReturnType<typeof setInterval> | null = null
let sleepTimeout: ReturnType<typeof setTimeout> | null = null
let lastSaveTime = 0

function setupMediaSession(podcast: Podcast, onSeek: (t: number) => void) {
  if (!('mediaSession' in navigator)) return

  navigator.mediaSession.metadata = new MediaMetadata({
    title: podcast.title,
    artist: podcast.authorName || 'Atelier',
    album: 'Atelier Podcasts',
    artwork: podcast.coverUrl
      ? [{ src: podcast.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
      : [],
  })

  navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume())
  navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause())
  navigator.mediaSession.setActionHandler('seekbackward', (d) => {
    onSeek(usePlayerStore.getState().currentTime - (d.seekOffset || 15))
  })
  navigator.mediaSession.setActionHandler('seekforward', (d) => {
    onSeek(usePlayerStore.getState().currentTime + (d.seekOffset || 30))
  })
  navigator.mediaSession.setActionHandler('seekto', (d) => {
    if (d.seekTime != null) onSeek(d.seekTime)
  })
}

function updateMediaSessionPosition(time: number, duration: number) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.setPositionState({
      duration: duration || 0,
      playbackRate: usePlayerStore.getState().playbackRate,
      position: time,
    })
  } catch {
    /* ignore */
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
  howl: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  queue: [],
  sleepTimerEnd: null,
  isExpanded: false,
  favoriteIds: new Set(),

  play: (podcast, startAt = 0) => {
    const { howl: prev, current } = get()
    if (prev) prev.unload()

    if (progressInterval) clearInterval(progressInterval)

    if (!podcast.audioUrl) {
      set({ current: podcast, isLoading: false, isPlaying: false })
      return
    }

    set({ current: podcast, isLoading: true, isPlaying: false, currentTime: startAt })

    const sound = new Howl({
      src: [podcast.audioUrl],
      html5: true,
      preload: true,
      format: ['mp3', 'm4a', 'aac', 'ogg', 'webm'],
      onload: () => {
        const dur = sound.duration()
        set({ duration: dur, isLoading: false })
        if (startAt > 0) sound.seek(startAt)
        sound.play()
        set({ isPlaying: true })
        setupMediaSession(podcast, (t) => get().seek(t))
        if (current?.$id !== podcast.$id) {
          incrementPlayCount(podcast.$id)
        }
      },
      onplay: () => set({ isPlaying: true }),
      onpause: () => set({ isPlaying: false }),
      onend: () => {
        set({ isPlaying: false, currentTime: 0 })
        const { queue, current: cur } = get()
        if (queue.length > 0) {
          const [next, ...rest] = queue
          set({ queue: rest })
          get().play(next, 0)
        } else if (cur) {
          const userId = localStorage.getItem('atelier_user_id')
          if (userId) saveProgress(userId, cur.$id, cur.duration, cur.duration)
        }
      },
      onloaderror: () => set({ isLoading: false, isPlaying: false }),
    })

    sound.rate(get().playbackRate)
    set({ howl: sound })

    progressInterval = setInterval(() => {
      const { howl: h, current: c, duration: d } = get()
      if (!h || !c) return
      const time = h.seek() as number
      set({ currentTime: time })
      updateMediaSessionPosition(time, d)

      const now = Date.now()
      if (now - lastSaveTime > PROGRESS_SAVE_INTERVAL_MS) {
        lastSaveTime = now
        const userId = localStorage.getItem('atelier_user_id')
        if (userId) saveProgress(userId, c.$id, time, d)
      }
    }, 500)
  },

  pause: () => {
    get().howl?.pause()
    set({ isPlaying: false })
  },

  resume: () => {
    get().howl?.play()
    set({ isPlaying: true })
  },

  toggle: () => {
    const { isPlaying, howl } = get()
    if (!howl) return
    if (isPlaying) get().pause()
    else get().resume()
  },

  seek: (time) => {
    const { howl, duration } = get()
    if (!howl) return
    const t = Math.max(0, Math.min(time, duration || Infinity))
    howl.seek(t)
    set({ currentTime: t })
    updateMediaSessionPosition(t, duration)
  },

  skip: (seconds) => {
    const { currentTime } = get()
    get().seek(currentTime + seconds)
  },

  setRate: (rate) => {
    get().howl?.rate(rate)
    set({ playbackRate: rate })
  },

  setVolume: (vol) => {
    get().howl?.volume(vol)
    set({ volume: vol })
  },

  setExpanded: (expanded) => set({ isExpanded: expanded }),

  addToQueue: (podcast) => {
    set((s) => ({ queue: [...s.queue, podcast] }))
  },

  playNext: () => {
    const { queue } = get()
    if (queue.length > 0) {
      const [next, ...rest] = queue
      set({ queue: rest })
      get().play(next)
    }
  },

  setSleepTimer: (minutes) => {
    if (sleepTimeout) clearTimeout(sleepTimeout)
    if (minutes <= 0) {
      set({ sleepTimerEnd: null })
      return
    }
    const end = Date.now() + minutes * 60 * 1000
    set({ sleepTimerEnd: end })
    sleepTimeout = setTimeout(() => {
      get().pause()
      set({ sleepTimerEnd: null })
    }, minutes * 60 * 1000)
  },

  setFavoriteIds: (ids) => set({ favoriteIds: ids }),

  toggleFavorite: (podcastId) => {
    set((s) => {
      const next = new Set(s.favoriteIds)
      if (next.has(podcastId)) next.delete(podcastId)
      else next.add(podcastId)
      return { favoriteIds: next }
    })
  },

  destroy: () => {
    if (progressInterval) clearInterval(progressInterval)
    if (sleepTimeout) clearTimeout(sleepTimeout)
    get().howl?.unload()
    set({
      howl: null,
      current: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    })
  },
}))

export function getChapterAt(time: number, chapters?: Chapter[]): Chapter | null {
  if (!chapters?.length) return null
  let current: Chapter | null = null
  for (const ch of chapters) {
    if (ch.startSec <= time) current = ch
    else break
  }
  return current
}
