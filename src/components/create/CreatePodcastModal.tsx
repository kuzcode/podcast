import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Video, Sparkles, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { extractFromUrl } from '@/api/podcasts'
import { detectPlatform } from '@/lib/format'
import { haptic } from '@/lib/telegram'
import { useToastStore } from '@/store/toastStore'
import styles from './CreatePodcastModal.module.css'

const SUPPORTED = [
  'YouTube (видео и плейлисты)',
  'TikTok, Instagram, VK',
  'Twitter/X, Facebook',
  'Twitch, Rutube, Vimeo',
  'SoundCloud, Reddit и др.',
]

interface CreatePodcastModalProps {
  open: boolean
  onClose: () => void
  onCreated?: (podcastId: string) => void
}

export function CreatePodcastModal({ open, onClose, onCreated }: CreatePodcastModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const showToast = useToastStore((s) => s.show)

  const platform = url ? detectPlatform(url) : null

  const handleSubmit = async () => {
    if (!url.trim()) {
      showToast('Вставьте ссылку на видео', 'error')
      return
    }

    setLoading(true)
    setProgress(10)
    haptic('medium')

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 90))
    }, 2000)

    try {
      const result = await extractFromUrl(url.trim())
      clearInterval(interval)
      setProgress(100)

      if (result.status === 'error') {
        throw new Error(result.error || 'Не удалось извлечь аудио')
      }

      if (result.podcast) {
        showToast('Подкаст создан!', 'success')
        haptic('success')
        onCreated?.(result.podcast.$id)
        setUrl('')
        onClose()
      } else {
        showToast('Обработка начата. Подкаст появится через минуту.', 'info')
        onClose()
      }
    } catch (e) {
      clearInterval(interval)
      const msg = e instanceof Error ? e.message : 'Ошибка создания'
      showToast(msg, 'error')
      haptic('error')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Создать подкаст">
      <div className={styles.content}>
        <motion.div
          className={styles.hero}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Sparkles className={styles.heroIcon} size={32} />
          <p>
            Вставьте ссылку на видео или плейлист — мы извлечём аудио и обложку автоматически
          </p>
        </motion.div>

        <div className={styles.inputWrap}>
          <Link2 size={18} className={styles.inputIcon} />
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {platform === 'youtube' && <Video size={18} className={styles.platformIcon} />}
        </div>

        {loading && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p>Извлекаем аудио… Это может занять 1–3 минуты</p>
          </div>
        )}

        <div className={styles.supported}>
          <p className={styles.supportedTitle}>
            <AlertCircle size={14} /> Поддерживаемые платформы
          </p>
          <ul>
            {SUPPORTED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <Button
          variant="gold"
          size="lg"
          loading={loading}
          onClick={handleSubmit}
          className={styles.submit}
        >
          Создать подкаст
        </Button>
      </div>
    </Modal>
  )
}
