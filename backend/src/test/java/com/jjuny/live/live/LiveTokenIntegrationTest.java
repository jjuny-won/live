package com.jjuny.live.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.jjuny.live.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

@DisplayName("LiveKit 토큰 권한(grant)")
class LiveTokenIntegrationTest extends IntegrationTest {

    private String ownerToken;
    private long ownerId;
    private long broadcastId;

    @BeforeEach
    void setUp() throws Exception {
        ownerToken = signupAndLogin();
        ownerId = body(mockMvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/members/me"), ownerToken)).andReturn()).get("id").asLong();
        broadcastId = createBroadcast(ownerToken, "토큰 테스트");
    }

    @Test
    @DisplayName("방송 시작: 소유자에게 publish 가능 토큰(identity member-{id}) + LiveKit 방 생성")
    void publisherToken() throws Exception {
        MvcResult result = mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livekitUrl").value("wss://test.livekit.invalid"))
                .andExpect(jsonPath("$.roomName").value("broadcast-" + broadcastId))
                .andReturn();

        JsonNode claims = LiveKitJwt.claims(body(result).get("token").asText());
        assertThat(claims.get("iss").asText()).isEqualTo(LiveKitJwt.API_KEY);
        assertThat(claims.get("sub").asText()).isEqualTo("member-" + ownerId);
        JsonNode video = claims.get("video");
        assertThat(video.get("room").asText()).isEqualTo("broadcast-" + broadcastId);
        assertThat(video.get("roomJoin").asBoolean()).isTrue();
        assertThat(video.get("canPublish").asBoolean()).isTrue();
        assertThat(video.get("canSubscribe").asBoolean()).isTrue();
        assertThat(video.get("canPublishData").asBoolean()).isTrue();
        verify(liveKitGateway).createRoom("broadcast-" + broadcastId);
    }

    @Test
    @DisplayName("비로그인 시청 토큰: canPublish=false, canPublishData=false, identity guest-*, canChat=false")
    void guestViewerToken() throws Exception {
        start();
        MvcResult result = mockMvc.perform(post("/api/broadcasts/{id}/viewer-token", broadcastId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canChat").value(false))
                .andExpect(jsonPath("$.roomName").value("broadcast-" + broadcastId))
                .andReturn();

        JsonNode claims = LiveKitJwt.claims(body(result).get("token").asText());
        assertThat(claims.get("sub").asText()).startsWith("guest-");
        assertThat(claims.get("name").asText()).startsWith("손님-");
        JsonNode video = claims.get("video");
        assertThat(video.get("room").asText()).isEqualTo("broadcast-" + broadcastId);
        assertThat(video.get("canPublish").asBoolean()).isFalse();
        assertThat(video.get("canSubscribe").asBoolean()).isTrue();
        assertThat(video.get("canPublishData").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("로그인 시청 토큰: canPublish=false, canPublishData=true(채팅), canChat=true")
    void memberViewerToken() throws Exception {
        start();
        String viewerToken = testLogin("VIEWER");
        MvcResult result = mockMvc.perform(withToken(post("/api/broadcasts/{id}/viewer-token", broadcastId),
                        viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canChat").value(true))
                .andReturn();

        JsonNode claims = LiveKitJwt.claims(body(result).get("token").asText());
        assertThat(claims.get("sub").asText()).startsWith("member-").isNotEqualTo("member-" + ownerId);
        assertThat(claims.get("name").asText()).isEqualTo("데모시청자");
        JsonNode video = claims.get("video");
        assertThat(video.get("canPublish").asBoolean()).isFalse();
        assertThat(video.get("canSubscribe").asBoolean()).isTrue();
        assertThat(video.get("canPublishData").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("방송 중이 아니면 시청 토큰 409 BROADCAST_NOT_LIVE, 없는 방송 404")
    void viewerTokenRequiresLive() throws Exception {
        mockMvc.perform(post("/api/broadcasts/{id}/viewer-token", broadcastId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BROADCAST_NOT_LIVE"));
        mockMvc.perform(post("/api/broadcasts/{id}/viewer-token", 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BROADCAST_NOT_FOUND"));
    }

    @Test
    @DisplayName("타인은 송출 토큰을 받을 수 없다(403) — LiveKit 방도 만들지 않음")
    void otherCannotGetPublisherToken() throws Exception {
        String other = signupAndLogin();
        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), other))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("BROADCAST_FORBIDDEN"));
        verify(liveKitGateway, never()).createRoom(anyString());
    }

    private void start() throws Exception {
        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), ownerToken))
                .andExpect(status().isOk());
    }
}
