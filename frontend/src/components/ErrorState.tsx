import { Link } from 'react-router-dom'
import { errorMessage, isApiError } from '@/api/client'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const forbidden = isApiError(error, 403)
  const notFound = isApiError(error, 404)
  const title = forbidden ? '권한이 없습니다' : notFound ? '찾을 수 없습니다' : '문제가 발생했습니다'
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <div className="text-4xl">{forbidden ? '🔒' : notFound ? '🔍' : '⚠️'}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-zinc-400">
        {forbidden ? '이 방송의 소유자만 접근할 수 있습니다.' : errorMessage(error)}
      </p>
      <div className="mt-2 flex gap-2">
        {onRetry && !forbidden && !notFound && (
          <button className="btn btn-secondary" onClick={onRetry}>
            다시 시도
          </button>
        )}
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    </div>
  )
}
