-- =============================================================================
-- TRIPAL ERP — Migration 003: Add Staff Master & Staff Attendance
-- =============================================================================
-- Safe, additive migration for:
-- 1. Staff Master (staff)
-- 2. Staff Attendance (staff_attendance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  designation VARCHAR(100) DEFAULT 'Worker',
  department VARCHAR(100),
  wage_type VARCHAR(50) DEFAULT 'Daily',
  wage_amount NUMERIC(15,2) DEFAULT 0,
  joining_date VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Full Day',
  overtime_hours NUMERIC(10,2) DEFAULT 0,
  remarks TEXT,
  marked_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_staff_attendance UNIQUE (staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance(staff_id);
