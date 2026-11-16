ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email VARCHAR(254) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS email_trip_alerts BOOLEAN NOT NULL DEFAULT FALSE AFTER accepted,
  ADD COLUMN IF NOT EXISTS email_trip_alerts_consented_at DATETIME(3) NULL AFTER email_trip_alerts;
