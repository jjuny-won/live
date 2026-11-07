package com.jjuny.live.broadcast;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jjuny.live.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

@DisplayName("방송 CRUD · 소유자 권한")
class BroadcastAuthorizationTest extends IntegrationTest {

    private String ownerToken;
    private String otherToken;
    private long broadcastId;

    @BeforeEach
    void setUp() throws Exception {
        ownerToken = signupAndLogin();
        otherToken = signupAndLogin();
        broadcastId = createBroadcast(ownerToken, "소유자 방송");
    }

    @Test
    @DisplayName("소유자는 조회·수정·시작·종료·삭제 가능")
    void ownerCanManage() throws Exception {
        mockMvc.perform(withToken(get("/api/broadcasts/{id}", broadcastId), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("소유자 방송"))
                .andExpect(jsonPath("$.category").value("TALK"))
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.viewerCount").value(0))
                .andExpect(jsonPath("$.owner.nickname").isString())
                .andExpect(jsonPath("$.isOwner").value(true));

        mockMvc.perform(withToken(patch("/api/broadcasts/{id}", broadcastId), ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("title", "바뀐 제목", "category", "GAME"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("바뀐 제목"))
                .andExpect(jsonPath("$.category").value("GAME"));

        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomName").value("broadcast-" + broadcastId));
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(jsonPath("$.status").value("LIVE"))
                .andExpect(jsonPath("$.startedAt").isString())
                .andExpect(jsonPath("$.isOwner").value(false));

        mockMvc.perform(withToken(post("/api/broadcasts/{id}/end", broadcastId), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"))
                .andExpect(jsonPath("$.endedAt").isString());

        mockMvc.perform(withToken(delete("/api/broadcasts/{id}", broadcastId), ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BROADCAST_NOT_FOUND"));
    }

    @Test
    @DisplayName("타인은 수정·삭제·시작·종료 시 403 BROADCAST_FORBIDDEN")
    void otherMemberIsForbidden() throws Exception {
        expectForbidden(mockMvc.perform(withToken(patch("/api/broadcasts/{id}", broadcastId), otherToken)
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("title", "탈취")))));
        expectForbidden(mockMvc.perform(withToken(delete("/api/broadcasts/{id}", broadcastId), otherToken)));
        expectForbidden(mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", broadcastId), otherToken)));
        expectForbidden(mockMvc.perform(withToken(post("/api/broadcasts/{id}/end", broadcastId), otherToken)));

        // 변경되지 않았는지 확인
        mockMvc.perform(withToken(get("/api/broadcasts/{id}", broadcastId), otherToken))
                .andExpect(jsonPath("$.title").value("소유자 방송"))
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.isOwner").value(false));
    }

    @Test
    @DisplayName("비로그인은 등록·수정 시 401, 목록·상세 조회는 가능")
    void anonymous() throws Exception {
        mockMvc.perform(post("/api/broadcasts").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("title", "익명"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(patch("/api/broadcasts/{id}", broadcastId).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("title", "익명"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/broadcasts").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andExpect(jsonPath("$.hasNext").isBoolean());
        mockMvc.perform(get("/api/broadcasts/{id}", broadcastId)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("목록은 LIVE 우선, status 필터와 내 방송 목록")
    void listing() throws Exception {
        long live = createBroadcast(ownerToken, "라이브 중");
        mockMvc.perform(withToken(post("/api/broadcasts/{id}/start", live), ownerToken)).andExpect(status().isOk());
        createBroadcast(ownerToken, "가장 최근 READY");

        mockMvc.perform(get("/api/broadcasts"))
                .andExpect(jsonPath("$.content[0].status").value("LIVE"));
        mockMvc.perform(get("/api/broadcasts").param("status", "READY"))
                .andExpect(jsonPath("$.content[0].title").value("가장 최근 READY"));
        mockMvc.perform(withToken(get("/api/broadcasts/me"), otherToken))
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(withToken(get("/api/broadcasts/me"), ownerToken))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].id").value(live));
    }

    @Test
    @DisplayName("제목 없이 등록하면 400")
    void validation() throws Exception {
        mockMvc.perform(withToken(post("/api/broadcasts"), ownerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("title", " "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private static void expectForbidden(ResultActions actions) throws Exception {
        actions.andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("BROADCAST_FORBIDDEN"))
                .andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.status").value(403));
    }
}
