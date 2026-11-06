package com.jjuny.live.broadcast;

import com.jjuny.live.auth.AuthMember;
import com.jjuny.live.broadcast.BroadcastDtos.BroadcastResponse;
import com.jjuny.live.broadcast.BroadcastDtos.CreateRequest;
import com.jjuny.live.broadcast.BroadcastDtos.UpdateRequest;
import com.jjuny.live.common.PageResponse;
import com.jjuny.live.live.LiveDtos.PublisherTokenResponse;
import com.jjuny.live.live.LiveDtos.ViewerTokenResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "방송")
@RestController
@RequestMapping("/api/broadcasts")
public class BroadcastController {

    private final BroadcastService broadcastService;

    public BroadcastController(BroadcastService broadcastService) {
        this.broadcastService = broadcastService;
    }

    @Operation(summary = "방송 목록", description = "공개. LIVE 우선, 최신순. status 생략 시 전체.")
    @GetMapping
    public PageResponse<BroadcastResponse> list(@RequestParam(required = false) BroadcastStatus status,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size,
                                                @AuthenticationPrincipal AuthMember me) {
        return broadcastService.list(status, page, size, idOf(me));
    }

    @Operation(summary = "내 방송 목록")
    @GetMapping("/me")
    public PageResponse<BroadcastResponse> mine(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size,
                                                @AuthenticationPrincipal AuthMember me) {
        return broadcastService.listMine(me.id(), page, size);
    }

    @Operation(summary = "방송 상세", description = "공개")
    @GetMapping("/{id}")
    public BroadcastResponse get(@PathVariable Long id, @AuthenticationPrincipal AuthMember me) {
        return broadcastService.get(id, idOf(me));
    }

    @Operation(summary = "방송 등록")
    @PostMapping
    public ResponseEntity<BroadcastResponse> create(@Valid @RequestBody CreateRequest request,
                                                    @AuthenticationPrincipal AuthMember me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(broadcastService.create(me.id(), request));
    }

    @Operation(summary = "방송 수정(소유자)", description = "보낸 필드만 수정. 소유자가 아니면 403 BROADCAST_FORBIDDEN")
    @PatchMapping("/{id}")
    public BroadcastResponse update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request,
                                    @AuthenticationPrincipal AuthMember me) {
        return broadcastService.update(id, me.id(), request);
    }

    @Operation(summary = "방송 삭제(소유자)", description = "LIVE 면 LiveKit 방을 닫고 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal AuthMember me) {
        broadcastService.delete(id, me.id());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "방송 시작(소유자)", description = "상태 LIVE + 송출(publish) 토큰. LiveKit 미설정이면 503")
    @PostMapping("/{id}/start")
    public PublisherTokenResponse start(@PathVariable Long id, @AuthenticationPrincipal AuthMember me) {
        return broadcastService.start(id, me.id());
    }

    @Operation(summary = "방송 종료(소유자)")
    @PostMapping("/{id}/end")
    public BroadcastResponse end(@PathVariable Long id, @AuthenticationPrincipal AuthMember me) {
        return broadcastService.end(id, me.id());
    }

    @Operation(summary = "시청 토큰", description = "공개(비로그인 게스트 가능). 로그인 시 canChat=true. LIVE 가 아니면 409")
    @PostMapping("/{id}/viewer-token")
    public ViewerTokenResponse viewerToken(@PathVariable Long id, @AuthenticationPrincipal AuthMember me) {
        return broadcastService.viewerToken(id, idOf(me));
    }

    private static Long idOf(AuthMember me) {
        return me == null ? null : me.id();
    }
}
