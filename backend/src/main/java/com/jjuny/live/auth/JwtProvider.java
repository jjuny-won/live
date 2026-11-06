package com.jjuny.live.auth;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Access JWT(HS256) 발급·검증. subject = 회원 id. */
@Component
public class JwtProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtProvider.class);
    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey key;
    private final AuthProperties.Jwt props;

    public JwtProvider(AuthProperties properties) {
        this.props = properties.jwt();
        String secret = props.secret();
        if (secret == null || secret.isBlank()) {
            byte[] random = new byte[48];
            new SecureRandom().nextBytes(random);
            this.key = Keys.hmacShaKeyFor(random);
            log.warn("JWT_SECRET 이 비어 있어 임의 키를 생성했습니다. 서버를 재시작하면 기존 Access 토큰은 무효가 됩니다.");
        } else {
            byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < MIN_SECRET_BYTES) {
                throw new IllegalStateException("JWT_SECRET 은 32바이트 이상이어야 합니다.");
            }
            this.key = Keys.hmacShaKeyFor(bytes);
        }
    }

    public String createAccessToken(Long memberId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.accessTokenTtl())))
                .signWith(key)
                .compact();
    }

    /** 유효하면 회원 id, 서명 불일치·만료·형식 오류면 empty. */
    public Optional<Long> parseMemberId(String token) {
        try {
            String subject = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload().getSubject();
            return Optional.of(Long.parseLong(subject));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
