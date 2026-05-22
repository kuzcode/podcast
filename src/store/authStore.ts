import { create } from 'zustand'
import { loginWithTelegram } from '@/api/auth'
import { hasTelegramContext, waitForTelegramUser } from '@/lib/telegram'
import { isAppwriteConfigured } from '@/lib/appwrite'
import { DEFAULT_SETTINGS } from '@/lib/constants'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  errorHint: string | null
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
  errorHint: null,

  init: async () => {
    set({ isLoading: true, error: null, errorHint: null })

    try {
      if (!isAppwriteConfigured()) {
        set({ user: DEMO_USER, isAuthenticated: true, isLoading: false })
        return
      }

      await waitForTelegramUser(4000)

      if (!hasTelegramContext()) {
        set({
          error: 'Откройте приложение через Telegram',
          errorHint: 'Ссылка в браузере не передаёт данные профиля.',
          isLoading: false,
        })
        return
      }

      const user = await loginWithTelegram()
      localStorage.setItem('atelier_user_id', user.$id)
      set({ user, isAuthenticated: true, isLoading: false, error: null, errorHint: null })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка входа'

      if (message === 'TELEGRAM_USER_MISSING') {
        set({
          error: 'Telegram не передал профиль',
          errorHint: 'Закройте Mini App и откройте снова из меню бота.',
          isLoading: false,
        })
        return
      }

      if (import.meta.env.DEV) {
        set({ user: DEMO_USER, isAuthenticated: true, isLoading: false })
        return
      }

      const isAppwrite =
        message.includes('Appwrite') ||
        message.includes('связи') ||
        message.includes('Platform')

      set({
        error: message,
        errorHint: isAppwrite
          ? 'Appwrite Console → Settings → Platforms → Add Web → ваш домен Vercel.'
          : 'Проверьте интернет и настройки .env на Vercel.',
        isLoading: false,
      })
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
