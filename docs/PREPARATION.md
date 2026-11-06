# 실시간 라이브 방송 플랫폼 공모전 준비 문서

> 이 문서는 **새 공개 저장소**에 옮겨 쓸 준비 문서 초안입니다. JustCommit 팀 프로젝트와는 별개입니다.
> 작성일: 2026-11-06(금) · 제출 마감: **2026-11-19(목) 23:59** · 남은 기간: 13일

---

## 0. 한눈에 보는 결론

| 항목 | 추천안 | 이유 |
|---|---|---|
| 미디어 전송 | **WebRTC SFU — LiveKit** (1순위 LiveKit Cloud 무료 플랜, 2순위 자체 호스팅) | 1초 미만 지연, 브라우저 SDK 완성도, TURN 내장, 녹화(Egress) 기능 포함 |
| PC 송출 | `getDisplayMedia`(화면+탭/시스템 오디오) + `getUserMedia`(마이크) → **트랙을 따로 publish** | 클라이언트 믹싱 없이 구현 가능, 시청 측·녹화(Room Composite)가 알아서 합침 |
| 모바일 송출 | `getUserMedia({video:{facingMode}, audio})` → 같은 방식으로 publish | 모바일 웹 화면공유는 불가하지만 요구사항은 카메라+마이크뿐 |
| 시청 | LiveKit 방에 **구독 전용 토큰**(canPublish=false)으로 입장 | 수백 ms 지연, 별도 HLS 변환 불필요 |
| 백엔드 | **Spring Boot 3 + Java 21**, Spring Security + JWT, LiveKit 서버 SDK(`io.livekit:server-sdk-kotlin`, Java에서 사용 가능) | 사용자 경험 스택, 토큰 발급·웹훅 처리만 하면 됨 |
| 프론트 | **React + Vite + TypeScript**, `livekit-client`, `@livekit/components-react` | 미디어 UI 컴포넌트 재사용 |
| DB | PostgreSQL (Docker 또는 무료 관리형) | 회원·방송·채팅·후원·녹화 메타 |
| 채팅(선택) | LiveKit **Data 메시지**(1순위) 또는 Spring WebSocket(STOMP) | 데이터 채널은 서버 코드 0줄, 영구 저장이 필요하면 백엔드도 같이 |
| 도네이션(선택) | 포인트 충전(가상) → 후원 → 채팅창 하이라이트 | 실결제 연동은 리스크 대비 가산점이 작음, 원하면 토스페이먼츠 테스트 모드 |
| 녹화/다시보기(선택) | LiveKit **Room Composite Egress** → MP4(또는 HLS) → S3/R2 → `<video>`/hls.js 재생 | 방송 종료 웹훅으로 자동 처리 |
| 배포 | 프론트: Vercel/Cloudflare Pages · 백엔드+DB: 단일 VM(Docker Compose + Caddy 자동 HTTPS) · 미디어: LiveKit Cloud | HTTPS 필수 조건을 가장 쉽게 충족 |

**핵심 원칙**: 미디어 서버는 직접 만들지 않는다. 13일 안에 점수가 나는 부분은 "필수 4개를 실제 배포 URL에서 확실히 동작" + "README 근거"다.

---

## 1. 요구사항별 기술 선택지 비교

### 1-1. 브라우저 송출 API

| API | 용도 | 지원 현황 / 주의 |
|---|---|---|
| `navigator.mediaDevices.getDisplayMedia({video:true, audio:true})` | PC 화면 공유 + 소리 공유 | 데스크톱 Chrome/Edge/Firefox/Safari 지원. **모바일 브라우저(iOS·Android)는 미지원** — 요구사항상 모바일은 카메라만이라 괜찮음. 사용자 클릭(제스처)에서만 호출 가능 |
| 소리 공유(오디오 트랙) | 탭 오디오 / 시스템 오디오 | **Chrome/Edge 기준**: Windows·ChromeOS는 "전체 화면 + 시스템 오디오" 가능, **탭 공유 시 탭 오디오는 모든 OS 가능**. macOS는 Chrome 141+ & macOS 14.2+ 에서 시스템 오디오 지원 보고(제3자 테스트, 재확인 필요). **Firefox·Safari는 화면 오디오를 사실상 못 받음** → "Chrome/Edge 권장" 명시 |
| `getUserMedia({audio:{echoCancellation, noiseSuppression}})` | 마이크 | 모든 주요 브라우저 지원. HTTPS 필요 |
| `getUserMedia({video:{facingMode:'user'|'environment', width, height}, audio:true})` | 모바일 카메라+마이크 | iOS Safari 11+, Android Chrome 지원. iOS는 `<video playsinline muted autoplay>` 필수 |

