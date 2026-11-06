import { useParams, useSearchParams } from 'react-router-dom'
import { useBroadcast } from '@/api/broadcasts'
import { ApiError } from '@/api/client'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { detectStudioMode, type StudioMode } from '@/features/studio/device'
import { EndedNotice, PcStudio } from '@/features/studio/PcStudio'
import { MobileStudio } from '@/features/studio/MobileStudio'

export function StudioPage() {
  const id = Number(useParams().id)
  const [params] = useSearchParams()
  const q = useBroadcast(id)
  const override = params.get('mode')
  const mode: StudioMode = override === 'pc' || override === 'mobile' ? override : detectStudioMode()

  if (q.isPending) return <Spinner className="min-h-dvh" label="방송 정보를 불러오는 중" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  // 소유자만 송출 가능 (서버의 /start도 403)
  if (!q.data.isOwner) return <ErrorState error={new ApiError(403, 'BROADCAST_FORBIDDEN', '')} />
  if (q.data.status === 'ENDED') return <EndedNotice id={id} />

  // key: 모드 전환 시 트랙·세션을 깨끗이 다시 만듦
  return mode === 'pc' ? <PcStudio key="pc" broadcast={q.data} /> : <MobileStudio key="mobile" broadcast={q.data} />
}
