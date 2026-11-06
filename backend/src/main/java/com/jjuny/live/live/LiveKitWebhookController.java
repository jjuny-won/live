package com.jjuny.live.live;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** LiveKit 이 호출(Content-Type: application/webhook+json). 사용자 JWT 필터 대상 아님. */
@Hidden
@RestController
@RequestMapping("/api/livekit")
public class LiveKitWebhookController {

    private final LiveKitWebhookService webhookService;

    public LiveKitWebhookController(LiveKitWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping(value = "/webhook", consumes = "*/*")
    public ResponseEntity<Void> webhook(@RequestBody String body,
                                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false)
                                        String authorization) {
        webhookService.handle(body, authorization);
        return ResponseEntity.ok().build();
    }
}
