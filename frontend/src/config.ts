// 배포(프로덕션 빌드)에서는 같은 출처의 /api 를 쓰고, Vercel이 백엔드로 프록시한다(frontend/vercel.json).
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.PROD ? '' : 'http://localhost:8080')

export const USE_MOCK_API = import.meta.env.VITE_API_MOCK === 'true'

/** 목업 API가 돌려주는 LiveKit 주소. 이 주소면 실제 LiveKit 연결을 건너뛴다. */
export const MOCK_LIVEKIT_URL = 'mock://livekit'
