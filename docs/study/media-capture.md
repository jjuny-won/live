# 브라우저 미디어 캡처

> 목표: PC 송출(화면+소리+마이크)과 모바일 송출(카메라+마이크)이 **어떤 API로, 어떤 조건에서** 되고 안 되는지 설명할 수 있게 되기.
> 관련: `docs/PREPARATION.md` 1-1, 1-4, 리스크 R1·R2

## 1. 두 API 비교

| | `getUserMedia` | `getDisplayMedia` |
|---|---|---|
| 가져오는 것 | 카메라, 마이크 | 화면 / 창 / 브라우저 탭 (+ 그 소리) |
| 선택 UI | 권한 팝업(허용/차단) | 브라우저가 띄우는 **공유 대상 선택 창** — 코드로 대상 지정 불가 |
| 호출 조건 | 보안 컨텍스트 | 보안 컨텍스트 + **사용자 제스처**(버튼 클릭 핸들러 안에서 호출) |
| 모바일 | iOS Safari·Android Chrome 지원 | **모바일 브라우저 미지원** |
| 반환 | `MediaStream` (트랙 여러 개) | `MediaStream` (비디오 1개 + 선택 시 오디오 1개) |

```js
// 마이크 (에코·잡음 제거)
const mic = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true },
});

// 모바일 카메라 + 마이크 (전면 'user' / 후면 'environment')
const cam = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: true,
});

// 화면 + 소리 (버튼 onClick 안에서)
const screen = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 30 },
  audio: true,
  systemAudio: 'include',        // Chrome 힌트: 전체 화면 공유 시 시스템 오디오 옵션 표시
  selfBrowserSurface: 'exclude', // 지금 탭은 목록에서 빼기(무한 거울 방지)
  surfaceSwitching: 'include',   // 공유 중 다른 탭으로 전환 허용
});
const hasAudio = screen.getAudioTracks().length > 0; // 사용자가 '오디오 공유'를 안 켰으면 false
```

LiveKit에서는 직접 부르지 않고 SDK가 감싼 함수를 쓴다.
```ts
await room.localParticipant.setScreenShareEnabled(true, { audio: true, systemAudio: 'include', contentHint: 'detail' });
await room.localParticipant.setMicrophoneEnabled(true);
await room.localParticipant.setCameraEnabled(true, { facingMode: 'environment' });
```

## 2. 보안 컨텍스트 (Secure Context)

- `navigator.mediaDevices`는 **HTTPS 또는 `localhost`/`127.0.0.1`** 에서만 존재한다. `http://192.168.0.10:5173` 같은 주소에선 `undefined` → 휴대폰으로 같은 와이파이 IP 접속 테스트가 안 되는 이유.
- 해결: `cloudflared tunnel --url http://localhost:5173` 또는 ngrok으로 HTTPS 주소 만들기.
- 확인: 개발자 도구 콘솔에서 `window.isSecureContext`.
- `<iframe>` 안이라면 `allow="camera; microphone; display-capture"` 권한 정책도 필요.

## 3. 권한과 에러 처리

| 에러 이름 | 의미 | UI 안내 |
|---|---|---|
| `NotAllowedError` | 사용자가 거부했거나, 공유 선택 창에서 취소 | "권한을 허용해 주세요" + 브라우저별 설정 방법 |
| `NotFoundError` | 카메라/마이크 장치 없음 | "장치를 연결해 주세요" |
| `NotReadableError` | 다른 앱이 장치를 사용 중(줌 등) | "다른 앱을 종료해 주세요" |
| `OverconstrainedError` | 요청한 해상도·facingMode를 만족 못 함 | 조건 낮춰 재시도(`ideal` 사용) |
| `TypeError` / `mediaDevices` 없음 | 보안 컨텍스트 아님 / 미지원 브라우저 | "HTTPS·지원 브라우저에서 열어 주세요" |

- 사용자가 브라우저의 **"공유 중지"** 버튼을 누르면 비디오 트랙의 `ended` 이벤트 발생 → 방송 화면 상태 갱신 필요.
- `navigator.permissions.query({ name: 'camera' })`로 미리 상태 확인 가능(브라우저별 지원 차이 있음).

## 4. 시스템 오디오 — OS·브라우저 제약 (가장 중요한 리스크 R1)

`getDisplayMedia`에서 소리가 오는지는 **무엇을 공유하느냐 × OS × 브라우저**로 정해진다.

| 공유 대상 | Windows / ChromeOS (Chrome·Edge) | macOS (Chrome·Edge) | Linux (Chrome) | Firefox / Safari |
|---|---|---|---|---|
| **브라우저 탭** | 탭 오디오 ✓ | 탭 오디오 ✓ | 탭 오디오 ✓ | ✗ (사실상 미지원) |
| **전체 화면** | 시스템 오디오 ✓ | Chrome 141+ & macOS 14.2+ 에서 ✓ (그 이전 ✗) | ✗ 또는 제한적 | ✗ |
| **특정 창** | ✗ (창 단위 오디오 없음) | ✗ | ✗ | ✗ |

