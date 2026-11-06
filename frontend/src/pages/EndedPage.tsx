import { Link, useParams } from 'react-router-dom'
import { useBroadcast } from '@/api/broadcasts'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { OwnerActions } from './MyBroadcastsPage'
import type { Broadcast } from '@/api/types'
import { elapsed } from '@/lib/format'

export function EndedPage() {
  const id = Number(useParams().id)
  const q = useBroadcast(id)
  if (q.isPending) return <Spinner className="py-24" />
  if (q.isError) return <ErrorState error={q.error} />
  return <EndedView broadcast={q.data} />
}

export function EndedView({ broadcast: b }: { broadcast: Broadcast }) {
  const duration =
    b.startedAt && b.endedAt ? elapsed(b.startedAt, new Date(b.endedAt).getTime()) : null
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-zinc-800 text-3xl">📺</div>
      <h1 className="text-xl font-bold">방송이 종료되었습니다</h1>
      <p className="text-zinc-300">{b.title}</p>
      <p className="text-sm text-zinc-500">
        {b.owner.nickname}
        {duration && <> · 방송 시간 {duration}</>}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn btn-primary">
          다른 라이브 보기
        </Link>
        {b.isOwner && <OwnerActions broadcast={b} />}
      </div>
    </div>
  )
}
