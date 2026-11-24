-- HEXALIS Leave & Attendance (/lna) — initial schema (Cloudflare D1 / SQLite)

CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin','manager','employee')),
  manager_id      INTEGER REFERENCES users(id),
  password_hash   TEXT,                       -- pbkdf2$iterations$salt$hash; never plain text
  must_change     INTEGER NOT NULL DEFAULT 1, -- 1 = temporary password, must be changed at next login
  active          INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_login_at   TEXT
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,               -- SHA-256 of the cookie token; the token itself is never stored
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE ip_failures (                    -- slows down guessing from one address across many accounts
  ip           TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE oauth_states (                   -- one-time values for "Sign in with Google"
  state      TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

CREATE TABLE attendance (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,                 -- YYYY-MM-DD, India time
  mode          TEXT NOT NULL CHECK (mode IN ('office','wfh')),
  status        TEXT NOT NULL CHECK (status IN ('approved','pending','rejected')),
  check_in_at   TEXT NOT NULL,
  check_out_at  TEXT,
  reviewer_id   INTEGER REFERENCES users(id),
  reviewed_at   TEXT,
  review_note   TEXT,
  UNIQUE (user_id, date)
);

CREATE TABLE leave_types (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  yearly_quota  REAL,                          -- NULL = no limit (e.g. unpaid / absence)
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE leaves (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  half_day      INTEGER NOT NULL DEFAULT 0,
  days          REAL NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewer_id   INTEGER REFERENCES users(id),
  reviewed_at   TEXT,
  review_note   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX leaves_user ON leaves(user_id, start_date);

CREATE TABLE holidays (
  id    INTEGER PRIMARY KEY,
  date  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

CREATE TABLE audit_log (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER,
  action   TEXT NOT NULL,
  detail   TEXT,
  at       TEXT NOT NULL
);

-- Placeholder leave types. Your policy isn't decided yet: the admin can rename,
-- re-quota or switch these off from Settings, and add new ones.
INSERT INTO leave_types (name, yearly_quota) VALUES
  ('Casual leave', 12),
  ('Sick leave', 6),
  ('Unpaid leave / absence', NULL);
