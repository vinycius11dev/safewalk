CREATE TABLE crime_points (
  import_id CHAR(36) NOT NULL,
  external_id CHAR(64) NOT NULL,
  longitude DOUBLE NOT NULL,
  latitude DOUBLE NOT NULL,
  category ENUM('robbery', 'theft', 'assault', 'sexual') NOT NULL,
  occurred_on DATE NOT NULL,
  period ENUM('dawn', 'morning', 'afternoon', 'night') NULL,
  PRIMARY KEY (import_id, external_id),
  INDEX crime_points_bounds (import_id, longitude, latitude),
  CONSTRAINT crime_points_import_fk FOREIGN KEY (import_id) REFERENCES urban_imports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
