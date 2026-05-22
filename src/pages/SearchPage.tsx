import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Clock, TrendingUp, Tag } from 'lucide-react'
import { PodcastCard } from '@/components/podcast/PodcastCard'
import { searchPodcasts, getTrendingPodcasts, getDemoPodcasts } from '@/api/podcasts'
import { isAppwriteConfigured } from '@/lib/appwrite'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import type { Podcast } from '@/types'
import styles from './SearchPage.module.css'

const POPULAR_TAGS = ['музыка', 'история', 'философия', 'наука', 'интервью', 'образование']

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Podcast[]>([])
  const [trending, setTrending] = useState<Podcast[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('atelier_recent_searches')
    if (saved) setRecent(JSON.parse(saved))
    if (isAppwriteConfigured()) {
      getTrendingPodcasts().then(setTrending).catch(() => setTrending(getDemoPodcasts()))
    } else {
      setTrending(getDemoPodcasts())
    }
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = isAppwriteConfigured()
        ? await searchPodcasts(q)
        : getDemoPodcasts().filter(
            (p) =>
              p.title.toLowerCase().includes(q.toLowerCase()) ||
              p.tags.some((t) => t.includes(q.toLowerCase()))
          )
      setResults(res)
      const updated = [q, ...recent.filter((r) => r !== q)].slice(0, 8)
      setRecent(updated)
      localStorage.setItem('atelier_recent_searches', JSON.stringify(updated))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [recent])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, doSearch])

  const searchByTag = (tag: string) => setQuery(tag)

  return (
    <div className="page">
      <h1 className="page-title">Поиск</h1>
      <p className="page-subtitle">Найдите подкасты по названию, автору или тегам</p>

      <div className={styles.searchBox}>
        <Search size={20} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Что хотите послушать?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button className={styles.clear} onClick={() => setQuery('')}>
            <X size={18} />
          </button>
        )}
      </div>

      {!query && recent.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionLabel}>
            <Clock size={14} /> Недавние
          </h3>
          <div className={styles.chips}>
            {recent.map((r) => (
              <button key={r} className={styles.chip} onClick={() => setQuery(r)}>
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {!query && (
        <section className={styles.section}>
          <h3 className={styles.sectionLabel}>
            <Tag size={14} /> Популярные теги
          </h3>
          <div className={styles.chips}>
            {POPULAR_TAGS.map((tag) => (
              <button key={tag} className={styles.chip} onClick={() => searchByTag(tag)}>
                #{tag}
              </button>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence mode="wait">
        {query ? (
          <motion.section
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {loading ? (
              <div className={styles.loading}>Поиск…</div>
            ) : results.length > 0 ? (
              <div className={styles.results}>
                {results.map((p, i) => (
                  <PodcastCard key={p.$id} podcast={p} variant="list" index={i} />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Ничего не найдено</p>
            )}
          </motion.section>
        ) : (
          <motion.section
            key="trending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h3 className={styles.sectionLabel}>
              <TrendingUp size={14} /> В тренде
            </h3>
            <div className={styles.results}>
              {trending.map((p, i) => (
                <PodcastCard key={p.$id} podcast={p} variant="list" index={i} />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
