import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from 'better-sqlite3';
import { logger } from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();

  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    INSERT OR IGNORE INTO schema_version (version) VALUES (0);
  `);

  // Force single row: Keep only the highest version to fix UNIQUE constraint errors
  // caused by manual SQL updates in previous versions.
  db.exec(`
    DELETE FROM schema_version 
    WHERE rowid NOT IN (SELECT rowid FROM schema_version ORDER BY version DESC LIMIT 1);
  `);

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  const currentVersion = row?.version || 0;

  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0], 10);
    if (version > currentVersion) {
      logger.info({ file, version }, 'migration_running');
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Strip manual schema_version updates from SQL to avoid UNIQUE constraint conflicts
      // with the migrator's own version tracking.
      sql = sql.replace(/UPDATE\s+schema_version\s+SET\s+version\s*=\s*\d+;?/gi, '');
      
      try {
        db.exec(sql);
      } catch (err: any) {
        if (err.message.includes('duplicate column name')) {
          logger.warn({ file, error: err.message }, 'migration_duplicate_column_ignored');
        } else {
          throw err;
        }
      }
      db.prepare('UPDATE schema_version SET version = ?').run(version);
    }
  }

  // Task 1: Add missing columns to lists if not exists
  const listColumns = [
    { name: 'category', type: "TEXT DEFAULT 'routine'" },
    { name: 'isRoutine', type: 'INTEGER DEFAULT 0' },
    { name: 'locationName', type: 'TEXT' },
    { name: 'createdAt', type: 'TEXT' },
    { name: 'updatedAt', type: 'TEXT' }
  ];

  for (const col of listColumns) {
    try {
      db.exec(`ALTER TABLE lists ADD COLUMN ${col.name} ${col.type}`);
    } catch (err: any) {
      if (!err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
        throw err;
      }
    }
  }

  // Task 1: Add usage tracking to list_items and item_stats
  try {
    db.exec(`
      ALTER TABLE list_items ADD COLUMN usageCount INTEGER DEFAULT 1;
    `);
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      throw err;
    }
  }

  db.exec(`
  CREATE TABLE IF NOT EXISTS item_stats (
    parentId TEXT NOT NULL,
    text TEXT NOT NULL,
    usageCount INTEGER DEFAULT 1,
    PRIMARY KEY (parentId, text)
  );
  `);

  // Migration 054: Extract |META: JSON from text and populate new columns
  const itemsWithMeta = db.prepare("SELECT id, text FROM list_items WHERE text LIKE '%|META:%'").all() as Array<{ id: string; text: string }>;
  if (itemsWithMeta.length > 0) {
  logger.info({ count: itemsWithMeta.length }, 'migration_extracting_list_item_metadata');
  const updateStmt = db.prepare('UPDATE list_items SET text = ?, storeName = ?, locationName = ?, completedAt = ? WHERE id = ?');
  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      const match = row.text.match(/(.*?)\s*\|META:(.+?)\|$/);
      if (match) {
        const cleanText = match[1].trim();
        try {
          const meta = JSON.parse(match[2]);
          updateStmt.run(
            cleanText,
            meta.storeName || null,
            meta.locationName || null,
            meta.completedAt || null,
            row.id
          );
        } catch (e) {
          logger.warn({ id: row.id, text: row.text }, 'migration_failed_to_parse_metadata');
        }
      }
    }
  });
  transaction(itemsWithMeta);
  }

  // Similar for lists table
  const listsWithMeta = db.prepare("SELECT id, title FROM lists WHERE title LIKE '%|META:%'").all() as Array<{ id: string; title: string }>;
  if (listsWithMeta.length > 0) {
  logger.info({ count: listsWithMeta.length }, 'migration_extracting_list_metadata');
  const updateStmt = db.prepare('UPDATE lists SET title = ?, locationName = ?, isRoutine = ? WHERE id = ?');
  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      const match = row.title.match(/(.*?)\s*\|META:(.+?)\|$/);
      if (match) {
        const cleanTitle = match[1].trim();
        try {
          const meta = JSON.parse(match[2]);
          updateStmt.run(
            cleanTitle,
            meta.locationName || null,
            meta.isRoutine ? 1 : 0,
            row.id
          );
        } catch (e) {
          logger.warn({ id: row.id, title: row.title }, 'migration_failed_to_parse_list_metadata');
        }
      }
    }
  });
  transaction(listsWithMeta);
  }
  }

