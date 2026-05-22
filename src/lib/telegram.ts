import type { TelegramUser } from '@/types'

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp
  }
  return null
}

export function initTelegramApp(): void {
  const tg = getTelegramWebApp()
  if (!tg) return

  tg.ready()
  tg.expand()
  tg.setHeaderColor('#0f0e0c')
  tg.setBackgroundColor('#0f0e0c')
}

/** Парсинг user из сырой строки initData (надёжнее, чем только initDataUnsafe). */
function parseUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (!userStr) return null
    const raw = JSON.parse(userStr) as Record<string, unknown>
    if (typeof raw.id !== 'number' || typeof raw.first_name !== 'string') return null
    return {
      id: raw.id,
      first_name: raw.first_name,
      last_name: typeof raw.last_name === 'string' ? raw.last_name : undefined,
      username: typeof raw.username === 'string' ? raw.username : undefined,
      language_code: typeof raw.language_code === 'string' ? raw.language_code : undefined,
      photo_url: typeof raw.photo_url === 'string' ? raw.photo_url : undefined,
      is_premium: Boolean(raw.is_premium),
    }
  } catch {
    return null
  }
}

/** Пользователь из Telegram. */
export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp()

  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user as TelegramUser
  }

  if (tg?.initData) {
    const parsed = parseUserFromInitData(tg.initData)
    if (parsed) return parsed
  }

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_TELEGRAM === 'true') {
    return {
      id: 123456789,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
      language_code: 'ru',
      photo_url: '',
      is_premium: false,
    }
  }

  return null
}

/** Telegram иногда отдаёт user с задержкой — ждём после ready(). */
export function waitForTelegramUser(timeoutMs = 4000): Promise<TelegramUser | null> {
  return new Promise((resolve) => {
    const started = Date.now()

    const tick = () => {
      const user = getTelegramUser()
      if (user) {
        resolve(user)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null)
        return
      }
      setTimeout(tick, 50)
    }

    initTelegramApp()
    tick()
  })
}

export function hasTelegramContext(): boolean {
  const tg = getTelegramWebApp()
  return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user))
}

export function haptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection' = 'light'
): void {
  const tg = getTelegramWebApp()
  if (!tg) return
  if (type === 'success' || type === 'error') {
    tg.HapticFeedback.notificationOccurred(type)
  } else if (type === 'selection') {
    tg.HapticFeedback.selectionChanged()
  } else {
    tg.HapticFeedback.impactOccurred(type)
  }
}

export function sharePodcast(podcastId: string, title: string): void {
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
  const link = `${appUrl}?startapp=podcast_${podcastId}`
  const text = `🎧 ${title}\n\nСлушай в Atelier:`

  const tg = getTelegramWebApp()
  if (tg?.shareMessage) {
    tg.shareMessage({ text, url: link })
    return
  }

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
  if (tg) {
    tg.openTelegramLink(shareUrl)
  } else if (navigator.share) {
    navigator.share({ title, text, url: link }).catch(() => {})
  } else {
    navigator.clipboard.writeText(`${text}\n${link}`)
  }
}

export function isInTelegram(): boolean {
  return hasTelegramContext()
}
