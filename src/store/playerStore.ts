import { create } from 'zustand'
import { saveProgress } from '@/api/progress'
import { incrementPlayCount } from '@/api/podcasts'
import { PROGRESS_SAVE_INTERVAL_MS } from '@/lib/constants'
import type { Podcast, Chapter } from '@/types'

interface PlayerState {
  current: Podcast | null
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

let audioEl: HTMLAudioElement | null = null
let sleepTimeout: ReturnType<typeof setTimeout> | null = null
let lastSaveTime = 0

function artworkFor(url: string) {
  return [
    { src: url, sizes: '96x96', type: 'image/jpeg' },
    { src: url, sizes: '128x128', type: 'image/jpeg' },
    { src: url, sizes: '256x256', type: 'image/jpeg' },
    { src: url, sizes: '512x512', type: 'image/jpeg' },
  ]
}

function syncMediaSessionState(playing: boolean) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  } catch {
    /* ignore */
  }
}

function setupMediaSession(podcast: Podcast, onSeek: (t: number) => void) {
  if (!('mediaSession' in navigator)) return

  const cover = podcast.coverUrl?.trim()
  navigator.mediaSession.metadata = new MediaMetadata({
    title: podcast.title,
    artist: podcast.authorName || 'Atelier',
    album: 'Atelier Podcasts',
    artwork: cover ? artworkFor(cover) : [],
  })

  navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume())
  navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause())
  navigator.mediaSession.setActionHandler('seekbackward', (d) => {
    onSeek(usePlayerStore.getState().currentTime - (d.seekOffset ?? 15))
  })
  navigator.mediaSession.setActionHandler('seekforward', (d) => {
    onSeek(usePlayerStore.getState().currentTime + (d.seekOffset ?? 30))
  })
  navigator.mediaSession.setActionHandler('seekto', (d) => {
    if (d.seekTime != null) onSeek(d.seekTime)
  })
  navigator.mediaSession.setActionHandler('stop', () => {
    usePlayerStore.getState().pause()
    usePlayerStore.getState().seek(0)
  })
}

function updateMediaSessionPosition(time: number, duration: number) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.setPositionState({
      duration: Math.max(0, duration || 0),
      playbackRate: usePlayerStore.getState().playbackRate,
      position: Math.max(0, Math.min(time, duration || time)),
    })
  } catch {
    /* ignore */
  }
}

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl

  const el = document.createElement('audio')
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.preload = 'auto'
  el.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(el)

  el.addEventListener('timeupdate', () => {
    const { current: c, duration: d } = usePlayerStore.getState()
    if (!c || !audioEl) return
    const time = audioEl.currentTime
    usePlayerStore.setState({ currentTime: time })
    const dur = audioEl.duration || d
    updateMediaSessionPosition(time, dur)

    const now = Date.now()
    if (now - lastSaveTime > PROGRESS_SAVE_INTERVAL_MS) {
      lastSaveTime = now
      const userId = localStorage.getItem('atelier_user_id')
      if (userId) saveProgress(userId, c.$id, time, dur)
    }
  })

  el.addEventListener('loadedmetadata', () => {
    if (!audioEl) return
    const dur = audioEl.duration
    if (Number.isFinite(dur) && dur > 0) {
      usePlayerStore.setState({ duration: dur, isLoading: false })
      updateMediaSessionPosition(audioEl.currentTime, dur)
    }
  })

  el.addEventListener('playing', () => {
    usePlayerStore.setState({ isPlaying: true, isLoading: false })
    syncMediaSessionState(true)
  })

  el.addEventListener('pause', () => {
    usePlayerStore.setState({ isPlaying: false })
    syncMediaSessionState(false)
  })

  el.addEventListener('ended', () => {
    const { queue, current: cur } = usePlayerStore.getState()
    usePlayerStore.setState({ isPlaying: false, currentTime: 0 })
    syncMediaSessionState(false)
    if (queue.length > 0) {
      const [next, ...rest] = queue
      usePlayerStore.setState({ queue: rest })
      usePlayerStore.getState().play(next, 0)
    } else if (cur) {
      const userId = localStorage.getItem('atelier_user_id')
      if (userId) saveProgress(userId, cur.$id, cur.duration, cur.duration)
    }
  })

  el.addEventListener('waiting', () => {
    usePlayerStore.setState({ isLoading: true })
  })

  el.addEventListener('error', () => {
    usePlayerStore.setState({ isLoading: false, isPlaying: false })
    syncMediaSessionState(false)
  })

  audioEl = el
  return el
}

