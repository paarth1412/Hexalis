-- HEXALIS Leave & Attendance — email notifications.

-- Every email is written here first, then sent in the background with retries,
-- so a slow or briefly unavailable mail server never loses or delays anything.
CREATE TABLE outbox (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  to_addr     TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,                 -- plain text; the HTML version is built when sending
  link        TEXT,                          -- app tab for the button, e.g. "approvals"
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','expired')),
  tries       INTEGER NOT NULL DEFAULT 0,
  next_at     TEXT NOT NULL,                 -- not before this time (retry back-off)
  error       TEXT,
  created_at  TEXT NOT NULL,
  sent_at     TEXT
);
CREATE INDEX outbox_due ON outbox(status, next_at);

-- Each person can turn ordinary notification emails off under Account.
-- Security emails (password changed or reset, account locked) are always sent.
ALTER TABLE users ADD COLUMN email_notify INTEGER NOT NULL DEFAULT 1;

-- The evening "you haven't checked out" reminder goes out once per day.
INSERT INTO settings (key, value) VALUES ('reminders_sent_on', ''), ('outbox_lock', '');
