package com.jjuny.live.live;

import com.jjuny.live.broadcast.BroadcastLiveStateUpdater;
import com.jjuny.live.common.BusinessException;
import com.jjuny.live.common.ErrorCode;
import io.livekit.server.WebhookReceiver;
import livekit.LivekitWebhook.WebhookEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * LiveKit 웹훅: 서명(Authorization JWT + 본문 sha256) 검증 후 방송 상태·시청자 수 반영.
 * room_started → LIVE, room_finished → ENDED, participant_joined/left → viewerCount(방송자 제외).
 */
@Service
public class LiveKitWebhookService {

    private static final Logger log = LoggerFactory.getLogger(LiveKitWebhookService.class);

    private final LiveKitProperties properties;
    private final BroadcastLiveStateUpdater stateUpdater;
    private volatile WebhookReceiver receiver;

    public LiveKitWebhookService(LiveKitProperties properties, BroadcastLiveStateUpdater stateUpdater) {
        this.properties = properties;
        this.stateUpdater = stateUpdater;
    }

    public void handle(String body, String authorization) {
        WebhookEvent event = verify(body, authorization);
        String roomName = event.hasRoom() ? event.getRoom().getName() : "";
        String identity = event.hasParticipant() ? event.getParticipant().getIdentity() : "";
        log.info("LiveKit 웹훅: event={}, room={}, participant={}", event.getEvent(), roomName, identity);
        switch (event.getEvent()) {
            case "room_started" -> stateUpdater.roomStarted(roomName);
            case "room_finished" -> stateUpdater.roomFinished(roomName);
            case "participant_joined" -> stateUpdater.participantJoined(roomName, identity);
            case "participant_left" -> stateUpdater.participantLeft(roomName, identity);
            default -> { /* track_published, egress_* 등은 아직 처리하지 않음 */ }
        }
    }

    private WebhookEvent verify(String body, String authorization) {
        if (!properties.isConfigured()) {
            throw new BusinessException(ErrorCode.LIVEKIT_NOT_CONFIGURED);
        }
        if (authorization == null || authorization.isBlank() || body == null) {
            throw new BusinessException(ErrorCode.INVALID_WEBHOOK);
        }
        try {
            return receiver().receive(body, authorization);
        } catch (Exception e) {
            log.warn("LiveKit 웹훅 서명 검증 실패: {}", e.toString());
            throw new BusinessException(ErrorCode.INVALID_WEBHOOK);
        }
    }

    private WebhookReceiver receiver() {
        if (receiver == null) {
            synchronized (this) {
                if (receiver == null) {
                    receiver = new WebhookReceiver(properties.apiKey(), properties.apiSecret());
                }
            }
        }
        return receiver;
    }
}
