import type { ProfileInfo, ProfileReport, ProfileRuntimeReport } from "./types";

function mergeProfiles(
  profiles: ProfileInfo[],
  runtimeByName: Map<string, ProfileRuntimeReport["profiles"][number]>,
): { changed: boolean; profiles: ProfileInfo[] } {
  let changed = false;
  const nextProfiles = profiles.map((profile) => {
    const runtime = runtimeByName.get(profile.name);
    if (
      !runtime ||
      (profile.isRunning === runtime.isRunning &&
        profile.runningProcessCount === runtime.runningProcessCount &&
        profile.runningPids.length === runtime.runningPids.length &&
        profile.runningPids.every((pid, index) => pid === runtime.runningPids[index]))
    ) {
      return profile;
    }
    changed = true;
    return {
      ...profile,
      isRunning: runtime.isRunning,
      runningPids: runtime.runningPids,
      runningProcessCount: runtime.runningProcessCount,
    };
  });
  return { changed, profiles: nextProfiles };
}

export function mergeProfileRuntimeReport(
  report: ProfileReport,
  runtimeReport: ProfileRuntimeReport,
): ProfileReport {
  const runtimeByName = new Map(runtimeReport.profiles.map((profile) => [profile.name, profile]));
  const active = mergeProfiles(report.profiles, runtimeByName);
  const archived = mergeProfiles(report.archivedProfiles ?? [], runtimeByName);
  if (!active.changed && !archived.changed) {
    return report;
  }
  return {
    ...report,
    profiles: active.profiles,
    archivedProfiles: archived.profiles,
  };
}
