// PC/모바일 스튜디오 판별과 브라우저별 안내에 쓰는 환경 감지

export type StudioMode = 'pc' | 'mobile'

export function canShareScreen() {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

export function canUseCamera() {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** 주 입력이 터치(손가락)이고 정밀 포인터(마우스)가 없는 기기 */
export function isCoarsePointer() {
  if (typeof matchMedia === 'undefined') return false
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches
}

/** getDisplayMedia가 있고 마우스 기기면 PC 스튜디오, 아니면 모바일 스튜디오 */
export function detectStudioMode(): StudioMode {
  return canShareScreen() && !isCoarsePointer() ? 'pc' : 'mobile'
}

export function browserInfo() {
  const ua = navigator.userAgent
  const isFirefox = /Firefox\//.test(ua)
  const isEdge = /Edg\//.test(ua)
  const isChromium = /Chrome\/|CriOS\//.test(ua) && !isFirefox
  const isSafari = /Safari\//.test(ua) && !isChromium && !isFirefox
  const isMac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)
  const isWindows = /Windows/.test(ua)
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)
  const chromeVersion = Number(ua.match(/Chrome\/(\d+)/)?.[1] ?? 0)
  // 카카오톡·인스타그램·페이스북·라인·네이버 앱 내 브라우저
  const isInAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp/.test(ua)
  return { isFirefox, isEdge, isChromium, isSafari, isMac, isWindows, isIOS, isAndroid, chromeVersion, isInAppBrowser }
}

/** getUserMedia/getDisplayMedia 에러 → 사용자 안내 문구 */
export function mediaErrorMessage(e: unknown, kind: 'camera' | 'mic' | 'screen' | 'camera+mic'): string {
  const name = (e as { name?: string })?.name
  const what = { camera: '카메라', mic: '마이크', screen: '화면 공유', 'camera+mic': '카메라·마이크' }[kind]
  if (typeof window !== 'undefined' && !window.isSecureContext)
    return `${what}는 HTTPS(또는 localhost)에서만 사용할 수 있습니다. 휴대폰 테스트는 HTTPS 터널 주소로 접속해 주세요.`
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return kind === 'screen'
        ? '화면 공유 권한이 거부되었습니다. macOS라면 시스템 설정 → 개인정보 보호 및 보안 → 화면 및 시스템 오디오 녹음에서 브라우저를 허용해 주세요.'
        : `${what} 권한이 거부되었습니다. 주소창 왼쪽의 자물쇠(또는 aA) 아이콘 → 사이트 설정에서 ${what} 권한을 허용한 뒤 새로고침해 주세요.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `사용할 수 있는 ${what} 장치를 찾지 못했습니다.`
    case 'NotReadableError':
    case 'AbortError':
      return `${what} 장치를 다른 앱이 사용 중이거나 열 수 없습니다. 다른 앱을 종료한 뒤 다시 시도해 주세요.`
    default:
      return `${what}를 시작하지 못했습니다. (${(e as Error)?.message ?? '알 수 없는 오류'})`
  }
}

/** 사용자가 공유 선택 창에서 '취소'를 누른 경우 */
export function isUserCancelled(e: unknown) {
  const name = (e as { name?: string })?.name
  const msg = String((e as Error)?.message ?? '')
  return name === 'NotAllowedError' && /Permission denied by user|cancel/i.test(msg)
}
