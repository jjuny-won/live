package com.jjuny.live.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AuthProperties(Jwt jwt, Cookie cookie, Cors cors, Demo demo) {

    public record Jwt(String secret, Duration accessTokenTtl, Duration refreshTokenTtl) {
    }

    public record Cookie(boolean secure, String sameSite) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Demo(boolean enabled, String password) {
    }
}
