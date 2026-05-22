import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Video, Sparkles, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createPodcastFromUrl } from '@/api/podcasts'
import { detectPlatform } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import { haptic } from '@/lib/telegram'
import { useToastStore } from '@/store/toastStore'
import styles from './CreatePodcastModal.module.css'

interface CreatePodcastModalProps {
  open: boolean
  onClose: () => void
  onCreated?: (podcastId: string) => void
}

export function CreatePodcastModal({ open, onClose, onCreated }: CreatePodcastModalProps) {
  const user = useAuthStore((s) => s.user)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const showToast = useToastStore((s) => s.show)

  const platform = url ? detectPlatform(url) : null

  const handleSubmit = async () => {
    if (!url.trim()) {
      showToast('Вставьте ссылку на видео', 'error')
      return
    }
    if (!user) {
      showToast('Войдите через Telegram', 'error')
      return
    }

    setLoading(true)
    haptic('medium')

    try {
      const podcast = await createPodcastFromUrl(url.trim(), user.$id)
      showToast('Подкаст создан!', 'success')
      haptic('success')
      onCreated?.(podcast.$id)
      setUrl('')
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка создания'
      showToast(msg, 'error')
      haptic('error')
    } finally {
      setLoading(false)
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
            Вставьте ссылку на YouTube — аудио и обложка подтянутся автоматически, без
            загрузки в Storage
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

        {loading && <p className={styles.loadingText}>Получаем аудио… обычно 5–15 сек</p>}

        <div className={styles.supported}>
          <p className={styles.supportedTitle}>
            <AlertCircle size={14} /> Сейчас поддерживается
          </p>
          <ul>
            <li>YouTube — видео, Shorts, youtu.be</li>
            <li>Аудио хранится по прямой ссылке (не в bucket)</li>
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
