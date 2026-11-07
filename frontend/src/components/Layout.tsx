import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { USE_MOCK_API } from '@/config'

export function Layout() {
  const { status, member, logout } = useAuth()
  const navigate = useNavigate()

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `btn btn-ghost px-3 ${isActive ? 'text-white' : ''}`

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="mr-auto flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="inline-block size-3 rounded-full bg-brand-500" />
            live
            {USE_MOCK_API && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                MOCK
              </span>
            )}
          </Link>
          {status === 'authenticated' ? (
            <>
              <NavLink to="/me/broadcasts" className={navCls}>
                내 방송
              </NavLink>
              <Link to="/broadcasts/new" className="btn btn-primary px-3">
                방송하기
              </Link>
              <span className="hidden text-sm text-zinc-400 sm:inline">{member?.nickname}</span>
              <button
                className="btn btn-ghost px-3"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                로그아웃
              </button>
            </>
          ) : status === 'anonymous' ? (
            <>
              <NavLink to="/login" className={navCls}>
                로그인
              </NavLink>
              <Link to="/signup" className="btn btn-primary px-3">
                회원가입
              </Link>
            </>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