**화면 오디오 + 마이크 처리 방법**

| 방법 | 설명 | 장단점 |
|---|---|---|
| A. 트랙 분리 publish (**추천**) | 화면 비디오 트랙, 화면 오디오 트랙(`Track.Source.ScreenShareAudio`), 마이크 트랙(`Track.Source.Microphone`)을 각각 publish | 구현 가장 쉬움. 시청자가 볼륨 개별 조절 가능. Room Composite 녹화도 자동 믹스 |
| B. Web Audio API로 믹싱 | `AudioContext` → `createMediaStreamSource`(화면, 마이크) → 각 `GainNode` → `createMediaStreamDestination()` → 단일 오디오 트랙 publish | 방송자 측에서 볼륨 믹서 UI 가능("마이크 70%, 게임 30%"). 구현량 증가, AudioContext는 사용자 제스처 후 resume 필요 |

> 가산점 포인트: A로 먼저 끝내고, 여유가 있으면 B의 "볼륨 믹서 UI"를 붙이면 README에 쓸 거리가 늘어남.

**PC 송출 구현 체크 포인트**
- `getDisplayMedia` 호출 시 `audio: true`, Chrome 힌트 옵션: `systemAudio: 'include'`, `selfBrowserSurface: 'exclude'`, `surfaceSwitching: 'include'`
- 사용자가 브라우저 "공유 중지" 버튼을 누르면 `track.onended` → 방송 상태 갱신
- 화면 공유는 해상도 1080p/30fps, `contentHint = 'detail'`(텍스트 위주) 또는 `'motion'`(게임) 설정
- 오디오 트랙이 비어있으면(사용자가 "오디오 공유" 체크 안 함) UI로 안내

### 1-2. 전송 방식 비교

| 방식 | 지연 | 브라우저 송출 | 구현 난이도(13일 기준) | 녹화 | 비고 |
|---|---|---|---|---|---|
| **LiveKit (WebRTC SFU)** | 0.2~0.5초 | SDK 그대로 | **낮음** | Egress(MP4/HLS) 내장 | Cloud 무료 플랜 또는 단일 바이너리 자체 호스팅, TURN 내장, WHIP/RTMP Ingress도 있음 |
| mediasoup | 0.2~0.5초 | 직접 시그널링 구현 | 높음 | 직접(ffmpeg/GStreamer 파이프) | Node.js 라이브러리, 시그널링·방 관리 전부 직접 → 13일엔 무리 |
| Janus / Jitsi / OpenVidu | 0.2~0.5초 | 플러그인/SDK | 중간 | 플러그인/있음 | OpenVidu 3는 내부가 LiveKit 기반 |
| WHIP 송출 + WHEP 시청 (Cloudflare Realtime/Stream, MediaMTX 등) | 0.5초 내외 | 브라우저 표준 HTTP+SDP, 코드 ~40줄 | 중간 | 서비스별 | 표준이라 깔끔하지만 다중 트랙(화면+시스템오디오+마이크) 관리·권한·채팅을 직접 구성 |
| RTMP → HLS (nginx-rtmp, MediaMTX, AWS IVS) | 3~10초(LL-HLS 2~3초) | **브라우저는 RTMP 못 보냄** → 서버에서 WebRTC→RTMP 변환 필요 | 중간~높음 | 쉬움(세그먼트가 곧 녹화) | 대규모 시청엔 유리하지만 "브라우저 송출" 요구사항과 궁합 나쁨 |
| P2P(메시) | 최저 | 가능 | 낮음 | 어려움 | 시청자 수만큼 송출자 업로드 증가 → 방송 플랫폼엔 부적합 |

**추천: LiveKit**. 이유
1. 브라우저 SDK가 화면 공유(+오디오), 카메라, 마이크, 재연결, 적응형 화질(simulcast)을 다 처리.
2. 권한 모델이 토큰 기반 → Spring Boot가 "방송 소유자만 publish 가능" 토큰을 발급하면 **방송 소유자 권한 관리** 요구사항이 자연스럽게 미디어 레벨까지 적용됨.
3. 웹훅(`room_started`, `room_finished`, `participant_joined`, `egress_ended`)으로 방송 상태·시청자 수·녹화 완료를 백엔드 DB에 반영.
4. Egress로 녹화(선택 기능) 해결.

**LiveKit Cloud vs 자체 호스팅**

