CREATE TABLE IF NOT EXISTS asset_categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_active IN (0,1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    asset_code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    asset_category_id SMALLINT UNSIGNED NOT NULL,
    building_id BIGINT UNSIGNED NOT NULL,
    room_id BIGINT UNSIGNED NULL,
    manufacturer VARCHAR(150) NULL,
    model VARCHAR(150) NULL,
    serial_number VARCHAR(150) NULL,
    description TEXT NULL,
    operational_status ENUM('operational','under_maintenance','out_of_service','retired') NOT NULL DEFAULT 'operational',
    purchase_date DATE NULL,
    installation_date DATE NULL,
    warranty_expires_at DATE NULL,
    created_by_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    retired_at DATETIME NULL,
    retired_by_id BIGINT UNSIGNED NULL,
    retirement_reason VARCHAR(500) NULL,
    KEY idx_asset_location (building_id, room_id),
    FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id),
    FOREIGN KEY (building_id) REFERENCES buildings(id),
    FOREIGN KEY (room_id,building_id) REFERENCES rooms(id,building_id),
    FOREIGN KEY (created_by_id) REFERENCES users(id),
    FOREIGN KEY (retired_by_id) REFERENCES users(id),
    CHECK ((operational_status='retired' AND retired_at IS NOT NULL AND retired_by_id IS NOT NULL AND retirement_reason IS NOT NULL AND CHAR_LENGTH(TRIM(retirement_reason))>0)
        OR (operational_status<>'retired' AND retired_at IS NULL AND retired_by_id IS NULL AND retirement_reason IS NULL))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_location_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    previous_building_id BIGINT UNSIGNED NOT NULL,
    previous_room_id BIGINT UNSIGNED NULL,
    new_building_id BIGINT UNSIGNED NOT NULL,
    new_room_id BIGINT UNSIGNED NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(500) NOT NULL CHECK (CHAR_LENGTH(TRIM(reason))>0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_asset_transfers (asset_id,id),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (previous_building_id) REFERENCES buildings(id),
    FOREIGN KEY (previous_room_id,previous_building_id) REFERENCES rooms(id,building_id),
    FOREIGN KEY (new_building_id) REFERENCES buildings(id),
    FOREIGN KEY (new_room_id,new_building_id) REFERENCES rooms(id,building_id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TRIGGER IF NOT EXISTS trg_asset_location_no_update BEFORE UPDATE ON asset_location_history FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Asset transfers are immutable';
CREATE TRIGGER IF NOT EXISTS trg_asset_location_no_delete BEFORE DELETE ON asset_location_history FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Asset transfers are immutable';

ALTER TABLE maintenance_requests
    ADD COLUMN IF NOT EXISTS asset_id BIGINT UNSIGNED NULL,
    ADD INDEX IF NOT EXISTS idx_requests_asset_status (asset_id,status),
    ADD FOREIGN KEY IF NOT EXISTS fk_requests_asset (asset_id) REFERENCES assets(id);
