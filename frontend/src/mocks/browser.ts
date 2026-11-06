import { getResponse } from 'msw'
import { API_BASE_URL } from '@/config'
import { handlers } from './handlers'

/**
 * MSW 핸들러로 API 요청에 응답한다.
 * Service Worker 대신 window.fetch를 감싸서, SW가 막힌 환경(앱 내 브라우저, HTTP 터널, 임베디드 브라우저)에서도 동작.
 * 실제 API로 전환: VITE_API_MOCK=false (기본값)
 */
export function enableFetchMock() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    if (!request.url.startsWith(API_BASE_URL)) return realFetch(input, init)
    const response = await getResponse(handlers, request)
    if (response) return response
    console.warn('[mock] 처리되지 않은 요청', request.method, request.url)
    return new Response(JSON.stringify({ code: 'MOCK_NOT_FOUND', message: '목업에 없는 API입니다.', status: 404 }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
