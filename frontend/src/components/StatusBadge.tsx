import type { BroadcastStatus } from '@/api/types'

export function StatusBadge({ status }: { status: BroadcastStatus }) {
  if (status === 'LIVE')
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
    )
  return (
    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200">
      {status === 'READY' ? '준비 중' : '종료'}
    </span>
  )
}

export function ViewerCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-300">
      <svg viewBox="0 0 20 20" className="size-3.5 fill-current" aria-hidden>
        <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
      </svg>
      {count.toLocaleString('ko-KR')}명
    </span>
  )
}
