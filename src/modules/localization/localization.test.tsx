import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createLocalization } from "./index";

const module = createLocalization({
  defaultLocale: "zh-CN",
  supportedLocales: ["zh-CN", "en-US"] as const,
  catalogs: {
    "en-US": {
      "共 {count} 项": "{count} items",
    },
  },
  storageKey: "r-test-language",
});

describe("localization module", () => {
  it("translates, interpolates, and falls back to source text", () => {
    expect(module.translate("en-US", "共 {count} 项", { count: 3 })).toBe("3 items");
    expect(module.translate("en-US", "未收录")).toBe("未收录");
    expect(module.translate("zh-CN", "共 {count} 项", { count: 3 })).toBe("共 3 项");
  });

  it("validates persisted locales without owning the storage implementation", () => {
    const values = new Map<string, string>([["r-test-language", "en-US"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(module.readStoredLocale(storage)).toBe("en-US");
    module.writeStoredLocale("zh-CN", storage);
    expect(module.readStoredLocale(storage)).toBe("zh-CN");
  });

  it("exposes a typed provider and hook", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <module.LocalizationProvider locale="en-US">{children}</module.LocalizationProvider>
    );
    const { result } = renderHook(() => module.useLocalization(), { wrapper });
    expect(result.current.locale).toBe("en-US");
    expect(result.current.t("共 {count} 项", { count: 2 })).toBe("2 items");
  });
});
