/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string
  readonly VITE_APPWRITE_PROJECT_ID: string
  readonly VITE_APPWRITE_DATABASE_ID: string
  readonly VITE_APPWRITE_USERS_COLLECTION: string
  readonly VITE_APPWRITE_PODCASTS_COLLECTION: string
  readonly VITE_APPWRITE_FAVORITES_COLLECTION: string
  readonly VITE_APPWRITE_HISTORY_COLLECTION: string
  readonly VITE_APPWRITE_PROGRESS_COLLECTION: string
  readonly VITE_APPWRITE_MEDIA_BUCKET: string
  readonly VITE_APP_URL: string
  readonly VITE_DEV_MOCK_TELEGRAM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  openLink: (url: string) => void
  openTelegramLink: (url: string) => void
  shareMessage?: (params: { text: string; url?: string }) => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
      photo_url?: string
      is_premium?: boolean
    }
  }
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
    setText: (text: string) => void
    enable: () => void
    disable: () => void
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
