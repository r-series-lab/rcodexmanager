import { describe, expect, it } from "vitest";
import { visibleWechatLog, wechatStatePresentation } from "./serverWechat";

describe("server WeChat presentation", () => {
  it("maps runtime states without treating errors as awaiting scan", () => {
    expect(wechatStatePresentation("awaiting-scan")).toEqual({
      label: "等待扫码",
      tone: "warning",
    });
    expect(wechatStatePresentation("error")).toEqual({
      label: "异常",
      tone: "error",
    });
    expect(wechatStatePresentation("unbound")).toEqual({
      label: "未绑定",
      tone: "neutral",
    });
  });

  it("shows only the latest QR block after a refresh", () => {
    const lines = [
      "Please scan the QR code with WeChat:",
      "old-qr",
      "QR expired, refreshing (1/3)...",
      "new-qr-line-1",
      "new-qr-line-2",
    ];

    expect(visibleWechatLog(lines)).toBe("new-qr-line-1\nnew-qr-line-2");
  });
});
