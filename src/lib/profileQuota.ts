import type { ProfileQuotaReport, QuotaWindowInfo } from "./types";

export const PROFILE_QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
export const PROFILE_QUOTA_ERROR_TTL_MS = 30 * 1000;
export const PROFILE_QUOTA_BATCH_CONCURRENCY = 2;

export interface ProfileQuotaCacheState {
  loading: boolean;
  report: ProfileQuotaReport | null;
  error: string | null;
  updatedAt: number;
}

export function isProfileQuotaCacheFresh(
  state: ProfileQuotaCacheState | undefined,
  now = Date.now(),
): boolean {
  if (!state || state.loading || state.updatedAt <= 0) return false;
  const ttl = state.error ? PROFILE_QUOTA_ERROR_TTL_MS : PROFILE_QUOTA_CACHE_TTL_MS;
  return now - state.updatedAt < ttl;
}

export function quotaWindowsForList(report: ProfileQuotaReport | null): QuotaWindowInfo[] {
  if (!report) return [];
  return report.windows
    .filter((window) => window.remainingPercent !== null || window.usedPercent !== null)
    .slice(0, 2);
}

export function compactQuotaWindowLabel(window: QuotaWindowInfo): string {
  if (window.windowMinutes === 300) return "5h";
  if (window.windowMinutes === 1440) return "24h";
  if (window.windowMinutes === 10080) return "7d";
  if (window.windowMinutes && window.windowMinutes >= 1440) {
    return `${Math.round(window.windowMinutes / 1440)}d`;
  }
  if (window.windowMinutes && window.windowMinutes >= 60) {
    return `${Math.round(window.windowMinutes / 60)}h`;
  }
  return window.label;
}

export function quotaRemainingPercent(window: QuotaWindowInfo): number | null {
  if (window.remainingPercent !== null) {
    return Math.max(0, Math.min(100, window.remainingPercent));
  }
  if (window.usedPercent !== null) {
    return Math.max(0, Math.min(100, 100 - window.usedPercent));
  }
  return null;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}
