import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type {
  Broadcast,
  BroadcastInput,
  BroadcastStatus,
  Page,
  StartBroadcastResponse,
  ViewerTokenResponse,
} from './types'

export const broadcastApi = {
  list: (params: { status?: BroadcastStatus; page?: number; size?: number } = {}) =>
    apiRequest<Page<Broadcast>>('/api/broadcasts', { query: { page: 0, size: 20, ...params } }),
  mine: (params: { page?: number; size?: number } = {}) =>
    apiRequest<Page<Broadcast>>('/api/broadcasts/me', { query: { page: 0, size: 50, ...params } }),
  get: (id: number) => apiRequest<Broadcast>(`/api/broadcasts/${id}`),
  create: (input: BroadcastInput) => apiRequest<Broadcast>('/api/broadcasts', { method: 'POST', body: input }),
  update: (id: number, input: Partial<BroadcastInput>) =>
    apiRequest<Broadcast>(`/api/broadcasts/${id}`, { method: 'PATCH', body: input }),
  remove: (id: number) => apiRequest<void>(`/api/broadcasts/${id}`, { method: 'DELETE' }),
  start: (id: number) => apiRequest<StartBroadcastResponse>(`/api/broadcasts/${id}/start`, { method: 'POST' }),
  end: (id: number) => apiRequest<Broadcast>(`/api/broadcasts/${id}/end`, { method: 'POST' }),
  viewerToken: (id: number) =>
    apiRequest<ViewerTokenResponse>(`/api/broadcasts/${id}/viewer-token`, { method: 'POST' }),
}

export const broadcastKeys = {
  all: ['broadcasts'] as const,
  list: (status?: BroadcastStatus) => ['broadcasts', 'list', status ?? 'ALL'] as const,
  mine: ['broadcasts', 'mine'] as const,
  detail: (id: number) => ['broadcasts', 'detail', id] as const,
}

export function useBroadcastList(status?: BroadcastStatus) {
  return useQuery({
    queryKey: broadcastKeys.list(status),
    queryFn: () => broadcastApi.list({ status }),
    refetchInterval: 15_000, // 시청자 수·LIVE 상태 갱신
    placeholderData: keepPreviousData,
  })
}

export function useMyBroadcasts(enabled = true) {
  return useQuery({ queryKey: broadcastKeys.mine, queryFn: () => broadcastApi.mine(), enabled })
}

export function useBroadcast(id: number, opts: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: broadcastKeys.detail(id),
    queryFn: () => broadcastApi.get(id),
    enabled: Number.isFinite(id),
    refetchInterval: opts.refetchInterval,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: broadcastKeys.all })
}

export function useCreateBroadcast() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: broadcastApi.create, onSuccess: invalidate })
}

export function useUpdateBroadcast(id: number) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: Partial<BroadcastInput>) => broadcastApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteBroadcast() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: broadcastApi.remove, onSuccess: invalidate })
}
