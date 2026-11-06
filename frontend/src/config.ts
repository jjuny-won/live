export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080'

export const USE_MOCK_API = import.meta.env.VITE_API_MOCK === 'true'

/** 목업 API가 돌려주는 LiveKit 주소. 이 주소면 실제 LiveKit 연결을 건너뛴다. */
export const MOCK_LIVEKIT_URL = 'mock://livekit'
