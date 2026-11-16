ALTER TABLE reports
  ADD COLUMN share_with_government TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN gov_status VARCHAR(16) NOT NULL DEFAULT 'received',
  ADD COLUMN gov_updated_at DATETIME(3) NULL,
  ADD CONSTRAINT chk_report_gov_status CHECK (gov_status IN ('received', 'analyzing', 'dispatched', 'resolved', 'dismissed')),
  ADD INDEX ix_report_government (share_with_government, gov_status, created_at);

CREATE TABLE admin_users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(300) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('viewer', 'operator')),
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  disabled_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE report_admin_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id CHAR(36) NOT NULL,
  admin_id CHAR(36) NULL,
  from_status VARCHAR(16) NULL,
  to_status VARCHAR(16) NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_admin_event_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_event_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX ix_admin_event_report (report_id, created_at)
) ENGINE=InnoDB
