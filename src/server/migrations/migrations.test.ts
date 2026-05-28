// @vitest-environment node
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrate.js';

describe('Migrations bootstrap', () => {
  it('creates homework and event attendees tables/indexes', () => {
    const db = new Database(':memory:');
    runMigrations(db as any);

    const homework = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='homework'").get() as any;
    const attendees = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='event_attendees'").get() as any;
    expect(homework?.name).toBe('homework');
    expect(attendees?.name).toBe('event_attendees');

    const idxHomeworkParent = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_homework_parent'").get() as any;
    const idxHomeworkDue = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_homework_due'").get() as any;
    const idxAttEvent = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_event_attendees_event'").get() as any;
    const idxAttUser = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_event_attendees_user'").get() as any;
    expect(idxHomeworkParent?.name).toBe('idx_homework_parent');
    expect(idxHomeworkDue?.name).toBe('idx_homework_due');
    expect(idxAttEvent?.name).toBe('idx_event_attendees_event');
    expect(idxAttUser?.name).toBe('idx_event_attendees_user');
  });
});
