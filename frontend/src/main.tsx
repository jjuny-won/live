import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { isApiError } from '@/api/client'
import { App } from '@/App'
import { AuthProvider } from '@/auth/AuthContext'
import { USE_MOCK_API } from '@/config'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // 4xx와 설정 문제(503 LIVEKIT_NOT_CONFIGURED)는 재시도해도 같은 결과
      retry: (count, e) =>
        !(isApiError(e) && ((e.status >= 400 && e.status < 500) || e.code === 'LIVEKIT_NOT_CONFIGURED')) && count < 2,
    },
  },
})

async function enableMocks() {
  if (!USE_MOCK_API) return
  const { enableFetchMock } = await import('@/mocks/browser')
  enableFetchMock()
  console.info('[live] MSW 목업 API 사용 중')
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
