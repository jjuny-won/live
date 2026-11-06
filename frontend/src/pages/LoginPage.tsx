import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

export function useRedirectTarget() {
  const location = useLocation()
  return (location.state as { from?: string } | null)?.from ?? '/'
}

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-2xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
      <h1 className="mb-5 text-xl font-bold">{title}</h1>
      {children}
    </div>
  )
}

export function LoginPage() {
  const { status, login, testLogin } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'login' | 'test' | 'viewer' | null>(null)

  if (status === 'authenticated' && !pending) return <Navigate to={target} replace />

  const run = async (kind: 'login' | 'test' | 'viewer', fn: () => Promise<unknown>) => {
    setPending(kind)
    setError(null)
    try {
      await fn()
      navigate(target, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setPending(null)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run('login', () => login(email.trim(), password))
  }

  return (
    <AuthCard title="로그인">
      <button
        type="button"
        className="btn btn-primary w-full py-3"
        disabled={pending !== null}
        onClick={() => run('test', () => testLogin('STREAMER'))}
      >
        {pending === 'test' ? '로그인 중…' : '테스트 계정으로 시작'}
      </button>
      <button
        type="button"
        className="btn btn-ghost mt-1 w-full text-xs"
        disabled={pending !== null}
        onClick={() => run('viewer', () => testLogin('VIEWER'))}
      >
        {pending === 'viewer' ? '로그인 중…' : '시청자 테스트 계정으로 시작'}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        또는 이메일로 로그인
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn btn-secondary w-full" disabled={pending !== null}>
          {pending === 'login' ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-400">
        계정이 없나요?{' '}
        <Link to="/signup" state={{ from: target }} className="text-brand-400 hover:underline">
          회원가입
        </Link>
      </p>
    </AuthCard>
  )
}
