import { functions, FN } from '@/lib/appwrite'
import type { AuthResponse } from '@/types'

const SESSION_KEY = 'atelier_session'

export function getStoredSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setStoredSession(token: string): void {
  localStorage.setItem(SESSION_KEY, token)
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function authenticateWithTelegram(initData: string): Promise<AuthResponse> {
  const execution = await functions.createExecution(
    FN.auth,
    JSON.stringify({ initData })
  )

  if (execution.status === 'failed') {
    throw new Error(execution.errors || 'Ошибка авторизации')
  }

  const result = JSON.parse(execution.responseBody) as AuthResponse & { error?: string }
  if (result.error) throw new Error(result.error)

  setStoredSession(result.sessionToken)
  return result
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredSession()
  return token ? { 'X-Session-Token': token } : {}
}
