import { motion } from 'framer-motion'
import { Play, Heart, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/format'
import { haptic } from '@/lib/telegram'
import { usePlayerStore } from '@/store/playerStore'
import type { Podcast } from '@/types'
import styles from './PodcastCard.module.css'

interface PodcastCardProps {
  podcast: Podcast
  progress?: number
  variant?: 'grid' | 'list' | 'horizontal'
  index?: number
  onPlay?: () => void
}

export function PodcastCard({
  podcast,
  progress,
  variant = 'grid',
  index = 0,
  onPlay,
}: PodcastCardProps) {
  const play = usePlayerStore((s) => s.play)
  const isFavorite = usePlayerStore((s) => s.favoriteIds.has(podcast.$id))
  const progressPercent =
    progress && podcast.duration ? (progress / podcast.duration) * 100 : 0

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptic('medium')
    play(podcast, progress || 0)
    onPlay?.()
  }

  return (
    <motion.article
      className={`${styles.card} ${styles[variant]}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlay}
    >
      <div className={styles.coverWrap}>
        {podcast.coverUrl ? (
          <img src={podcast.coverUrl} alt="" className={styles.cover} loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span>♪</span>
          </div>
        )}
        <motion.button
          className={styles.playBtn}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handlePlay}
          aria-label="Воспроизвести"
        >
          <Play size={variant === 'list' ? 16 : 20} fill="currentColor" />
        </motion.button>
        {progressPercent > 0 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        {isFavorite && (
          <span className={styles.favBadge}>
            <Heart size={12} fill="var(--gold)" color="var(--gold)" />
          </span>
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{podcast.title}</h3>
        {variant !== 'horizontal' && podcast.authorName && (
          <p className={styles.author}>{podcast.authorName}</p>
        )}
        <div className={styles.meta}>
          <Clock size={12} />
          <span>{formatDuration(podcast.duration)}</span>
          {progressPercent > 0 && (
            <span className={styles.progressText}>{Math.round(progressPercent)}%</span>
          )}
        </div>
      </div>
    </motion.article>
  )
}
