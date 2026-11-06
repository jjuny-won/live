# API 계약 (v0 초안)

BE·FE 공통 기준. 바꿀 때는 이 파일을 같이 수정한다.

## 공통
- Base URL: 로컬 `http://localhost:8080`, 배포 `https://api.<도메인>` (FE는 `VITE_API_BASE_URL`)
- 인증: `Authorization: Bearer <accessToken>` (Access 30분). Refresh 토큰은 HttpOnly 쿠키 `refresh_token` (14일, `Path=/api/auth`)
- 응답 본문은 데이터 그대로(래퍼 없음). 시간은 ISO-8601(UTC, `2026-11-10T12:00:00Z`)
- 에러 형식
  ```json
  { "code": "BROADCAST_FORBIDDEN", "message": "방송 소유자만 수정할 수 있습니다.", "status": 403 }
  ```
- 페이지: `?page=0&size=20` → `{ "content": [...], "page": 0, "size": 20, "totalElements": 3, "hasNext": false }`

## 인증
| Method | URL | 권한 | 요청 | 응답 |
|---|---|---|---|---|
| POST | /api/auth/signup | 공개 | `{email, password, nickname}` | 201 `{id, email, nickname}` |
| POST | /api/auth/login | 공개 | `{email, password}` | `{accessToken, member:{id,email,nickname}}` + refresh 쿠키 |
| POST | /api/auth/test-login | 공개 | `{role: "STREAMER" \| "VIEWER"}` (생략 시 STREAMER) | login과 동일 |
| POST | /api/auth/refresh | 쿠키 | - | `{accessToken}` |
| POST | /api/auth/logout | 로그인 | - | 204, 쿠키 삭제 |
| GET | /api/members/me | 로그인 | - | `{id, email, nickname}` |

## 방송
`Broadcast` 응답
```json
{
  "id": 1, "title": "코딩 방송", "description": "…", "category": "TALK",
  "thumbnailUrl": null, "status": "READY | LIVE | ENDED",
  "owner": { "id": 1, "nickname": "streamer" },
  "viewerCount": 0, "startedAt": null, "endedAt": null,
  "createdAt": "…", "updatedAt": "…", "isOwner": true
}
```
| Method | URL | 권한 | 요청 | 응답 |
|---|---|---|---|---|
| GET | /api/broadcasts?status=LIVE&page&size | 공개 | - | Page<Broadcast> (LIVE 우선, 최신순) |
| GET | /api/broadcasts/me | 로그인 | - | Page<Broadcast> (내 방송) |
| GET | /api/broadcasts/{id} | 공개 | - | Broadcast |
| POST | /api/broadcasts | 로그인 | `{title, description?, category?}` | 201 Broadcast |
| PATCH | /api/broadcasts/{id} | 소유자 | `{title?, description?, category?}` | Broadcast |
| DELETE | /api/broadcasts/{id} | 소유자 | - | 204 (LIVE면 방 종료 후 삭제) |
| POST | /api/broadcasts/{id}/start | 소유자 | - | `{livekitUrl, token, roomName}` (publish 가능 토큰), 상태 LIVE |
| POST | /api/broadcasts/{id}/end | 소유자 | - | Broadcast (ENDED) |
| POST | /api/broadcasts/{id}/viewer-token | 공개(로그인 시 채팅 가능) | - | `{livekitUrl, token, roomName, canChat}` |

- 카테고리: `TALK, GAME, MUSIC, STUDY, ETC`
- 방 이름: `broadcast-{id}`
- 송출 토큰: `canPublish=true, canSubscribe=true, canPublishData=true`, identity `member-{id}`
- 시청 토큰: `canPublish=false, canSubscribe=true, canPublishData=로그인 여부`, identity `member-{id}` 또는 `guest-{uuid}`, name은 닉네임 또는 `손님-xxxx`

## LiveKit 웹훅
| POST | /api/livekit/webhook | LiveKit 서명 검증 | `room_started/room_finished` → 상태, `participant_joined/left` → viewerCount, `egress_ended` → 녹화 |

## 선택 기능 (확정 전 초안)
- 채팅: LiveKit Data 메시지, topic `chat`, payload `{type:"chat", text, nickname, sentAt}`
- 후원: `POST /api/broadcasts/{id}/donations {amount, message}` → 데이터 메시지 topic `donation`으로 방송에 알림, `GET /api/points/me`, `POST /api/points/charge {amount}`(가상 포인트)
- 다시보기: `GET /api/broadcasts/{id}/recordings` → `[{id, fileUrl, durationSec, createdAt}]`