| | LiveKit Cloud (Build, 무료) | 자체 호스팅(VM 1대) |
|---|---|---|
| 준비 시간 | 10분 (키 발급) | 반나절~1일 (도메인, TLS, UDP 포트, TURN) |
| 한도 | 공식 문서상 무료 한도는 **하드 캡**. 제3자 정리 기준 월 약 5,000 참가자-분, 동시 접속 100, 다운로드 50GB 수준(**가입 후 대시보드에서 실제 수치 확인 필수**) | VM 트래픽 요금만 |
| TURN | 내장(관리됨) | `livekit.yaml`의 `turn` 설정 + 443/TLS 도메인 필요 |
| 녹화 | Cloud Egress 사용(한도 내) | Egress 별도 컨테이너 + Redis + Chrome(메모리 2GB+) |
| 리스크 | 심사 기간 중 한도 소진 → 시청 불가 | 네트워크 설정 실패 시 특정 망에서 연결 안 됨 |

> 결정: **Cloud로 개발·제출**, 심사 기간에 한도가 걱정되면 마감 전 자체 호스팅으로 전환할 수 있게 `LIVEKIT_URL/KEY/SECRET` 환경변수만 바꾸면 되도록 설계. 시청자도 참가자-분을 소모하므로 심사 중엔 방송을 오래 켜두지 말 것.

### 1-3. 저지연 시청

- 시청자는 백엔드에서 `canPublish=false, canSubscribe=true, canPublishData=true(채팅용)` 토큰을 받아 방에 입장 → WebRTC로 바로 수신(지연 1초 미만).
- 화면 공유는 **simulcast/적응형 스트림**(`adaptiveStream: true, dynacast: true`)으로 시청자 네트워크에 맞게 자동 화질 조절.
- 비로그인 시청 허용 여부 결정 필요 → 치지직처럼 **비로그인 시청 가능, 채팅·후원은 로그인 필요** 추천(게스트 토큰은 identity를 `guest-<uuid>`로).
- 대규모 시청이 목표가 아니므로 HLS 병행은 하지 않음. (README "확장 계획"에 "시청자 수천 명 이상은 Egress HLS → CDN" 한 줄 언급)

### 1-4. 모바일 브라우저 제약

| 항목 | iOS Safari / iOS Chrome(WebKit) | Android Chrome |
|---|---|---|
| 카메라+마이크 | 지원 (HTTPS 필수) | 지원 |
| 화면 공유 | **미지원** (모바일 웹 전반) | 미지원 |
| 자동 재생 | 소리 있는 영상 자동재생 차단 → **"탭하여 소리 켜기" 버튼** 필요, `playsinline` 필수 | 비슷한 정책 |
| 백그라운드 | 화면 잠금/앱 전환 시 카메라 중단 → `visibilitychange`로 "방송 일시정지" 표시 | 유사 |
| 기타 | 인앱 브라우저(카카오톡·인스타)는 권한 문제 잦음 → "Safari/Chrome에서 열기" 안내 | 동일 |

모바일 송출 화면 필수 UI: 전/후면 카메라 전환(`facingMode`), 마이크 음소거, 세로 화면 레이아웃, 권한 거부 시 안내 문구.

### 1-5. 녹화 / 다시보기

| 방법 | 설명 | 추천도 |
|---|---|---|
| **LiveKit Room Composite Egress** | 방 전체(화면+모든 오디오)를 서버에서 합성해 MP4 또는 HLS로 S3 호환 스토리지 저장. 방 종료 시 자동 정지 | ★★★ (서버 측, 안정적) |
| Track Composite / Track Egress | 특정 트랙만 저장 | ★★ |
| 클라이언트 `MediaRecorder` | 방송자 브라우저에서 WebM 녹화 후 업로드 | ★ (방송자 PC 부하, 브라우저 종료 시 유실) |

흐름: 방송 시작 API → 백엔드가 `StartRoomCompositeEgress`(파일: `recordings/{broadcastId}.mp4`) 호출 → `egress_ended` 웹훅 → `recording` 테이블에 URL·길이 저장 → 다시보기 페이지에서 재생.
스토리지: **Cloudflare R2**(무료 10GB, 송신료 없음) 또는 AWS S3. 재생은 MP4면 `<video>`로 충분.

---

## 2. 아키텍처 추천

```
[방송자 PC 브라우저] ─ getDisplayMedia + getUserMedia ─┐
[방송자 모바일 브라우저] ─ getUserMedia(카메라+마이크) ─┤  WebRTC (publish)
                                                        ▼
                                              ┌──────────────────┐
[시청자 브라우저] ◀── WebRTC (subscribe) ──── │  LiveKit SFU     │──Egress──▶ [R2/S3: 녹화 MP4]
        ▲  채팅: Data 메시지 ───────────────▶ │ (Cloud/자체호스팅)│
        │                                     └───────┬──────────┘
        │ REST (JWT)                                  │ Webhook (서명 검증)
        ▼                                             ▼
┌───────────────────────────────────────────────────────────┐
│ Spring Boot API (Java 21)                                  │
│  - 회원/인증(JWT, Refresh)  - 방송 CRUD  - LiveKit 토큰 발급 │
│  - 웹훅 처리(방송 상태/시청자 수/녹화 완료) - 후원/채팅 저장  │
└──────────────────────────┬────────────────────────────────┘
                           ▼
                     [PostgreSQL]
```

