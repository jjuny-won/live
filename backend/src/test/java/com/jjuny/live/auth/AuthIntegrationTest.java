package com.jjuny.live.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jjuny.live.IntegrationTest;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

@DisplayName("인증 흐름")
class AuthIntegrationTest extends IntegrationTest {

    @Test
    @DisplayName("회원가입 → 로그인(Refresh 쿠키) → 내 정보 → refresh → 로그아웃 → refresh 거부")
    void fullFlow() throws Exception {
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "Flow@Test.dev", "password", "password123", "nickname", "흐름"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.email").value("flow@test.dev"))
                .andExpect(jsonPath("$.nickname").value("흐름"))
                .andExpect(jsonPath("$.password").doesNotExist());

        MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "flow@test.dev", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.member.email").value("flow@test.dev"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(cookie().path("refresh_token", "/api/auth"))
                .andExpect(cookie().maxAge("refresh_token", 14 * 24 * 3600))
                .andReturn();
        String accessToken = body(login).get("accessToken").asText();
        Cookie refresh = login.getResponse().getCookie("refresh_token");
        assertThat(refresh).isNotNull();

        mockMvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("flow@test.dev"))
                .andExpect(jsonPath("$.nickname").value("흐름"));

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString());

        mockMvc.perform(post("/api/auth/logout").cookie(refresh))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("refresh_token", 0));

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("이메일 중복 409, 잘못된 비밀번호 401, 검증 실패 400")
    void signupAndLoginErrors() throws Exception {
        String body = json(Map.of("email", "dup@test.dev", "password", "password123", "nickname", "중복"));
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_DUPLICATED"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "dup@test.dev", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "not-an-email", "password", "short", "nickname", "x"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("테스트 로그인: 기본 STREAMER, VIEWER 선택 가능, 데모 비밀번호로 일반 로그인도 가능")
    void testLogin() throws Exception {
        mockMvc.perform(post("/api/auth/test-login"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member.email").value("streamer@demo.test"))
                .andExpect(header().exists(HttpHeaders.SET_COOKIE));

        mockMvc.perform(post("/api/auth/test-login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "VIEWER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member.email").value("viewer@demo.test"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "viewer@demo.test", "password", "demo-test-pw"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("토큰 없이 내 정보 401 UNAUTHORIZED, 잘못된 토큰 401 INVALID_TOKEN")
    void unauthorized() throws Exception {
        mockMvc.perform(get("/api/members/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.status").value(401));

        mockMvc.perform(get("/api/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }
}
