package com.jjuny.live;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jjuny.live.live.LiveKitGateway;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 실제 PostgreSQL(Testcontainers) + 전체 스프링 컨텍스트. LiveKit 서버 API 호출만 목으로 대체. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @MockitoBean
    protected LiveKitGateway liveKitGateway;

    protected String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    protected JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    /** 새 회원 가입 후 로그인 → accessToken. */
    protected String signupAndLogin() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "user-" + suffix + "@test.dev";
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", "password123", "nickname", "u" + suffix))))
                .andExpect(status().isCreated());
        MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn();
        return body(login).get("accessToken").asText();
    }

    protected String testLogin(String role) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/test-login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", role))))
                .andExpect(status().isOk()).andReturn();
        return body(result).get("accessToken").asText();
    }

    /** 방송 생성 → id */
    protected long createBroadcast(String token, String title) throws Exception {
        MvcResult result = mockMvc.perform(withToken(post("/api/broadcasts"), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("title", title, "category", "TALK"))))
                .andExpect(status().isCreated()).andReturn();
        return body(result).get("id").asLong();
    }
}
