package com.jjuny.live.broadcast;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class BroadcastDtos {

    private BroadcastDtos() {
    }

    public record CreateRequest(
            @NotBlank @Size(max = 100) String title,
            @Size(max = 1000) String description,
            BroadcastCategory category) {
    }

    /** 보낸 필드만 수정. title 을 보내면 공백일 수 없다. */
    public record UpdateRequest(
            @Size(min = 1, max = 100) @Pattern(regexp = ".*\\S.*", message = "공백일 수 없습니다") String title,
            @Size(max = 1000) String description,
            BroadcastCategory category) {
    }

    public record OwnerResponse(Long id, String nickname) {
    }

    public record BroadcastResponse(
            Long id, String title, String description, BroadcastCategory category, String thumbnailUrl,
            BroadcastStatus status, OwnerResponse owner, int viewerCount,
            Instant startedAt, Instant endedAt, Instant createdAt, Instant updatedAt, boolean isOwner) {

        public static BroadcastResponse of(Broadcast b, Long currentMemberId) {
            return new BroadcastResponse(b.getId(), b.getTitle(), b.getDescription(), b.getCategory(),
                    b.getThumbnailUrl(), b.getStatus(),
                    new OwnerResponse(b.getOwner().getId(), b.getOwner().getNickname()),
                    b.getViewerCount(), b.getStartedAt(), b.getEndedAt(), b.getCreatedAt(), b.getUpdatedAt(),
                    b.isOwnedBy(currentMemberId));
        }
    }
}