### 2-1. 백엔드 (Spring Boot)
- **모듈은 단일 애플리케이션**(MSA 금지 — 13일). 패키지: `auth`, `member`, `broadcast`, `live`(토큰·웹훅), `chat`, `donation`, `recording`, `common`.
- 의존성: Spring Web, Security, Data JPA, Validation, Flyway, PostgreSQL, `io.livekit:server-sdk-kotlin`(Java에서 `AccessToken`, `RoomServiceClient`, `EgressServiceClient`, `WebhookReceiver` 사용), springdoc-openapi(Swagger → README 근거로 활용).
- 인증: 이메일+비밀번호(BCrypt) → Access JWT(15~30분) + Refresh(HttpOnly 쿠키 또는 DB 저장). 로그아웃은 Refresh 폐기 + (선택) Access 블랙리스트.
- **소유자 권한**: `broadcast.owner_id == 로그인 사용자`일 때만 수정·삭제·송출 토큰 발급. 서비스 계층 검사 + `@PreAuthorize` 또는 커스텀 체크, 위반 시 403. 테스트 코드로 증빙.
- **테스트 로그인**: `POST /api/auth/test-login` → 시드된 데모 계정으로 즉시 로그인(README 필수 항목 대응). 프론트에 "테스트 계정으로 시작" 버튼.

**API 초안**

| Method | URL | 권한 | 설명 |
|---|---|---|---|
| POST | /api/auth/signup | 공개 | 회원가입 |
| POST | /api/auth/login | 공개 | 로그인 |
| POST | /api/auth/test-login | 공개 | 테스트 계정 로그인 |
| POST | /api/auth/refresh | 쿠키 | 토큰 재발급 |
| POST | /api/auth/logout | 로그인 | 로그아웃 |
| GET | /api/broadcasts?status=LIVE | 공개 | 방송 목록(라이브 우선, 시청자 수) |
| GET | /api/broadcasts/{id} | 공개 | 방송 상세 |
| POST | /api/broadcasts | 로그인 | 방송 등록(제목, 설명, 카테고리, 썸네일) |
| PATCH | /api/broadcasts/{id} | **소유자** | 수정 |
| DELETE | /api/broadcasts/{id} | **소유자** | 삭제(라이브 중이면 방 종료) |
| POST | /api/broadcasts/{id}/start | **소유자** | 방송 시작 → publish 토큰 + LiveKit URL 반환, (선택) 녹화 시작 |
| POST | /api/broadcasts/{id}/end | **소유자** | 방송 종료 → 방 삭제 |
| POST | /api/broadcasts/{id}/viewer-token | 공개/로그인 | 구독 전용 토큰(로그인 시 채팅 가능) |
| POST | /api/livekit/webhook | LiveKit 서명 | 상태·시청자 수·녹화 반영 |
| GET | /api/broadcasts/{id}/recordings | 공개 | 다시보기 목록 |
| POST | /api/broadcasts/{id}/donations | 로그인 | 후원 |

### 2-2. DB 스키마 초안
- `member(id, email, password_hash, nickname, role, created_at)`
- `refresh_token(id, member_id, token_hash, expires_at)`
- `broadcast(id, owner_id, title, description, category, thumbnail_url, status[READY|LIVE|ENDED], room_name, viewer_count, started_at, ended_at, created_at, updated_at, deleted_at)`
- `chat_message(id, broadcast_id, member_id, content, created_at)` — 저장은 선택
- `point_wallet(member_id, balance)`, `donation(id, broadcast_id, sender_id, amount, message, created_at)`
- `recording(id, broadcast_id, egress_id, file_url, duration_sec, status, created_at)`

### 2-3. 프론트엔드
- React + Vite + TypeScript + React Router + TanStack Query, 스타일은 Tailwind.
- 페이지: 홈(라이브 목록), 로그인/회원가입, 방송 만들기/수정, **PC 스튜디오**(화면/오디오/마이크 선택, 미리보기, 방송 시작/종료), **모바일 스튜디오**(카메라 전환·음소거), 시청 페이지(플레이어+채팅+후원), 다시보기, 내 방송 관리.
- `livekit-client`: `room.localParticipant.setScreenShareEnabled(true, {audio: true, systemAudio: 'include', contentHint: 'detail'})`, `setMicrophoneEnabled(true)`, `setCameraEnabled(true, {facingMode})`.
- 디바이스 판별(`matchMedia('(pointer:coarse)')` + `getDisplayMedia` 존재 여부)로 PC/모바일 스튜디오 자동 분기.

