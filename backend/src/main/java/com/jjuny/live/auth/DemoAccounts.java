package com.jjuny.live.auth;

import com.jjuny.live.auth.AuthDtos.DemoRole;

/** 테스트 로그인용 시드 계정(README 공개용). */
public enum DemoAccounts {
    STREAMER(DemoRole.STREAMER, "streamer@demo.test", "데모방송자"),
    VIEWER(DemoRole.VIEWER, "viewer@demo.test", "데모시청자");

    private final DemoRole role;
    private final String email;
    private final String nickname;

    DemoAccounts(DemoRole role, String email, String nickname) {
        this.role = role;
        this.email = email;
        this.nickname = nickname;
    }

    public static DemoAccounts of(DemoRole role) {
        return role == DemoRole.VIEWER ? VIEWER : STREAMER;
    }

    public DemoRole role() {
        return role;
    }

    public String email() {
        return email;
    }

    public String nickname() {
        return nickname;
    }
}
