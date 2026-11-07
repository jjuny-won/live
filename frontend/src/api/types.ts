// docs/API.md 기준 타입

export interface Member {
  id: number
  email: string
  nickname: string
}

export interface LoginResponse {
  accessToken: string
  member: Member
}

export type BroadcastStatus = 'READY' | 'LIVE' | 'ENDED'

export const CATEGORIES = ['TALK', 'GAME', 'MUSIC', 'STUDY', 'ETC'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  TALK: '토크',
  GAME: '게임',
  MUSIC: '음악',
  STUDY: '공부',
  ETC: '기타',
}

export interface Broadcast {
  id: number
  title: string
  description: string | null
  category: Category | null
  thumbnailUrl: string | null
  status: BroadcastStatus
  owner: { id: number; nickname: string }
  viewerCount: number
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
  isOwner: boolean
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface BroadcastInput {
  title: string
  description?: string
  category?: Category
}

export interface StartBroadcastResponse {
  livekitUrl: string
  token: string
  roomName: string
}

export interface ViewerTokenResponse extends StartBroadcastResponse {
  canChat: boolean
}

export interface ApiErrorBody {
  code: string
  message: string
  status: number
}
