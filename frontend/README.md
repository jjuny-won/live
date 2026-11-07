# frontend

React 19 + Vite 7 + TypeScript · React Router 7 · TanStack Query 5 · Tailwind 4 · `livekit-client` / `@livekit/components-react`

## 실행
```bash
nvm use            # .nvmrc = 20 (Vite 7은 Node 20.19+)
npm install
cp .env.example .env.local
npm run dev        # 실제 백엔드(VITE_API_BASE_URL, 기본 http://localhost:8080). 백엔드 실행은 ../backend/README.md
npm run dev:mock   # 백엔드 없이 MSW 목업 API (테스트 계정 streamer@demo.test / demo1234!)
npm run build      # 타입 체크 + 빌드
```

## 구조
| 경로 | 내용 |
|---|---|
| `src/api/client.ts` | fetch 래퍼. Access 토큰은 메모리+sessionStorage, 401 → `/api/auth/refresh`(쿠키) 후 1회 재시도. refresh도 실패하면 토큰을 버리고 비로그인으로 다시 요청(만료 토큰은 공개 API도 401 `INVALID_TOKEN`) |
| `src/api/*.ts` | `docs/API.md` 그대로의 함수·Query 훅 |
| `src/mocks/` | MSW 핸들러(localStorage에 데이터 유지). `window.fetch`를 감싸는 방식이라 Service Worker 불필요 |
| `src/features/studio/PcStudio.tsx` | 화면+화면 소리(`ScreenShareAudio`)+마이크 송출 |
| `src/features/studio/MobileStudio.tsx` | 카메라(전/후면)+마이크 세로 송출 |
| `src/features/studio/useLiveSession.ts` | `/start` 토큰으로 LiveKit 접속·publish, `/end` |
| `src/features/watch/LivePlayer.tsx` | 구독 전용 시청, [소리 켜기] |

## 스튜디오 동작
- `/studio/:id`가 `getDisplayMedia` 지원 + 마우스 기기면 PC, 아니면 모바일 스튜디오. `?mode=pc|mobile`로 강제 가능.
- 미리보기 트랙은 `setScreenShareEnabled`와 같은 옵션(`audio`, `systemAudio: 'include'`, `contentHint` 등)으로 먼저 만들고,
  [방송 시작] 시 `/start` → `room.connect` → `publishTrack`. (LiveKit은 접속 전 publish를 15초 후 타임아웃시키므로 미리보기 단계에서는 방에 접속하지 않음)
- 목업 API는 `livekitUrl: mock://livekit`을 돌려주며, 이때는 LiveKit 접속 없이 상태만 LIVE로 바뀜.
- 백엔드에 LiveKit 키가 없으면 `/start`·`/viewer-token`이 503 `LIVEKIT_NOT_CONFIGURED` → 스튜디오·시청 화면에 설정 안내를 띄움.
  목업에서 재현: 개발자 도구에서 `localStorage.setItem('live.mock.livekit', 'off')`
- 휴대폰 테스트는 HTTPS 필요: `cloudflared tunnel --url http://localhost:5173`
