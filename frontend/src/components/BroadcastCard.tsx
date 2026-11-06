import { Link } from 'react-router-dom'
import { CATEGORY_LABEL, type Broadcast } from '@/api/types'
import { relativeTime } from '@/lib/format'
import { StatusBadge, ViewerCount } from './StatusBadge'

const gradients = [
  'from-emerald-700 to-cyan-900',
  'from-fuchsia-700 to-indigo-900',
  'from-amber-600 to-rose-900',
  'from-sky-700 to-violet-900',
]

export function Thumbnail({ broadcast }: { broadcast: Broadcast }) {
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${gradients[broadcast.id % gradients.length]}`}
    >
      {broadcast.thumbnailUrl ? (
        <img src={broadcast.thumbnailUrl} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center p-4 text-center text-lg font-bold text-white/80">
          {broadcast.title}
        </div>
      )}
      <div className="absolute top-2 left-2">
        <StatusBadge status={broadcast.status} />
      </div>
      {broadcast.status === 'LIVE' && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5">
          <ViewerCount count={broadcast.viewerCount} />
        </div>
      )}
    </div>
  )
}

export function BroadcastCard({ broadcast }: { broadcast: Broadcast }) {
  return (
    <Link to={`/live/${broadcast.id}`} className="group block">
      <div className="transition group-hover:-translate-y-0.5">
        <Thumbnail broadcast={broadcast} />
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-1 font-semibold group-hover:text-brand-400">{broadcast.title}</h3>
        <p className="mt-0.5 text-sm text-zinc-400">
          {broadcast.owner.nickname}
          {broadcast.category && <> · {CATEGORY_LABEL[broadcast.category]}</>}
          {broadcast.status === 'LIVE' && broadcast.startedAt && <> · {relativeTime(broadcast.startedAt)} 시작</>}
        </p>
      </div>
    </Link>
  )
}
