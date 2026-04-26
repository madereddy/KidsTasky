import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from 'better-sqlite3';

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
      console.log(`Running migration: ${file}`);
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Strip manual schema_version updates from SQL to avoid UNIQUE constraint conflicts
      // with the migrator's own version tracking.
      sql = sql.replace(/UPDATE\s+schema_version\s+SET\s+version\s*=\s*\d+;?/gi, '');
      
      try {
        db.exec(sql);
      } catch (err: any) {
        if (err.message.includes('duplicate column name')) {
          console.warn(`Ignoring duplicate column in ${file}`);
        } else {
          throw err;
        }
      }
      db.prepare('UPDATE schema_version SET version = ?').run(version);
    }
  }
}
