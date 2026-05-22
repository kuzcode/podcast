export const DEFAULT_SETTINGS = {
  playbackSpeed: 1,
  skipForwardSec: 30,
  skipBackwardSec: 15,
  autoPlayNext: true,
  sleepTimerMinutes: 0,
  trimSilence: false,
  theme: 'renaissance' as const,
}

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export const SLEEP_TIMER_OPTIONS = [0, 5, 10, 15, 30, 45, 60, 90]

export const PROGRESS_SAVE_INTERVAL_MS = 5000

export const RECOMMENDATION_LIMIT = 12

export const SEARCH_DEBOUNCE_MS = 300
