import { motion } from 'framer-motion'
import { Loader2, Video } from 'lucide-react'
import { useImportStore } from '@/store/importStore'
import styles from './CreatingPodcastBanner.module.css'

export function CreatingPodcastBanner() {
  const active = useImportStore((s) => s.active)
  const url = useImportStore((s) => s.url)

  if (!active) return null

  let host = 'YouTube'
  try {
    if (url) host = new URL(url).hostname.replace('www.', '')
  } catch {
    /* ignore */
  }

  return (
    <motion.div
      className={styles.banner}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <div className={styles.iconWrap}>
        <Loader2 className={styles.spinner} size={22} />
        <Video size={18} className={styles.yt} />
      </div>
      <div className={styles.text}>
        <p className={styles.title}>Создаём подкаст</p>
        <p className={styles.sub}>
          Конвертируем аудио и загружаем в Storage · {host}
        </p>
        <p className={styles.hint}>Обычно 20–60 секунд. Можно пользоваться приложением.</p>
      </div>
    </motion.div>
  )
}
