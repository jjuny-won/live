import type { ReactNode } from 'react'

const tones = {
  info: 'bg-sky-500/10 text-sky-200 ring-sky-500/30',
  warn: 'bg-amber-500/10 text-amber-200 ring-amber-500/30',
  error: 'bg-red-500/10 text-red-200 ring-red-500/30',
}

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: keyof typeof tones
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl px-4 py-3 text-sm ring-1 sm:flex-row sm:items-center ${tones[tone]}`}>
      <div className="flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  )
}
