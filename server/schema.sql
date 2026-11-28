CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    campus_id VARCHAR(30) NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    member_type ENUM('student','faculty','staff','contractor') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_campus_id (campus_id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT chk_users_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
    id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    description VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id TINYINT UNSIGNED NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    KEY idx_user_roles_role (role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buildings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_buildings_code (code),
    CONSTRAINT chk_buildings_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    building_id BIGINT UNSIGNED NOT NULL,
    room_code VARCHAR(30) NOT NULL,
    floor_number SMALLINT NULL,
    description VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rooms_building_room (building_id, room_code),
    UNIQUE KEY uq_rooms_id_building (id, building_id),
    CONSTRAINT fk_rooms_building FOREIGN KEY (building_id)
        REFERENCES buildings(id) ON DELETE RESTRICT,
    CONSTRAINT chk_rooms_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_code (code),
    CONSTRAINT chk_categories_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technician_skills (
    technician_id BIGINT UNSIGNED NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (technician_id, category_id),
    KEY idx_skills_category (category_id),
    CONSTRAINT fk_skills_technician FOREIGN KEY (technician_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_skills_category FOREIGN KEY (category_id)
        REFERENCES maintenance_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_id BIGINT UNSIGNED NOT NULL,
    building_id BIGINT UNSIGNED NOT NULL,
    room_id BIGINT UNSIGNED NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    location_note VARCHAR(255) NULL,
    priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
    status ENUM('submitted','approved','rejected','assigned',
                'in_progress','completed','closed','reopened')
                NOT NULL DEFAULT 'submitted',
    status_changed_by_id BIGINT UNSIGNED NULL,
    status_note VARCHAR(500) NULL,
    reviewed_by_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    closed_by_id BIGINT UNSIGNED NULL,
    closed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_requests_reporter (reporter_id),
    KEY idx_requests_building (building_id),
    KEY idx_requests_room_building (room_id, building_id),
    KEY idx_requests_category (category_id),
    KEY idx_requests_status_created (status, created_at),
    KEY idx_requests_priority_status (priority, status),
    KEY idx_requests_changed_by (status_changed_by_id),
    KEY idx_requests_reviewed_by (reviewed_by_id),
    KEY idx_requests_closed_by (closed_by_id),
    CONSTRAINT fk_requests_reporter FOREIGN KEY (reporter_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_building FOREIGN KEY (building_id)
        REFERENCES buildings(id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_room_building FOREIGN KEY (room_id, building_id)
        REFERENCES rooms(id, building_id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_category FOREIGN KEY (category_id)
        REFERENCES maintenance_categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_changed_by FOREIGN KEY (status_changed_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_reviewed_by FOREIGN KEY (reviewed_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_closed_by FOREIGN KEY (closed_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_request_closed_fields CHECK (
        (status = 'closed' AND closed_by_id IS NOT NULL AND closed_at IS NOT NULL)
        OR
        (status <> 'closed' AND closed_by_id IS NULL AND closed_at IS NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS work_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id BIGINT UNSIGNED NOT NULL,
    technician_id BIGINT UNSIGNED NOT NULL,
    assigned_by_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    completion_note TEXT NULL,
    root_cause VARCHAR(40) NULL,
    root_cause_details TEXT NULL,
    materials_used TEXT NULL,
    labor_minutes INT UNSIGNED NULL,
    ended_at DATETIME NULL,
    ended_by_id BIGINT UNSIGNED NULL,
    end_reason ENUM('completed','reassigned','cancelled') NULL,
    active_request_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN ended_at IS NULL THEN request_id ELSE NULL END
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_one_active_assignment (active_request_id),
    KEY idx_assignments_request (request_id),
    KEY idx_assignments_technician (technician_id, ended_at),
    KEY idx_assignments_assigned_by (assigned_by_id),
    KEY idx_assignments_ended_by (ended_by_id),
    CONSTRAINT fk_assignments_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_technician FOREIGN KEY (technician_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_assigned_by FOREIGN KEY (assigned_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_ended_by FOREIGN KEY (ended_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_assignment_end_fields CHECK (
        (ended_at IS NULL AND ended_by_id IS NULL AND end_reason IS NULL)
        OR
        (ended_at IS NOT NULL AND ended_by_id IS NOT NULL AND end_reason IS NOT NULL)
    ),
    CONSTRAINT chk_assignment_completion CHECK (
        (completed_at IS NULL OR
            (end_reason IS NOT NULL AND end_reason = 'completed'))
        AND
        (end_reason IS NULL OR end_reason <> 'completed' OR
            (completed_at IS NOT NULL AND started_at IS NOT NULL AND
             completion_note IS NOT NULL AND CHAR_LENGTH(TRIM(completion_note)) > 0))
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM('submitted','status_changed',
                    'assignment_created','assignment_ended') NOT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    note VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_history_request_date (request_id, created_at, id),
    KEY idx_history_actor (actor_id),
    CONSTRAINT fk_history_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_history_actor FOREIGN KEY (actor_id)
        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    visibility ENUM('reporter_visible','staff_only')
        NOT NULL DEFAULT 'reporter_visible',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_comments_request_date (request_id, created_at),
    KEY idx_comments_author (author_id),
    CONSTRAINT fk_comments_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_comments_body CHECK (CHAR_LENGTH(TRIM(body)) > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_attachments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id BIGINT UNSIGNED NOT NULL,
    uploaded_by_id BIGINT UNSIGNED NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    file_size_bytes INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attachments_storage_key (storage_key),
    KEY idx_attachments_request (request_id),
    KEY idx_attachments_uploader (uploaded_by_id),
    CONSTRAINT fk_attachments_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_attachments_uploader FOREIGN KEY (uploaded_by_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_attachments_type CHECK (
        mime_type IN ('image/jpeg','image/png','image/webp')
    ),
    CONSTRAINT chk_attachments_size CHECK (
        file_size_bytes BETWEEN 1 AND 5242880
    )
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (code, description) VALUES
  ('campus_member', 'Can report and follow their own campus issues'),
  ('admin', 'Manages user accounts, roles and system setup'),
  ('coordinator', 'Reviews, assigns, verifies and closes maintenance work'),
  ('technician', 'Works on assigned maintenance jobs');

INSERT IGNORE INTO maintenance_categories (code, name) VALUES
  ('ac', 'Air Conditioning'),
  ('electrical', 'Electrical'),
  ('furniture', 'Furniture'),
  ('it', 'IT and Projectors'),
  ('plumbing', 'Plumbing'),
  ('general', 'General Maintenance');

DELIMITER $$

DROP TRIGGER IF EXISTS trg_requests_before_insert$$
CREATE TRIGGER trg_requests_before_insert
BEFORE INSERT ON maintenance_requests
FOR EACH ROW
BEGIN
    IF NEW.status <> 'submitted' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A new request must start as submitted';
    END IF;
    IF NEW.status_changed_by_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No status-change actor is needed when submitting';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_requests_after_insert$$
CREATE TRIGGER trg_requests_after_insert
AFTER INSERT ON maintenance_requests
FOR EACH ROW
BEGIN
    INSERT INTO request_history (
        request_id, actor_id, event_type, old_status, new_status, note
    ) VALUES (
        NEW.id, NEW.reporter_id, 'submitted', NULL, 'submitted',
        'Maintenance request submitted'
    );
END$$

DROP TRIGGER IF EXISTS trg_requests_before_update$$
CREATE TRIGGER trg_requests_before_update
BEFORE UPDATE ON maintenance_requests
FOR EACH ROW
BEGIN
    DECLARE v_active_assignments INT DEFAULT 0;
    DECLARE v_latest_completed INT DEFAULT 0;

    IF NEW.status <> OLD.status THEN
        IF NEW.status_changed_by_id IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Provide the actor for a status change';
        END IF;

        IF NOT (
            (OLD.status = 'submitted' AND NEW.status IN ('approved','rejected')) OR
            (OLD.status = 'approved' AND NEW.status = 'assigned') OR
            (OLD.status = 'assigned' AND NEW.status IN ('in_progress','reopened')) OR
            (OLD.status = 'in_progress' AND NEW.status IN ('completed','reopened')) OR
            (OLD.status = 'completed' AND NEW.status IN ('closed','reopened')) OR
            (OLD.status = 'closed' AND NEW.status = 'reopened') OR
            (OLD.status = 'reopened' AND NEW.status = 'assigned')
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'This status transition is not permitted';
        END IF;

        IF NEW.status IN ('approved','rejected') AND
           (NEW.reviewed_by_id IS NULL OR NEW.reviewed_at IS NULL OR
            NEW.reviewed_by_id <> NEW.status_changed_by_id) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A coordinator review record is required';
        END IF;

        IF NEW.status IN ('rejected','reopened') AND
            (NEW.status_note IS NULL OR CHAR_LENGTH(TRIM(NEW.status_note)) = 0)
        THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Rejection or reopening requires a reason';
        END IF;

        IF NEW.status IN ('assigned','in_progress') THEN
            SELECT COUNT(*) INTO v_active_assignments
              FROM work_assignments
             WHERE request_id = NEW.id AND ended_at IS NULL;
            IF v_active_assignments = 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'An active technician assignment is required';
            END IF;
        END IF;

        IF NEW.status = 'completed' THEN
            SELECT COUNT(*) INTO v_latest_completed
              FROM work_assignments wa
             WHERE wa.id = (
                SELECT MAX(wa2.id) FROM work_assignments wa2
                 WHERE wa2.request_id = NEW.id
             )
               AND wa.end_reason = 'completed'
               AND wa.ended_at IS NOT NULL
               AND wa.completed_at IS NOT NULL;
            IF v_latest_completed = 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'The latest assignment must be completed first';
            END IF;
        END IF;

        IF NEW.status = 'closed' AND (
            NEW.closed_by_id IS NULL OR NEW.closed_at IS NULL OR
            NEW.closed_by_id <> NEW.status_changed_by_id
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Coordinator closure details are required';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_requests_after_update$$
CREATE TRIGGER trg_requests_after_update
AFTER UPDATE ON maintenance_requests
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO request_history (
            request_id, actor_id, event_type, old_status, new_status, note
        ) VALUES (
            NEW.id, NEW.status_changed_by_id, 'status_changed',
            OLD.status, NEW.status, NEW.status_note
        );
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_assignments_before_insert$$
CREATE TRIGGER trg_assignments_before_insert
BEFORE INSERT ON work_assignments
FOR EACH ROW
BEGIN
    DECLARE v_valid_technician INT DEFAULT 0;
    DECLARE v_valid_coordinator INT DEFAULT 0;
    DECLARE v_assignable_request INT DEFAULT 0;

    SELECT COUNT(*) INTO v_valid_technician
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
     WHERE u.id = NEW.technician_id AND u.is_active = TRUE
       AND r.code = 'technician';

    SELECT COUNT(*) INTO v_valid_coordinator
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
     WHERE u.id = NEW.assigned_by_id AND u.is_active = TRUE
       AND r.code = 'coordinator';

    SELECT COUNT(*) INTO v_assignable_request
      FROM maintenance_requests
     WHERE id = NEW.request_id AND status IN ('approved','reopened');

    IF v_valid_technician = 0 OR v_valid_coordinator = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An active technician and coordinator are required';
    END IF;

    IF v_assignable_request = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only approved or reopened requests can be assigned';
    END IF;

    IF NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL OR
       NEW.ended_at IS NOT NULL OR NEW.end_reason IS NOT NULL OR
       NEW.ended_by_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'New assignments must start unfinished';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_assignments_after_insert$$
CREATE TRIGGER trg_assignments_after_insert
AFTER INSERT ON work_assignments
FOR EACH ROW
BEGIN
    INSERT INTO request_history (request_id, actor_id, event_type, note)
    VALUES (
        NEW.request_id, NEW.assigned_by_id, 'assignment_created',
        CONCAT('Assigned technician #', NEW.technician_id,
               ' (assignment #', NEW.id, ')')
    );
END$$

DROP TRIGGER IF EXISTS trg_assignments_before_update$$
CREATE TRIGGER trg_assignments_before_update
BEFORE UPDATE ON work_assignments
FOR EACH ROW
BEGIN
    DECLARE v_in_progress INT DEFAULT 0;

    IF OLD.ended_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An ended assignment cannot be edited';
    END IF;

    IF NEW.request_id <> OLD.request_id OR
       NEW.technician_id <> OLD.technician_id OR
       NEW.assigned_by_id <> OLD.assigned_by_id OR
       NEW.assigned_at <> OLD.assigned_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Assignment identity fields cannot change';
    END IF;

    IF OLD.started_at IS NULL AND NEW.started_at IS NOT NULL THEN
        SELECT COUNT(*) INTO v_in_progress
          FROM maintenance_requests
         WHERE id = NEW.request_id AND status IN ('assigned','in_progress');
        IF v_in_progress = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Start work only when the request is assigned';
        END IF;
    END IF;

    IF OLD.started_at IS NOT NULL AND
       (NEW.started_at IS NULL OR NEW.started_at <> OLD.started_at) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Work start time cannot be changed';
    END IF;

    IF NEW.completed_at IS NOT NULL AND NEW.ended_at IS NOT NULL AND
       NEW.end_reason = 'completed' THEN
        SELECT COUNT(*) INTO v_in_progress
          FROM maintenance_requests
         WHERE id = NEW.request_id AND status = 'in_progress';
        IF v_in_progress = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Only in-progress jobs may be completed';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_assignments_after_update$$
CREATE TRIGGER trg_assignments_after_update
AFTER UPDATE ON work_assignments
FOR EACH ROW
BEGIN
    IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
        INSERT INTO request_history (request_id, actor_id, event_type, note)
        VALUES (
            NEW.request_id, NEW.ended_by_id, 'assignment_ended',
            CONCAT('Assignment #', NEW.id, ' ended: ', NEW.end_reason)
        );
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_history_no_update$$
CREATE TRIGGER trg_history_no_update
BEFORE UPDATE ON request_history
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Request history is append-only';
END$$

DROP TRIGGER IF EXISTS trg_history_no_delete$$
CREATE TRIGGER trg_history_no_delete
BEFORE DELETE ON request_history
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Request history cannot be deleted';
END$$

DELIMITER ;

CREATE OR REPLACE VIEW v_maintenance_board AS
SELECT
    mr.id AS request_id,
    mr.title,
    mr.status,
    mr.priority,
    mr.created_at,
    mr.reporter_id,
    u.full_name AS reporter_name,
    b.code AS building_code,
    b.name AS building_name,
    rm.room_code,
    c.name AS category_name,
    wa.technician_id AS active_technician_id,
    tech.full_name AS active_technician_name
FROM maintenance_requests AS mr
JOIN users AS u ON u.id = mr.reporter_id
JOIN buildings AS b ON b.id = mr.building_id
LEFT JOIN rooms AS rm ON rm.id = mr.room_id
JOIN maintenance_categories AS c ON c.id = mr.category_id
LEFT JOIN work_assignments AS wa
       ON wa.request_id = mr.id AND wa.ended_at IS NULL
LEFT JOIN users AS tech ON tech.id = wa.technician_id;
CREATE TABLE IF NOT EXISTS notifications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 request_id BIGINT UNSIGNED NULL,
 assignment_id BIGINT UNSIGNED NULL,
 portal VARCHAR(20) NOT NULL,
 event_type VARCHAR(50) NOT NULL,
 deduplication_key VARCHAR(191) NOT NULL,
 read_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_delivery(user_id,deduplication_key),
 KEY idx_inbox(user_id,read_at,id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(request_id) REFERENCES maintenance_requests(id),
 FOREIGN KEY(assignment_id) REFERENCES work_assignments(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(50) NOT NULL,
 entity_type VARCHAR(40) NOT NULL,
 entity_id VARCHAR(80) NOT NULL,
 old_values JSON NULL,
 new_values JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_actor(actor_id,id),
 KEY idx_entity(entity_type,entity_id),
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TRIGGER IF NOT EXISTS trg_audit_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Audit records are immutable';
CREATE TRIGGER IF NOT EXISTS trg_audit_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Audit records are immutable';
CREATE TABLE IF NOT EXISTS maintenance_priority_policies (
 priority ENUM('low','normal','high') PRIMARY KEY,
 response_target_minutes INT UNSIGNED NOT NULL,
 resolution_target_minutes INT UNSIGNED NOT NULL,
 response_warning_minutes INT UNSIGNED NOT NULL,
 resolution_warning_minutes INT UNSIGNED NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT FALSE,
 updated_by_id BIGINT UNSIGNED NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(updated_by_id) REFERENCES users(id),
 CHECK(response_target_minutes BETWEEN 1 AND 525600 AND resolution_target_minutes BETWEEN response_target_minutes AND 525600),
 CHECK(response_warning_minutes <= response_target_minutes AND resolution_warning_minutes <= resolution_target_minutes)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_deadlines (
 request_id BIGINT UNSIGNED PRIMARY KEY,
 priority ENUM('low','normal','high') NOT NULL,
 response_target_minutes INT UNSIGNED NOT NULL,
 resolution_target_minutes INT UNSIGNED NOT NULL,
 response_warning_minutes INT UNSIGNED NOT NULL,
 resolution_warning_minutes INT UNSIGNED NOT NULL,
 response_due_at DATETIME NOT NULL,
 resolution_due_at DATETIME NOT NULL,
 response_met_at DATETIME NULL,
 resolution_met_at DATETIME NULL,
 response_next_alert DATETIME NULL,
 resolution_next_alert DATETIME NULL,
 KEY idx_response_alert(response_next_alert),
 KEY idx_resolution_alert(resolution_next_alert),
 FOREIGN KEY(request_id) REFERENCES maintenance_requests(id)
) ENGINE=InnoDB;

-- Phase 3.3 asset management
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
