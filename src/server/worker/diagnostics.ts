export type WorkerJobDiagnostics = {
  name: string;
  intervalType: 'interval' | 'cron';
  schedule: string;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastDurationMs: number | null;
  successCount: number;
  failureCount: number;
  lastError: string | null;
};

export const workerJobs: Record<string, WorkerJobDiagnostics> = {
  eventReminders: {
    name: 'eventReminders',
    intervalType: 'interval',
    schedule: '60000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  overdueTasks: {
    name: 'overdueTasks',
    intervalType: 'interval',
    schedule: '300000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  photoCleanup: {
    name: 'photoCleanup',
    intervalType: 'interval',
    schedule: '900000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  dailyCleanup: {
    name: 'dailyCleanup',
    intervalType: 'cron',
    schedule: '0 3 * * *',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  multiSourceSync: {
    name: 'multiSourceSync',
    intervalType: 'cron',
    schedule: '*/5 * * * *',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
};

export function markWorkerJobStart(jobName: keyof typeof workerJobs): number {
  const startedAt = Date.now();
  const job = workerJobs[jobName];
  job.lastStartedAt = startedAt;
  return startedAt;
}

export function markWorkerJobSuccess(jobName: keyof typeof workerJobs, startedAt: number) {
  const job = workerJobs[jobName];
  const finishedAt = Date.now();
  job.lastFinishedAt = finishedAt;
  job.lastSuccessAt = finishedAt;
  job.lastDurationMs = finishedAt - startedAt;
  job.successCount += 1;
  job.lastError = null;
}

export function markWorkerJobFailure(jobName: keyof typeof workerJobs, startedAt: number, error: unknown) {
  const job = workerJobs[jobName];
  const finishedAt = Date.now();
  job.lastFinishedAt = finishedAt;
  job.lastFailureAt = finishedAt;
  job.lastDurationMs = finishedAt - startedAt;
  job.failureCount += 1;
  job.lastError = error instanceof Error ? error.message : String(error);
}
