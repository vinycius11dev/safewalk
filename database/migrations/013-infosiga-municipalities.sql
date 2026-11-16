CREATE TABLE infosiga_municipalities (
  import_id CHAR(36) NOT NULL,
  municipality VARCHAR(120) NOT NULL,
  relevant_rows INT UNSIGNED NOT NULL,
  valid_coordinates INT UNSIGNED NOT NULL,
  missing_coordinates INT UNSIGNED NOT NULL,
  outside_envelope INT UNSIGNED NOT NULL,
  PRIMARY KEY (import_id, municipality),
  CONSTRAINT infosiga_municipality_import_fk FOREIGN KEY (import_id) REFERENCES urban_imports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