### 2-4. 배포 & HTTPS
- `getUserMedia`/`getDisplayMedia`는 **보안 컨텍스트(HTTPS 또는 localhost)에서만 동작** → 배포 URL은 반드시 HTTPS. 휴대폰으로 로컬 테스트할 땐 같은 와이파이 IP로는 안 되므로 `ngrok`/`cloudflared tunnel`로 HTTPS 터널 사용.
- 추천 구성
  - 프론트: **Vercel** 또는 **Cloudflare Pages**(무료, 자동 HTTPS)
  - 백엔드+DB: VM 1대(AWS Lightsail/EC2 프리티어, 또는 Oracle Cloud Always Free) + Docker Compose(api, postgres, caddy). **Caddy**가 도메인 인증서 자동 발급.
    - Oracle Always Free는 2026년 중 A1 한도가 약 2 OCPU/12GB로 축소됐다는 보고가 있고, 신규 가입 시 용량 부족이 잦음 → 확정되기 전 예비안으로만.
  - 대안: Render/Railway/Fly.io(무료 한도·슬립 정책 확인 필요, 슬립되면 심사 때 첫 요청이 느림 → 유료 최소 플랜 또는 VM 권장)
  - 도메인: 무료 서브도메인(duckdns 등) 또는 저렴한 도메인 1개. 프론트와 API를 같은 상위 도메인으로 두면 쿠키·CORS 단순.
  - 미디어: LiveKit Cloud(`wss://<project>.livekit.cloud`).
- **TURN 필요 여부**: 회사·학교·모바일 통신망(대칭 NAT, UDP 차단)에서는 TURN 없이는 연결 실패 가능 → **필요**. LiveKit Cloud는 TURN 포함이라 신경 쓸 것 없음. 자체 호스팅 시 `turn.enabled: true`, `tls_port: 443`(또는 5349), 별도 도메인 인증서, UDP 50000-60000·7881/TCP·3478/UDP 포트 개방 필요. 대안으로 Cloudflare Realtime TURN(SFU와 합산 월 1,000GB 무료).
- CI/CD: GitHub Actions — 백엔드 테스트 + Docker 이미지 빌드 → VM에 ssh 배포(시간 남으면).

---

## 3. 13일 일정표

> 원칙: **D+4까지 "로그인 → 방송 생성 → PC 송출 → 다른 기기 시청"이 배포 환경에서 동작**하게 만든다. 선택 기능은 필수 4개가 배포 환경에서 검증된 다음에만.

| 날짜 | 목표 | 완료 기준 |
|---|---|---|
| **11/6(금)** D0 | 준비: 저장소 생성, LiveKit Cloud 가입·키 발급, 기술 스파이크 | 로컬 HTML 1장으로 `getDisplayMedia` → LiveKit publish → 다른 탭 시청 성공(시스템 오디오 포함 여부 OS별 확인) |
| **11/7(토)** D1 | 백엔드 골격: Spring Boot, Postgres(Docker), Flyway, 회원가입/로그인/로그아웃(JWT), 테스트 로그인 | Swagger에서 인증 흐름 통과, 통합 테스트 |
| **11/8(일)** D2 | 방송 CRUD + 소유자 권한 + LiveKit 토큰 발급 API | 타인 방송 수정 시 403 테스트 통과 |
| **11/9(월)** D3 | 프론트 골격: 라우팅, 로그인, 방송 목록/등록/수정/삭제 | UI로 CRUD 가능 |
| **11/10(화)** D4 | PC 스튜디오(화면+소리+마이크) + 시청 페이지 / **첫 배포**(Vercel + VM + HTTPS) | 배포 URL에서 PC 송출 → 휴대폰 LTE로 시청 성공 |
| **11/11(수)** D5 | 모바일 스튜디오(카메라·마이크·전후면 전환), iOS/Android 실기기 테스트 | iPhone Safari 송출 → PC 시청 성공 |
| **11/12(목)** D6 | 웹훅: 방송 상태(LIVE/ENDED), 시청자 수, 비정상 종료 처리, 방송 종료 API | 브라우저 강제 종료해도 목록에서 LIVE 해제 |
| **11/13(금)** D7 | **필수 기능 동결 + 버퍼**: 버그 수정, 예외 UI(권한 거부, 오디오 미공유, 미지원 브라우저 안내) | 필수 4개 시나리오 체크리스트 전부 통과 |
| **11/14(토)** D8 | 선택①: 채팅(LiveKit Data, 로그인 사용자만, 닉네임 표시, 선택적으로 DB 저장) | 두 기기 간 채팅 |
| **11/15(일)** D9 | 선택②: 녹화(Room Composite Egress → R2) + 다시보기 페이지 | 방송 종료 후 다시보기 재생 |
| **11/16(월)** D10 | 선택③: 도네이션(가상 포인트 충전 → 후원 → 채팅창 하이라이트 + 방송 화면 알림) | 후원 시 방송자 화면에 알림 |
| **11/17(화)** D11 | 다듬기: UI, 썸네일, 오디오 믹서(Web Audio, 선택), 테스트 보강 | — |
| **11/18(수)** D12 | README·스크린샷·시연 영상(선택), 제출 폼 근거 초안 작성, 최종 배포 | 처음 보는 사람이 README만 보고 테스트 가능 |
| **11/19(목)** D13 | **오전 중 제출**(늦어도 18시), 이후엔 배포 상태 모니터링만 | 코드밋 제출 + '공모전에도 내기' 체크 확인 |

