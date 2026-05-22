import { databases, DB_ID, COL } from '@/lib/appwrite'
import { DEFAULT_SETTINGS } from '@/lib/constants'
import { getTelegramUser } from '@/lib/telegram'
import type { User, UserSettings, TelegramUser } from '@/types'

function mapUser(doc: Record<string, unknown>): User {
  let settings: UserSettings = { ...DEFAULT_SETTINGS }
  if (typeof doc.settings === 'string') {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(doc.settings) } as UserSettings
    } catch {
      /* defaults */
    }
  } else if (doc.settings && typeof doc.settings === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...(doc.settings as UserSettings) }
  }

  return {
    $id: doc.$id as string,
    telegramId: doc.telegramId as string,
    firstName: doc.firstName as string,
    lastName: doc.lastName as string | undefined,
    username: doc.username as string | undefined,
    photoUrl: doc.photoUrl as string | undefined,
    languageCode: doc.languageCode as string | undefined,
    isPremium: doc.isPremium as boolean | undefined,
    settings,
    createdAt: doc.createdAt as string,
  }
}

/** Вход без Functions: профиль Telegram → документ в Appwrite (ID = telegramId). */
export async function loginWithTelegram(): Promise<User> {
  const tg = getTelegramUser()
  if (!tg) throw new Error('Нет данных Telegram. Откройте приложение из бота.')

  return upsertUser(tg)
}

async function upsertUser(tg: TelegramUser): Promise<User> {
  const docId = String(tg.id)
  const payload = {
    telegramId: docId,
    firstName: tg.first_name,
    lastName: tg.last_name || '',
    username: tg.username || '',
    photoUrl: tg.photo_url || '',
    languageCode: tg.language_code || 'ru',
    isPremium: tg.is_premium || false,
    settings: JSON.stringify(DEFAULT_SETTINGS),
    createdAt: new Date().toISOString(),
  }

  try {
    await databases.getDocument(DB_ID, COL.users, docId)
    const updated = await databases.updateDocument(DB_ID, COL.users, docId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      photoUrl: payload.photoUrl,
      languageCode: payload.languageCode,
      isPremium: payload.isPremium,
    })
    return mapUser(updated as unknown as Record<string, unknown>)
  } catch {
    const created = await databases.createDocument(DB_ID, COL.users, docId, payload)
    return mapUser(created as unknown as Record<string, unknown>)
  }
}
