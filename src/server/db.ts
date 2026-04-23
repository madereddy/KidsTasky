import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

const dbPath = process.env.DB_PATH || 'database.db';
export const db = new Database(process.env.VITEST || process.env.NODE_ENV === 'test' ? ':memory:' : dbPath, { 
  verbose: process.env.VITEST || process.env.NODE_ENV === 'test' ? undefined : console.log 
});

db.pragma('journal_mode = WAL');

// Initialize schema
runMigrations(db);
