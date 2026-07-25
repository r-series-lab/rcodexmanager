import type { ProfileInfo } from "./types";

export type ProfileSortMode = "smart" | "recent" | "name";

export const PROFILE_SORT_OPTIONS: ReadonlyArray<{ value: ProfileSortMode; label: string }> = [
  { value: "smart", label: "智能排序" },
  { value: "recent", label: "最近使用" },
  { value: "name", label: "名称排序" },
];

export function parseProfileSortMode(value: string | null | undefined): ProfileSortMode {
  return value === "recent" || value === "name" || value === "smart" ? value : "smart";
}

export function profileActivityTime(profile: ProfileInfo): number {
  const sessions = [profile.latestSession, ...profile.recentSessions].filter(Boolean);
  return sessions.reduce((latest, session) => {
    const value = Date.parse(session?.updatedAt || session?.startedAt || "");
    return Number.isNaN(value) ? latest : Math.max(latest, value);
  }, 0);
}

function compareProfileName(left: ProfileInfo, right: ProfileInfo): number {
  const leftLabel = left.alias || left.name;
  const rightLabel = right.alias || right.name;
  return leftLabel.localeCompare(rightLabel, "zh-CN", { numeric: true })
    || left.name.localeCompare(right.name, "en", { numeric: true });
}

function compareRecent(left: ProfileInfo, right: ProfileInfo): number {
  return profileActivityTime(right) - profileActivityTime(left)
    || Number(right.isDefault) - Number(left.isDefault)
    || compareProfileName(left, right);
}

export function sortProfiles(profiles: readonly ProfileInfo[], mode: ProfileSortMode): ProfileInfo[] {
  return [...profiles].sort((left, right) => {
    if (mode === "name") {
      return compareProfileName(left, right);
    }
    if (mode === "smart") {
      const runningOrder = Number(right.isRunning) - Number(left.isRunning);
      if (runningOrder !== 0) {
        return runningOrder;
      }
    }
    return compareRecent(left, right);
  });
}
