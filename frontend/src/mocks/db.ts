// 목업 데이터. localStorage에 저장해 새로고침해도 유지한다.
import type { Broadcast, Category, Member } from '@/api/types'

export interface MockMember extends Member {
  password: string
}

export interface MockBroadcast extends Omit<Broadcast, 'isOwner' | 'owner'> {
  ownerId: number
}

interface MockState {
  members: MockMember[]
  broadcasts: MockBroadcast[]
  /** 서버의 refresh 쿠키 대신: 로그인된 회원 id */
  refreshMemberId: number | null
  seq: { member: number; broadcast: number }
}

const KEY = 'live.mock.db.v1'

const now = () => new Date().toISOString()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function seed(): MockState {
  const members: MockMember[] = [
    { id: 1, email: 'streamer@demo.test', password: 'demo1234!', nickname: '데모방송자' },
    { id: 2, email: 'viewer@demo.test', password: 'demo1234!', nickname: '데모시청자' },
    { id: 3, email: 'coder@demo.test', password: 'demo1234!', nickname: '코딩하는곰' },
  ]
  const b = (
    id: number,
    ownerId: number,
    title: string,
    category: Category,
    status: Broadcast['status'],
    viewerCount: number,
    startedMin: number | null,
  ): MockBroadcast => ({
    id,
    ownerId,
    title,
    description: `${title} — 목업 방송입니다.`,
    category,
    thumbnailUrl: null,
    status,
    viewerCount,
    startedAt: startedMin === null ? null : minutesAgo(startedMin),
    endedAt: status === 'ENDED' ? minutesAgo(5) : null,
    createdAt: minutesAgo(120),
    updatedAt: minutesAgo(10),
  })
  return {
    members,
    broadcasts: [
      b(1, 3, 'React 19로 방송 플랫폼 만들기', 'STUDY', 'LIVE', 42, 35),
      b(2, 1, '저녁 수다 방송', 'TALK', 'LIVE', 7, 12),
      b(3, 3, '인디 게임 첫 플레이', 'GAME', 'READY', 0, null),
      b(4, 1, '어쿠스틱 기타 연습', 'MUSIC', 'ENDED', 0, 80),
      b(5, 1, '내일 준비 중인 방송', 'ETC', 'READY', 0, null),
    ],
    refreshMemberId: null,
    seq: { member: 3, broadcast: 5 },
  }
}

let state: MockState = load()

function load(): MockState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockState
  } catch {
    /* 무시 */
  }
  return seed()
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 무시 */
  }
}

export function db() {
  return state
}

export function resetDb() {
  state = seed()
  save()
}

export function nextId(kind: 'member' | 'broadcast') {
  state.seq[kind] += 1
  save()
  return state.seq[kind]
}

export { now }
