CREATE TABLE IF NOT EXISTS routing_cache (
  cache_key CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)),
  fetched_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_routing_cache_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_routing_cache_expiration (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS route_proposals (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  snapshot LONGTEXT NOT NULL CHECK (JSON_VALID(snapshot)),
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_route_proposal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_route_proposal_owner (user_id, expires_at)
) ENGINE=InnoDB;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_snapshot LONGTEXT NULL CHECK (route_snapshot IS NULL OR JSON_VALID(route_snapshot));
