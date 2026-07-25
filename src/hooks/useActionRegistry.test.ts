import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionRegistry } from "./useActionRegistry";

describe("useActionRegistry", () => {
  it("keeps unrelated operations independent and rejects duplicate starts", () => {
    const { result } = renderHook(() => useActionRegistry());

    act(() => {
      expect(result.current.startAction("profile.lifecycle:codex-g", "启动中")).toBe(true);
      expect(result.current.startAction("profile.lifecycle:codex-g", "再次启动")).toBe(false);
      expect(result.current.startAction("auth.import", "导入备份包")).toBe(true);
    });

    expect(result.current.isActionBusy("profile.lifecycle:codex-g")).toBe(true);
    expect(result.current.isActionBusy("profile.")).toBe(true);
    expect(result.current.isActionBusy("modelRoute.")).toBe(false);
    expect(result.current.activeActions.map((action) => action.label)).toEqual(["启动中", "导入备份包"]);

    act(() => result.current.finishAction("profile.lifecycle:codex-g"));

    expect(result.current.isActionBusy("profile.")).toBe(false);
    expect(result.current.isActionBusy("auth.")).toBe(true);
    expect(result.current.activeActions).toHaveLength(1);
  });
});
