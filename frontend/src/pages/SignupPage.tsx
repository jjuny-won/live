import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { AuthCard, useRedirectTarget } from './LoginPage'

export function SignupPage() {
  const { status, signup } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', nickname: '' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (status === 'authenticated' && !pending) return <Navigate to={target} replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8 || form.password.length > 64) return setError('비밀번호는 8~64자로 입력해 주세요.')
    if (form.password !== form.passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')
    const nick = form.nickname.trim()
    if (nick.length < 2 || nick.length > 20) return setError('닉네임은 2~20자로 입력해 주세요.')
    setPending(true)
    setError(null)
    try {
      await signup(form.email.trim(), form.password, form.nickname.trim())
      navigate(target, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <AuthCard title="회원가입">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input" type="email" autoComplete="email" placeholder="이메일" value={form.email} onChange={set('email')} required />
        <input className="input" autoComplete="nickname" placeholder="닉네임 (2~20자)" maxLength={20} value={form.nickname} onChange={set('nickname')} required />
        <input className="input" type="password" autoComplete="new-password" placeholder="비밀번호 (8~64자)" maxLength={64} value={form.password} onChange={set('password')} required />
        <input className="input" type="password" autoComplete="new-password" placeholder="비밀번호 확인" value={form.passwordConfirm} onChange={set('passwordConfirm')} required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn btn-primary w-full py-2.5" disabled={pending}>
          {pending ? '가입 중…' : '가입하고 시작하기'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-400">
        이미 계정이 있나요?{' '}
        <Link to="/login" state={{ from: target }} className="text-brand-400 hover:underline">
          로그인
        </Link>
      </p>
    </AuthCard>
  )
}