- 공유 선택 창에서 사용자가 **"오디오 공유" 체크박스**를 켜야 오디오 트랙이 생긴다. 코드로 강제할 수 없음 → 트랙이 없으면 안내 토스트.
- macOS 시스템 오디오는 OS의 "화면 및 시스템 오디오 녹음" 권한(시스템 설정 → 개인정보 보호 및 보안)도 Chrome에 허용돼야 한다.
- 시스템 오디오를 공유하면서 마이크도 켜면 **에코**(스피커 소리가 마이크로 다시 들어감) 가능 → 헤드폰 권장, `echoCancellation: true`.
- 내 환경(11/6 확인): **macOS 14.6.1 + Chrome 156** → 조건상 시스템 오디오 가능해야 함. 스파이크에서 실제 확인할 것.
- README에 쓸 문구: "PC는 Chrome/Edge 최신 권장. macOS에서 시스템 전체 소리는 Chrome 141+ & macOS 14.2+, 그 외에는 Chrome **탭**을 공유하면 탭 소리가 송출됩니다."

## 5. 화면 소리 + 마이크를 어떻게 보낼까

| 방법 | 설명 | 선택 |
|---|---|---|
| A. 트랙 분리 publish | 화면 오디오(`ScreenShareAudio`)와 마이크(`Microphone`)를 별도 트랙으로 | **기본** — 쉽고 시청자 쪽에서 자동으로 함께 들림 |
| B. Web Audio 믹싱 | `AudioContext` → 두 소스 → 각각 `GainNode` → `MediaStreamDestination` → 트랙 1개 | 여유 있을 때 "볼륨 믹서" 가산점 |

```js
// B안 뼈대
const ctx = new AudioContext();           // 사용자 클릭 후 생성/resume
const dest = ctx.createMediaStreamDestination();
for (const [stream, vol] of [[screen, 0.3], [mic, 1.0]]) {
  const g = ctx.createGain(); g.gain.value = vol;
  ctx.createMediaStreamSource(stream).connect(g).connect(dest);
}
const mixedTrack = dest.stream.getAudioTracks()[0];
```

## 6. 트랙 품질 힌트

- `track.contentHint = 'detail'` — 텍스트·코드 화면(해상도 유지, 프레임 희생)
- `track.contentHint = 'motion'` — 게임·영상(프레임 유지, 해상도 희생)
- 오디오는 `'speech'` / `'music'`
- `track.getSettings()`로 실제 적용된 해상도·프레임 확인

## 7. 모바일 주의점

- iOS: `<video playsinline autoplay muted>` 필수(없으면 전체 화면으로 튐/재생 안 됨).
- **자동 재생 정책**: 소리 있는 재생은 사용자 탭 이후에만 → 시청 페이지에 "소리 켜기" 버튼, LiveKit은 `room.startAudio()`.
- 화면 잠금·앱 전환 시 카메라가 멈춤 → `visibilitychange`로 "방송 일시정지" 표시.
- 카카오톡·인스타 **인앱 브라우저**는 권한 문제가 잦음 → "Safari/Chrome으로 열기" 안내.
- 전·후면 전환: 기존 비디오 트랙을 `stop()`하고 다른 `facingMode`로 다시 요청(LiveKit은 `track.restartTrack({ facingMode })`).

---

## 직접 확인해 볼 것
- [ ] https://addpipe.com/getdisplaymedia-demo/ 에서 **탭 / 전체 화면 / 창** 공유 각각 소리가 오는지 (내 Mac, Chrome 156)
- [ ] 전체 화면 공유 시 "시스템 오디오 공유" 체크박스가 보이는지, macOS 권한 팝업이 뜨는지
- [ ] Safari·Firefox에서 같은 데모 → 오디오 트랙이 생기는지
- [ ] `http://<내 IP>:5173`로 휴대폰 접속 시 `navigator.mediaDevices`가 `undefined`인지 → `cloudflared` 터널로 다시 시도
- [ ] iPhone Safari에서 전/후면 카메라 전환, 화면 잠금 후 복귀 시 동작
- [ ] 공유 중 브라우저의 "공유 중지" 버튼 → `ended` 이벤트가 오는지 콘솔로 확인
- [ ] 결과를 아래 표에 기록하고 README "알려진 제약"에 반영

| 환경 | 탭 오디오 | 시스템 오디오 | 마이크 | 비고 |
|---|---|---|---|---|
| macOS 14.6.1 / Chrome 156 | | | | |
| Windows / Chrome | | | | |
| iPhone Safari (카메라) | - | - | | |
| Android Chrome (카메라) | - | - | | |

## 내 정리
<!-- 공부하면서 내 말로 정리. 질문이 생기면 '궁금한 점'에 적고 문서화 세션에 물어보기 -->

### 한 줄 요약


### 궁금한 점
-

### 면접/README에 쓸 수 있는 문장
-
