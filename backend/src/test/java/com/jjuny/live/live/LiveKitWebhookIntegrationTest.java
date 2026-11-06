package com.jjuny.live.live;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.google.protobuf.util.JsonFormat;
import com.jjuny.live.IntegrationTest;
import io.livekit.server.AccessToken;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import livekit.LivekitModels.ParticipantInfo;
import livekit.LivekitModels.Room;
import livekit.LivekitWebhook.WebhookEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.ResultActions;

@DisplayName("LiveKit 웹훅")
class LiveKitWebhookIntegrationTest extends IntegrationTest {

    private String ownerToken;
    private long ownerId;
    private long broadcastId;
    private String room;

    @BeforeEach
    void setUp() throws Exception {
        ownerToken = signupAndLogin();
        ownerId = body(mockMvc.perform(withToken(get("/api/members/me"), ownerToken)).andReturn()).get("id").asLong();
        broadcastId = createBroadcast(ownerToken, "웹훅 테스트");
        room = "broadcast-" + broadcastId;
    }

    @Test
    @DisplayName("participant_joined/left 는 방송자를 빼고 viewerCount 반영, room_finished 는 ENDED")
    void viewerCountAndFinish() throws Exception {
        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), ownerToken))
                .andExpect(status().isOk());

        send(event("participant_joined", "member-" + ownerId)).andExpect(status().isOk());
        send(event("participant_joined", "guest-aaa")).andExpect(status().isOk());
        send(event("participant_joined", "member-77-abcd1234")).andExpect(status().isOk());
        expectViewerCount(2);

        send(event("participant_left", "guest-aaa")).andExpect(status().isOk());
        send(event("participant_left", "member-" + ownerId)).andExpect(status().isOk());
        expectViewerCount(1);

        send(event("room_finished", null)).andExpect(status().isOk());
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(jsonPath("$.status").value("ENDED"))
                .andExpect(jsonPath("$.viewerCount").value(0))
                .andExpect(jsonPath("$.endedAt").isString());
    }

    @Test
    @DisplayName("room_started 는 READY 방송을 LIVE 로")
    void roomStarted() throws Exception {
        send(event("room_started", null)).andExpect(status().isOk());
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(jsonPath("$.status").value("LIVE"));
    }

    @Test
    @DisplayName("서명이 틀리거나 본문이 바뀌면 401 INVALID_WEBHOOK, 상태 변화 없음")
    void invalidSignature() throws Exception {
        String body = event("room_started", null);
        mockMvc.perform(post("/api/livekit/webhook").contentType("application/webhook+json").content(body)
                        .header(HttpHeaders.AUTHORIZATION, sign(body, "wrong-secret-0123456789abcdef0123456789")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_WEBHOOK"));

        String tampered = event("room_finished", null);
        mockMvc.perform(post("/api/livekit/webhook").contentType("application/webhook+json").content(tampered)
                        .header(HttpHeaders.AUTHORIZATION, sign(body, LiveKitJwt.API_SECRET)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/livekit/webhook").contentType("application/webhook+json").content(body))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    @DisplayName("broadcast-* 가 아닌 방 이벤트는 무시(200)")
    void unknownRoomIgnored() throws Exception {
        String body = JsonFormat.printer().print(WebhookEvent.newBuilder().setEvent("room_started")
                .setId("EV_x").setRoom(Room.newBuilder().setName("other-room")).build());
        send(body).andExpect(status().isOk());
    }

    private void expectViewerCount(int expected) throws Exception {
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(jsonPath("$.viewerCount").value(expected));
    }

    private String event(String type, String identity) throws Exception {
        WebhookEvent.Builder builder = WebhookEvent.newBuilder()
                .setEvent(type)
                .setId("EV_" + System.nanoTime())
                .setCreatedAt(System.currentTimeMillis() / 1000)
                .setRoom(Room.newBuilder().setName(room).setSid("RM_test"));
        if (identity != null) {
            builder.setParticipant(ParticipantInfo.newBuilder().setIdentity(identity).setSid("PA_" + identity));
        }
        return JsonFormat.printer().print(builder.build());
    }

    private ResultActions send(String body) throws Exception {
        return mockMvc.perform(post("/api/livekit/webhook")
                .contentType("application/webhook+json")
                .content(body)
                .header(HttpHeaders.AUTHORIZATION, sign(body, LiveKitJwt.API_SECRET)));
    }

    /** LiveKit 서버가 보내는 것과 같은 형식: sha256(body) 를 담은 JWT(iss=apiKey). */
    private static String sign(String body, String secret) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
        AccessToken token = new AccessToken(LiveKitJwt.API_KEY, secret);
        token.setSha256(Base64.getEncoder().encodeToString(digest));
        return token.toJwt();
    }
}
