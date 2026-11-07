package com.jjuny.live.auth;

import com.jjuny.live.auth.AuthDtos.DemoRole;
import com.jjuny.live.auth.AuthDtos.IssuedTokens;
import com.jjuny.live.auth.AuthDtos.LoginRequest;
import com.jjuny.live.auth.AuthDtos.LoginResponse;
import com.jjuny.live.auth.AuthDtos.SignupRequest;
import com.jjuny.live.auth.AuthDtos.TestLoginRequest;
import com.jjuny.live.auth.AuthDtos.TokenResponse;
import com.jjuny.live.member.MemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String REFRESH_COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/auth";

    private final AuthService authService;
    private final AuthProperties properties;

    public AuthController(AuthService authService, AuthProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @Operation(summary = "회원가입")
    @PostMapping("/signup")
    public ResponseEntity<MemberResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @Operation(summary = "로그인", description = "Access 토큰은 본문, Refresh 토큰은 HttpOnly 쿠키(refresh_token)로 내려간다.")
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return loginResponse(authService.login(request));
    }

    @Operation(summary = "테스트 계정 로그인", description = "role: STREAMER(기본) | VIEWER. 시드된 데모 계정으로 바로 로그인.")
    @PostMapping("/test-login")
    public ResponseEntity<LoginResponse> testLogin(@RequestBody(required = false) TestLoginRequest request) {
        DemoRole role = request == null || request.role() == null ? DemoRole.STREAMER : request.role();
        return loginResponse(authService.testLogin(role));
    }

    @Operation(summary = "Access 토큰 재발급", description = "refresh_token 쿠키 필요(프론트는 credentials: 'include').")
    @PostMapping("/refresh")
    public TokenResponse refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        return new TokenResponse(authService.refresh(refreshToken));
    }

    @Operation(summary = "로그아웃", description = "Refresh 토큰 폐기 + 쿠키 삭제. Access 토큰이 만료돼도 호출 가능.")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    private ResponseEntity<LoginResponse> loginResponse(IssuedTokens tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshCookie(tokens.refreshToken(), properties.jwt().refreshTokenTtl()).toString())
                .body(new LoginResponse(tokens.accessToken(), tokens.member()));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(properties.cookie().secure())
                .sameSite(properties.cookie().sameSite())
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
