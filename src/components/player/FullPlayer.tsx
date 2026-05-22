import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Heart,
  Share2,
  ListPlus,
  Gauge,
  Moon,
  ChevronDown,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { usePlayerStore, getChapterAt, normalizeChapters } from '@/store/playerStore'
import { useAuthStore } from '@/store/authStore'
import { formatDuration } from '@/lib/format'
import { sharePodcast, haptic } from '@/lib/telegram'
import { addFavorite, removeFavorite } from '@/api/favorites'
import { PLAYBACK_SPEEDS, SLEEP_TIMER_OPTIONS } from '@/lib/constants'
import { useToastStore } from '@/store/toastStore'
import styles from './FullPlayer.module.css'

export function FullPlayer() {
  const isExpanded = usePlayerStore((s) => s.isExpanded)
  const setExpanded = usePlayerStore((s) => s.setExpanded)
  const current = usePlayerStore((s) => s.current)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isLoading = usePlayerStore((s) => s.isLoading)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const favoriteIds = usePlayerStore((s) => s.favoriteIds)
  const toggle = usePlayerStore((s) => s.toggle)
  const seek = usePlayerStore((s) => s.seek)
  const skip = usePlayerStore((s) => s.skip)
  const setRate = usePlayerStore((s) => s.setRate)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite)
  const user = useAuthStore((s) => s.user)
  const showToast = useToastStore((s) => s.show)

  const [showSpeed, setShowSpeed] = useState(false)
  const [showSleep, setShowSleep] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  if (!current) return null

  const isFav = favoriteIds.has(current.$id)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const chapters = normalizeChapters(current.chapters)
  const chapter = getChapterAt(currentTime, chapters)
  const settings = user?.settings

  const handleSeek = (clientX: number) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    seek(ratio * duration)
    haptic('light')
  }

  const handleFavorite = async () => {
    if (!user) return
    haptic('medium')
    toggleFavorite(current.$id)
    try {
      if (isFav) {
        await removeFavorite(user.$id, current.$id)
        showToast('Удалено из избранного', 'info')
      } else {
        await addFavorite(user.$id, current.$id)
        showToast('Добавлено в избранное', 'success')
      }
    } catch {
      toggleFavorite(current.$id)
    }
  }

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={styles.player}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <button className={styles.collapse} onClick={() => setExpanded(false)}>
              <ChevronDown size={28} />
            </button>

            <motion.div
              className={styles.artwork}
              animate={{ scale: isPlaying ? 1 : 0.95 }}
              transition={{ duration: 0.5 }}
            >
              {current.coverUrl ? (
                <img src={current.coverUrl} alt="" />
              ) : (
                <div className={styles.artPlaceholder}>♪</div>
              )}
            </motion.div>

            <div className={styles.trackInfo}>
              <h1>{current.title}</h1>
              <p>{current.authorName || chapter?.title || 'Atelier'}</p>
              {isLoading && <p className={styles.loadingLabel}>Загрузка аудио…</p>}
            </div>

            {chapters.length > 0 && (
              <div className={styles.chapters}>
                {chapters.map((ch) => (
                  <button
                    key={ch.startSec}
                    className={
                      chapter?.startSec === ch.startSec ? styles.chapterActive : ''
                    }
                    onClick={() => seek(ch.startSec)}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            )}

            <div
              className={styles.progressWrap}
              ref={progressRef}
              onClick={(e) => handleSeek(e.clientX)}
              onTouchEnd={(e) => {
                const touch = e.changedTouches[0]
                if (touch) handleSeek(touch.clientX)
              }}
            >
              <div className={styles.progressBg}>
                <motion.div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className={styles.timeRow}>
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || current.duration)}</span>
              </div>
            </div>

            <div className={styles.controls}>
              <button onClick={() => skip(-(settings?.skipBackwardSec || 15))}>
                <RotateCcw size={24} />
                <span className={styles.skipLabel}>{settings?.skipBackwardSec || 15}</span>
              </button>
              <motion.button
                className={styles.playMain}
                whileTap={{ scale: 0.92 }}
                onClick={toggle}
              >
                {isPlaying ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" />
                )}
              </motion.button>
              <button onClick={() => skip(settings?.skipForwardSec || 30)}>
                <RotateCw size={24} />
                <span className={styles.skipLabel}>{settings?.skipForwardSec || 30}</span>
              </button>
            </div>

            <div className={styles.secondary}>
              <button onClick={handleFavorite} aria-label="Избранное">
                <Heart
                  size={22}
                  fill={isFav ? 'var(--gold)' : 'none'}
                  color={isFav ? 'var(--gold)' : 'currentColor'}
                />
              </button>
              <button
                onClick={() => {
                  sharePodcast(current.$id, current.title)
                  haptic('light')
                }}
              >
                <Share2 size={22} />
              </button>
              <button
                onClick={() => {
                  addToQueue(current)
                  showToast('Добавлено в очередь', 'success')
                }}
              >
                <ListPlus size={22} />
              </button>
              <button onClick={() => setShowSpeed(!showSpeed)}>
                <Gauge size={22} />
                <span className={styles.badge}>{playbackRate}x</span>
              </button>
              <button onClick={() => setShowSleep(!showSleep)}>
                <Moon size={22} />
              </button>
            </div>

            <AnimatePresence>
              {showSpeed && (
                <motion.div
                  className={styles.panel}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <p className={styles.panelTitle}>Скорость воспроизведения</p>
                  <div className={styles.speedGrid}>
                    {PLAYBACK_SPEEDS.map((s) => (
                      <button
                        key={s}
                        className={playbackRate === s ? styles.speedActive : ''}
                        onClick={() => {
                          setRate(s)
                          haptic('selection')
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {showSleep && (
                <motion.div
                  className={styles.panel}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <p className={styles.panelTitle}>Таймер сна</p>
                  <div className={styles.speedGrid}>
                    {SLEEP_TIMER_OPTIONS.map((m) => (
                      <button
                        key={m}
                        className={m === 0 ? styles.speedActive : ''}
                        onClick={() => {
                          setSleepTimer(m)
                          showToast(m ? `Сон через ${m} мин` : 'Таймер отключён', 'info')
                          haptic('selection')
                        }}
                      >
                        {m === 0 ? 'Выкл' : `${m}м`}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
