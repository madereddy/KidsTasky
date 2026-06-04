import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";
import fs from "fs";
import path from "path";
import { logger } from "./lib/logger.js";

export const dbPath = process.env.DB_PATH || 'database.db';
const isDevOrTest = process.env.VITEST || process.env.NODE_ENV === 'test';
const sqlDebugEnabled = process.env.SQL_DEBUG === '1' || process.env.DB_VERBOSE === '1';

if (!isDevOrTest) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      logger.info({ dir }, 'db_create_directory');
      fs.mkdirSync(dir, { recursive: true });
    }
    logger.info({
      dbPath,
      uid: process.getuid?.(),
      gid: process.getgid?.(),
    }, 'db_initializing');
  } catch (err) {
    logger.error({ error: err }, 'db_preinit_failed');
  }
}

export const db = new Database(isDevOrTest ? ':memory:' : dbPath, { 
  verbose: isDevOrTest || !sqlDebugEnabled ? undefined : ((sql) => logger.debug({ sql }, 'sql_statement'))
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // WAL provides durability; FULL double-syncs unnecessarily
db.pragma('cache_size = -16000'); // 16MB page cache — sufficient for self-hosted
db.pragma('busy_timeout = 5000');
db.pragma('temp_store = MEMORY');

// Initialize schema
runMigrations(db);
