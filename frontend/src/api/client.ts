import { API_BASE_URL } from '@/config'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status)
}

export function errorMessage(e: unknown, fallback = '요청을 처리하지 못했습니다.'): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.'
    return e.message || fallback
  }
  if (e instanceof Error) return e.message
  return fallback
}

/* ───────────── Access 토큰: 메모리 + sessionStorage(새로고침 대비) ───────────── */

const TOKEN_KEY = 'live.accessToken'
let accessToken: string | null = readStoredToken()
const authLostListeners = new Set<() => void>()

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 사파리 사생활 보호 모드 등 */
  }
}

/** refresh까지 실패해 로그인이 풀렸을 때 알림 */
export function onAuthLost(listener: () => void) {
  authLostListeners.add(listener)
  return () => {
    authLostListeners.delete(listener)
  }
}

/* ───────────── refresh (동시 요청은 한 번만) ───────────── */

let refreshing: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) return null
        const body = (await res.json()) as { accessToken: string }
        setAccessToken(body.accessToken)
        return body.accessToken
      } catch {
        return null
      } finally {
        // 다음 tick에 해제해 같은 순간 들어온 요청이 같은 결과를 공유
        setTimeout(() => (refreshing = null), 0)
      }
    })()
  }
  return refreshing
}

/* ───────────── 요청 ───────────── */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** false면 401이어도 refresh 재시도 안 함 */
  retryOnUnauthorized?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(API_BASE_URL + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v))
  }
  return url.toString()
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {}
  try {
    body = (await res.json()) as Partial<ApiErrorBody>
  } catch {
    /* 본문 없음 */
  }
  const fallback =
    res.status === 401
      ? '로그인이 필요합니다.'
      : res.status === 403
        ? '권한이 없습니다.'
        : res.status === 404
          ? '찾을 수 없습니다.'
          : `요청 실패 (${res.status})`
  return new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.message ?? fallback)
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, retryOnUnauthorized = true, signal } = opts

  const send = (token: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // refresh 쿠키(Path=/api/auth)를 주고받기 위해 항상 포함
      credentials: 'include',
      signal,
    })
  }

  let res: Response
  try {
    res = await send(accessToken)
    if (res.status === 401 && retryOnUnauthorized) {
      const hadToken = accessToken !== null
      const next = await refreshAccessToken()
      if (next) {
        res = await send(next)
      } else if (hadToken) {
        setAccessToken(null)
        authLostListeners.forEach((l) => l())
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다.')
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
