package com.jjuny.live.auth;

/** 인증된 요청의 principal. 컨트롤러에서 {@code @AuthenticationPrincipal AuthMember} 로 받는다. */
public record AuthMember(Long id) {
}
