# Backend (Spring Boot)

인증·방송 관리·LiveKit 토큰 발급·웹훅 처리 API. 미디어(WebRTC)는 LiveKit 이 담당한다.
API 계약은 [`docs/API.md`](../docs/API.md).

- Java 21(Gradle toolchain — 로컬 JDK 가 25여도 21 을 자동 사용), Spring Boot 3.5, PostgreSQL 17, Flyway
- 패키지: `auth`(JWT·Refresh 쿠키·테스트 로그인) · `member` · `broadcast`(CRUD·소유자 권한) · `live`(LiveKit 토큰·웹훅) · `common`

## 실행
```bash
cp .env.example .env          # 저장소 루트에서. LiveKit 키는 비워 둬도 실행됨
docker compose up -d          # PostgreSQL (localhost:5432)
cd backend && ./gradlew bootRun
```
- Swagger: http://localhost:8080/swagger-ui/index.html
- 헬스체크: http://localhost:8080/actuator/health
- 루트 `.env` 는 `bootRun` 이 직접 읽는다(`spring.config.import`). 환경변수로 줘도 된다.

## 테스트 계정
기동 시 자동 생성(`DEMO_ENABLED=false` 로 끔). 비밀번호는 `DEMO_PASSWORD`(기본 `demo1234!`).

| 역할 | 이메일 | 테스트 로그인 |
|---|---|---|
| 방송자 | streamer@demo.test | `POST /api/auth/test-login` `{"role":"STREAMER"}` |
| 시청자 | viewer@demo.test | `POST /api/auth/test-login` `{"role":"VIEWER"}` |

## Swagger로 권한 확인 (3분)
1. `POST /api/auth/test-login` `{"role":"STREAMER"}` → `accessToken` 복사 → [Authorize]에 붙여넣기
2. `POST /api/broadcasts` `{"title":"테스트"}` → 응답의 `id` 기억
3. [Authorize] → Logout → `test-login` `{"role":"VIEWER"}` 토큰으로 다시 Authorize
4. `PATCH /api/broadcasts/{id}` → **403 `BROADCAST_FORBIDDEN`**

## LiveKit
`.env` 에 `LIVEKIT_URL`(wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` 를 넣는다.
비어 있으면 `/start`, `/viewer-token`, 웹훅만 `503 LIVEKIT_NOT_CONFIGURED` 이고 나머지는 동작한다.

웹훅: LiveKit Cloud 대시보드 → Settings → Webhooks 에 `https://<API 주소>/api/livekit/webhook` 등록.
로컬은 `cloudflared tunnel --url http://localhost:8080` 으로 받은 HTTPS 주소를 쓴다.

## 테스트
```bash
./gradlew test   # Docker 필요(Testcontainers PostgreSQL)
```
| 테스트 | 확인 내용 |
|---|---|
| `AuthIntegrationTest` | 회원가입→로그인(HttpOnly 쿠키)→me→refresh→로그아웃→refresh 거부, 중복·오류 코드, 테스트 로그인 |
| `BroadcastAuthorizationTest` | 소유자 CRUD·시작·종료, **타인 수정/삭제/시작/종료 403**, 비로그인 401, 목록 LIVE 우선 |
| `LiveTokenIntegrationTest` | 송출 토큰 `canPublish=true`, **시청 토큰 `canPublish=false`**, 게스트 `canPublishData=false` |
| `LiveKitWebhookIntegrationTest` | 서명 검증(위조·변조 401), 시청자 수(방송자 제외), room_started/finished 상태 |
| `LiveKitNotConfiguredTest` | 키 없을 때 토큰 API만 503 |

## 환경변수
루트 [`.env.example`](../.env.example) 참고. 배포 시 꼭 바꿀 것: `JWT_SECRET`(32바이트 이상),
`COOKIE_SECURE=true`·`COOKIE_SAME_SITE=None`(프론트와 API 도메인이 다를 때), `CORS_ALLOWED_ORIGINS`, `DB_PASSWORD`, `DEMO_PASSWORD`.
