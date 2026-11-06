package com.jjuny.live.live;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** 테스트: LiveKit 접속 토큰을 테스트 시크릿으로 서명 검증하고 claims 를 JSON 으로 돌려준다. */
final class LiveKitJwt {

    static final String API_KEY = "test-api-key";
    static final String API_SECRET = "test-api-secret-0123456789abcdef0123456789";

    private LiveKitJwt() {
    }

    static JsonNode claims(String token) {
        Map<String, Object> payload = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(API_SECRET.getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(token).getPayload();
        return new ObjectMapper().valueToTree(payload);
    }
}
