import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { formatDuration } from '@/lib/format'
import styles from './MiniPlayer.module.css'

export function MiniPlayer() {
  const current = usePlayerStore((s) => s.current)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const toggle = usePlayerStore((s) => s.toggle)
  const setExpanded = usePlayerStore((s) => s.setExpanded)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className={styles.mini}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          onClick={() => setExpanded(true)}
        >
          <div className={styles.progressTrack}>
            <motion.div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
              layout
            />
          </div>
          <div className={styles.content}>
            {current.coverUrl ? (
              <img src={current.coverUrl} alt="" className={styles.cover} />
            ) : (
              <div className={styles.coverPlaceholder}>♪</div>
            )}
            <div className={styles.info}>
              <p className={styles.title}>{current.title}</p>
              <p className={styles.time}>
                {formatDuration(currentTime)} / {formatDuration(duration || current.duration)}
              </p>
            </div>
            <button
              className={styles.playBtn}
              onClick={(e) => {
                e.stopPropagation()
                toggle()
              }}
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
