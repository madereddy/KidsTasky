import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || 'database.db';
const isDevOrTest = process.env.VITEST || process.env.NODE_ENV === 'test';

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
  verbose: isDevOrTest ? undefined : console.log 
});

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('busy_timeout = 5000'); // 5 second timeout for write locks
db.pragma('temp_store = MEMORY'); // Store temp tables and indices in memory

// Initialize schema
runMigrations(db);
