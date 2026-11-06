import { createLocalTracks, LocalAudioTrack, LocalVideoTrack, Track, VideoPresets } from 'livekit-client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Broadcast } from '@/api/types'
import { browserInfo, canUseCamera, mediaErrorMessage } from './device'
import { LocalPreview } from './LocalPreview'
import { EndedNotice } from './PcStudio'
import { StudioHeader } from './StudioHeader'
import { useLiveSession } from './useLiveSession'

type Facing = 'user' | 'environment'

const MIC_OPTIONS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

function videoOptions(facingMode: Facing) {
  // 세로 방송: 720x1280 근처를 요청(기기가 알아서 맞춤)
  return { facingMode, resolution: { ...VideoPresets.h720.resolution, width: 720, height: 1280 } }
}

export function MobileStudio({ broadcast }: { broadcast: Broadcast }) {
  const session = useLiveSession(broadcast.id, broadcast.status === 'LIVE')
  const { phase } = session
  const info = useMemo(browserInfo, [])

  const [video, setVideo] = useState<LocalVideoTrack | null>(null)
  const [audio, setAudio] = useState<LocalAudioTrack | null>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [micMuted, setMicMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)

  const ref = useRef({ video, audio, facing, phase })
  ref.current = { video, audio, facing, phase }

  useEffect(
    () => () => {
      ref.current.video?.stop()
      ref.current.audio?.stop()
    },
    [],
  )

  const enableCamera = async () => {
    setBusy(true)
    setError(null)
    try {
      const tracks = await createLocalTracks({ audio: MIC_OPTIONS, video: videoOptions(facing) })
      setVideo((tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack) ?? null)
      setAudio((tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack) ?? null)
    } catch (e) {
      setError(mediaErrorMessage(e, 'camera+mic'))
    } finally {
      setBusy(false)
    }
  }

  const flipCamera = async () => {
    if (!video) return
    const next: Facing = facing === 'user' ? 'environment' : 'user'
    setBusy(true)
    try {
      // 같은 트랙을 재시작하므로 방송 중에도 재publish 없이 전환됨
      await video.restartTrack(videoOptions(next))
      setFacing(next)
    } catch (e) {
      setError(mediaErrorMessage(e, 'camera'))
    } finally {
      setBusy(false)
    }
  }

  const toggleMic = async () => {
    if (!audio) return
    if (micMuted) await audio.unmute()
    else await audio.mute()
    setMicMuted(!micMuted)
  }

  // 화면 잠금·앱 전환: iOS/Android는 카메라가 멈추므로 시청자에게 '일시정지'로 보이게 하고, 돌아오면 재시작
  useEffect(() => {
    const onVisibility = async () => {
      const { video: v, audio: a, facing: f, phase: p } = ref.current
      if (document.visibilityState === 'hidden') {
        if (p === 'live') {
          setPaused(true)
          await v?.mute()
        }
        return
      }
      try {
        if (v && v.mediaStreamTrack.readyState === 'ended') await v.restartTrack(videoOptions(f))
        if (a && a.mediaStreamTrack.readyState === 'ended') await a.restartTrack(MIC_OPTIONS)
        if (v?.isMuted) await v.unmute()
      } catch (e) {
        setError(mediaErrorMessage(e, 'camera'))
      }
      setPaused(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 방송 중 화면 꺼짐 방지
  useEffect(() => {
    if (phase !== 'live' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* 배터리 절약 모드 등 */
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [phase])

  if (phase === 'ended') return <EndedNotice id={broadcast.id} />

  const isLive = phase === 'live'
  const supported = canUseCamera()

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="bg-zinc-950/80">
        <StudioHeader broadcast={broadcast} session={session} mode="mobile" />
      </div>

      {/* 세로 미리보기 */}
      <div className="relative min-h-0 flex-1">
        {video ? (
          <LocalPreview track={video} mirror={facing === 'user'} fit="cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="text-5xl">📱</div>
            <p className="text-zinc-300">카메라와 마이크로 방송합니다.</p>
            {info.isInAppBrowser && (
              <p className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-200">
                앱 안의 브라우저(카카오톡 등)에서는 카메라 권한이 막힐 수 있습니다. 오른쪽 위 메뉴에서{' '}
                <b>{info.isIOS ? 'Safari로 열기' : 'Chrome으로 열기'}</b>를 눌러 주세요.
              </p>
            )}
            {supported ? (
              <button className="btn btn-primary px-6 py-3" onClick={enableCamera} disabled={busy}>
                {busy ? '권한 요청 중…' : '카메라·마이크 켜기'}
              </button>
            ) : (
              <p className="text-sm text-red-300">
                이 브라우저에서는 카메라를 사용할 수 없습니다. HTTPS 주소인지, iOS Safari / Android Chrome인지 확인해 주세요.
              </p>
            )}
          </div>
        )}

        {paused && isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-sm">
            방송 일시정지 중 — 화면으로 돌아오면 이어서 송출합니다.
          </div>
        )}

        <div className="absolute inset-x-3 top-3 space-y-2">
          {error && (
            <div className="rounded-lg bg-red-600/90 p-3 text-sm leading-relaxed">
              {error}
              <button className="ml-2 underline" onClick={() => setError(null)}>
                닫기
              </button>
            </div>
          )}
          {session.error && <div className="rounded-lg bg-red-600/90 p-3 text-sm">{session.error}</div>}
          {session.isMock && isLive && (
            <div className="rounded-lg bg-sky-600/80 p-2 text-xs">목업 API 모드: 실제 송출 없이 상태만 LIVE입니다.</div>
          )}
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="flex items-center justify-around gap-3 bg-zinc-950/90 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <RoundButton label={micMuted ? '마이크 켜기' : '음소거'} onClick={toggleMic} disabled={!audio} active={micMuted}>
          {micMuted ? '🔇' : '🎙️'}
        </RoundButton>

        {isLive || phase === 'ending' ? (
          <button
            className="btn btn-danger h-14 flex-1 rounded-full text-base"
            onClick={() => void session.end()}
            disabled={phase === 'ending'}
          >
            {phase === 'ending' ? '종료 중…' : '방송 종료'}
          </button>
        ) : (
          <button
            className="btn btn-primary h-14 flex-1 rounded-full text-base"
            disabled={!video || phase === 'connecting'}
            onClick={() => void session.start([video, audio].filter((t): t is NonNullable<typeof t> => !!t))}
          >
            {phase === 'connecting' ? '연결 중…' : session.resumable ? '방송 다시 연결' : '방송 시작'}
          </button>
        )}

        <RoundButton label="카메라 전환" onClick={flipCamera} disabled={!video || busy}>
          🔄
        </RoundButton>
      </div>
    </div>
  )
}

function RoundButton({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-14 shrink-0 items-center justify-center rounded-full text-2xl transition disabled:opacity-40 ${active ? 'bg-red-600' : 'bg-zinc-800'}`}
    >
      {children}
    </button>
  )
}
