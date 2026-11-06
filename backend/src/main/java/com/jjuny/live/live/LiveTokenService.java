package com.jjuny.live.live;

import com.jjuny.live.common.BusinessException;
import com.jjuny.live.common.ErrorCode;
import com.jjuny.live.live.LiveDtos.PublisherTokenResponse;
import com.jjuny.live.live.LiveDtos.ViewerTokenResponse;
import io.livekit.server.AccessToken;
import io.livekit.server.CanPublish;
import io.livekit.server.CanPublishData;
import io.livekit.server.CanSubscribe;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * LiveKit 접속 토큰 발급. 미디어 서버 수준의 권한이 여기서 결정된다.
 * - 송출(방송 소유자): canPublish=true, identity member-{id}
 * - 시청: canPublish=false, canPublishData=로그인 여부(채팅), identity member-{id}-{rand} / guest-{uuid}
 */
@Service
public class LiveTokenService {

    private final LiveKitProperties properties;

    public LiveTokenService(LiveKitProperties properties) {
        this.properties = properties;
    }

    public static String publisherIdentity(Long memberId) {
        return "member-" + memberId;
    }

    public void ensureConfigured() {
        if (!properties.isConfigured()) {
            throw new BusinessException(ErrorCode.LIVEKIT_NOT_CONFIGURED);
        }
    }

    public PublisherTokenResponse publisherToken(String roomName, Long memberId, String nickname) {
        ensureConfigured();
        AccessToken token = newToken(publisherIdentity(memberId), nickname);
        token.addGrants(new RoomJoin(true), new RoomName(roomName),
                new CanPublish(true), new CanSubscribe(true), new CanPublishData(true));
        return new PublisherTokenResponse(properties.url(), token.toJwt(), roomName);
    }

    /** @param memberId 비로그인이면 null */
    public ViewerTokenResponse viewerToken(String roomName, Long memberId, String nickname) {
        ensureConfigured();
        boolean loggedIn = memberId != null;
        // 같은 identity 로 두 번 입장하면 앞 접속이 끊기므로(여러 탭·방송자 본인 미리보기) 접미사를 붙인다.
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String identity = loggedIn ? "member-" + memberId + "-" + suffix.substring(0, 8) : "guest-" + suffix;
        String name = loggedIn ? nickname : "손님-" + suffix.substring(0, 4);
        AccessToken token = newToken(identity, name);
        token.addGrants(new RoomJoin(true), new RoomName(roomName),
                new CanPublish(false), new CanSubscribe(true), new CanPublishData(loggedIn));
        return new ViewerTokenResponse(properties.url(), token.toJwt(), roomName, loggedIn);
    }

    private AccessToken newToken(String identity, String name) {
        AccessToken token = new AccessToken(properties.apiKey(), properties.apiSecret());
        token.setIdentity(identity);
        token.setName(name);
        token.setTtl(properties.tokenTtl().toMillis());
        return token;
    }
}
