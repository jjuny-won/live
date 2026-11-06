package com.jjuny.live.common;

/** 모든 에러 응답 형식: {@code {code, message, status}} (docs/API.md). */
public record ErrorResponse(String code, String message, int status) {

    public static ErrorResponse of(ErrorCode code) {
        return of(code, code.defaultMessage());
    }

    public static ErrorResponse of(ErrorCode code, String message) {
        return new ErrorResponse(code.name(), message, code.status().value());
    }
}
