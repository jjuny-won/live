package com.jjuny.live.auth;

import com.jjuny.live.common.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * {@code Authorization: Bearer <jwt>} 가 있으면 검증해 인증 정보를 넣는다.
 * 헤더가 없으면 비로그인으로 통과, 헤더가 있는데 유효하지 않으면 공개 API여도 401(INVALID_TOKEN)
 * → 프론트는 401 을 받으면 refresh 후 재시도하면 된다.
 * /api/auth/** 와 LiveKit 웹훅(자체 Authorization 헤더 사용)은 검사하지 않는다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;
    private final SecurityErrorWriter errorWriter;

    public JwtAuthenticationFilter(JwtProvider jwtProvider, SecurityErrorWriter errorWriter) {
        this.jwtProvider = jwtProvider;
        this.errorWriter = errorWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/") || path.startsWith("/api/livekit/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(PREFIX)) {
            chain.doFilter(request, response);
            return;
        }
        Optional<Long> memberId = jwtProvider.parseMemberId(header.substring(PREFIX.length()).trim());
        if (memberId.isEmpty()) {
            errorWriter.write(response, ErrorCode.INVALID_TOKEN);
            return;
        }
        var authentication = new UsernamePasswordAuthenticationToken(
                new AuthMember(memberId.get()), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        chain.doFilter(request, response);
    }
}
