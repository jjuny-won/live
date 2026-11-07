package com.jjuny.live.auth;

import com.jjuny.live.auth.AuthDtos.DemoRole;
import com.jjuny.live.auth.AuthDtos.IssuedTokens;
import com.jjuny.live.auth.AuthDtos.LoginRequest;
import com.jjuny.live.auth.AuthDtos.SignupRequest;
import com.jjuny.live.common.BusinessException;
import com.jjuny.live.common.ErrorCode;
import com.jjuny.live.member.Member;
import com.jjuny.live.member.MemberRepository;
import com.jjuny.live.member.MemberResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final MemberRepository memberRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final AuthProperties properties;

    public AuthService(MemberRepository memberRepository, RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder, JwtProvider jwtProvider, AuthProperties properties) {
        this.memberRepository = memberRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.properties = properties;
    }

    @Transactional
    public MemberResponse signup(SignupRequest request) {
        String email = normalize(request.email());
        String nickname = request.nickname().trim();
        if (memberRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.EMAIL_DUPLICATED);
        }
        if (memberRepository.existsByNickname(nickname)) {
            throw new BusinessException(ErrorCode.NICKNAME_DUPLICATED);
        }
        Member member = memberRepository.save(new Member(email, passwordEncoder.encode(request.password()), nickname));
        return MemberResponse.from(member);
    }

    @Transactional
    public IssuedTokens login(LoginRequest request) {
        Member member = memberRepository.findByEmail(normalize(request.email()))
                .filter(m -> passwordEncoder.matches(request.password(), m.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
        return issue(member);
    }

    @Transactional
    public IssuedTokens testLogin(DemoRole role) {
        if (!properties.demo().enabled()) {
            throw new BusinessException(ErrorCode.DEMO_DISABLED);
        }
        DemoAccounts account = DemoAccounts.of(role);
        Member member = memberRepository.findByEmail(account.email())
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        return issue(member);
    }

    @Transactional(readOnly = true)
    public String refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash(refreshToken))
                .filter(t -> !t.isExpired(Instant.now()))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN));
        if (!memberRepository.existsById(stored.getMemberId())) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        return jwtProvider.createAccessToken(stored.getMemberId());
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenRepository.deleteByTokenHash(hash(refreshToken));
        }
    }

    private IssuedTokens issue(Member member) {
        Instant now = Instant.now();
        refreshTokenRepository.deleteExpired(member.getId(), now);
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String refreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        refreshTokenRepository.save(new RefreshToken(member.getId(), hash(refreshToken),
                now.plus(properties.jwt().refreshTokenTtl())));
        return new IssuedTokens(jwtProvider.createAccessToken(member.getId()), refreshToken, MemberResponse.from(member));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase();
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
