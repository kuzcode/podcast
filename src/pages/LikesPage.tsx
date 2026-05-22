import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Mic, History } from 'lucide-react'
import { PodcastCard } from '@/components/podcast/PodcastCard'
import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { getFavorites } from '@/api/favorites'
import { getHistory } from '@/api/progress'
import { listUserPodcasts, getPodcast } from '@/api/podcasts'
import { isAppwriteConfigured } from '@/lib/appwrite'
import type { Podcast } from '@/types'
import styles from './LikesPage.module.css'

type Tab = 'favorites' | 'created' | 'history'

export function LikesPage() {
  const user = useAuthStore((s) => s.user)
  const setFavoriteIds = usePlayerStore((s) => s.setFavoriteIds)
  const [tab, setTab] = useState<Tab>('favorites')
  const [favorites, setFavorites] = useState<Podcast[]>([])
  const [created, setCreated] = useState<Podcast[]>([])
  const [history, setHistory] = useState<Podcast[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      if (!user) return
      setLoading(true)
      try {
        if (!isAppwriteConfigured()) {
          setLoading(false)
          return
        }

        const [favs, hist, own] = await Promise.all([
          getFavorites(user.$id),
          getHistory(user.$id),
          listUserPodcasts(user.$id),
        ])

        const favPodcasts: Podcast[] = []
        for (const f of favs) {
          const p = await getPodcast(f.podcastId)
          if (p) favPodcasts.push(p)
        }
        setFavorites(favPodcasts)
        setFavoriteIds(new Set(favs.map((f) => f.podcastId)))

        const histPodcasts: Podcast[] = []
        const seen = new Set<string>()
        for (const h of hist) {
          if (seen.has(h.podcastId)) continue
          seen.add(h.podcastId)
          const p = await getPodcast(h.podcastId)
          if (p) histPodcasts.push(p)
        }
        setHistory(histPodcasts)
        setCreated(own)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, setFavoriteIds])

  const tabs: { id: Tab; label: string; icon: typeof Heart }[] = [
    { id: 'favorites', label: 'Избранное', icon: Heart },
    { id: 'created', label: 'Мои', icon: Mic },
    { id: 'history', label: 'История', icon: History },
  ]

  const currentList =
    tab === 'favorites' ? favorites : tab === 'created' ? created : history

  return (
    <div className="page">
      <h1 className="page-title">Коллекция</h1>
      <p className="page-subtitle">Избранное, ваши подкасты и история</p>

      <div className={styles.tabs}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
            {id === 'favorites' && favorites.length > 0 && (
              <span className={styles.badge}>{favorites.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`skeleton ${styles.skeleton}`} />
          ))}
        </div>
      ) : currentList.length > 0 ? (
        <motion.div
          className={styles.list}
          key={tab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {currentList.map((p, i) => (
            <PodcastCard key={p.$id} podcast={p} variant="list" index={i} />
          ))}
        </motion.div>
      ) : (
        <div className={styles.empty}>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            {tab === 'favorites' && <Heart size={48} />}
            {tab === 'created' && <Mic size={48} />}
            {tab === 'history' && <History size={48} />}
          </motion.div>
          <p>
            {tab === 'favorites' && 'Пока нет избранных подкастов'}
            {tab === 'created' && 'Создайте первый подкаст из видео'}
            {tab === 'history' && 'История прослушивания пуста'}
          </p>
        </div>
      )}
    </div>
  )
}
