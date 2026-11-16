ALTER TABLE reports
  ADD COLUMN share_with_community TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN public_latitude DECIMAL(10,7) NULL,
  ADD COLUMN public_longitude DECIMAL(10,7) NULL,
  ADD COLUMN community_status VARCHAR(16) NOT NULL DEFAULT 'visible',
  ADD CONSTRAINT chk_report_community_status CHECK (community_status IN ('visible', 'hidden')),
  ADD INDEX ix_report_community (share_with_community, community_status, status, expires_at, created_at);

CREATE TABLE report_attachments (
  id CHAR(36) PRIMARY KEY,
  report_id CHAR(36) NOT NULL UNIQUE,
  storage_key VARCHAR(80) NOT NULL UNIQUE,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_report_attachment_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE report_feedback (
  user_id CHAR(36) NOT NULL,
  report_id CHAR(36) NOT NULL,
  choice VARCHAR(16) NOT NULL CHECK (choice IN ('present', 'resolved', 'not_found')),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, report_id),
  CONSTRAINT fk_report_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_feedback_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  INDEX ix_report_feedback_report (report_id, choice)
) ENGINE=InnoDB;

CREATE TABLE report_flags (
  user_id CHAR(36) NOT NULL,
  report_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, report_id),
  CONSTRAINT fk_report_flag_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_flag_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  INDEX ix_report_flags_report (report_id)
) ENGINE=InnoDB;
