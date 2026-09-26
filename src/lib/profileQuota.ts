import type { ProfileQuotaReport, QuotaWindowInfo } from "./types";

export const PROFILE_QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
export const PROFILE_QUOTA_ERROR_TTL_MS = 30 * 1000;
export const PROFILE_QUOTA_UNSUPPORTED_TTL_MS = 30 * 60 * 1000;
export const PROFILE_QUOTA_BATCH_CONCURRENCY = 2;
export const PROFILE_QUOTA_STORAGE_KEY = "rcodexmanager-quota-cache-v1";
export const PROFILE_QUOTA_UNSUPPORTED_ERROR = "does not have a configured quota provider";

export interface ProfileQuotaCacheState {
  loading: boolean;
  report: ProfileQuotaReport | null;
  error: string | null;
  updatedAt: number;
}

type QuotaStorage = Pick<Storage, "getItem" | "setItem">;

function defaultQuotaStorage(): QuotaStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isQuotaWindow(value: unknown): value is QuotaWindowInfo {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QuotaWindowInfo>;
  return typeof candidate.id === "string"
    && typeof candidate.label === "string"
    && isNullableNumber(candidate.usedPercent)
    && isNullableNumber(candidate.remainingPercent)
    && isNullableNumber(candidate.windowMinutes)
    && isNullableNumber(candidate.resetsAt)
    && typeof candidate.status === "string";
}

function isQuotaReport(value: unknown): value is ProfileQuotaReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProfileQuotaReport>;
  return typeof candidate.generatedAt === "string"
    && typeof candidate.profileName === "string"
    && typeof candidate.capturedAt === "number"
    && typeof candidate.endpoint === "string"
    && Array.isArray(candidate.windows)
    && candidate.windows.every(isQuotaWindow);
}

export function isProfileQuotaUnsupportedError(error: string | null | undefined): boolean {
  return Boolean(error?.includes(PROFILE_QUOTA_UNSUPPORTED_ERROR));
}

export function readPersistedProfileQuotaCache(
  storage: Pick<Storage, "getItem"> | null = defaultQuotaStorage(),
): Record<string, ProfileQuotaCacheState> {
  if (!storage) return {};

  try {
    const raw = storage.getItem(PROFILE_QUOTA_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const cache: Record<string, ProfileQuotaCacheState> = {};
    for (const [profileName, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value as { report?: unknown; error?: unknown; updatedAt?: unknown };
      if (typeof candidate.updatedAt !== "number" || !Number.isFinite(candidate.updatedAt)) {
        continue;
      }
      const report = isQuotaReport(candidate.report) ? candidate.report : null;
      const error = typeof candidate.error === "string" && isProfileQuotaUnsupportedError(candidate.error)
        ? candidate.error
        : null;
      if (!report && !error) continue;
      cache[profileName] = {
        loading: false,
        report,
        error,
        updatedAt: candidate.updatedAt,
      };
    }
    return cache;
  } catch {
    return {};
  }
}

export function persistProfileQuotaCache(
  cache: Record<string, ProfileQuotaCacheState>,
  storage: Pick<Storage, "setItem"> | null = defaultQuotaStorage(),
): void {
  if (!storage) return;

  try {
    const persisted = Object.fromEntries(
      Object.entries(cache)
        .filter(([, state]) => (
          (state.report || isProfileQuotaUnsupportedError(state.error))
          && Number.isFinite(state.updatedAt)
          && state.updatedAt > 0
        ))
        .map(([profileName, state]) => [profileName, {
          // The UI only needs the windows after restart; avoid persisting account metadata.
          report: state.report ? { ...state.report, account: null } : null,
          error: isProfileQuotaUnsupportedError(state.error) ? state.error : null,
          updatedAt: state.updatedAt,
        }]),
    );
    storage.setItem(PROFILE_QUOTA_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Local storage can be unavailable or full; the in-memory cache still works.
  }
}

export function isProfileQuotaCacheFresh(
  state: ProfileQuotaCacheState | undefined,
  now = Date.now(),
): boolean {
  if (!state || state.loading || state.updatedAt <= 0) return false;
  const ttl = isProfileQuotaUnsupportedError(state.error)
    ? PROFILE_QUOTA_UNSUPPORTED_TTL_MS
    : state.error
      ? PROFILE_QUOTA_ERROR_TTL_MS
      : PROFILE_QUOTA_CACHE_TTL_MS;
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

export function formatQuotaDateTime(
  value: number | null,
  locale: "zh-CN" | "en-US" = "zh-CN",
): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (locale === "zh-CN") {
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
  }
  return formatter.format(date);
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
