import {
  LiveKitRoom,
  RoomAudioRenderer,
  useAudioPlayback,
  useConnectionState,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'
import { ConnectionState, Track } from 'livekit-client'
import type { ViewerTokenResponse } from '@/api/types'
import { MOCK_LIVEKIT_URL } from '@/config'

/** 구독 전용 토큰으로 방에 입장해 방송자의 화면(또는 카메라)과 소리를 재생 */
export function LivePlayer({ token, onDisconnected }: { token: ViewerTokenResponse; onDisconnected: () => void }) {
  if (token.livekitUrl === MOCK_LIVEKIT_URL) return <MockPlayer />
  return (
    <LiveKitRoom
      serverUrl={token.livekitUrl}
      token={token.token}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={onDisconnected}
      className="relative size-full"
    >
      <Stage />
      <RoomAudioRenderer />
      <StartAudioButton />
    </LiveKitRoom>
  )
}

function Stage() {
  const state = useConnectionState()
  // 화면 공유 우선, 없으면 카메라(모바일 방송)
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera], { onlySubscribed: true })
  const main = tracks.find((t) => t.source === Track.Source.ScreenShare) ?? tracks[0]

  if (state === ConnectionState.Connecting) return <Overlay>방송에 연결하는 중…</Overlay>
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting)
    return <Overlay>연결이 불안정합니다. 다시 연결하는 중…</Overlay>
  if (state === ConnectionState.Disconnected) return <Overlay>연결이 끊겼습니다.</Overlay>
  if (!main) return <Overlay>방송자 화면을 기다리는 중…</Overlay>

  return (
    <>
      {/* VideoTrack은 내부적으로 playsInline·muted로 붙임. 명시적으로도 지정 */}
      <VideoTrack trackRef={main} playsInline muted className="size-full bg-black object-contain" />
      {main.publication.isMuted && <Overlay dim>방송자가 잠시 자리를 비웠습니다.</Overlay>}
    </>
  )
}

/** 자동재생 정책(iOS Safari 등)으로 소리가 막힌 경우 → room.startAudio() */
function StartAudioButton() {
  const { canPlayAudio, startAudio } = useAudioPlayback()
  if (canPlayAudio) return null
  return (
    <button
      onClick={() => void startAudio()}
      className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-zinc-900 shadow-lg"
    >
      🔊 소리 켜기
    </button>
  )
}

function Overlay({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-300 ${dim ? 'bg-black/70' : 'bg-black'}`}
    >
      {children}
    </div>
  )
}

function MockPlayer() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 to-black p-6 text-center">
      <div className="text-4xl">🎬</div>
      <p className="font-semibold">목업 API 모드</p>
      <p className="max-w-sm text-sm text-zinc-400">
        실제 LiveKit 서버 없이 실행 중이라 영상은 나오지 않습니다. 백엔드와 LiveKit 키를 연결하면 여기서 실시간 방송이
        재생됩니다.
      </p>
    </div>
  )
}
