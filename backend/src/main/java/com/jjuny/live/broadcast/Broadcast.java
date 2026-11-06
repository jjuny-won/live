package com.jjuny.live.broadcast;

import com.jjuny.live.member.Member;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "broadcast")
@SQLRestriction("deleted_at IS NULL")
public class Broadcast {

    public static final String ROOM_PREFIX = "broadcast-";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private Member owner;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastCategory category;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastStatus status;

    @Column(name = "room_name", unique = true)
    private String roomName;

    @Column(name = "viewer_count", nullable = false)
    private int viewerCount;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Broadcast() {
    }

    public Broadcast(Member owner, String title, String description, BroadcastCategory category) {
        this.owner = owner;
        this.title = title;
        this.description = description;
        this.category = category == null ? BroadcastCategory.ETC : category;
        this.status = BroadcastStatus.READY;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public static String roomNameOf(Long id) {
        return ROOM_PREFIX + id;
    }

    /** 저장 직후(id 생성 후) 호출. */
    void assignRoomName() {
        this.roomName = roomNameOf(id);
    }

    public boolean isOwnedBy(Long memberId) {
        return memberId != null && owner.getId().equals(memberId);
    }

    void update(String title, String description, BroadcastCategory category) {
        if (title != null) {
            this.title = title;
        }
        if (description != null) {
            this.description = description;
        }
        if (category != null) {
            this.category = category;
        }
    }

    /** 방송 시작(재시작 포함). 이미 LIVE면 시작 시각을 유지한다. */
    void goLive() {
        if (status != BroadcastStatus.LIVE) {
            status = BroadcastStatus.LIVE;
            startedAt = Instant.now();
            endedAt = null;
            viewerCount = 0;
        }
    }

    void end() {
        if (status != BroadcastStatus.ENDED) {
            status = BroadcastStatus.ENDED;
            endedAt = Instant.now();
        }
        viewerCount = 0;
    }

    void softDelete() {
        this.deletedAt = Instant.now();
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Member getOwner() {
        return owner;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public BroadcastCategory getCategory() {
        return category;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public BroadcastStatus getStatus() {
        return status;
    }

    public String getRoomName() {
        return roomName;
    }

    public int getViewerCount() {
        return viewerCount;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
