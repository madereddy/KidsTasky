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

  const currentVersion = db.prepare('SELECT version FROM schema_version').get()?.version || 0;

  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0], 10);
    if (version > currentVersion) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('UPDATE schema_version SET version = ?').run(version);
    }
  }
}
