import { Link } from 'react-router-dom'
import { useDeleteBroadcast, useMyBroadcasts } from '@/api/broadcasts'
import { errorMessage } from '@/api/client'
import { CATEGORY_LABEL, type Broadcast } from '@/api/types'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { StatusBadge, ViewerCount } from '@/components/StatusBadge'
import { relativeTime } from '@/lib/format'

export function MyBroadcastsPage() {
  const q = useMyBroadcasts()
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">내 방송 관리</h1>
        <Link to="/broadcasts/new" className="btn btn-primary">
          + 새 방송
        </Link>
      </div>
      {q.isPending ? (
        <Spinner className="py-16" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.content.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-zinc-400">
          아직 만든 방송이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
          {q.data.content.map((b) => (
            <MyBroadcastRow key={b.id} broadcast={b} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function OwnerActions({ broadcast: b, compact = false }: { broadcast: Broadcast; compact?: boolean }) {
  const del = useDeleteBroadcast()
  // 소유자에게만 노출 (서버도 403으로 막음)
  if (!b.isOwner) return null
  const onDelete = async () => {
    const msg =
      b.status === 'LIVE' ? '방송 중입니다. 방송을 종료하고 삭제할까요?' : `'${b.title}' 방송을 삭제할까요?`
    if (!window.confirm(msg)) return
    try {
      await del.mutateAsync(b.id)
    } catch (e) {
      window.alert(errorMessage(e))
    }
  }
  const size = compact ? 'px-2.5 py-1.5 text-xs' : ''
  return (
    <div className="flex flex-wrap gap-2">
      {b.status !== 'ENDED' && (
        <Link to={`/studio/${b.id}`} className={`btn btn-primary ${size}`}>
          {b.status === 'LIVE' ? '스튜디오' : '방송 시작'}
        </Link>
      )}
      <Link to={`/broadcasts/${b.id}/edit`} className={`btn btn-secondary ${size}`}>
        수정
      </Link>
      <button className={`btn btn-danger ${size}`} onClick={onDelete} disabled={del.isPending}>
        {del.isPending ? '삭제 중…' : '삭제'}
      </button>
    </div>
  )
}

function MyBroadcastRow({ broadcast: b }: { broadcast: Broadcast }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Link to={`/live/${b.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          {b.status === 'LIVE' && <ViewerCount count={b.viewerCount} />}
        </div>
        <p className="mt-1 truncate font-semibold hover:text-brand-400">{b.title}</p>
        <p className="text-xs text-zinc-500">
          {b.category && CATEGORY_LABEL[b.category]} · {relativeTime(b.createdAt)} 생성
        </p>
      </Link>
      <OwnerActions broadcast={b} compact />
    </li>
  )
}
