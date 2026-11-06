package com.jjuny.live.live;

public final class LiveDtos {

    private LiveDtos() {
    }

    /** POST /api/broadcasts/{id}/start */
    public record PublisherTokenResponse(String livekitUrl, String token, String roomName) {
    }

    /** POST /api/broadcasts/{id}/viewer-token */
    public record ViewerTokenResponse(String livekitUrl, String token, String roomName, boolean canChat) {
    }
}
