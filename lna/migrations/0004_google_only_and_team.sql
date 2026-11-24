-- HEXALIS Leave & Attendance — Google sign-in only, the team, and the leave policy.

-- ---- sign-in is Google only: no passwords are kept -----------------------------
UPDATE users SET password_hash = NULL, must_change = 0, failed_attempts = 0, locked_until = NULL;

-- ---- leave can also build up "1 day for every N days" ----------------------------
ALTER TABLE leave_types ADD COLUMN accrual_days INTEGER;   -- used when accrual = 'days'

-- Leave policy for the whole year:
--   Earned leave  18 a year, 1 day for every 20 days
--   Sick leave     7 a year
--   Casual leave   7 a year
-- "Unpaid leave / absence" stays (no limit): it's how absence is recorded.
UPDATE leave_types SET yearly_quota = 7,  accrual = 'yearly', accrual_days = NULL, active = 1 WHERE name = 'Casual leave';
UPDATE leave_types SET yearly_quota = 7,  accrual = 'yearly', accrual_days = NULL, active = 1 WHERE name = 'Sick leave';
UPDATE leave_types SET yearly_quota = 18, accrual = 'days',   accrual_days = 20,  active = 1 WHERE name = 'Earned leave';
INSERT INTO leave_types (name, yearly_quota, accrual, accrual_days)
  SELECT 'Earned leave', 18, 'days', 20 WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Earned leave');

-- ---- the team ----------------------------------------------------------------------
-- Deepak: admin. Divya: manager. Mohit and Govind: employees.
-- Mohit and Divya report to Deepak; Govind reports to Divya.
-- Names are replaced by each person's full Google name the first time they sign in.
INSERT INTO users (email, name, role, must_change) VALUES
  ('deepak@hexalis.in',         'Deepak',         'admin',    0),
  ('divya.gulati@hexalis.in',   'Divya Gulati',   'manager',  0),
  ('mohit.sharma@hexalis.in',   'Mohit Sharma',   'employee', 0),
  ('govind.jaiswal@hexalis.in', 'Govind Jaiswal', 'employee', 0)
ON CONFLICT(email) DO UPDATE SET role = excluded.role, active = 1;

UPDATE users SET manager_id = NULL WHERE email = 'deepak@hexalis.in';
UPDATE users SET manager_id = (SELECT id FROM users WHERE email = 'deepak@hexalis.in')
  WHERE email IN ('divya.gulati@hexalis.in', 'mohit.sharma@hexalis.in');
UPDATE users SET manager_id = (SELECT id FROM users WHERE email = 'divya.gulati@hexalis.in')
  WHERE email = 'govind.jaiswal@hexalis.in';
