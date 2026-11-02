import { apiRequest } from './client.js'

export function registerAccount({ email, password, birthDate, chronotype }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, birth_date: birthDate, chronotype },
  })
}

export function requestToken({ email, password }) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } })
}

export function getProfile(token) {
  return apiRequest('/users/me', { token })
}