function stopAudio() {
  if (!audioEl) return
  audioEl.pause()
  audioEl.removeAttribute('src')
  audioEl.load()
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
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
    const prevId = get().current?.$id
    const isNewTrack = prevId !== podcast.$id

    if (isNewTrack) stopAudio()

    if (!podcast.audioUrl) {
      set({ current: podcast, isLoading: false, isPlaying: false })
      return
    }

    const el = ensureAudio()
    const dur = podcast.duration > 0 ? podcast.duration : get().duration

    set({
      current: podcast,
      isLoading: true,
      isPlaying: false,
      currentTime: startAt,
      duration: dur,
    })

    setupMediaSession(podcast, (t) => get().seek(t))

    el.playbackRate = get().playbackRate
    el.volume = get().volume
    el.src = podcast.audioUrl

    const startPlayback = () => {
      if (startAt > 0) el.currentTime = startAt
      el.play()
        .then(() => {
          set({ isPlaying: true, isLoading: false })
          syncMediaSessionState(true)
          if (isNewTrack) incrementPlayCount(podcast.$id)
        })
        .catch(() => {
          set({ isLoading: false, isPlaying: false })
          syncMediaSessionState(false)
        })
    }

    el.addEventListener('canplay', startPlayback, { once: true })
    el.load()
  },

  pause: () => {
    audioEl?.pause()
    set({ isPlaying: false })
    syncMediaSessionState(false)
  },

  resume: () => {
    const { current } = get()
    if (!current?.audioUrl) return
    audioEl
      ?.play()
      .then(() => {
        set({ isPlaying: true })
        syncMediaSessionState(true)
      })
      .catch(() => {})
  },

  toggle: () => {
    const { isPlaying, current } = get()
    if (!current?.audioUrl) return
    if (isPlaying) get().pause()
    else get().resume()
  },

  seek: (time) => {
    const { duration, current } = get()
    if (!audioEl || !current) return
    const t = Math.max(0, Math.min(time, duration || audioEl.duration || Infinity))
    audioEl.currentTime = t
    set({ currentTime: t })
    updateMediaSessionPosition(t, duration || audioEl.duration)
  },

  skip: (seconds) => {
    get().seek(get().currentTime + seconds)
  },

  setRate: (rate) => {
    if (audioEl) audioEl.playbackRate = rate
    set({ playbackRate: rate })
    updateMediaSessionPosition(get().currentTime, get().duration)
  },

  setVolume: (vol) => {
    if (audioEl) audioEl.volume = vol
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
    if (sleepTimeout) clearTimeout(sleepTimeout)
    stopAudio()
    set({
      current: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
    })
    syncMediaSessionState(false)
  },
}))

export function getChapterAt(time: number, chapters?: Chapter[] | string): Chapter | null {
  const list = normalizeChapters(chapters)
  if (!list.length) return null
  let current: Chapter | null = null
  for (const ch of list) {
    if (ch.startSec <= time) current = ch
    else break
  }
  return current
}

export function normalizeChapters(chapters?: Chapter[] | string): Chapter[] {
  if (!chapters) return []
  if (Array.isArray(chapters)) return chapters
  if (typeof chapters === 'string') {
    try {
      const parsed = JSON.parse(chapters) as unknown
      return Array.isArray(parsed) ? (parsed as Chapter[]) : []
    } catch {
      return []
    }
  }
  return []
}
