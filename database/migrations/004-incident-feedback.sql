CREATE TABLE IF NOT EXISTS incident_feedback (
  user_id CHAR(36) NOT NULL,
  incident_id VARCHAR(40) NOT NULL,
  choice VARCHAR(16) NOT NULL CHECK (choice IN ('confirm', 'resolved')),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, incident_id),
  CONSTRAINT fk_incident_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
