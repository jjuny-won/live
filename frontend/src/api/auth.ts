import { apiRequest } from './client'
import type { LoginResponse, Member } from './types'

export const authApi = {
  signup: (input: { email: string; password: string; nickname: string }) =>
    apiRequest<Member>('/api/auth/signup', { method: 'POST', body: input, retryOnUnauthorized: false }),
  login: (input: { email: string; password: string }) =>
    apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: input, retryOnUnauthorized: false }),
  testLogin: (role: 'STREAMER' | 'VIEWER' = 'STREAMER') =>
    apiRequest<LoginResponse>('/api/auth/test-login', { method: 'POST', body: { role }, retryOnUnauthorized: false }),
  logout: () => apiRequest<void>('/api/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
  me: () => apiRequest<Member>('/api/members/me'),
}
