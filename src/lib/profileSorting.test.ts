import { describe, expect, it } from "vitest";
import type { ProfileInfo } from "./types";
import {
  parseProfileSortMode,
  profileActivityTime,
  sortProfiles,
} from "./profileSorting";

function profile(
  name: string,
  options: { alias?: string; running?: boolean; default?: boolean; updatedAt?: string | null } = {},
): ProfileInfo {
  const session = options.updatedAt === undefined ? null : {
    id: `${name}-session`,
    title: name,
    renamedTitle: null,
    summary: null,
    updatedAt: options.updatedAt,
    startedAt: null,
    cwd: null,
    path: null,
  };
  return {
    name,
    alias: options.alias ?? null,
    category: "测试",
    note: null,
    codexHome: `/tmp/${name}`,
    userDataDir: `/tmp/${name}-data`,
    configPath: `/tmp/${name}/config.toml`,
    model: null,
    modelProvider: null,
    reasoningEffort: null,
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: true,
    isDefault: options.default ?? false,
    launcherKind: "desktop",
    zshrcLine: 1,
    isRunning: options.running ?? false,
    runningPids: [],
    runningProcessCount: 0,
    account: null,
    latestSession: session,
    recentSessions: session ? [session] : [],
  };
}

describe("profile sorting", () => {
  it("puts running profiles first in smart mode, then uses recent activity", () => {
    const input = [
      profile("codex-a", { updatedAt: "2026-07-20T09:00:00Z" }),
      profile("codex-b", { running: true, updatedAt: "2026-07-18T09:00:00Z" }),
      profile("codex-c", { updatedAt: "2026-07-19T09:00:00Z" }),
    ];

    expect(sortProfiles(input, "smart").map((item) => item.name)).toEqual([
      "codex-b",
      "codex-a",
      "codex-c",
    ]);
    expect(input.map((item) => item.name)).toEqual(["codex-a", "codex-b", "codex-c"]);
  });

  it("sorts purely by activity in recent mode", () => {
    const input = [
      profile("codex-a", { running: true, updatedAt: "2026-07-18T09:00:00Z" }),
      profile("codex-b", { updatedAt: "2026-07-20T09:00:00Z" }),
    ];

    expect(sortProfiles(input, "recent").map((item) => item.name)).toEqual(["codex-b", "codex-a"]);
  });

  it("uses the visible label for name mode and handles missing activity", () => {
    const input = [
      profile("codex-z", { alias: "阿尔法" }),
      profile("codex-a", { alias: "Beta" }),
      profile("codex-default", { default: true }),
    ];

    expect(sortProfiles(input, "name").map((item) => item.name)).toEqual([
      "codex-z",
      "codex-a",
      "codex-default",
    ]);
    expect(profileActivityTime(input[0])).toBe(0);
  });

  it("falls back to smart mode for unknown saved values", () => {
    expect(parseProfileSortMode("recent")).toBe("recent");
    expect(parseProfileSortMode("unexpected")).toBe("smart");
    expect(parseProfileSortMode(null)).toBe("smart");
  });
});
