import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

const dbPath = process.env.DB_PATH || 'database.db';
export const db = new Database(process.env.VITEST || process.env.NODE_ENV === 'test' ? ':memory:' : dbPath, { 
  verbose: process.env.VITEST || process.env.NODE_ENV === 'test' ? undefined : console.log 
});

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('busy_timeout = 5000'); // 5 second timeout for write locks
db.pragma('temp_store = MEMORY'); // Store temp tables and indices in memory

// Initialize schema
runMigrations(db);
