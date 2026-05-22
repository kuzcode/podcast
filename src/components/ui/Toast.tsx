import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '@/store/toastStore'
import styles from './Toast.module.css'

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`${styles.toast} ${styles[t.type]}`}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
