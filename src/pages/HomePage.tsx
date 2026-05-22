import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, TrendingUp, PlayCircle } from 'lucide-react'
import { PodcastCard } from '@/components/podcast/PodcastCard'
import { CreatePodcastModal } from '@/components/create/CreatePodcastModal'
import { CreatingPodcastBanner } from '@/components/create/CreatingPodcastBanner'
import { useAuthStore } from '@/store/authStore'
import { getRecommendations, getContinueListening } from '@/api/recommendations'
import { getTrendingPodcasts, getDemoPodcasts } from '@/api/podcasts'
import { isAppwriteConfigured } from '@/lib/appwrite'
import type { Podcast } from '@/types'
import styles from './HomePage.module.css'

export function HomePage() {
  const user = useAuthStore((s) => s.user)
  const [createOpen, setCreateOpen] = useState(false)
  const [continueList, setContinueList] = useState<
    Array<{ podcast: Podcast; progress: number }>
  >([])
  const [recommended, setRecommended] = useState<Podcast[]>([])
  const [trending, setTrending] = useState<Podcast[]>([])
  const [loading, setLoading] = useState(true)

  const loadFeed = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (isAppwriteConfigured()) {
        const [cont, rec, trend] = await Promise.all([
          getContinueListening(user.$id),
          getRecommendations(user.$id),
          getTrendingPodcasts(),
        ])
        setContinueList(cont)
        setRecommended(rec)
        setTrending(trend)
      } else {
        const demo = getDemoPodcasts()
        setRecommended(demo)
        setTrending(demo)
      }
    } catch {
      const demo = getDemoPodcasts()
      setRecommended(demo)
      setTrending(demo)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    localStorage.setItem('atelier_user_id', user.$id)
    loadFeed()
  }, [user, loadFeed])

  return (
    <div className="page">
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className={styles.greeting}>Добро пожаловать</p>
          <h1 className="page-title gold-gradient-text">Atelier</h1>
          <p className="page-subtitle">Ваша коллекция подкастов</p>
        </div>
        <motion.button
          className={styles.createBtn}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={22} />
          <span>Создать</span>
        </motion.button>
      </motion.header>

      <CreatingPodcastBanner />

      {continueList.length > 0 && (
        <section className={styles.section}>
          <h2 className="section-title">
            <PlayCircle size={18} /> Продолжить
          </h2>
          <div className={styles.horizontalScroll}>
            {continueList.map(({ podcast, progress }, i) => (
              <PodcastCard
                key={podcast.$id}
                podcast={podcast}
                progress={progress}
                variant="horizontal"
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className="section-title">Может понравиться</h2>
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`skeleton ${styles.skeletonCard}`} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {recommended.map((p, i) => (
              <PodcastCard key={p.$id} podcast={p} variant="grid" index={i} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className="section-title">
          <TrendingUp size={18} /> Популярное
        </h2>
        <div className={styles.list}>
          {trending.map((p, i) => (
            <PodcastCard key={p.$id} podcast={p} variant="list" index={i} />
          ))}
        </div>
      </section>

      <CreatePodcastModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadFeed()}
      />
    </div>
  )
}
