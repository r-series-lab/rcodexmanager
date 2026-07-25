import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionCenterDialog } from "./SessionCenterDialog";
import type { CodexSessionSummary, ProfileInfo, ProfileSessionReport } from "../../lib/types";

const session: CodexSessionSummary = {
  id: "session-1",
  title: "按需读取详情",
  renamedTitle: null,
  summary: "列表只包含当前页摘要",
  updatedAt: "2026-07-15T10:00:00Z",
  startedAt: "2026-07-15T09:00:00Z",
  cwd: "/tmp/project",
  path: "/tmp/session-1.jsonl",
};

const profile = {
  name: "codex-g",
  alias: "codex-g",
  category: "free",
  isDefault: false,
} as ProfileInfo;

const report: ProfileSessionReport = {
  generatedAt: "2026-07-15T10:01:00Z",
  sessionCount: 1,
  offset: 0,
  limit: 10,
  hasMore: false,
  sessions: [{ profileName: profile.name, profileAlias: profile.alias, profileCategory: profile.category, isDefault: false, session }],
};

describe("SessionCenterDialog", () => {
  it("loads detail only after selecting a row", async () => {
    const user = userEvent.setup();
    const loadDetail = vi.fn(async () => ({ ...session, summary: "详情已读取" }));
    render(
      <SessionCenterDialog
        open
        items={[{ profile, session }]}
        profiles={[profile]}
        report={report}
        activeProfileName={profile.name}
        loading={false}
        query=""
        profileName=""
        category=""
        page={1}
        pageSize={10}
        onClose={() => undefined}
        onRefresh={() => undefined}
        onQueryChange={() => undefined}
        onProfileChange={() => undefined}
        onCategoryChange={() => undefined}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
        onLoadDetail={loadDetail}
        onOpen={() => undefined}
        onCopySummary={() => undefined}
        onCopyReference={() => undefined}
      />,
    );
    expect(loadDetail).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /按需读取详情/ }));
    await waitFor(() => expect(loadDetail).toHaveBeenCalledOnce());
    expect(await screen.findByText("详情已读取")).toBeInTheDocument();
  });
});
