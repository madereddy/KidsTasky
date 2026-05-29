CREATE TABLE IF NOT EXISTS proof_templates (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  questionsJson TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proof_templates_parent_kind_name
  ON proof_templates(parentId, kind, name);

CREATE INDEX IF NOT EXISTS idx_proof_templates_parent_kind_pinned
  ON proof_templates(parentId, kind, pinned DESC, updatedAt DESC);
