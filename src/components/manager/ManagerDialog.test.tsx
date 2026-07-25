import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { describe, expect, it, vi } from "vitest";
import {
  DialogTabs,
  ErrorState,
  ManagerDialogShell,
  SensitiveActionConfirmDialog,
  isDialogResourceFresh,
} from ".";

describe("manager dialog primitives", () => {
  it("switches tabs and retries an error", async () => {
    const user = userEvent.setup();
    const onTab = vi.fn();
    const onRetry = vi.fn();
    render(
      <>
        <DialogTabs value="overview" onChange={onTab} label="详情" tabs={[{ value: "overview", label: "概览" }, { value: "logs", label: "日志" }]} />
        <ErrorState message="加载失败" onRetry={onRetry} />
      </>,
    );
    await user.click(screen.getByRole("tab", { name: "日志" }));
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onTab).toHaveBeenCalledWith("logs");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps sensitive actions behind an explicit confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SensitiveActionConfirmDialog
        open
        title="解除绑定"
        description="token 会先归档"
        confirmLabel="确认解除"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认解除" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes through the dialog shell and applies the 30 second cache window", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ManagerDialogShell open title="设置" icon={<SettingsRoundedIcon />} onClose={onClose}>
        <div>内容</div>
      </ManagerDialogShell>,
    );
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(isDialogResourceFresh(80_000, 100_000)).toBe(true);
    expect(isDialogResourceFresh(60_000, 100_000)).toBe(false);
  });
});

