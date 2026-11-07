package com.jjuny.live.broadcast;

import com.jjuny.live.broadcast.BroadcastDtos.BroadcastResponse;
import com.jjuny.live.broadcast.BroadcastDtos.CreateRequest;
import com.jjuny.live.broadcast.BroadcastDtos.UpdateRequest;
import com.jjuny.live.common.BusinessException;
import com.jjuny.live.common.ErrorCode;
import com.jjuny.live.common.PageResponse;
import com.jjuny.live.live.LiveDtos.PublisherTokenResponse;
import com.jjuny.live.live.LiveDtos.ViewerTokenResponse;
import com.jjuny.live.live.LiveKitGateway;
import com.jjuny.live.live.LiveTokenService;
import com.jjuny.live.member.Member;
import com.jjuny.live.member.MemberRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BroadcastService {

    private static final int MAX_PAGE_SIZE = 50;

    private final BroadcastRepository broadcastRepository;
    private final MemberRepository memberRepository;
    private final LiveTokenService liveTokenService;
    private final LiveKitGateway liveKitGateway;

    public BroadcastService(BroadcastRepository broadcastRepository, MemberRepository memberRepository,
                            LiveTokenService liveTokenService, LiveKitGateway liveKitGateway) {
        this.broadcastRepository = broadcastRepository;
        this.memberRepository = memberRepository;
        this.liveTokenService = liveTokenService;
        this.liveKitGateway = liveKitGateway;
    }

    @Transactional(readOnly = true)
    public PageResponse<BroadcastResponse> list(BroadcastStatus status, int page, int size, Long currentMemberId) {
        PageRequest pageable = pageRequest(page, size);
        var result = status == null
                ? broadcastRepository.findAllLiveFirst(pageable)
                : broadcastRepository.findByStatus(status, pageable);
        return PageResponse.of(result, b -> BroadcastResponse.of(b, currentMemberId));
    }

    @Transactional(readOnly = true)
    public PageResponse<BroadcastResponse> listMine(Long memberId, int page, int size) {
        return PageResponse.of(broadcastRepository.findByOwner(memberId, pageRequest(page, size)),
                b -> BroadcastResponse.of(b, memberId));
    }

    @Transactional(readOnly = true)
    public BroadcastResponse get(Long id, Long currentMemberId) {
        return BroadcastResponse.of(find(id), currentMemberId);
    }

    @Transactional
    public BroadcastResponse create(Long memberId, CreateRequest request) {
        Member owner = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        Broadcast broadcast = broadcastRepository.save(
                new Broadcast(owner, request.title().trim(), request.description(), request.category()));
        broadcast.assignRoomName();
        return BroadcastResponse.of(broadcast, memberId);
    }

    @Transactional
    public BroadcastResponse update(Long id, Long memberId, UpdateRequest request) {
        Broadcast broadcast = findOwned(id, memberId);
        broadcast.update(request.title() == null ? null : request.title().trim(),
                request.description(), request.category());
        broadcastRepository.flush();
        return BroadcastResponse.of(broadcast, memberId);
    }

    @Transactional
    public void delete(Long id, Long memberId) {
        Broadcast broadcast = findOwned(id, memberId);
        if (broadcast.getStatus() == BroadcastStatus.LIVE) {
            broadcast.end();
            liveKitGateway.deleteRoom(broadcast.getRoomName());
        }
        broadcast.softDelete();
    }

    /** 방송 시작: 상태 LIVE + 송출 토큰. 종료된 방송도 다시 시작할 수 있다. */
    @Transactional
    public PublisherTokenResponse start(Long id, Long memberId) {
        Broadcast broadcast = findOwned(id, memberId);
        liveTokenService.ensureConfigured(); // 토큰을 못 주면 상태도 바꾸지 않는다
        boolean wasLive = broadcast.getStatus() == BroadcastStatus.LIVE;
        broadcast.goLive();
        if (!wasLive) {
            liveKitGateway.createRoom(broadcast.getRoomName());
        }
        return liveTokenService.publisherToken(broadcast.getRoomName(), memberId,
                broadcast.getOwner().getNickname());
    }

    @Transactional
    public BroadcastResponse end(Long id, Long memberId) {
        Broadcast broadcast = findOwned(id, memberId);
        boolean wasLive = broadcast.getStatus() == BroadcastStatus.LIVE;
        broadcast.end();
        if (wasLive) {
            liveKitGateway.deleteRoom(broadcast.getRoomName());
        }
        broadcastRepository.flush();
        return BroadcastResponse.of(broadcast, memberId);
    }

    /** 시청 토큰: 비로그인(게스트) 허용, 방송 중일 때만. */
    @Transactional(readOnly = true)
    public ViewerTokenResponse viewerToken(Long id, Long memberId) {
        Broadcast broadcast = find(id);
        liveTokenService.ensureConfigured();
        if (broadcast.getStatus() != BroadcastStatus.LIVE) {
            throw new BusinessException(ErrorCode.BROADCAST_NOT_LIVE);
        }
        String nickname = memberId == null ? null : memberRepository.findById(memberId)
                .map(Member::getNickname)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        return liveTokenService.viewerToken(broadcast.getRoomName(), memberId, nickname);
    }

    private Broadcast find(Long id) {
        return broadcastRepository.findWithOwner(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.BROADCAST_NOT_FOUND));
    }

    /** 소유자 검사. 아니면 403 BROADCAST_FORBIDDEN. */
    private Broadcast findOwned(Long id, Long memberId) {
        Broadcast broadcast = find(id);
        checkOwner(broadcast, memberId);
        return broadcast;
    }

    static void checkOwner(Broadcast broadcast, Long memberId) {
        if (!broadcast.isOwnedBy(memberId)) {
            throw new BusinessException(ErrorCode.BROADCAST_FORBIDDEN);
        }
    }

    private static PageRequest pageRequest(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
    }
}
