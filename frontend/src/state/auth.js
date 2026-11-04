import { reactive } from 'vue'
import { ApiError } from '../api/client.js'
import { getProfile, requestToken } from '../api/auth.js'

const storageKey = 'perfect-day.access-token'

function readToken() {
  try {
    return sessionStorage.getItem(storageKey) || ''
  } catch {
    return ''
  }
}

function saveToken(token) {
  try {
    if (token) sessionStorage.setItem(storageKey, token)
    else sessionStorage.removeItem(storageKey)
  } catch {
    return
  }
}

export const auth = reactive({ token: readToken(), user: null, notice: '' })

export function signOut() {
  auth.token = ''
  auth.user = null
  saveToken('')
}

export async function signIn(credentials) {
  const result = await requestToken(credentials)
  if (typeof result.access_token !== 'string' || !result.access_token || result.token_type !== 'bearer') {
    throw new ApiError('Сервер не вернул токен для входа. Попробуйте ещё раз.')
  }
  const user = await getProfile(result.access_token)
  auth.token = result.access_token
  auth.user = user
  auth.notice = ''
  saveToken(auth.token)
}

export async function restoreSession() {
  if (!auth.token) return false
  try {
    auth.user = await getProfile(auth.token)
    return true
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      signOut()
      return false
    }
    throw error
  }
}
