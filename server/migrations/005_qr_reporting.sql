CREATE TABLE IF NOT EXISTS qr_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token CHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    asset_id BIGINT UNSIGNED NULL,
    room_id BIGINT UNSIGNED NULL,
    building_id BIGINT UNSIGNED NULL,
    created_by_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    revoked_by_id BIGINT UNSIGNED NULL,
    active_key VARCHAR(32) AS (IF(revoked_at IS NULL, COALESCE(CONCAT('a',asset_id),CONCAT('r',room_id),CONCAT('b',building_id)), NULL)) PERSISTENT UNIQUE,
    CHECK ((asset_id IS NOT NULL)+(room_id IS NOT NULL)+(building_id IS NOT NULL)=1),
    CHECK ((revoked_at IS NULL)=(revoked_by_id IS NULL)),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (building_id) REFERENCES buildings(id),
    FOREIGN KEY (created_by_id) REFERENCES users(id),
    FOREIGN KEY (revoked_by_id) REFERENCES users(id)
) ENGINE=InnoDB;

ALTER TABLE maintenance_requests
    ADD COLUMN IF NOT EXISTS qr_code_id BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS reporting_source ENUM('manual','qr') NULL,
    ADD INDEX IF NOT EXISTS idx_requests_qr (qr_code_id),
    ADD FOREIGN KEY IF NOT EXISTS fk_requests_qr (qr_code_id) REFERENCES qr_codes(id);
