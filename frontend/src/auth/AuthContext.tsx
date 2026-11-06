import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { getAccessToken, onAuthLost, refreshAccessToken, setAccessToken } from '@/api/client'
import type { LoginResponse, Member } from '@/api/types'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  member: Member | null
  login: (email: string, password: string) => Promise<Member>
  testLogin: (role?: 'STREAMER' | 'VIEWER') => Promise<Member>
  signup: (email: string, password: string, nickname: string) => Promise<Member>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [member, setMember] = useState<Member | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // 첫 진입: 저장된 access 토큰 또는 refresh 쿠키로 세션 복원
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!getAccessToken() && !(await refreshAccessToken())) throw new Error('no session')
        const me = await authApi.me()
        if (!cancelled) {
          setMember(me)
          setStatus('authenticated')
        }
      } catch {
        setAccessToken(null)
        if (!cancelled) {
          setMember(null)
          setStatus('anonymous')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      onAuthLost(() => {
        setMember(null)
        setStatus('anonymous')
        qc.invalidateQueries()
      }),
    [qc],
  )

  const applyLogin = useCallback(
    (res: LoginResponse) => {
      setAccessToken(res.accessToken)
      setMember(res.member)
      setStatus('authenticated')
      // isOwner 등 로그인 여부에 따라 달라지는 응답 다시 받기
      qc.invalidateQueries()
      return res.member
    },
    [qc],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      member,
      login: async (email, password) => applyLogin(await authApi.login({ email, password })),
      testLogin: async (role) => applyLogin(await authApi.testLogin(role)),
      signup: async (email, password, nickname) => {
        await authApi.signup({ email, password, nickname })
        return applyLogin(await authApi.login({ email, password }))
      },
      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          /* 서버 오류여도 로컬 세션은 정리 */
        }
        setAccessToken(null)
        setMember(null)
        setStatus('anonymous')
        qc.invalidateQueries()
      },
    }),
    [status, member, applyLogin, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  return ctx
}
