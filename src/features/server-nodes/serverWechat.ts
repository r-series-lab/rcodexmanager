import type { StatusTone } from "../../components/manager";

export function wechatStatePresentation(connectionState: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  if (connectionState === "running") return { label: "运行中", tone: "success" };
  if (connectionState === "awaiting-scan") return { label: "等待扫码", tone: "warning" };
  if (connectionState === "bound") return { label: "已绑定", tone: "info" };
  if (connectionState === "error") return { label: "异常", tone: "error" };
  return { label: "未绑定", tone: "neutral" };
}

export function visibleWechatLog(lines: string[]): string {
  let qrStart = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (
      lines[index].includes("Please scan the QR code with WeChat")
      || lines[index].includes("QR expired, refreshing")
    ) {
      qrStart = index + 1;
      break;
    }
  }
  return lines.slice(qrStart >= 0 ? qrStart : Math.max(0, lines.length - 32)).join("\n");
}
