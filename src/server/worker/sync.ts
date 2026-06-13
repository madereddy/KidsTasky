import ical from 'node-ical';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { db } from '../db.js';
import type { Server as SocketServer } from 'socket.io';
import { magicService } from '../modules/magic/service.js';
import { syncService, decryptConnection } from '../modules/sync/service.js';
import { 
  syncBackoff, 
  onGoogleSyncFailure, 
  onGoogleSyncSuccess, 
  shouldSkipGoogleSync 
} from '../lib/syncBackoff.js';
import { logger } from '../lib/logger.js';
import { markWorkerJobStart, markWorkerJobSuccess, markWorkerJobFailure } from './diagnostics.js';
import { SyncConnection } from '../../types.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function runMultiSourceSync(io?: SocketServer) {
  const startedAt = markWorkerJobStart('multiSourceSync');
  try {
    logger.info({}, 'worker_multi_source_sync_start');
    
    // 1. Google Calendar Sync
    if (shouldSkipGoogleSync()) {
      logger.info({ nextAllowedAt: new Date(syncBackoff.nextAllowedAt).toISOString() }, 'worker_google_sync_skipped_backoff');
    } else {
      try {
        const rows = db.prepare("SELECT * FROM sync_connections WHERE provider = 'google' AND refreshToken IS NOT NULL").all() as SyncConnection[];
        const connections = rows.map(decryptConnection);
        let anyRateLimit = false;
        for (const conn of connections) {
          try {
            const result = await syncService.syncGoogleConnectionNow(conn);
            if (result.errors.some(e => e.message.includes('invalid_grant'))) {
              logger.error({ connectionId: conn.id }, 'worker_google_invalid_grant');
              db.prepare('DELETE FROM sync_connections WHERE id = ?').run(conn.id);
            } else if (result.imported > 0) {
              io?.to(conn.parentId).emit('stale-data', { type: 'events' });
            }
            if (result.failureCount > 0) {
              logger.error({ connectionId: conn.id, errors: result.errors }, 'worker_google_sync_partial');
              for (const error of result.errors) {
                onGoogleSyncFailure(error);
              }
              anyRateLimit = true;
            }
          } catch (err: any) {
            logger.error({ connectionId: conn.id, error: err?.message }, 'worker_google_sync_connection_error');
            onGoogleSyncFailure(err);
            anyRateLimit = true;
          }
        }
        if (!anyRateLimit) onGoogleSyncSuccess();
      } catch (err: any) {
        logger.error({ error: err }, 'worker_google_sync_global_error');
        onGoogleSyncFailure(err);
      }
    }

    // 2. iCal Sync
    try {
      const icalConns = db.prepare("SELECT * FROM sync_connections WHERE icalUrl IS NOT NULL").all() as any[];
      for (const conn of icalConns) {
        if (!conn.icalUrl) continue;
        const webEvents = await ical.fromURL(conn.icalUrl);
        const existingExternalIds = new Set(
          (db.prepare("SELECT externalId FROM events WHERE parentId = ? AND source = 'ical' AND externalId IS NOT NULL")
            .all(conn.parentId) as Array<{ externalId: string }>)
            .map((row) => row.externalId)
        );
        let changes = false;
        for (const k in webEvents) {
          const ev: any = webEvents[k];
          if (!ev || ev.type !== 'VEVENT' || !ev.summary || !ev.start || !ev.end) continue;
          const eId = "ical_" + (ev.uid || k);
          if (!existingExternalIds.has(eId)) {
            db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eId, conn.parentId, ev.summary, ev.description || '', new Date(ev.start).getTime(), new Date(ev.end).getTime(), null, 'purple', eId, 'ical');
            existingExternalIds.add(eId);
            changes = true;
          }
        }
        if (changes) io?.to(conn.parentId).emit('stale-data', { type: 'events' });
      }
    } catch (err) { logger.error({ error: err }, 'worker_ical_sync_error'); }

    // 3. IMAP (Magic Email) Sync
    if (GEMINI_API_KEY) {
      try {
        const manualConns = syncService.getManualConnections();
        for (const conn of manualConns) {
          let connection;
          try {
            const config = { imap: { user: conn.email, password: conn.appPassword, host: 'imap.gmail.com', port: 993, tls: true, authTimeout: 3000 } };
            connection = await imaps.connect(config);
            await connection.openBox('INBOX');
            const messages = await connection.search(['UNSEEN'], { bodies: ['HEADER', 'TEXT'], markSeen: true });
            for (const msg of messages) {
              const all = msg.parts.find((p: any) => p.which === 'TEXT');
              if (all) {
                const parsed = await simpleParser(all.body);
                const extracted = await magicService.parseEventsFromText(parsed.text || parsed.html || '', GEMINI_API_KEY);
                if (extracted && extracted.title && extracted.date) {
                  const startTs = new Date(`${extracted.date}T${extracted.startTime || '09:00'}:00`).getTime();
                  db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("magic_" + Date.now() + "_" + msg.attributes.uid, conn.parentId, extracted.title, `From email: ${extracted.location || ''}`, startTs, startTs + 3600000, null, 'amber', 'magic');
                  io?.to(conn.parentId).emit('stale-data', { type: 'events' });
                }
              }
            }
          } catch (connErr) {
            logger.error({ email: conn.email, error: connErr }, 'worker_imap_connection_error');
          } finally {
            try { connection?.end(); } catch {}
          }
        }
      } catch (err) { logger.error({ error: err }, 'worker_imap_sync_error'); }
    }
    markWorkerJobSuccess('multiSourceSync', startedAt);
  } catch (error) {
    markWorkerJobFailure('multiSourceSync', startedAt, error);
    logger.error({ error }, 'worker_multi_source_sync_error');
    throw error;
  }
}
