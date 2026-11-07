package com.jjuny.live.live;

import io.livekit.server.RoomServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LiveKitRoomGateway implements LiveKitGateway {

    private static final Logger log = LoggerFactory.getLogger(LiveKitRoomGateway.class);
    /** 마지막 참가자가 나간 뒤 방 유지 시간(초). 방송자가 새로고침해도 방이 바로 닫히지 않게. */
    private static final int DEPARTURE_TIMEOUT_SECONDS = 60;

    private final LiveKitProperties properties;
    private volatile RoomServiceClient client;

    public LiveKitRoomGateway(LiveKitProperties properties) {
        this.properties = properties;
    }

    @Override
    public void createRoom(String roomName) {
        RoomServiceClient c = client();
        if (c == null) {
            return;
        }
        try {
            c.createRoom(roomName, properties.emptyTimeoutSeconds(), null, null, null, null, null, null,
                    DEPARTURE_TIMEOUT_SECONDS).execute();
        } catch (Exception e) {
            log.warn("LiveKit 방 생성 실패(입장 시 자동 생성됨): room={}, error={}", roomName, e.toString());
        }
    }

    @Override
    public void deleteRoom(String roomName) {
        RoomServiceClient c = client();
        if (c == null) {
            return;
        }
        try {
            c.deleteRoom(roomName).execute();
        } catch (Exception e) {
            log.warn("LiveKit 방 삭제 실패: room={}, error={}", roomName, e.toString());
        }
    }

    private RoomServiceClient client() {
        if (!properties.isConfigured()) {
            return null;
        }
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = RoomServiceClient.createClient(properties.apiHost(), properties.apiKey(),
                            properties.apiSecret());
                }
            }
        }
        return client;
    }
}
