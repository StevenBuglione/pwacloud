PRAGMA foreign_keys = ON;
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE registrations (
  id TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL,
  client_id TEXT NOT NULL, provider_workspace TEXT NOT NULL,
  credential_ref TEXT, state TEXT NOT NULL,
  UNIQUE(issuer, subject, client_id, provider_workspace)
);
CREATE TABLE workspaces (id TEXT PRIMARY KEY, title TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE installs (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id), id TEXT NOT NULL,
  plugin_id TEXT NOT NULL, digest TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation > 0),
  state TEXT NOT NULL, manifest_json TEXT NOT NULL,
  PRIMARY KEY(workspace_id, id)
);
CREATE TABLE grants (
  workspace_id TEXT NOT NULL, install_id TEXT NOT NULL, id TEXT NOT NULL,
  capability TEXT NOT NULL, scope_json TEXT NOT NULL,
  generation INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  expires_at INTEGER,
  PRIMARY KEY(workspace_id, install_id, id),
  FOREIGN KEY(workspace_id, install_id) REFERENCES installs(workspace_id, id) ON DELETE CASCADE
);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  registration_id TEXT REFERENCES registrations(id),
  generation INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE runs (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, install_id TEXT NOT NULL,
  registration_id TEXT REFERENCES registrations(id),
  generation INTEGER NOT NULL, account_generation INTEGER NOT NULL,
  account_key TEXT NOT NULL DEFAULT 'legacy-unbound', idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','running','completed','failed','interrupted','cancelled')),
  provider_mode TEXT NOT NULL CHECK(provider_mode IN ('demo','chatgpt-plan-local','approved-hosted')),
  created_at INTEGER NOT NULL, last_sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, install_id, idempotency_key),
  FOREIGN KEY(workspace_id, install_id) REFERENCES installs(workspace_id,id)
);
CREATE TABLE run_events (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence > 0), kind TEXT NOT NULL, payload_json TEXT NOT NULL,
  PRIMARY KEY(run_id, sequence)
);
CREATE TABLE usage_reservations (
  run_id TEXT PRIMARY KEY REFERENCES runs(id), admitted_at INTEGER NOT NULL,
  completed_at INTEGER, input_bytes INTEGER NOT NULL CHECK(input_bytes >= 0),
  provider_usage_json TEXT
);
CREATE INDEX run_owner_time ON runs(workspace_id, install_id, created_at);
-- The opaque account key binds verified issuer/subject, independently of session generation or client ID.
CREATE INDEX run_account_time ON runs(account_key, created_at);
CREATE INDEX grants_capability ON grants(workspace_id, install_id, capability, revoked);
INSERT INTO schema_migrations VALUES(1, 'implementation-time');
