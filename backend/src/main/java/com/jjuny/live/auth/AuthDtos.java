package com.jjuny.live.auth;

import com.jjuny.live.member.MemberResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 64) String password,
            @NotBlank @Size(min = 2, max = 20) String nickname) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public enum DemoRole { STREAMER, VIEWER }

    public record TestLoginRequest(DemoRole role) {
    }

    public record LoginResponse(String accessToken, MemberResponse member) {
    }

    public record TokenResponse(String accessToken) {
    }

    /** 서비스 → 컨트롤러 전달용(쿠키에 넣을 refresh 원문 포함). */
    public record IssuedTokens(String accessToken, String refreshToken, MemberResponse member) {
    }
}
