CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  is_group INTEGER NOT NULL,
  name TEXT,
  last_active INTEGER,
  last_message TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  msg_id TEXT,
  timestamp INTEGER,
  is_passive INTEGER DEFAULT 0,
  author_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
