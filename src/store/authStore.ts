import { create } from 'zustand'
import { authenticateWithTelegram, getStoredSession } from '@/api/auth'
import { getInitData } from '@/lib/telegram'
import { isAppwriteConfigured } from '@/lib/appwrite'
import { DEFAULT_SETTINGS } from '@/lib/constants'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  init: () => Promise<void>
  updateSettings: (settings: Partial<User['settings']>) => void
  logout: () => void
}

const DEMO_USER: User = {
  $id: 'demo-user',
  telegramId: '123456789',
  firstName: 'Dev',
  lastName: 'User',
  username: 'devuser',
  settings: DEFAULT_SETTINGS,
  createdAt: new Date().toISOString(),
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  init: async () => {
    set({ isLoading: true, error: null })

    try {
      const initData = getInitData()

      if (!isAppwriteConfigured()) {
        set({
          user: DEMO_USER,
          isAuthenticated: true,
          isLoading: false,
        })
        return
      }

      if (!initData) {
        set({
          error: 'Откройте приложение через Telegram',
          isLoading: false,
        })
        return
      }

      const session = getStoredSession()
      if (session) {
        try {
          const { user } = await authenticateWithTelegram(initData)
          localStorage.setItem('atelier_user_id', user.$id)
          set({ user, isAuthenticated: true, isLoading: false })
          return
        } catch {
          /* re-auth */
        }
      }

      const { user } = await authenticateWithTelegram(initData)
      localStorage.setItem('atelier_user_id', user.$id)
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка входа'
      if (import.meta.env.DEV) {
        set({ user: DEMO_USER, isAuthenticated: true, isLoading: false })
      } else {
        set({ error: message, isLoading: false })
      }
    }
  },

  updateSettings: (partial) => {
    const { user } = get()
    if (!user) return
    set({
      user: {
        ...user,
        settings: { ...user.settings, ...partial },
      },
    })
  },

  logout: () => {
    localStorage.removeItem('atelier_session')
    set({ user: null, isAuthenticated: false })
  },
}))
