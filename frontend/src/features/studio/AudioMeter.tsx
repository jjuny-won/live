import { useEffect, useRef } from 'react'

/** 오디오 트랙 입력 레벨 막대 (마이크·화면 소리가 실제로 들어오는지 확인용) */
export function AudioMeter({ track, muted = false }: { track: MediaStreamTrack | undefined; muted?: boolean }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!track || muted) {
      if (barRef.current) barRef.current.style.width = '0%'
      return
    }
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    void ctx.resume().catch(() => {})
    const data = new Uint8Array(analyser.fftSize)
    let raf = 0
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(sum / data.length)
      if (barRef.current) barRef.current.style.width = `${Math.min(100, rms * 300)}%`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      void ctx.close()
    }
  }, [track, muted])

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div ref={barRef} className="h-full w-0 rounded-full bg-brand-500 transition-[width] duration-75" />
    </div>
  )
}
