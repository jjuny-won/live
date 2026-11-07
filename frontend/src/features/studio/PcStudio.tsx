import {
  createLocalAudioTrack,
  createLocalScreenTracks,
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  Track,
  TrackEvent,
  type ScreenShareCaptureOptions,
} from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Broadcast } from '@/api/types'
import { Banner } from '@/components/Banner'
import { AudioMeter } from './AudioMeter'
import { browserInfo, canShareScreen, isUserCancelled, mediaErrorMessage } from './device'
import { LocalPreview } from './LocalPreview'
import { StudioHeader } from './StudioHeader'
import { useLiveSession } from './useLiveSession'

type ContentHint = 'detail' | 'motion'

/** setScreenShareEnabled(true, …)에 그대로 넘길 수 있는 화면 공유 옵션 */
export function screenShareOptions(contentHint: ContentHint): ScreenShareCaptureOptions {
  return {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    suppressLocalAudioPlayback: false,
    contentHint,
    video: { displaySurface: 'monitor' },
  }
}

const MIC_OPTIONS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

export function PcStudio({ broadcast }: { broadcast: Broadcast }) {
  const session = useLiveSession(broadcast.id, broadcast.status === 'LIVE')
  const { phase, publish, unpublish } = session
  const info = useMemo(browserInfo, [])
  const supported = canShareScreen()

  const [contentHint, setContentHint] = useState<ContentHint>('detail')
  const [screen, setScreen] = useState<{ video: LocalVideoTrack; audio?: LocalAudioTrack } | null>(null)
  const [screenStopped, setScreenStopped] = useState(false)
  const [mic, setMic] = useState<LocalAudioTrack | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'screen' | 'mic' | null>(null)

  // 최신 트랙 참조 (언마운트 정리용)
  const tracksRef = useRef<{ screen: typeof screen; mic: typeof mic }>({ screen: null, mic: null })
  tracksRef.current = { screen, mic }
  useEffect(
    () => () => {
      tracksRef.current.screen?.video.stop()
      tracksRef.current.screen?.audio?.stop()
      tracksRef.current.mic?.stop()
    },
    [],
  )

  const stopScreen = useCallback(
    async (s: NonNullable<typeof screen>) => {
      s.video.removeAllListeners(TrackEvent.Ended)
      await Promise.all([unpublish(s.video), s.audio && unpublish(s.audio)])
      s.video.stop()
      s.audio?.stop()
    },
    [unpublish],
  )

  /* ── 화면 + 소리 선택 ── */
  const selectScreen = async () => {
    setBusy('screen')
    setMediaError(null)
    try {
      const tracks = await createLocalScreenTracks(screenShareOptions(contentHint))
      const video = tracks.find((t): t is LocalVideoTrack => t.kind === Track.Kind.Video)!
      const audio = tracks.find((t): t is LocalAudioTrack => t.kind === Track.Kind.Audio)
      if (screen) await stopScreen(screen)
      const next = { video, audio }
      // 브라우저의 '공유 중지' 버튼 → 트랙 ended
      video.once(TrackEvent.Ended, () => {
        const cur = tracksRef.current.screen
        if (cur?.video !== video) return
        void stopScreen(cur)
        setScreen(null)
        setScreenStopped(true)
      })
      setScreen(next)
      setScreenStopped(false)
      await publish(video)
      if (audio) await publish(audio)
    } catch (e) {
      if (!isUserCancelled(e)) setMediaError(mediaErrorMessage(e, 'screen'))
    } finally {
      setBusy(null)
    }
  }

  // 방송 중 콘텐츠 유형 변경 → 인코더 힌트만 갱신
  useEffect(() => {
    if (screen) screen.video.mediaStreamTrack.contentHint = contentHint
  }, [contentHint, screen])

  /* ── 마이크 ── */
  const enableMic = async (deviceId?: string) => {
    setBusy('mic')
    setMediaError(null)
    try {
      if (mic) {
        await mic.restartTrack({ ...MIC_OPTIONS, deviceId })
      } else {
        const track = await createLocalAudioTrack({ ...MIC_OPTIONS, deviceId })
        setMic(track)
        setMicMuted(false)
        await publish(track)
      }
      setMicDevices(await Room.getLocalDevices('audioinput'))
    } catch (e) {
      setMediaError(mediaErrorMessage(e, 'mic'))
    } finally {
      setBusy(null)
    }
  }

  const toggleMicMute = async () => {
    if (!mic) return
    if (micMuted) await mic.unmute()
    else await mic.mute()
    setMicMuted(!micMuted)
  }

  const disableMic = async () => {
    if (!mic) return
    await unpublish(mic)
    mic.stop()
    setMic(null)
  }

  const startLive = () => {
    const tracks = [screen?.video, screen?.audio, mic].filter((t): t is NonNullable<typeof t> => !!t)
    void session.start(tracks)
  }

  if (phase === 'ended') return <EndedNotice id={broadcast.id} />

  const isLive = phase === 'live'
  const noScreenAudio = screen !== null && !screen.audio

  return (
    <div className="flex min-h-dvh flex-col">
      <StudioHeader broadcast={broadcast} session={session} mode="pc" />

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[1fr_340px]">
        {/* 미리보기 */}
        <section className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-zinc-800">
            {screen ? (
              <LocalPreview track={screen.video} />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-zinc-400">
                <div className="text-4xl">🖥️</div>
                <p>공유할 화면을 선택하면 여기에 미리보기가 나옵니다.</p>
                {supported && (
                  <button className="btn btn-primary" onClick={selectScreen} disabled={busy !== null}>
                    화면 선택
                  </button>
                )}
              </div>
            )}
            {isLive && (
              <div className="absolute top-3 left-3 rounded bg-red-600 px-2 py-0.5 text-xs font-bold">LIVE</div>
            )}
          </div>

          {!supported && (
            <Banner tone="error">
              이 브라우저는 화면 공유(<code>getDisplayMedia</code>)를 지원하지 않습니다. PC의 최신 Chrome 또는 Edge에서
              열어 주세요. 휴대폰이라면{' '}
              <Link to="?mode=mobile" className="underline">
                모바일 스튜디오(카메라)
              </Link>
              를 사용하세요.
            </Banner>
          )}
          {supported && !info.isChromium && (
            <Banner tone="warn">
              {info.isFirefox ? 'Firefox' : 'Safari'}는 화면의 <b>소리 공유</b>를 지원하지 않습니다. 소리까지 송출하려면
              Chrome 또는 Edge를 사용해 주세요.
            </Banner>
          )}
          {screenStopped && (
            <Banner
              tone="warn"
              action={
                <button className="btn btn-primary shrink-0" onClick={selectScreen}>
                  화면 다시 선택
                </button>
              }
            >
              브라우저의 <b>‘공유 중지’</b>로 화면 공유가 멈췄습니다.{' '}
              {isLive ? '시청자에게는 화면이 보이지 않습니다. 다시 선택하거나 방송을 종료하세요.' : ''}
            </Banner>
          )}
          {noScreenAudio && (
            <Banner
              tone="warn"
              action={
                <button className="btn btn-secondary shrink-0" onClick={selectScreen}>
                  다시 선택
                </button>
              }
            >
              <b>화면 소리가 공유되지 않았습니다.</b> 공유 창 아래의{' '}
              <b>{info.isMac ? '‘시스템 오디오 공유’ / ‘탭 오디오 공유’' : '‘시스템 오디오 공유’ / ‘탭 오디오도 공유’'}</b>를 켜고
              다시 선택해 주세요.
              {info.isMac &&
                (info.chromeVersion > 0 && info.chromeVersion < 141
                  ? ' macOS에서 전체 화면 소리는 Chrome 141 이상 + macOS 14.2 이상에서만 됩니다. 지금은 Chrome 탭을 공유하면 탭 소리가 나갑니다.'
                  : ' macOS 14.2 미만이면 전체 화면 소리는 공유되지 않으니 Chrome 탭을 공유해 주세요.')}
            </Banner>
          )}
          {mediaError && <Banner tone="error">{mediaError}</Banner>}
          {session.error && <Banner tone="error">{session.error}</Banner>}
          {session.isMock && isLive && (
            <Banner tone="info">
              목업 API 모드입니다. 실제 LiveKit 송출 없이 방송 상태만 LIVE로 바뀌었습니다.
            </Banner>
          )}
        </section>

        {/* 컨트롤 */}
        <aside className="flex flex-col gap-4">
          <Panel title="화면 · 소리">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">화면</span>
              <span>{screen ? screen.video.mediaStreamTrack.label || '공유 중' : '선택 안 함'}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">화면 소리</span>
                <span className={noScreenAudio ? 'text-amber-300' : ''}>
                  {!screen ? '-' : screen.audio ? '공유 중' : '없음'}
                </span>
              </div>
              {screen?.audio && <AudioMeter track={screen.audio.mediaStreamTrack} />}
            </div>
            <div className="flex gap-1 rounded-lg bg-zinc-800 p-1 text-xs">
              {(['detail', 'motion'] as const).map((h) => (
                <button
                  key={h}
                  className={`flex-1 rounded-md py-1.5 ${contentHint === h ? 'bg-zinc-600 text-white' : 'text-zinc-400'}`}
                  onClick={() => setContentHint(h)}
                >
                  {h === 'detail' ? '선명하게 (문서·코딩)' : '부드럽게 (게임·영상)'}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary w-full" onClick={selectScreen} disabled={!supported || busy !== null}>
              {busy === 'screen' ? '선택 중…' : screen ? '다른 화면 선택' : '화면 선택'}
            </button>
            <p className="text-xs leading-relaxed text-zinc-500">
              공유 창에서 <b>‘시스템 오디오 공유’</b>(탭이면 ‘탭 오디오 공유’)를 켜야 소리가 나갑니다.
            </p>
          </Panel>

          <Panel title="마이크">
            {mic ? (
              <>
                <AudioMeter track={mic.mediaStreamTrack} muted={micMuted} />
                {micDevices.length > 1 && (
                  <select
                    className="input"
                    value={mic.mediaStreamTrack.getSettings().deviceId}
                    onChange={(e) => enableMic(e.target.value)}
                  >
                    {micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || '마이크'}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <button className={`btn flex-1 ${micMuted ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleMicMute}>
                    {micMuted ? '🔇 음소거됨' : '🎙️ 음소거'}
                  </button>
                  <button className="btn btn-ghost" onClick={disableMic}>
                    끄기
                  </button>
                </div>
              </>
            ) : (
              <button className="btn btn-secondary w-full" onClick={() => enableMic()} disabled={busy !== null}>
                {busy === 'mic' ? '켜는 중…' : '🎙️ 마이크 켜기'}
              </button>
            )}
          </Panel>

          <Panel title="방송">
            {isLive || phase === 'ending' ? (
              <button className="btn btn-danger w-full py-3" onClick={() => void session.end()} disabled={phase === 'ending'}>
                {phase === 'ending' ? '종료 중…' : '방송 종료'}
              </button>
            ) : (
              <button
                className="btn btn-primary w-full py-3"
                onClick={startLive}
                disabled={!screen || phase === 'connecting'}
              >
                {phase === 'connecting' ? '연결 중…' : session.resumable ? '방송 다시 연결' : '방송 시작'}
              </button>
            )}
            {!screen && !isLive && <p className="text-xs text-zinc-500">화면을 먼저 선택해 주세요.</p>}
            <Link to={`/live/${broadcast.id}`} target="_blank" className="text-center text-xs text-zinc-400 hover:underline">
              시청 페이지 새 탭으로 열기 ↗
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
      {children}
    </div>
  )
}

export function EndedNotice({ id }: { id: number }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">👋</div>
      <h1 className="text-xl font-bold">방송을 종료했습니다</h1>
      <div className="flex gap-2">
        <Link to={`/live/${id}/ended`} className="btn btn-secondary">
          방송 요약
        </Link>
        <Link to="/me/broadcasts" className="btn btn-primary">
          내 방송 관리
        </Link>
      </div>
    </div>
  )
}
