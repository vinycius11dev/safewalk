CREATE TABLE IF NOT EXISTS contact_invitations (
  token_hash CHAR(64) PRIMARY KEY,
  contact_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  responded_at DATETIME(3) NULL,
  CONSTRAINT fk_invitation_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX ix_invitation_contact (contact_id)
) ENGINE=InnoDB;
