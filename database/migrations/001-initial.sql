CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contacts (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL, phone VARCHAR(24) NOT NULL, relationship VARCHAR(50) NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_contact_owner (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL,
  route_kind VARCHAR(12) NOT NULL, destination VARCHAR(200) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  active_user_id CHAR(36) NULL,
  started_at DATETIME(3) NOT NULL, expected_arrival_at DATETIME(3) NOT NULL,
  alert_deadline DATETIME(3) NULL, escalation_deadline DATETIME(3) NULL,
  last_position LONGTEXT NULL CHECK (last_position IS NULL OR JSON_VALID(last_position)),
  CONSTRAINT fk_trip_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY ix_one_active_trip_per_user (active_user_id),
  CONSTRAINT ck_trip_active_owner CHECK (
    (status IN ('active','checkin_pending','alerted','escalated') AND active_user_id IS NOT NULL AND active_user_id = user_id)
    OR (status IN ('arrived','cancelled') AND active_user_id IS NULL)
  ),
  INDEX ix_trip_owner (user_id, started_at),
  INDEX ix_trip_deadline (status, alert_deadline, escalation_deadline)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_contacts (
  trip_id CHAR(36) NOT NULL, contact_id CHAR(36) NOT NULL, acknowledged_at DATETIME(3) NULL,
  PRIMARY KEY (trip_id, contact_id),
  CONSTRAINT fk_tc_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_tc_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_positions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, trip_id CHAR(36) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL, accuracy_meters DOUBLE NOT NULL,
  recorded_at DATETIME(3) NOT NULL, received_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_position_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX ix_position_trip (trip_id, recorded_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS share_tokens (
  token_hash CHAR(64) PRIMARY KEY, trip_id CHAR(36) NOT NULL, contact_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3) NULL,
  CONSTRAINT fk_share_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_share_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX ix_share_trip (trip_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, type VARCHAR(24) NOT NULL,
  description VARCHAR(1000) NOT NULL, address VARCHAR(200) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active', created_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_report_owner (user_id, created_at), INDEX ix_report_expiration (expires_at, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, trip_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL, payload LONGTEXT NOT NULL CHECK (JSON_VALID(payload)),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_event_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX ix_event_trip (trip_id, created_at)
) ENGINE=InnoDB;
