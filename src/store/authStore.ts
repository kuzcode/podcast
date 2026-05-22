import { create } from 'zustand'
import { loginWithTelegram } from '@/api/auth'
import { getTelegramUser } from '@/lib/telegram'
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
  $id: '123456789',
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
      if (!isAppwriteConfigured()) {
        set({ user: DEMO_USER, isAuthenticated: true, isLoading: false })
        return
      }

      if (!getTelegramUser()) {
        set({
          error: 'Откройте приложение через Telegram',
          isLoading: false,
        })
        return
      }

      const user = await loginWithTelegram()
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
    localStorage.removeItem('atelier_user_id')
    set({ user: null, isAuthenticated: false })
  },
}))
