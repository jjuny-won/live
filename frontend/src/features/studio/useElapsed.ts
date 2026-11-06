import { useEffect, useState } from 'react'
import { elapsed } from '@/lib/format'

export function useElapsed(from: number | string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!from) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [from])
  if (!from) return ''
  return elapsed(typeof from === 'number' ? new Date(from).toISOString() : from, now)
}
