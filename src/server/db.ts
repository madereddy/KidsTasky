import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || 'database.db';
const isDevOrTest = process.env.VITEST || process.env.NODE_ENV === 'test';
const sqlDebugEnabled = process.env.SQL_DEBUG === '1' || process.env.DB_VERBOSE === '1';

if (!isDevOrTest) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      console.log(`[DB] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log(`[DB] Initializing database at ${dbPath}`);
    console.log(`[DB] Current User: ${process.getuid?.()}:${process.getgid?.()}`);
  } catch (err) {
    console.error(`[DB] Pre-init check failed:`, err);
  }
}

export const db = new Database(isDevOrTest ? ':memory:' : dbPath, { 
  verbose: isDevOrTest || !sqlDebugEnabled ? undefined : console.log
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // WAL provides durability; FULL double-syncs unnecessarily
db.pragma('cache_size = -16000'); // 16MB page cache — sufficient for self-hosted
db.pragma('busy_timeout = 5000');
db.pragma('temp_store = MEMORY');

// Initialize schema
runMigrations(db);
