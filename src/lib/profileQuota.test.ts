import { describe, expect, it } from "vitest";
import {
  compactQuotaWindowLabel,
  formatQuotaDateTime,
  isProfileQuotaCacheFresh,
  mapWithConcurrency,
  persistProfileQuotaCache,
  quotaRemainingPercent,
  quotaWindowsForList,
  PROFILE_QUOTA_CACHE_TTL_MS,
  PROFILE_QUOTA_ERROR_TTL_MS,
  PROFILE_QUOTA_UNSUPPORTED_ERROR,
  PROFILE_QUOTA_UNSUPPORTED_TTL_MS,
  PROFILE_QUOTA_STORAGE_KEY,
  readPersistedProfileQuotaCache,
  type ProfileQuotaCacheState,
} from "./profileQuota";
import type { ProfileQuotaReport, QuotaWindowInfo } from "./types";

function state(overrides: Partial<ProfileQuotaCacheState> = {}): ProfileQuotaCacheState {
  return {
    loading: false,
    report: null,
    error: null,
    updatedAt: 1_000,
    ...overrides,
  };
}

function windowInfo(overrides: Partial<QuotaWindowInfo> = {}): QuotaWindowInfo {
  return {
    id: "primary",
    label: "Main",
    usedPercent: 38,
    remainingPercent: 62,
    windowMinutes: 300,
    resetsAt: null,
    allowed: true,
    limitReached: false,
    status: "available",
    ...overrides,
  };
}

describe("profile quota list helpers", () => {
  it("uses a longer success cache and a short failure cooldown", () => {
    expect(isProfileQuotaCacheFresh(state(), 1_000 + PROFILE_QUOTA_CACHE_TTL_MS - 1)).toBe(true);
    expect(isProfileQuotaCacheFresh(state(), 1_000 + PROFILE_QUOTA_CACHE_TTL_MS)).toBe(false);
    expect(isProfileQuotaCacheFresh(state({ error: "offline" }), 1_000 + PROFILE_QUOTA_ERROR_TTL_MS - 1)).toBe(true);
    expect(isProfileQuotaCacheFresh(state({ error: "offline" }), 1_000 + PROFILE_QUOTA_ERROR_TTL_MS)).toBe(false);
    expect(isProfileQuotaCacheFresh(
      state({ error: `codex-kimi ${PROFILE_QUOTA_UNSUPPORTED_ERROR}` }),
      1_000 + PROFILE_QUOTA_UNSUPPORTED_TTL_MS - 1,
    )).toBe(true);
    expect(isProfileQuotaCacheFresh(
      state({ error: `codex-kimi ${PROFILE_QUOTA_UNSUPPORTED_ERROR}` }),
      1_000 + PROFILE_QUOTA_UNSUPPORTED_TTL_MS,
    )).toBe(false);
    expect(isProfileQuotaCacheFresh(state({ loading: true }), 1_001)).toBe(false);
  });

  it("selects two compact windows and derives remaining percentages", () => {
    const report: ProfileQuotaReport = {
      generatedAt: "",
      profileName: "codex-b",
      account: null,
      capturedAt: 0,
      endpoint: "",
      windows: [
        windowInfo(),
        windowInfo({ id: "secondary", windowMinutes: 10080, usedPercent: 71, remainingPercent: null }),
        windowInfo({ id: "extra" }),
      ],
    };
    expect(quotaWindowsForList(report)).toHaveLength(2);
    expect(compactQuotaWindowLabel(report.windows[0])).toBe("5h");
    expect(compactQuotaWindowLabel(report.windows[1])).toBe("7d");
    expect(quotaRemainingPercent(report.windows[0])).toBe(62);
    expect(quotaRemainingPercent(report.windows[1])).toBe(29);
  });

  it("limits concurrent quota requests while retaining input order", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });
    expect(peak).toBe(2);
    expect(results).toEqual([2, 4, 6, 8]);
  });

  it("persists successful reports and restores them as immediately displayable cache", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const report: ProfileQuotaReport = {
      generatedAt: "2026-09-20T00:00:00.000Z",
      profileName: "codex-b",
      account: {
        authMode: "chatgpt",
        email: "private@example.com",
        name: null,
        accountId: "acct-1",
        userId: "user-1",
        planType: "plus",
        organizationTitle: null,
        lastRefresh: null,
      },
      capturedAt: 1_758_326_400,
      endpoint: "https://chatgpt.com/backend-api/wham/usage",
      windows: [windowInfo({ resetsAt: 1_758_333_600 })],
    };

    persistProfileQuotaCache({
      "codex-b": {
        loading: false,
        report,
        error: null,
        updatedAt: 1_758_326_401_000,
      },
    }, storage);

    const raw = JSON.parse(values.get(PROFILE_QUOTA_STORAGE_KEY) ?? "{}");
    expect(raw["codex-b"].report.account).toBeNull();
    expect(readPersistedProfileQuotaCache(storage)).toEqual({
      "codex-b": {
        loading: false,
        report: { ...report, account: null },
        error: null,
        updatedAt: 1_758_326_401_000,
      },
    });
  });

  it("persists unsupported results without treating them as a quota report", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const unsupported = `codex-kimi ${PROFILE_QUOTA_UNSUPPORTED_ERROR}`;
    persistProfileQuotaCache({
      "codex-kimi": {
        loading: false,
        report: null,
        error: unsupported,
        updatedAt: 1_758_326_401_000,
      },
    }, storage);

    expect(readPersistedProfileQuotaCache(storage)).toEqual({
      "codex-kimi": {
        loading: false,
        report: null,
        error: unsupported,
        updatedAt: 1_758_326_401_000,
      },
    });
  });

  it("formats reset dates with both date and time", () => {
    const formatted = formatQuotaDateTime(1_758_333_600, "zh-CN");
    expect(formatted).toMatch(/\d+月\d+日/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
    expect(formatQuotaDateTime(null)).toBe("--");
  });
});
