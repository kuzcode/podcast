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

export function getInitData(): string {
  const tg = getTelegramWebApp()
  if (tg?.initData) return tg.initData

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_TELEGRAM === 'true') {
    const mockUser = {
      id: 123456789,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
      language_code: 'ru',
      photo_url: '',
      is_premium: false,
    }
    const authDate = Math.floor(Date.now() / 1000)
    const params = new URLSearchParams({
      user: JSON.stringify(mockUser),
      auth_date: String(authDate),
      hash: 'dev_mock_hash_not_for_production',
    })
    return params.toString()
  }

  return ''
}

export function getTelegramUserUnsafe() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null
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
  return Boolean(getTelegramWebApp()?.initData)
}
