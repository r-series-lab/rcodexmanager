import { describe, expect, it } from "vitest";
import type { ServerNodeOperation } from "../../lib/types";
import {
  appendServerNodeTask,
  classifyServerNodeError,
  failedServerNodeTask,
  formatServerNodeDiagnostic,
  safeRetryOperation,
  SERVER_NODE_TASK_LIMIT,
  type ServerNodeTaskEntry,
} from "./serverNodeTasks";

describe("serverNodeTasks", () => {
  it("allows retry only for read-only operations", () => {
    const read: ServerNodeOperation = { kind: "doctor" };
    const write: ServerNodeOperation = { kind: "launch-profile", profileName: "codex-g" };
    expect(safeRetryOperation(read)).toBe(read);
    expect(safeRetryOperation(write)).toBeNull();
  });

  it("keeps only the newest ten tasks for each node", () => {
    let history: ServerNodeTaskEntry[] = [];
    for (let index = 0; index < SERVER_NODE_TASK_LIMIT + 3; index += 1) {
      history = appendServerNodeTask(history, failedServerNodeTask(
        "node-a",
        { kind: "doctor" },
        `node-op-${index}-1: failed`,
        new Date(index).toISOString(),
        index,
      ));
    }
    expect(history).toHaveLength(SERVER_NODE_TASK_LIMIT);
    expect(history[0].error).toContain(`node-op-${SERVER_NODE_TASK_LIMIT + 2}-1`);
  });

  it("turns transport failures into actionable guidance", () => {
    expect(classifyServerNodeError("Permission denied (publickey)").code).toBe("ssh-auth");
    expect(classifyServerNodeError("SSH operation timed out after 30 seconds").code).toBe("timeout");
    expect(classifyServerNodeError("another write operation is already running").code).toBe("busy");
  });

  it("redacts credentials from copied diagnostics", () => {
    const task = failedServerNodeTask(
      "node-a",
      { kind: "doctor" },
      "node-op-1-1: Authorization=Bearer secret-value token=abc123",
      new Date(0).toISOString(),
      20,
    );
    const diagnostic = formatServerNodeDiagnostic("Server", "server-alias", task, null);
    expect(diagnostic).not.toContain("secret-value");
    expect(diagnostic).not.toContain("abc123");
    expect(diagnostic).toContain("[redacted]");
  });
});
