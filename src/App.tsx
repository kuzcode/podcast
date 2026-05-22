import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LikesPage } from '@/pages/LikesPage'
import { AccountPage } from '@/pages/AccountPage'
import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { getPodcast } from '@/api/podcasts'
import { initTelegramApp } from '@/lib/telegram'
import '@/styles/globals.css'

function DeepLinkHandler() {
  const [params] = useSearchParams()
  const play = usePlayerStore((s) => s.play)

  useEffect(() => {
    const startapp = params.get('startapp') || params.get('tgWebAppStartParam')
    if (startapp?.startsWith('podcast_')) {
      const id = startapp.replace('podcast_', '')
      getPodcast(id).then((p) => {
        if (p?.audioUrl) play(p)
      })
    }
  }, [params, play])

  return null
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, error, init } = useAuthStore()

  useEffect(() => {
    initTelegramApp()
    init()
  }, [init])

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__logo">Atelier</div>
        <div className="auth-loading__spinner" />
        <p>Вход через Telegram…</p>
        <style>{`
          .auth-loading {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            background: var(--bg-primary);
          }
          .auth-loading__logo {
            font-family: var(--font-display);
            font-size: 2.5rem;
            background: linear-gradient(135deg, var(--gold-light), var(--gold));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: fadeInUp 0.8s ease;
          }
          .auth-loading__spinner {
            width: 32px;
            height: 32px;
            border: 2px solid var(--border);
            border-top-color: var(--gold);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .auth-loading p {
            color: var(--text-muted);
            font-size: 0.85rem;
          }
        `}</style>
      </div>
    )
  }

  if (!isAuthenticated && error) {
    return (
      <div className="auth-loading">
        <p style={{ color: 'var(--burgundy-light)', textAlign: 'center', padding: '0 24px' }}>
          {error}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Откройте приложение через бота в Telegram
        </p>
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <DeepLinkHandler />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/likes" element={<LikesPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
