import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { RequireAuth } from '@/components/RequireAuth'
import { BroadcastFormPage } from '@/pages/BroadcastFormPage'
import { EndedPage } from '@/pages/EndedPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MyBroadcastsPage } from '@/pages/MyBroadcastsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SignupPage } from '@/pages/SignupPage'
import { Spinner } from '@/components/Spinner'

// LiveKit SDK가 큰 편이라 송출·시청 화면은 따로 로드
const StudioPage = lazy(() => import('@/pages/StudioPage').then((m) => ({ default: m.StudioPage })))
const WatchPage = lazy(() => import('@/pages/WatchPage').then((m) => ({ default: m.WatchPage })))

export function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-dvh" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="live/:id" element={<WatchPage />} />
          <Route path="live/:id/ended" element={<EndedPage />} />
          <Route element={<RequireAuth />}>
            <Route path="broadcasts/new" element={<BroadcastFormPage mode="create" />} />
            <Route path="broadcasts/:id/edit" element={<BroadcastFormPage mode="edit" />} />
            <Route path="me/broadcasts" element={<MyBroadcastsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {/* 스튜디오는 전체 화면 레이아웃 */}
        <Route element={<RequireAuth />}>
          <Route path="studio/:id" element={<StudioPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