**우선순위가 밀릴 때 버리는 순서**: 오디오 믹서 UI → 도네이션 → 채팅 DB 저장 → 녹화 → (필수는 절대 안 버림)

---

## 4. 리스크 목록

| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | **시스템 오디오 캡처 OS 제약**: macOS는 Chrome 141+/macOS 14.2+ 이전 환경에서 시스템 오디오 불가(탭 오디오만), Firefox·Safari는 화면 오디오 미지원 | "소리 공유" 시연 실패 | D0에 실제 환경 확인. README에 "Chrome/Edge 최신 권장, macOS는 탭 공유 시 탭 오디오 또는 macOS 14.2+" 명시. 시연 영상은 Windows Chrome 또는 탭 오디오로 촬영 |
| R2 | 브라우저 호환성(Safari 코덱, 모바일 자동재생 차단) | 시청 시 무음/검은 화면 | `playsinline muted` + "소리 켜기" 버튼, LiveKit `room.startAudio()` 처리, 미지원 시 안내 배너 |
| R3 | 모바일 웹 화면 공유 불가 | — (요구사항 아님) | 모바일 스튜디오에서 화면 공유 버튼 숨김 |
| R4 | **NAT/방화벽**: UDP 차단 망에서 연결 실패 | 심사자 환경에서 시청 안 됨 | LiveKit Cloud(TURN 포함) 사용. 자체 호스팅 시 TURN/TLS 443 필수 |
| R5 | LiveKit Cloud 무료 한도(하드 캡) 소진 | 심사 기간 중 방송 불가 | 대시보드 사용량 모니터링, 개발 중 방 장시간 방치 금지, 자체 호스팅 전환 가능하도록 환경변수화 |
| R6 | 배포 비용·무료 호스팅 슬립/용량 부족 | 첫 접속 지연, VM 생성 실패 | 소액(월 수천 원~1만 원대) VM 하나로 고정. 프리티어 만료일 확인 |
| R7 | HTTPS/도메인 설정 지연 | 배포 환경에서 카메라 안 켜짐 | D4에 첫 배포를 강제, Caddy 자동 인증서 |
| R8 | 시크릿 노출(공개 저장소) | LiveKit 키·DB 비밀번호 유출 | `.env` gitignore, `.env.example`만 커밋, GitHub secret scanning 켜기, 커밋 전 `git diff` 확인 |
| R9 | 심사 시점 서비스 다운 | 감점 | 제출 후 헬스체크(UptimeRobot 무료), 시드 데이터·테스트 계정 재생성 스크립트 |
| R10 | 범위 과다 | 필수 미완성 | D7 필수 동결 규칙, 선택은 하나씩 완료 후 다음 |
| R11 | 웹훅 수신 실패(로컬 개발) | 상태 미반영 | 로컬은 `cloudflared`/ngrok 터널, 웹훅 서명 검증, 방송 상세 조회 시 LiveKit `listRooms`로 보정 |

---

## 5. 제출 체크리스트

