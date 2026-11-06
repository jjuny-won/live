package com.jjuny.live.live;

/** LiveKit 서버 API(방 생성·삭제) 호출. 실패해도 예외를 던지지 않는다(best-effort). */
public interface LiveKitGateway {

    void createRoom(String roomName);

    void deleteRoom(String roomName);
}
