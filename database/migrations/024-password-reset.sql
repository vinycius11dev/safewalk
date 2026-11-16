CREATE TABLE password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  account_kind VARCHAR(8) NOT NULL,
  account_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT chk_reset_account_kind CHECK (account_kind IN ('user', 'admin')),
  UNIQUE KEY ux_reset_token_hash (token_hash),
  INDEX ix_reset_account (account_kind, account_id, created_at)
) ENGINE=InnoDB;

ALTER TABLE users ADD COLUMN sessions_valid_after DATETIME NULL;

ALTER TABLE admin_users ADD COLUMN sessions_valid_after DATETIME NULL
