package com.jjuny.live.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "인증 토큰이 유효하지 않거나 만료되었습니다."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    EMAIL_DUPLICATED(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    NICKNAME_DUPLICATED(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."),
    DEMO_DISABLED(HttpStatus.NOT_FOUND, "테스트 로그인이 비활성화되어 있습니다."),
    BROADCAST_NOT_FOUND(HttpStatus.NOT_FOUND, "방송을 찾을 수 없습니다."),
    BROADCAST_FORBIDDEN(HttpStatus.FORBIDDEN, "방송 소유자만 할 수 있습니다."),
    BROADCAST_NOT_LIVE(HttpStatus.CONFLICT, "방송 중이 아닙니다."),
    LIVEKIT_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "미디어 서버(LiveKit) 설정이 없어 방송 토큰을 발급할 수 없습니다."),
    INVALID_WEBHOOK(HttpStatus.UNAUTHORIZED, "웹훅 서명이 올바르지 않습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
