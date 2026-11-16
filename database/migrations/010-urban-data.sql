CREATE TABLE urban_provider_cache (
  cache_key VARCHAR(160) PRIMARY KEY,
  source_id VARCHAR(80) NOT NULL,
  west DOUBLE NOT NULL,
  south DOUBLE NOT NULL,
  east DOUBLE NOT NULL,
  north DOUBLE NOT NULL,
  payload LONGTEXT NULL CHECK (payload IS NULL OR JSON_VALID(payload)),
  fetched_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  attempted_at DATETIME(3) NOT NULL,
  retry_after DATETIME(3) NOT NULL,
  last_error VARCHAR(100) NULL,
  INDEX urban_cache_source_time (source_id, fetched_at),
  INDEX urban_cache_bounds (west, east, south, north)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE urban_imports (
  id CHAR(36) PRIMARY KEY,
  source_id VARCHAR(80) NOT NULL,
  resource_id VARCHAR(80) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  published_at DATETIME(3) NULL,
  completed_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  west DOUBLE NOT NULL,
  south DOUBLE NOT NULL,
  east DOUBLE NOT NULL,
  north DOUBLE NOT NULL,
  rows_scanned INT UNSIGNED NOT NULL,
  relevant_rows INT UNSIGNED NOT NULL,
  rows_without_coordinates INT UNSIGNED NOT NULL,
  feature_count INT UNSIGNED NOT NULL,
  truncated BOOLEAN NOT NULL,
  INDEX urban_import_latest (source_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE urban_import_features (
  import_id CHAR(36) NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  longitude DOUBLE NOT NULL,
  latitude DOUBLE NOT NULL,
  feature_json LONGTEXT NOT NULL CHECK (JSON_VALID(feature_json)),
  PRIMARY KEY (import_id, external_id),
  INDEX urban_import_feature_bounds (import_id, longitude, latitude),
  CONSTRAINT urban_feature_import_fk FOREIGN KEY (import_id) REFERENCES urban_imports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
