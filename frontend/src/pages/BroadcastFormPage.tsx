import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBroadcast, useCreateBroadcast, useUpdateBroadcast } from '@/api/broadcasts'
import { ApiError, errorMessage } from '@/api/client'
import { CATEGORIES, CATEGORY_LABEL, type Broadcast, type Category } from '@/api/types'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'

export function BroadcastFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  if (mode === 'create') return <BroadcastForm />
  return <EditLoader id={Number(id)} />
}

function EditLoader({ id }: { id: number }) {
  const q = useBroadcast(id)
  if (q.isPending) return <Spinner className="py-24" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  // 소유자가 아니면 화면 단에서도 403 처리 (서버도 403을 돌려줌)
  if (!q.data.isOwner) return <ErrorState error={new ApiError(403, 'BROADCAST_FORBIDDEN', '')} />
  return <BroadcastForm initial={q.data} />
}

function BroadcastForm({ initial }: { initial?: Broadcast }) {
  const navigate = useNavigate()
  const create = useCreateBroadcast()
  const update = useUpdateBroadcast(initial?.id ?? NaN)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState<Category>(initial?.category ?? 'TALK')
  const [error, setError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return setError('제목을 입력해 주세요.')
    setError(null)
    const input = { title: t, description: description.trim(), category }
    try {
      if (initial) {
        await update.mutateAsync(input)
        navigate('/me/broadcasts')
      } else {
        const created = await create.mutateAsync(input)
        navigate(`/studio/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-xl font-bold">{initial ? '방송 정보 수정' : '새 방송 만들기'}</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">제목</span>
          <input className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 저녁 코딩 방송" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">카테고리</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`btn px-3 py-1.5 ${category === c ? 'btn-primary' : 'btn-secondary'}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">설명 (선택)</span>
          <textarea className="input min-h-28" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            취소
          </button>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? '저장 중…' : initial ? '저장' : '만들고 스튜디오로'}
          </button>
        </div>
      </form>
    </div>
  )
}
