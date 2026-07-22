-- FTS5 virtual table for full-text search on skills
CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  name, description, content, content=skills, content_rowid=rowid
);

-- Auto-sync triggers: keep FTS5 in sync with skills table

-- Insert trigger
CREATE TRIGGER IF NOT EXISTS skills_fts_insert AFTER INSERT ON skills BEGIN
  INSERT INTO skills_fts(rowid, name, description, content)
  VALUES (new.rowid, new.name, new.description, new.content);
END;

-- Delete trigger
CREATE TRIGGER IF NOT EXISTS skills_fts_delete AFTER DELETE ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content)
  VALUES ('delete', old.rowid, old.name, old.description, old.content);
END;

-- Update trigger
CREATE TRIGGER IF NOT EXISTS skills_fts_update AFTER UPDATE ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content)
  VALUES ('delete', old.rowid, old.name, old.description, old.content);
  INSERT INTO skills_fts(rowid, name, description, content)
  VALUES (new.rowid, new.name, new.description, new.content);
END;
