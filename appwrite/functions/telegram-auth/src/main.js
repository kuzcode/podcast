import * as crypto from 'crypto'
import { Client, Databases, ID, Query } from 'node-appwrite'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DB_ID = process.env.APPWRITE_DATABASE_ID || 'podcast_db'
const USERS_COL = process.env.APPWRITE_USERS_COLLECTION || 'users'
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production'

function validateInitData(initData) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new Error('Missing hash')

  params.delete('hash')
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const secretKey = crypto.createHmac('sha256', BOT_TOKEN).update('WebAppData').digest()

  const calculated = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (calculated !== hash) throw new Error('Invalid initData signature')

  const authDate = parseInt(params.get('auth_date') || '0', 10)
  if (Date.now() / 1000 - authDate > 86400) {
    throw new Error('initData expired')
  }

  const userStr = params.get('user')
  if (!userStr) throw new Error('No user in initData')
  return JSON.parse(userStr)
}

function createSessionToken(telegramId) {
  const payload = `${telegramId}:${Date.now()}`
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex')
}

export default async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return res.json('', 204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    })
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY)

    const databases = new Databases(client)

    let body = {}
    try {
      body = JSON.parse(req.body || '{}')
    } catch {
      body = {}
    }

    const initData = body.initData || req.headers['x-telegram-init-data']
    if (!initData) {
      return res.json({ error: 'initData required' }, 400)
    }

    const tgUser = validateInitData(initData)
    const telegramId = String(tgUser.id)

    const existing = await databases.listDocuments(DB_ID, USERS_COL, [
      Query.equal('telegramId', telegramId),
      Query.limit(1),
    ])

    const defaultSettings = JSON.stringify({
      playbackSpeed: 1,
      skipForwardSec: 30,
      skipBackwardSec: 15,
      autoPlayNext: true,
      sleepTimerMinutes: 0,
      trimSilence: false,
      theme: 'renaissance',
    })

    let userDoc

    if (existing.total > 0) {
      userDoc = await databases.updateDocument(DB_ID, USERS_COL, existing.documents[0].$id, {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || '',
        username: tgUser.username || '',
        photoUrl: tgUser.photo_url || '',
        languageCode: tgUser.language_code || 'ru',
        isPremium: tgUser.is_premium || false,
      })
    } else {
      userDoc = await databases.createDocument(DB_ID, USERS_COL, ID.unique(), {
        telegramId,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || '',
        username: tgUser.username || '',
        photoUrl: tgUser.photo_url || '',
        languageCode: tgUser.language_code || 'ru',
        isPremium: tgUser.is_premium || false,
        settings: defaultSettings,
        sessionToken: '',
        createdAt: new Date().toISOString(),
      })
    }

    const sessionToken = createSessionToken(telegramId)
    await databases.updateDocument(DB_ID, USERS_COL, userDoc.$id, { sessionToken })

    const settings =
      typeof userDoc.settings === 'string'
        ? JSON.parse(userDoc.settings)
        : userDoc.settings

    return res.json(
      {
        user: {
          $id: userDoc.$id,
          telegramId: userDoc.telegramId,
          firstName: userDoc.firstName,
          lastName: userDoc.lastName,
          username: userDoc.username,
          photoUrl: userDoc.photoUrl,
          languageCode: userDoc.languageCode,
          isPremium: userDoc.isPremium,
          settings,
          createdAt: userDoc.createdAt,
        },
        sessionToken,
      },
      200,
      { 'Access-Control-Allow-Origin': '*' }
    )
  } catch (e) {
    error(e.message)
    return res.json({ error: e.message }, 401, {
      'Access-Control-Allow-Origin': '*',
    })
  }
}
