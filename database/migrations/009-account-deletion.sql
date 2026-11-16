ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS purge_after DATETIME(3) NULL,
  ADD INDEX IF NOT EXISTS ix_user_purge (purge_after);
