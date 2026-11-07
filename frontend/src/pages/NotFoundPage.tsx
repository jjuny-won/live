import { ErrorState } from '@/components/ErrorState'
import { ApiError } from '@/api/client'

export function NotFoundPage() {
  return <ErrorState error={new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.')} />
}
