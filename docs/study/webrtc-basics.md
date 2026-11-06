# WebRTC 기초

> 목표: "브라우저 A의 영상이 어떻게 브라우저 B까지 1초 안에 가는가"를 내 말로 설명할 수 있게 되기.
> 이 프로젝트에서는 LiveKit SDK가 아래 과정을 대부분 대신 해 주지만, 연결이 안 될 때 원인을 찾으려면 알아야 한다.

## 1. 큰 그림

WebRTC는 브라우저끼리(또는 브라우저와 미디어 서버가) **실시간으로 오디오·비디오·데이터를 주고받는 표준**이다. 연결까지 세 단계가 필요하다.

1. **시그널링(Signaling)** — "나는 이런 미디어를 이런 형식으로 보낼 수 있어"(SDP)와 "나한테는 이 주소로 오면 돼"(ICE 후보)를 상대에게 전달. WebRTC 표준은 시그널링 방법을 정하지 않는다(WebSocket, HTTP 등 아무거나). LiveKit은 자체 WebSocket 시그널링을 쓴다.
2. **연결 수립(ICE)** — 주고받은 후보 주소들 중 실제로 통하는 경로를 찾는다. NAT·방화벽 때문에 STUN/TURN이 필요하다.
3. **미디어 전송** — 찾은 경로로 암호화(DTLS-SRTP)된 RTP 패킷을 보낸다. 보통 UDP. 데이터는 SCTP 기반 DataChannel.

```
[브라우저 A]                 [시그널링 서버]                [브라우저 B]
 createOffer() ── SDP offer ──────▶ │ ────────────────────▶ setRemoteDescription()
                                    │ ◀──── SDP answer ───── createAnswer()
 onicecandidate ── 후보 ──────────▶ │ ────────────────────▶ addIceCandidate()
                                    │ ◀──── 후보 ────────────
 ═══════════════════ ICE 연결 확인 후 미디어(RTP/UDP) 직접 전송 ═══════════════════
```

## 2. SDP (Session Description Protocol)

- 텍스트 형식의 "미디어 명세서". `m=audio`, `m=video` 줄마다 하나의 미디어 섹션.
- 담기는 정보: 코덱 목록(VP8/VP9/H.264/AV1, Opus), 방향(`sendrecv`, `sendonly`, `recvonly`), 암호화 지문(fingerprint), ICE 자격(ufrag/pwd), simulcast 정보 등.
- **Offer/Answer 모델**: 한쪽이 offer를 만들고, 상대가 자기가 지원하는 것과 교집합을 골라 answer를 만든다.
- 이 프로젝트에서: LiveKit SDK가 `RTCPeerConnection`을 만들고 SDP 교환을 자동으로 처리. 시청자는 `recvonly`, 방송자는 `sendonly`에 가까운 구성이 된다.

## 3. NAT와 ICE

**NAT(Network Address Translation)**: 공유기·통신사가 내부 사설 IP(`192.168.x.x`)를 공인 IP 하나로 바꿔 내보내는 것. 문제는 외부에서 **먼저** 들어오는 연결은 기본적으로 막힌다는 것.

| NAT 종류(대략) | 특징 | P2P 연결 |
|---|---|---|
| Full Cone / Restricted Cone | 내부 포트 → 외부 포트 매핑이 목적지와 무관하게 유지 | STUN으로 대부분 가능 |
| **Symmetric NAT** | 목적지마다 다른 외부 포트를 씀 | STUN으로 알아낸 주소가 상대에겐 무용지물 → **TURN 필요** |

회사·학교 망, 일부 모바일 통신망은 Symmetric NAT이거나 **UDP 자체를 막는다**.

**ICE(Interactive Connectivity Establishment)**: 가능한 모든 후보 주소를 모아 짝지어 보고(connectivity check) 통하는 것 중 가장 좋은 경로를 고르는 절차.

| 후보 종류 | 어디서 얻나 | 예 |
|---|---|---|
| `host` | 내 네트워크 인터페이스 | `192.168.0.12:54321` |
| `srflx` (server reflexive) | STUN 서버가 알려 준 "바깥에서 본 내 주소" | `211.x.x.x:61000` |
| `relay` | TURN 서버에 할당받은 중계 주소 | `turn.example.com:443` |

우선순위는 보통 host > srflx > relay(중계는 느리고 서버 비용이 들어서 최후 수단).

## 4. STUN vs TURN

