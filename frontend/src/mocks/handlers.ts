import { delay, http, HttpResponse } from 'msw'
import { CATEGORIES, type Broadcast, type BroadcastInput, type Category } from '@/api/types'
import { API_BASE_URL, MOCK_LIVEKIT_URL } from '@/config'
import { db, nextId, now, save, type MockBroadcast, type MockMember } from './db'

const api = (path: string) => `${API_BASE_URL}${path}`

// 목업 토큰 형식: mock-access.<memberId>
const tokenFor = (m: MockMember) => `mock-access.${m.id}`

function error(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message, status }, { status })
}

/** 토큰이 있는데 잘못되었으면 공개 API여도 401 INVALID_TOKEN (docs/API.md) */
function invalidToken(request: Request) {
  const auth = request.headers.get('Authorization')
  if (auth && !currentMember(request)) return error(401, 'INVALID_TOKEN', '토큰이 만료되었거나 올바르지 않습니다.')
  return null
}

/** localStorage['live.mock.livekit'] = 'off' 이면 키 없는 서버처럼 503 */
function livekitOff() {
  try {
    return localStorage.getItem('live.mock.livekit') === 'off'
  } catch {
    return false
  }
}
const livekitNotConfigured = () =>
  error(503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit 설정이 없어 방송 토큰을 발급할 수 없습니다.')

function currentMember(request: Request): MockMember | null {
  const auth = request.headers.get('Authorization')
  const match = auth?.match(/^Bearer mock-access\.(\d+)$/)
  if (!match) return null
  return db().members.find((m) => m.id === Number(match[1])) ?? null
}

const publicMember = (m: MockMember) => ({ id: m.id, email: m.email, nickname: m.nickname })

function toDto(b: MockBroadcast, viewer: MockMember | null): Broadcast {
  const owner = db().members.find((m) => m.id === b.ownerId)
  const { ownerId, ...rest } = b
  return {
    ...rest,
    owner: { id: ownerId, nickname: owner?.nickname ?? '알 수 없음' },
    isOwner: viewer?.id === ownerId,
  }
}

function page<T>(items: T[], url: URL) {
  const p = Number(url.searchParams.get('page') ?? 0)
  const size = Number(url.searchParams.get('size') ?? 20)
  const content = items.slice(p * size, p * size + size)
  return { content, page: p, size, totalElements: items.length, hasNext: (p + 1) * size < items.length }
}

const statusOrder = { LIVE: 0, READY: 1, ENDED: 2 } as const
const sortBroadcasts = (a: MockBroadcast, b: MockBroadcast) =>
  statusOrder[a.status] - statusOrder[b.status] || b.createdAt.localeCompare(a.createdAt)

function loginResponse(m: MockMember) {
  db().refreshMemberId = m.id
  save()
  return HttpResponse.json({ accessToken: tokenFor(m), member: publicMember(m) })
}

function findOwned(request: Request, id: string | readonly string[] | undefined) {
  const bad = invalidToken(request)
  if (bad) return { err: bad }
  const me = currentMember(request)
  if (!me) return { err: error(401, 'UNAUTHORIZED', '로그인이 필요합니다.') }
  const b = db().broadcasts.find((x) => x.id === Number(id))
  if (!b) return { err: error(404, 'BROADCAST_NOT_FOUND', '방송을 찾을 수 없습니다.') }
  if (b.ownerId !== me.id) return { err: error(403, 'BROADCAST_FORBIDDEN', '방송 소유자만 할 수 있습니다.') }
  return { me, b }
}

function validateInput(body: Partial<BroadcastInput>, partial: boolean) {
  if (!partial || body.title !== undefined) {
    const t = body.title?.trim() ?? ''
    if (t.length < 1 || t.length > 100) return error(400, 'VALIDATION_ERROR', '제목은 1~100자로 입력해 주세요.')
  }
  if (body.category && !CATEGORIES.includes(body.category as Category))
    return error(400, 'VALIDATION_ERROR', '알 수 없는 카테고리입니다.')
  return null
}

export const handlers = [
  /* ── 인증 ── */
  http.post(api('/api/auth/signup'), async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as { email: string; password: string; nickname: string }
    if (!body.email?.includes('@')) return error(400, 'VALIDATION_ERROR', '이메일 형식이 올바르지 않습니다.')
    const pw = body.password ?? ''
    if (pw.length < 8 || pw.length > 64) return error(400, 'VALIDATION_ERROR', '비밀번호는 8~64자여야 합니다.')
    const nickname = body.nickname?.trim() ?? ''
    if (nickname.length < 2 || nickname.length > 20) return error(400, 'VALIDATION_ERROR', '닉네임은 2~20자여야 합니다.')
    const email = body.email.toLowerCase()
    if (db().members.some((m) => m.email === email)) return error(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일입니다.')
    if (db().members.some((m) => m.nickname === nickname))
      return error(409, 'NICKNAME_DUPLICATED', '이미 사용 중인 닉네임입니다.')
    const m: MockMember = { id: nextId('member'), email, password: pw, nickname }
    db().members.push(m)
    save()
    return HttpResponse.json(publicMember(m), { status: 201 })
  }),

  http.post(api('/api/auth/login'), async ({ request }) => {
    await delay(300)
    const { email, password } = (await request.json()) as { email: string; password: string }
    const m = db().members.find((x) => x.email === email.toLowerCase() && x.password === password)
    if (!m) return error(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
    return loginResponse(m)
  }),

  http.post(api('/api/auth/test-login'), async ({ request }) => {
    await delay(200)
    const body = (await request.json().catch(() => ({}))) as { role?: 'STREAMER' | 'VIEWER' }
    const m = db().members.find((x) => x.id === (body.role === 'VIEWER' ? 2 : 1))!
    return loginResponse(m)
  }),

  http.post(api('/api/auth/refresh'), () => {
    const m = db().members.find((x) => x.id === db().refreshMemberId)
    if (!m) return error(401, 'INVALID_REFRESH_TOKEN', '다시 로그인해 주세요.')
    return HttpResponse.json({ accessToken: tokenFor(m) })
  }),

  // 쿠키 기반: Access 토큰 없어도 됨
  http.post(api('/api/auth/logout'), () => {
    db().refreshMemberId = null
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/api/members/me'), ({ request }) => {
    const bad = invalidToken(request)
    if (bad) return bad
    const me = currentMember(request)
    return me ? HttpResponse.json(publicMember(me)) : error(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }),

  /* ── 방송 ── */
  http.get(api('/api/broadcasts/me'), async ({ request }) => {
    await delay(200)
    const me = currentMember(request)
    if (!me) return error(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    const items = db().broadcasts.filter((b) => b.ownerId === me.id).sort(sortBroadcasts)
    return HttpResponse.json(page(items.map((b) => toDto(b, me)), new URL(request.url)))
  }),

  http.get(api('/api/broadcasts'), async ({ request }) => {
    await delay(250)
    const bad = invalidToken(request)
    if (bad) return bad
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const me = currentMember(request)
    const items = db()
      .broadcasts.filter((b) => !status || b.status === status)
      .sort(sortBroadcasts)
    return HttpResponse.json(page(items.map((b) => toDto(b, me)), url))
  }),

  http.get(api('/api/broadcasts/:id'), async ({ request, params }) => {
    await delay(150)
    const bad = invalidToken(request)
    if (bad) return bad
    const b = db().broadcasts.find((x) => x.id === Number(params.id))
    if (!b) return error(404, 'BROADCAST_NOT_FOUND', '방송을 찾을 수 없습니다.')
    return HttpResponse.json(toDto(b, currentMember(request)))
  }),

  http.post(api('/api/broadcasts'), async ({ request }) => {
    await delay(300)
    const me = currentMember(request)
    if (!me) return error(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    const body = (await request.json()) as BroadcastInput
    const invalid = validateInput(body, false)
    if (invalid) return invalid
    const b: MockBroadcast = {
      id: nextId('broadcast'),
      ownerId: me.id,
      title: body.title.trim(),
      description: body.description ?? null,
      category: body.category ?? 'ETC',
      thumbnailUrl: null,
      status: 'READY',
      viewerCount: 0,
      startedAt: null,
      endedAt: null,
      createdAt: now(),
      updatedAt: now(),
    }
    db().broadcasts.push(b)
    save()
    return HttpResponse.json(toDto(b, me), { status: 201 })
  }),

  http.patch(api('/api/broadcasts/:id'), async ({ request, params }) => {
    await delay(300)
    const r = findOwned(request, params.id)
    if (r.err) return r.err
    const body = (await request.json()) as Partial<BroadcastInput>
    const invalid = validateInput(body, true)
    if (invalid) return invalid
    if (body.title !== undefined) r.b.title = body.title.trim()
    if (body.description !== undefined) r.b.description = body.description
    if (body.category !== undefined) r.b.category = body.category
    r.b.updatedAt = now()
    save()
    return HttpResponse.json(toDto(r.b, r.me))
  }),

  http.delete(api('/api/broadcasts/:id'), async ({ request, params }) => {
    await delay(300)
    const r = findOwned(request, params.id)
    if (r.err) return r.err
    db().broadcasts = db().broadcasts.filter((x) => x.id !== r.b.id)
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api('/api/broadcasts/:id/start'), async ({ request, params }) => {
    await delay(400)
    const r = findOwned(request, params.id)
    if (r.err) return r.err
    if (livekitOff()) return livekitNotConfigured()
    // LIVE 중 재호출은 토큰만 재발급, ENDED는 다시 시작
    if (r.b.status !== 'LIVE') {
      r.b.status = 'LIVE'
      r.b.startedAt = now()
      r.b.endedAt = null
    }
    r.b.updatedAt = now()
    save()
    return HttpResponse.json({ livekitUrl: MOCK_LIVEKIT_URL, token: 'mock-publish-token', roomName: `broadcast-${r.b.id}` })
  }),

  http.post(api('/api/broadcasts/:id/end'), async ({ request, params }) => {
    await delay(300)
    const r = findOwned(request, params.id)
    if (r.err) return r.err
    r.b.status = 'ENDED'
    r.b.endedAt = now()
    r.b.viewerCount = 0
    r.b.updatedAt = now()
    save()
    return HttpResponse.json(toDto(r.b, r.me))
  }),

  http.post(api('/api/broadcasts/:id/viewer-token'), async ({ request, params }) => {
    await delay(200)
    const bad = invalidToken(request)
    if (bad) return bad
    const b = db().broadcasts.find((x) => x.id === Number(params.id))
    if (!b) return error(404, 'BROADCAST_NOT_FOUND', '방송을 찾을 수 없습니다.')
    if (livekitOff()) return livekitNotConfigured()
    if (b.status !== 'LIVE') return error(409, 'BROADCAST_NOT_LIVE', '방송 중이 아닙니다.')
    return HttpResponse.json({
      livekitUrl: MOCK_LIVEKIT_URL,
      token: 'mock-viewer-token',
      roomName: `broadcast-${b.id}`,
      canChat: currentMember(request) !== null,
    })
  }),
]
