import { describe, expect, it } from "vitest";
import {
  compactQuotaWindowLabel,
  isProfileQuotaCacheFresh,
  mapWithConcurrency,
  quotaRemainingPercent,
  quotaWindowsForList,
  PROFILE_QUOTA_CACHE_TTL_MS,
  PROFILE_QUOTA_ERROR_TTL_MS,
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
});
