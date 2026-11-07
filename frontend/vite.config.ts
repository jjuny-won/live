import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // livekit-client 청크(~580kB)는 시청·스튜디오 진입 시에만 로드
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    // 휴대폰 실기기 테스트 시 cloudflared/ngrok 터널 호스트 허용
    allowedHosts: true,
  },
})
