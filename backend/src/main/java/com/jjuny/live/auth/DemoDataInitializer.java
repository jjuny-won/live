package com.jjuny.live.auth;

import com.jjuny.live.broadcast.BroadcastCategory;
import com.jjuny.live.broadcast.BroadcastDtos.CreateRequest;
import com.jjuny.live.broadcast.BroadcastRepository;
import com.jjuny.live.broadcast.BroadcastService;
import com.jjuny.live.member.Member;
import com.jjuny.live.member.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 기동 시 데모 계정(streamer/viewer)과 샘플 방송 1개를 만든다(이미 있으면 건너뜀). */
@Component
public class DemoDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    private final AuthProperties properties;
    private final MemberRepository memberRepository;
    private final BroadcastRepository broadcastRepository;
    private final BroadcastService broadcastService;
    private final PasswordEncoder passwordEncoder;

    public DemoDataInitializer(AuthProperties properties, MemberRepository memberRepository,
                               BroadcastRepository broadcastRepository, BroadcastService broadcastService,
                               PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.memberRepository = memberRepository;
        this.broadcastRepository = broadcastRepository;
        this.broadcastService = broadcastService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.demo().enabled()) {
            return;
        }
        for (DemoAccounts account : DemoAccounts.values()) {
            if (!memberRepository.existsByEmail(account.email())) {
                memberRepository.save(new Member(account.email(),
                        passwordEncoder.encode(properties.demo().password()), account.nickname()));
                log.info("데모 계정 생성: {}", account.email());
            }
        }
        if (broadcastRepository.count() == 0) {
            Long streamerId = memberRepository.findByEmail(DemoAccounts.STREAMER.email()).orElseThrow().getId();
            broadcastService.create(streamerId, new CreateRequest("데모 방송", "테스트 계정의 샘플 방송입니다.",
                    BroadcastCategory.TALK));
        }
    }
}
