package com.jjuny.live.live;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("livekit")
public record LiveKitProperties(String url, String apiKey, String apiSecret, Duration tokenTtl,
                                int emptyTimeoutSeconds) {

    public boolean isConfigured() {
        return notBlank(url) && notBlank(apiKey) && notBlank(apiSecret);
    }

    /** 클라이언트용 wss:// URL → 서버 API용 https:// 호스트. */
    public String apiHost() {
        return url.trim().replaceFirst("^wss://", "https://").replaceFirst("^ws://", "http://");
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
