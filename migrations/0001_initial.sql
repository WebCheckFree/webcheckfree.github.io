CREATE TABLE IF NOT EXISTS audit_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  stage TEXT NOT NULL,
  state_json TEXT NOT NULL,
  audit_json TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  client_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_expires_at ON audit_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_client_key ON audit_jobs(client_key);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
