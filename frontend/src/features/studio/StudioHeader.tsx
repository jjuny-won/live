import { Link } from 'react-router-dom'
import type { Broadcast } from '@/api/types'
import { ViewerCount } from '@/components/StatusBadge'
import type { StudioMode } from './device'
import type { useLiveSession } from './useLiveSession'
import { useElapsed } from './useElapsed'

export function StudioHeader({
  broadcast,
  session,
  mode,
}: {
  broadcast: Broadcast
  session: ReturnType<typeof useLiveSession>
  mode: StudioMode
}) {
  const isLive = session.phase === 'live'
  const time = useElapsed(isLive ? session.startedAt : null)
  return (
    <header className="flex h-14 items-center gap-3 border-b border-zinc-800 px-4">
      <Link to="/me/broadcasts" className="text-zinc-400 hover:text-white" aria-label="내 방송으로">
        ←
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{broadcast.title}</p>
        <p className="text-xs text-zinc-500">{mode === 'pc' ? 'PC 스튜디오 · 화면 공유' : '모바일 스튜디오 · 카메라'}</p>
      </div>
      {isLive && (
        <>
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">LIVE {time}</span>
          {session.viewers !== null && <ViewerCount count={session.viewers} />}
        </>
      )}
      {!isLive && (
        <Link
          to={mode === 'pc' ? '?mode=mobile' : '?mode=pc'}
          className="hidden text-xs text-zinc-400 hover:underline sm:inline"
        >
          {mode === 'pc' ? '카메라 모드로' : 'PC(화면 공유) 모드로'}
        </Link>
      )}
    </header>
  )
}
