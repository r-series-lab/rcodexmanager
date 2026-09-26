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
}));

vi.mock("../../lib/api", () => apiMocks);

const browserSession: AuthLoginSessionReport = {
  sessionId: "auth-login-test",
  targetKind: "local-profile",
  profileName: "codex-p",
  mode: "browser-oauth",
  status: "waiting",
  verificationUrl: "https://auth.openai.com/oauth/authorize?state=test",
  userCode: null,
  startedAt: "2026-07-28T10:00:00Z",
  expiresAt: "2026-07-28T10:15:00Z",
  message: "授权页已就绪，正在等待浏览器完成登录。",
};

describe("AuthLoginDialog", () => {
  beforeEach(() => {
    apiMocks.startLocalProfileLogin.mockResolvedValue(browserSession);
    apiMocks.cancelAuthLoginSession.mockResolvedValue({
      ...browserSession,
      status: "cancelled",
      verificationUrl: null,
      userCode: null,
    });
  });

  it("shows a local browser challenge and cancels the ephemeral session on close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AuthLoginDialog
        open
        target={{
          kind: "local-profile",
          profileName: "codex-p",
          profileLabel: "本地开发",
        }}
        onClose={onClose}
        onCompleted={() => undefined}
        onAutoRefresh={() => false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "生成授权链接" }));

    expect(apiMocks.startLocalProfileLogin).toHaveBeenCalledWith("codex-p");
    expect(screen.getByText("auth.openai.com/oauth/authorize")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消登录" }));
    expect(apiMocks.cancelAuthLoginSession).toHaveBeenCalledWith("auth-login-test");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
