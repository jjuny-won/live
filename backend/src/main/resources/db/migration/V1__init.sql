CREATE TABLE member (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    nickname      VARCHAR(30)  NOT NULL UNIQUE,
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE refresh_token (
    id         BIGSERIAL PRIMARY KEY,
    member_id  BIGINT      NOT NULL REFERENCES member (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_token_member ON refresh_token (member_id);

CREATE TABLE broadcast (
    id            BIGSERIAL PRIMARY KEY,
    owner_id      BIGINT        NOT NULL REFERENCES member (id),
    title         VARCHAR(100)  NOT NULL,
    description   VARCHAR(1000),
    category      VARCHAR(20)   NOT NULL DEFAULT 'ETC',
    thumbnail_url VARCHAR(500),
    status        VARCHAR(10)   NOT NULL DEFAULT 'READY',
    room_name     VARCHAR(100)  UNIQUE,
    viewer_count  INT           NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_broadcast_owner ON broadcast (owner_id);
CREATE INDEX idx_broadcast_status_created ON broadcast (status, created_at DESC);
