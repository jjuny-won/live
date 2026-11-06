import type { LocalVideoTrack } from 'livekit-client'
import { useEffect, useRef } from 'react'

/** 로컬 비디오 트랙 미리보기. iOS용 playsInline·muted 필수 */
export function LocalPreview({
  track,
  mirror = false,
  fit = 'contain',
  className = '',
}: {
  track: LocalVideoTrack | undefined
  mirror?: boolean
  fit?: 'contain' | 'cover'
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      className={`size-full bg-black ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${mirror ? '-scale-x-100' : ''} ${className}`}
    />
  )
}
