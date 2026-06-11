import { logger } from "./logger.js";

export const syncBackoff = { failCount: 0, nextAllowedAt: 0 };

export function onGoogleSyncFailure(err: any) {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || err?.cause?.code || "").toUpperCase();
  const is429 = err?.status === 429 || code === "429" ||
    msg.includes("quota") ||
    msg.includes("rate limit");
  const isNetwork = ["EAI_AGAIN", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"].includes(code) ||
    msg.includes("getaddrinfo") || msg.includes("fetch error") || msg.includes("eai_again");
    
  if (is429 || isNetwork) {
    syncBackoff.failCount++;
    // Exponential backoff: 1min, 2min, 4min, 8min, 16min — max 30min
    const delayMs = Math.min(Math.pow(2, syncBackoff.failCount) * 60_000, 30 * 60_000);
    syncBackoff.nextAllowedAt = Date.now() + delayMs;
    logger.warn({
      delayMinutes: delayMs / 60_000,
      failCount: syncBackoff.failCount,
      reason: is429 ? "rate_limit" : "network_error",
      error: msg
    }, "worker_google_sync_backed_off");
  }
}

export function onGoogleSyncSuccess() {
  syncBackoff.failCount = 0;
  syncBackoff.nextAllowedAt = 0;
}

export function shouldSkipGoogleSync(): boolean {
  return Date.now() < syncBackoff.nextAllowedAt;
}
