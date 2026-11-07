package com.jjuny.live.broadcast;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface BroadcastRepository extends JpaRepository<Broadcast, Long> {

    String LIVE_FIRST = " order by case when b.status = com.jjuny.live.broadcast.BroadcastStatus.LIVE then 0 else 1 end,"
            + " b.createdAt desc, b.id desc";

    @Query(value = "select b from Broadcast b join fetch b.owner" + LIVE_FIRST,
            countQuery = "select count(b) from Broadcast b")
    Page<Broadcast> findAllLiveFirst(Pageable pageable);

    @Query(value = "select b from Broadcast b join fetch b.owner where b.status = :status" + LIVE_FIRST,
            countQuery = "select count(b) from Broadcast b where b.status = :status")
    Page<Broadcast> findByStatus(BroadcastStatus status, Pageable pageable);

    @Query(value = "select b from Broadcast b join fetch b.owner where b.owner.id = :ownerId" + LIVE_FIRST,
            countQuery = "select count(b) from Broadcast b where b.owner.id = :ownerId")
    Page<Broadcast> findByOwner(Long ownerId, Pageable pageable);

    @Query("select b from Broadcast b join fetch b.owner where b.id = :id")
    Optional<Broadcast> findWithOwner(Long id);

    Optional<Broadcast> findByRoomName(String roomName);

    @Modifying(clearAutomatically = true)
    @Query("update Broadcast b set b.viewerCount = b.viewerCount + 1 where b.id = :id")
    int incrementViewerCount(Long id);

    @Modifying(clearAutomatically = true)
    @Query("update Broadcast b set b.viewerCount = case when b.viewerCount > 0 then b.viewerCount - 1 else 0 end"
            + " where b.id = :id")
    int decrementViewerCount(Long id);
}
