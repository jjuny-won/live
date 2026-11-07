import { useQueryClient } from '@tanstack/react-query'
import {
  AudioPresets,
  DisconnectReason,
  LocalAudioTrack,
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  type LocalTrack,
  type TrackPublishOptions,
} from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { broadcastApi, broadcastKeys } from '@/api/broadcasts'
import { errorMessage } from '@/api/client'
import { MOCK_LIVEKIT_URL } from '@/config'

export type LivePhase = 'preview' | 'connecting' | 'live' | 'ending' | 'ended'

/** 트랙 종류별 publish 옵션 */
export function publishOptionsFor(track: LocalTrack): TrackPublishOptions {
  switch (track.source) {
    case Track.Source.ScreenShare:
      return {
        source: Track.Source.ScreenShare,
        screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
        simulcast: true,
      }
    case Track.Source.ScreenShareAudio:
      // 게임·음악 소리는 음질 우선, 무음 구간 압축(DTX) 끔
      return { source: Track.Source.ScreenShareAudio, audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: false }
    case Track.Source.Microphone:
      return { source: Track.Source.Microphone, audioPreset: AudioPresets.speech }
    default:
      return { source: track.source, simulcast: true }
  }
}

/**
 * 방송 세션: /start로 publish 토큰을 받아 LiveKit 방에 접속하고 미리보기 트랙을 publish한다.
 * 목업 API(livekitUrl === mock://livekit)면 실제 접속 없이 상태만 LIVE로 바꾼다.
 */
export function useLiveSession(broadcastId: number, initialLive: boolean) {
  const qc = useQueryClient()
  const roomRef = useRef<Room | null>(null)
  const phaseRef = useRef<LivePhase>('preview')
  const [phase, setPhaseState] = useState<LivePhase>('preview')
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [viewers, setViewers] = useState<number | null>(null)

  const setPhase = (p: LivePhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: broadcastKeys.all }), [qc])

  const start = useCallback(
    async (tracks: LocalTrack[]) => {
      setError(null)
      setPhase('connecting')
      try {
        const res = await broadcastApi.start(broadcastId)
        if (res.livekitUrl === MOCK_LIVEKIT_URL) {
          setIsMock(true)
        } else {
          const room = new Room({ dynacast: true, adaptiveStream: false, disconnectOnPageLeave: true })
          room
            .on(RoomEvent.Disconnected, (reason) => {
              roomRef.current = null
              setViewers(null)
              if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return
              setPhase('preview')
              setError(
                reason === DisconnectReason.DUPLICATE_IDENTITY
                  ? '다른 창(기기)에서 같은 방송을 시작해 이 창의 송출이 끊겼습니다.'
                  : reason === DisconnectReason.ROOM_DELETED
                    ? '방송 방이 서버에서 종료되었습니다.'
                    : 'LiveKit 연결이 끊겼습니다. [방송 시작]을 다시 눌러 재접속해 주세요.',
              )
            })
            .on(RoomEvent.ParticipantConnected, () => setViewers(room.remoteParticipants.size))
            .on(RoomEvent.ParticipantDisconnected, () => setViewers(room.remoteParticipants.size))
          roomRef.current = room
          await room.connect(res.livekitUrl, res.token)
          setViewers(room.remoteParticipants.size)
          for (const t of tracks) await room.localParticipant.publishTrack(t, publishOptionsFor(t))
        }
        setStartedAt((s) => s ?? Date.now())
        setPhase('live')
        invalidate()
      } catch (e) {
        await roomRef.current?.disconnect(false)
        roomRef.current = null
        setPhase('preview')
        setError(`방송을 시작하지 못했습니다: ${errorMessage(e)}`)
      }
    },
    [broadcastId, invalidate],
  )

  /** 방송 중에 새로 켠 트랙(마이크, 다시 고른 화면)을 publish */
  const publish = useCallback(async (track: LocalTrack) => {
    const room = roomRef.current
    if (!room || phaseRef.current !== 'live') return
    await room.localParticipant.publishTrack(track, publishOptionsFor(track))
  }, [])

  const unpublish = useCallback(async (track: LocalTrack) => {
    const room = roomRef.current
    if (!room) return
    // 미리보기 트랙은 호출한 쪽에서 정리하므로 여기서는 stop하지 않음
    await room.localParticipant.unpublishTrack(track, false)
  }, [])

  const end = useCallback(async () => {
    setPhase('ending')
    setError(null)
    try {
      await roomRef.current?.disconnect(true)
      roomRef.current = null
      await broadcastApi.end(broadcastId)
      setPhase('ended')
      invalidate()
    } catch (e) {
      setPhase('live')
      setError(`방송 종료 요청이 실패했습니다: ${errorMessage(e)}`)
    }
  }, [broadcastId, invalidate])

  // 방송 중 창 닫기 경고
  useEffect(() => {
    if (phase !== 'live') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  // 페이지를 떠나면 연결만 끊음(방송 종료 처리는 서버 웹훅/다음 진입에서)
  useEffect(
    () => () => {
      roomRef.current?.disconnect(false)
      roomRef.current = null
    },
    [],
  )

  return {
    phase,
    error,
    setError,
    isMock,
    startedAt,
    viewers,
    /** 새로고침 등으로 다시 들어온 경우 서버 상태는 LIVE지만 송출은 끊긴 상태 */
    resumable: initialLive && phase === 'preview',
    start,
    end,
    publish,
    unpublish,
  }
}

export function isAudioTrack(t: LocalTrack | undefined): t is LocalAudioTrack {
  return t instanceof LocalAudioTrack
}
