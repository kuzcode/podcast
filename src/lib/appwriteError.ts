import { AppwriteException } from 'appwrite'

export function formatAppwriteError(e: unknown): string {
  if (e instanceof AppwriteException) {
    if (e.code === 401 || e.code === 403) {
      return `Appwrite: нет доступа (${e.code}). В коллекции users включите Create/Read/Update для Any.`
    }
    if (e.code === 404) {
      return 'Appwrite: коллекция или документ не найден. Проверьте ID базы и коллекций в .env'
    }
    return e.message || `Appwrite error ${e.code}`
  }

  if (e instanceof Error) {
    const msg = e.message.toLowerCase()
    if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('network')) {
      return (
        'Нет связи с Appwrite. В Console → Settings → Platforms добавьте домен ' +
        'вашего приложения (например podcast-five-sage.vercel.app) как Web platform.'
      )
    }
    return e.message
  }

  return 'Неизвестная ошибка'
}

export function isNotFoundError(e: unknown): boolean {
  return e instanceof AppwriteException && e.code === 404
}
