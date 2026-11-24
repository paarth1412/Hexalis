-- HEXALIS Leave & Attendance — round two: shifts, corrections, employee details,
-- notifications, documents, settings and idle sign-out.

-- ---- people ------------------------------------------------------------------
ALTER TABLE users ADD COLUMN employee_code TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN designation TEXT;
ALTER TABLE users ADD COLUMN joining_date TEXT;          -- YYYY-MM-DD; no leave or "missing" days before it
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN dob TEXT;                   -- for birthdays on the team dashboard
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN emergency_name TEXT;
ALTER TABLE users ADD COLUMN emergency_relation TEXT;
ALTER TABLE users ADD COLUMN emergency_phone TEXT;
CREATE UNIQUE INDEX users_code ON users(employee_code) WHERE employee_code IS NOT NULL;

-- ---- sessions: sign out after a period of inactivity ------------------------
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;

-- ---- attendance: shift results, where it came from, corrections ------------
ALTER TABLE attendance ADD COLUMN late INTEGER NOT NULL DEFAULT 0;        -- checked in after shift start + grace
ALTER TABLE attendance ADD COLUMN early INTEGER NOT NULL DEFAULT 0;       -- checked out before shift end
ALTER TABLE attendance ADD COLUMN worked_min INTEGER;                     -- minutes between check-in and check-out
ALTER TABLE attendance ADD COLUMN day_status TEXT;                        -- present | half_day | short (set at check-out)
ALTER TABLE attendance ADD COLUMN ip TEXT;
ALTER TABLE attendance ADD COLUMN user_agent TEXT;
ALTER TABLE attendance ADD COLUMN distance_m INTEGER;                     -- from the office, when location is checked
ALTER TABLE attendance ADD COLUMN corrected INTEGER NOT NULL DEFAULT 0;   -- 1 = times changed by an approved correction

CREATE TABLE corrections (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('in','out','both')),
  mode          TEXT CHECK (mode IN ('office','wfh')),   -- only when there was no record that day
  check_in_at   TEXT,
  check_out_at  TEXT,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewer_id   INTEGER REFERENCES users(id),
  reviewed_at   TEXT,
  review_note   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX corrections_user ON corrections(user_id, date);

-- ---- leave: monthly build-up and supporting documents -----------------------
ALTER TABLE leave_types ADD COLUMN accrual TEXT NOT NULL DEFAULT 'yearly';  -- yearly = all on 1 Jan; monthly = 1/12 per completed month
ALTER TABLE leave_types ADD COLUMN doc_after_days REAL;                     -- a document is required above this many days; NULL = never

CREATE TABLE leave_docs (
  leave_id  INTEGER PRIMARY KEY REFERENCES leaves(id),
  name      TEXT NOT NULL,
  mime      TEXT NOT NULL,
  size      INTEGER NOT NULL,
  data      BLOB NOT NULL
);

-- ---- notifications (the bell) -------------------------------------------------
CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  text        TEXT NOT NULL,
  link        TEXT,                    -- an app tab, e.g. "approvals"
  created_at  TEXT NOT NULL,
  read_at     TEXT
);
CREATE INDEX notifications_user ON notifications(user_id, read_at);

-- ---- settings the admin can change -------------------------------------------
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('shift_start', '09:30'),
  ('shift_end', '18:30'),
  ('grace_min', '15'),
  ('full_day_hours', '8'),
  ('half_day_hours', '4'),
  ('weekend', '0,6'),          -- 0 = Sunday … 6 = Saturday
  ('idle_minutes', '60'),
  ('office_lat', ''),
  ('office_lon', ''),
  ('office_radius_m', '0');    -- 0 = don't check location

-- Placeholders, like the others: editable or removable under Settings.
UPDATE leave_types SET doc_after_days = 2 WHERE name = 'Sick leave';
INSERT INTO leave_types (name, yearly_quota, accrual) VALUES ('Earned leave', 15, 'monthly');
