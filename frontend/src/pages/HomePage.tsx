import { Link } from 'react-router-dom'
import { useBroadcastList } from '@/api/broadcasts'
import { useAuth } from '@/auth/AuthContext'
import { BroadcastCard } from '@/components/BroadcastCard'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'

export function HomePage() {
  const { status } = useAuth()
  const live = useBroadcastList('LIVE')

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 ring-1 ring-zinc-800 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">설치 없이, 브라우저로 바로 라이브</h1>
          <p className="mt-1 text-sm text-zinc-400">
            PC에선 화면·소리·마이크를, 휴대폰에선 카메라·마이크를 실시간으로 송출하세요.
          </p>
        </div>
        <Link
          to={status === 'authenticated' ? '/broadcasts/new' : '/login'}
          state={{ from: '/broadcasts/new' }}
          className="btn btn-primary"
        >
          방송 시작하기
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="text-xl font-bold">지금 라이브</h2>
          {live.data && <span className="text-sm text-zinc-400">{live.data.totalElements}개</span>}
        </div>
        {live.isPending ? (
          <Spinner className="py-16" />
        ) : live.isError ? (
          <ErrorState error={live.error} onRetry={() => live.refetch()} />
        ) : live.data.content.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-zinc-400">
            지금 진행 중인 방송이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {live.data.content.map((b) => (
              <BroadcastCard key={b.id} broadcast={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
