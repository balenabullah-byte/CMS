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
