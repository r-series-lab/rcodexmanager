import { describe, expect, it } from "vitest";
import { createMockProfileReport } from "./mock-data";
import { mergeProfileRuntimeReport } from "./profileRuntime";

describe("mergeProfileRuntimeReport", () => {
  it("updates only runtime fields and preserves report identity when nothing changes", () => {
    const report = createMockProfileReport();
    const target = report.profiles[0];
    const updated = mergeProfileRuntimeReport(report, {
      generatedAt: new Date().toISOString(),
      profiles: [{
        name: target.name,
        isRunning: !target.isRunning,
        runningPids: [9123],
        runningProcessCount: 1,
      }],
    });

    expect(updated).not.toBe(report);
    expect(updated.profiles[0]).toMatchObject({
      name: target.name,
      alias: target.alias,
      isRunning: !target.isRunning,
      runningPids: [9123],
      runningProcessCount: 1,
    });

    const unchanged = mergeProfileRuntimeReport(updated, {
      generatedAt: new Date().toISOString(),
      profiles: [{
        name: target.name,
        isRunning: !target.isRunning,
        runningPids: [9123],
        runningProcessCount: 1,
      }],
    });
    expect(unchanged).toBe(updated);
  });

  it("updates archived profiles and ignores profiles absent from the current report", () => {
    const baseReport = createMockProfileReport();
    const archived = { ...baseReport.profiles[0], isArchived: true };
    const report = {
      ...baseReport,
      archivedCount: 1,
      archivedProfiles: [archived],
    };

    const updated = mergeProfileRuntimeReport(report, {
      generatedAt: new Date().toISOString(),
      profiles: [
        {
          name: archived.name,
          isRunning: true,
          runningPids: [42],
          runningProcessCount: 1,
        },
        {
          name: "codex-missing",
          isRunning: true,
          runningPids: [99],
          runningProcessCount: 1,
        },
      ],
    });

    expect(updated.archivedProfiles?.[0]).toMatchObject({
      name: archived.name,
      isRunning: true,
      runningPids: [42],
      runningProcessCount: 1,
    });
    expect(updated.profileCount).toBe(report.profileCount);
  });
});
