package com.jjuny.live.broadcast;

import com.jjuny.live.live.LiveTokenService;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** LiveKit 웹훅 이벤트를 방송 상태에 반영. 알 수 없는 방(broadcast-* 아님)은 무시. */
@Service
public class BroadcastLiveStateUpdater {

    private final BroadcastRepository broadcastRepository;

    public BroadcastLiveStateUpdater(BroadcastRepository broadcastRepository) {
        this.broadcastRepository = broadcastRepository;
    }

    @Transactional
    public void roomStarted(String roomName) {
        find(roomName).filter(b -> b.getStatus() == BroadcastStatus.READY).ifPresent(Broadcast::goLive);
    }

    @Transactional
    public void roomFinished(String roomName) {
        find(roomName).filter(b -> b.getStatus() == BroadcastStatus.LIVE).ifPresent(Broadcast::end);
    }

    @Transactional
    public void participantJoined(String roomName, String identity) {
        find(roomName).filter(b -> isViewer(b, identity))
                .ifPresent(b -> broadcastRepository.incrementViewerCount(b.getId()));
    }

    @Transactional
    public void participantLeft(String roomName, String identity) {
        find(roomName).filter(b -> isViewer(b, identity))
                .ifPresent(b -> broadcastRepository.decrementViewerCount(b.getId()));
    }

    private static boolean isViewer(Broadcast b, String identity) {
        return b.getStatus() == BroadcastStatus.LIVE
                && identity != null && !identity.isBlank()
                && !identity.equals(LiveTokenService.publisherIdentity(b.getOwner().getId()));
    }

    private Optional<Broadcast> find(String roomName) {
        if (roomName == null || !roomName.startsWith(Broadcast.ROOM_PREFIX)) {
            return Optional.empty();
        }
        return broadcastRepository.findByRoomName(roomName);
    }
}
