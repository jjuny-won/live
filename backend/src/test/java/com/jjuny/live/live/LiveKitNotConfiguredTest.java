package com.jjuny.live.live;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jjuny.live.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

@DisplayName("LiveKit 키 미설정")
@TestPropertySource(properties = {"livekit.url=", "livekit.api-key=", "livekit.api-secret="})
class LiveKitNotConfiguredTest extends IntegrationTest {

    @Test
    @DisplayName("토큰 발급·웹훅만 503 LIVEKIT_NOT_CONFIGURED, 방송 CRUD 는 정상이고 상태도 바뀌지 않는다")
    void onlyTokenApisFail() throws Exception {
        String token = testLogin("STREAMER");
        long id = createBroadcast(token, "키 없는 방송");

        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", id), token))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LIVEKIT_NOT_CONFIGURED"))
                .andExpect(jsonPath("$.status").value(503));
        mockMvc.perform(get("/api/broadcasts/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
        mockMvc.perform(post("/api/broadcasts/{id}/viewer-token", id))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LIVEKIT_NOT_CONFIGURED"));
        mockMvc.perform(post("/api/livekit/webhook").contentType(MediaType.APPLICATION_JSON).content("{}")
                        .header("Authorization", "x"))
                .andExpect(status().isServiceUnavailable());
    }
}
