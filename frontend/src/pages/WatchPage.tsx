import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { broadcastApi, useBroadcast } from '@/api/broadcasts'
import { errorMessage, hasErrorCode } from '@/api/client'
import { CATEGORY_LABEL, type Broadcast } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { StatusBadge, ViewerCount } from '@/components/StatusBadge'
import { useElapsed } from '@/features/studio/useElapsed'
import { LivePlayer } from '@/features/watch/LivePlayer'
import { EndedView } from './EndedPage'
import { OwnerActions } from './MyBroadcastsPage'

export function WatchPage() {
  const id = Number(useParams().id)
  const q = useBroadcast(id, { refetchInterval: 10_000 })
  const { refetch } = q
  const refresh = useCallback(() => void refetch(), [refetch])

  if (q.isPending) return <Spinner className="py-24" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const b = q.data
  if (b.status === 'ENDED') return <EndedView broadcast={b} />

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-zinc-800">
          {b.status === 'LIVE' ? (
            <LiveSection broadcast={b} onDisconnected={refresh} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-center text-zinc-400">
              <div className="text-4xl">⏳</div>
              <p>아직 방송이 시작되지 않았습니다.</p>
              <p className="text-xs">시작되면 자동으로 재생됩니다.</p>
            </div>
          )}
        </div>
        <BroadcastInfo broadcast={b} />
      </div>
      <ChatPanelPlaceholder />
    </div>
  )
}

function LiveSection({ broadcast, onDisconnected }: { broadcast: Broadcast; onDisconnected: () => void }) {
  const { status } = useAuth()
  // 로그인 여부에 따라 canChat이 달라지므로 키에 포함
  const token = useQuery({
    queryKey: ['viewer-token', broadcast.id, status],
    queryFn: () => broadcastApi.viewerToken(broadcast.id),
    enabled: status !== 'loading',
    staleTime: Infinity,
    gcTime: 0,
  })
  const notLive = hasErrorCode(token.error, 'BROADCAST_NOT_LIVE')
  // 목록에선 LIVE였지만 그새 끝난 경우 → 방송 상태를 다시 받아 종료/대기 화면으로
  useEffect(() => {
    if (notLive) onDisconnected()
  }, [notLive, onDisconnected])

  if (token.isPending) return <Spinner className="size-full" label="입장 준비 중" />
  if (token.isError) {
    const noLiveKit = hasErrorCode(token.error, 'LIVEKIT_NOT_CONFIGURED')
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-4xl">{noLiveKit ? '🛠️' : '⚠️'}</div>
        <p className="max-w-md text-sm text-zinc-300">{errorMessage(token.error)}</p>
        {!notLive && (
          <button className="btn btn-secondary" onClick={() => token.refetch()}>
            다시 시도
          </button>
        )}
      </div>
    )
  }
  return <LivePlayer token={token.data} onDisconnected={onDisconnected} />
}

function BroadcastInfo({ broadcast: b }: { broadcast: Broadcast }) {
  const time = useElapsed(b.status === 'LIVE' ? b.startedAt : null)
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold">{b.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          <StatusBadge status={b.status} />
          {b.status === 'LIVE' && (
            <>
              <ViewerCount count={b.viewerCount} />
              <span>· {time} 방송 중</span>
            </>
          )}
          <span>· {b.owner.nickname}</span>
          {b.category && <span>· {CATEGORY_LABEL[b.category]}</span>}
        </div>
        {b.description && <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-300">{b.description}</p>}
      </div>
      <OwnerActions broadcast={b} compact />
    </div>
  )
}

/** 채팅(선택 기능) 자리. LiveKit Data 메시지(topic: chat)로 구현 예정 */
function ChatPanelPlaceholder() {
  const { status } = useAuth()
  return (
    <aside className="flex min-h-64 flex-col rounded-xl bg-zinc-900 ring-1 ring-zinc-800 lg:h-[calc(100dvh-8rem)]">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">채팅</div>
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-zinc-500">
        채팅은 준비 중입니다.
      </div>
      <div className="border-t border-zinc-800 p-3">
        {status === 'authenticated' ? (
          <input className="input" disabled placeholder="채팅 준비 중" />
        ) : (
          <Link to="/login" className="btn btn-secondary w-full text-xs">
            로그인하고 채팅하기
          </Link>
        )}
      </div>
    </aside>
  )
}
