import { describe, expect, it } from "vitest";
import { createTranslator } from ".";

describe("rCodexManager language catalog", () => {
  it("translates shared workspace copy and preserves runtime content", () => {
    const t = createTranslator("en-US");

    expect(t("设置")).toBe("Settings");
    expect(t("共 {count} 个 profile", { count: 8 })).toBe("8 profiles");
    expect(t("server log: authentication failed")).toBe(
      "server log: authentication failed",
    );
  });
});
