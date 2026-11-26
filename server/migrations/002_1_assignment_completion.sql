ALTER TABLE work_assignments
    ADD COLUMN root_cause VARCHAR(40) NULL,
    ADD COLUMN root_cause_details TEXT NULL,
    ADD COLUMN materials_used TEXT NULL,
    ADD COLUMN labor_minutes INT UNSIGNED NULL;