### 5-1. 제출 전 확인
- [ ] 저장소가 **Public**이고 기본 브랜치에 최신 코드가 있음
- [ ] 시크릿이 커밋 이력에 없음(`git log -p | grep -i secret` 등으로 확인)
- [ ] 배포 URL(HTTPS) 접속 가능, 시크릿 창에서 처음부터 테스트
- [ ] 테스트 로그인 버튼/계정 동작, 테스트 계정으로 만든 샘플 방송·다시보기 존재
- [ ] PC(Chrome) 송출: 화면 + 소리 + 마이크 → 다른 기기 시청에서 모두 들림
- [ ] 모바일(iOS Safari, Android Chrome) 송출: 카메라 + 마이크
- [ ] 방송 등록·조회·수정·삭제, 타인 방송 수정/삭제/송출 시 403
- [ ] 회원가입·로그인·로그아웃
- [ ] (선택) 채팅 / 도네이션 / 녹화·다시보기
- [ ] README 필수 3항목: 서비스 주소, 테스트 계정/로그인, 실행 및 기능 확인 방법
- [ ] 코드밋 제출 페이지(https://classroom.codemit.kr/classes/3/problems/68/submit)에 URL 입력, **'공모전에도 내기' 체크**
- [ ] 제출 폼에서 **실제 구현한 항목만** '충족' 체크, 각 항목에 근거 작성

### 5-2. README 템플릿

````markdown
# <서비스 이름> — 브라우저만으로 하는 실시간 라이브 방송

> 설치 없이 PC에선 화면·소리·마이크를, 휴대폰에선 카메라·마이크를 실시간으로 송출하고 1초 미만 지연으로 시청하는 웹 서비스

## 🔗 서비스 주소
- 웹: https://<도메인>
- API 문서(Swagger): https://api.<도메인>/swagger-ui/index.html
- 시연 영상(선택): <YouTube 링크>

## 🔑 테스트 계정
| 구분 | 이메일 | 비밀번호 |
|---|---|---|
| 방송자 | streamer@demo.test | <비밀번호> |
| 시청자 | viewer@demo.test | <비밀번호> |

또는 로그인 화면의 **[테스트 계정으로 시작]** 버튼을 누르면 바로 로그인됩니다.

## ✅ 기능 확인 방법 (5분)
> 권장 환경: PC는 **Chrome/Edge 최신**, 모바일은 iOS Safari / Android Chrome. 카메라·마이크 권한을 허용해 주세요.

1. **로그인**: 테스트 계정으로 로그인
2. **방송 등록**: [방송 만들기] → 제목 입력 → 저장
3. **PC 송출**: [방송 시작] → 공유할 화면/탭 선택 → **"오디오 공유" 체크** → 마이크 켜기
4. **시청**: 다른 기기(또는 시크릿 창)에서 홈 → LIVE 방송 클릭 → [소리 켜기]
5. **모바일 송출**: 휴대폰으로 접속 → 방송 만들기 → 카메라 방송 시작(전/후면 전환 가능)
6. **권한 확인**: 시청자 계정으로 방송자 방송의 수정 URL 접근 → 403 안내
7. (선택) 채팅 입력, 후원하기, 방송 종료 후 [다시보기]

> macOS에서 "시스템 전체 소리" 공유는 Chrome 141+ & macOS 14.2+ 에서 가능합니다. 그 이하 환경에서는 **Chrome 탭을 공유**하면 탭 소리가 송출됩니다.

## 📋 요구사항 충족 현황
| 요구사항 | 상태 | 구현 위치 |
|---|---|---|
| PC 라이브: 화면 공유 | ✅ | `frontend/src/features/studio/PcStudio.tsx` |
| PC 라이브: 소리 공유 | ✅ | 〃 (`ScreenShareAudio` 트랙) |
| PC 라이브: 마이크 송출 | ✅ | 〃 |
| 모바일 라이브: 카메라+마이크 | ✅ | `frontend/src/features/studio/MobileStudio.tsx` |
| 방송 CRUD + 실시간 시청 | ✅ | `backend/.../broadcast/`, `frontend/.../watch/` |
| 인증·인가 / 소유자 권한 | ✅ | `backend/.../auth/`, `BroadcastService#checkOwner` |
| 채팅 | ✅/➖ | |
| 도네이션 | ✅/➖ | |
| 녹화·다시보기 | ✅/➖ | |

## 🏗 아키텍처
(다이어그램 이미지 또는 mermaid)

## 🛠 기술 스택
- Frontend: React, TypeScript, Vite, livekit-client
- Backend: Java 21, Spring Boot 3, Spring Security(JWT), JPA, PostgreSQL, Flyway
- Media: LiveKit (WebRTC SFU, TURN, Egress)
- Infra: Vercel, Docker Compose, Caddy, Cloudflare R2

## 💻 로컬 실행
```bash
cp .env.example .env   # LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET 등 입력
docker compose up -d   # postgres
cd backend && ./gradlew bootRun
cd frontend && npm install && npm run dev
```
- 로컬에서 휴대폰 테스트 시 HTTPS가 필요하므로 `cloudflared tunnel --url http://localhost:5173` 사용

## 🤖 AI 개발 도구 활용
- 사용 도구와 활용 방식(설계 검토, 코드 생성, 테스트 작성, 리뷰 등)

## 📌 알려진 제약 / 확장 계획
- 모바일 웹은 브라우저 정책상 화면 공유 불가(요구사항: 카메라+마이크)
- 시청자 대규모 확장 시 Egress HLS + CDN 병행
````

### 5-3. 제출 폼 요구사항 근거 작성 양식

각 요구사항마다 아래 형식으로 작성(구체적일수록 유리).

```
[요구사항] PC 라이브 방송 - 소리 공유
[충족 여부] 충족
[구현 내용]
- getDisplayMedia({ video, audio: true, systemAudio: 'include' })로 화면과 시스템/탭 오디오를 함께 캡처
- 화면 오디오 트랙을 ScreenShareAudio 소스로, 마이크를 Microphone 소스로 각각 publish하여 시청자가 두 소리를 모두 수신
- 사용자가 '오디오 공유'를 체크하지 않은 경우 오디오 트랙 부재를 감지해 안내 토스트 표시
[코드 위치]
- frontend/src/features/studio/PcStudio.tsx (L40-95)
- frontend/src/features/studio/useScreenShare.ts
[확인 방법]
- README '기능 확인 방법' 3~4번. 시연 영상 0:45~1:20
[제약/참고]
- macOS 시스템 전체 오디오는 Chrome 141+ & macOS 14.2+. 그 외에는 탭 오디오 공유
```

```
[요구사항] 인증·인가 - 방송 소유자 권한 관리
[충족 여부] 충족
[구현 내용]
- JWT 기반 인증, 방송 수정/삭제/시작/종료 API에서 owner_id와 로그인 사용자 비교, 불일치 시 403
- 송출(publish) 권한이 담긴 LiveKit 토큰은 소유자에게만 발급, 시청자는 canPublish=false 토큰 → 미디어 서버 수준에서도 송출 차단
[코드 위치]
- backend/src/main/java/.../broadcast/BroadcastService.java#checkOwner
- backend/src/main/java/.../live/LiveTokenService.java
- 테스트: backend/src/test/java/.../BroadcastAuthorizationTest.java
[확인 방법]
- 시청자 계정으로 PATCH /api/broadcasts/{id} → 403 (Swagger)
```

---

## 6. D0(오늘) 바로 할 일
1. 새 공개 GitHub 저장소 생성(모노레포: `backend/`, `frontend/`, `infra/`, `docs/`), `.gitignore`·`.env.example` 먼저 커밋
2. LiveKit Cloud 가입 → 프로젝트 생성 → API Key/Secret 발급, **대시보드에서 무료 한도 수치 확인해 이 문서 R5에 기록**
3. 스파이크: HTML 1장 + LiveKit 샌드박스 토큰으로 화면+오디오+마이크 publish / 다른 기기 subscribe 확인 (본인 PC의 OS·Chrome 버전에서 시스템 오디오 가능 여부 기록)
4. 도메인·VM 결정(비용 확인)

---

## 참고 자료 (2026-11 조사)
- LiveKit 할당량·한도: https://docs.livekit.io/deploy/admin/quotas-and-limits/ · 가격: https://livekit.com/pricing
- LiveKit Egress 출력 옵션(MP4/HLS): https://docs.livekit.io/transport/media/ingress-egress/egress/outputs/ · 자체 호스팅 Egress: https://docs.livekit.io/transport/self-hosting/egress.md
- LiveKit Ingress(RTMP/WHIP): https://docs.livekit.io/transport/media/ingress-egress/ingress/
- Java 서버 SDK 사용 예(토큰·웹훅): https://openvidu.io/latest/docs/tutorials/application-server/java
- Chrome macOS 시스템 오디오(getDisplayMedia): https://blog.addpipe.com/getdisplaymedia-allows-capturing-the-screen-with-system-sounds-on-chrome-on-macos/
- getDisplayMedia 데모: https://addpipe.com/getdisplaymedia-demo/
- Cloudflare Realtime(SFU/TURN) 가격: https://developers.cloudflare.com/realtime/sfu/pricing
- Oracle Always Free 2026 변경 보고: https://terminalbytes.com/oracle-cloud-free-tier-changes-2026
- iOS Safari WebRTC/getDisplayMedia: https://webrtc.ventures/2020/01/safari-a-webrtc-screen-sharing-story/

> ⚠️ 무료 한도·브라우저 지원은 제3자 자료를 포함하므로 D0에 공식 페이지·실기기로 재확인할 것.
