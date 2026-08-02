import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthLoginSessionReport } from "../../lib/types";
import { AuthLoginDialog } from "./AuthLoginDialog";

const apiMocks = vi.hoisted(() => ({
  cancelAuthLoginSession: vi.fn(),
  openAuthLoginUrl: vi.fn(),
  readAuthLoginSession: vi.fn(),
  startLocalProfileLogin: vi.fn(),
  startServerProfileLogin: vi.fn(),
}));

vi.mock("../../lib/api", () => apiMocks);

const deviceSession: AuthLoginSessionReport = {
  sessionId: "auth-login-test",
  targetKind: "server-profile",
  targetId: "node-1",
  profileName: "codex-p",
  mode: "device-code",
  status: "waiting",
  verificationUrl: "https://auth.openai.com/codex/device",
  userCode: "TEST-CODE1",
  startedAt: "2026-07-28T10:00:00Z",
  expiresAt: "2026-07-28T10:15:00Z",
  message: "设备码已就绪，正在等待服务器完成登录。",
};

describe("AuthLoginDialog", () => {
  beforeEach(() => {
    apiMocks.startServerProfileLogin.mockResolvedValue(deviceSession);
    apiMocks.cancelAuthLoginSession.mockResolvedValue({
      ...deviceSession,
      status: "cancelled",
      verificationUrl: null,
      userCode: null,
    });
  });

  it("shows a server device challenge and cancels the ephemeral session on close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AuthLoginDialog
        open
        target={{
          kind: "server-profile",
          profileName: "codex-p",
          profileLabel: "服务器开发",
          nodeId: "node-1",
          nodeLabel: "阿里云 Codex",
        }}
        onClose={onClose}
        onCompleted={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "生成设备码" }));

    expect(apiMocks.startServerProfileLogin).toHaveBeenCalledWith("node-1", "codex-p");
    expect(await screen.findByText("TEST-CODE1")).toBeInTheDocument();
    expect(screen.getByText("auth.openai.com/codex/device")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消登录" }));
    expect(apiMocks.cancelAuthLoginSession).toHaveBeenCalledWith("auth-login-test");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