| | STUN | TURN |
|---|---|---|
| 역할 | "내 공인 IP:포트가 뭐야?" 질문에 답하는 거울 | 미디어를 **대신 받아서 전달**하는 중계 서버 |
| 트래픽 | 거의 없음(작은 요청 몇 개) | 모든 미디어가 거쳐 감 → 대역폭 비용 큼 |
| 필요한 때 | 일반 가정용 NAT | Symmetric NAT, UDP 차단 망(→ TURN over TCP/TLS 443) |

- **TURN over TLS 443**: 방화벽이 웹 트래픽(443)만 허용할 때도 통과. 그래서 자체 호스팅 시 `turn.tls_port: 443`과 도메인 인증서가 필요하다(PREPARATION 2-4 참고).
- 이 프로젝트에서: **LiveKit Cloud가 TURN을 포함**하므로 따로 설정할 것 없음. 심사자가 회사망에서 접속해도 연결될 가능성이 높아지는 이유(R4).

## 5. SFU vs MCU vs P2P(Mesh)

방송자 1명 → 시청자 N명일 때 비교.

| 구조 | 동작 | 방송자 업로드 | 서버 부하 | 지연 | 방송 플랫폼 적합성 |
|---|---|---|---|---|---|
| **P2P / Mesh** | 방송자가 시청자마다 직접 연결 | **N배** | 없음(시그널링만) | 최저 | ✗ 시청자 몇 명만 돼도 업로드 폭발 |
| **MCU** (Multipoint Control Unit) | 서버가 모든 스트림을 **디코딩→합성→재인코딩**해서 하나로 보냄 | 1배 | **매우 큼**(트랜스코딩) | 높음 | △ 화상회의 레거시, 비용 큼 |
| **SFU** (Selective Forwarding Unit) | 서버가 패킷을 **디코딩 없이 골라서 전달** | 1배 | 작음(전달만) | 낮음 | ✓ **LiveKit이 이것** |

- SFU의 핵심 기술
  - **Simulcast**: 방송자가 같은 영상을 고/중/저 화질 2~3개로 동시에 보내고, SFU가 시청자 네트워크에 맞는 층을 골라 전달.
  - **Dynacast**: 아무도 안 보는 화질 층은 방송자에게 "보내지 마"라고 알려 업로드 절약.
  - **Adaptive stream**: 시청자 화면 크기에 맞는 해상도만 받기.
- MCU가 하는 "합성"은 이 프로젝트에선 **녹화(Room Composite Egress)** 때만 필요 → LiveKit Egress가 서버에서 헤드리스 Chrome으로 합성한다.

## 6. 지연 시간 비교 감 잡기

| 방식 | 대략 지연 | 이유 |
|---|---|---|
| WebRTC(SFU) | 0.2~0.5초 | UDP, 버퍼 최소, 재전송보다 손실 감수 |
| LL-HLS | 2~3초 | 짧은 세그먼트 |
| HLS/DASH | 6~30초 | 수 초 단위 세그먼트를 몇 개 버퍼링 |

## 7. 이 프로젝트에 매핑

| 개념 | 우리 코드에서 |
|---|---|
| 시그널링 | LiveKit SDK ↔ LiveKit Cloud WebSocket(`wss://<project>.livekit.cloud`) |
| 시그널링 권한 | Spring Boot가 발급하는 **LiveKit 접근 토큰(JWT)** — `canPublish` 등 |
| ICE/STUN/TURN | LiveKit Cloud가 제공, 클라이언트는 자동 |
| SFU | LiveKit 서버 |
| DataChannel | 채팅(topic `chat`), 후원 알림(topic `donation`) |

---

## 직접 확인해 볼 것
- [ ] Chrome에서 `chrome://webrtc-internals` 열어 두고 방송/시청 → `RTCPeerConnection`의 SDP offer/answer 원문 찾아보기 (`m=video` 줄, 코덱 이름)
- [ ] 같은 화면에서 선택된 ICE 후보 쌍(candidate pair)이 `host`/`srflx`/`relay` 중 무엇인지 확인. 휴대폰 LTE로 시청할 때와 비교
- [ ] https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ 에서 내 네트워크의 후보 수집 결과 보기
- [ ] simulcast 층이 몇 개 올라가는지(`outbound-rtp`가 여러 개인지) 확인
- [ ] 시청 지연을 재 보기: 방송 화면에 스톱워치를 띄우고 시청 화면과 같이 사진 찍기

## 내 정리
<!-- 공부하면서 내 말로 정리. 질문이 생기면 아래 '궁금한 점'에 적고 문서화 세션에 물어보기 -->

### 한 줄 요약


### 궁금한 점
-

### 면접/README에 쓸 수 있는 문장
-
