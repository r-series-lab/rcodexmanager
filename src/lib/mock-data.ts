import type {
  AuthVaultReport,
  CodexSessionSummary,
  DoctorReport,
  FeishuRemoteReport,
  ListProfileSessionsInput,
  ModelRouteProxyStatus,
  ModelRoutePresetInfo,
  ModelRoutePreview,
  ModelRouteReport,
  PreviewModelRouteInput,
  ProfileActionReport,
  ProfileInfo,
  ProfileModelRouteState,
  ProfileReport,
  ProfileSessionReport,
  ReadProfileSessionDetailInput,
  ServerNodeOperation,
  ServerNodeOperationReport,
  ServerNodeProbeReport,
  ServerNodeReport,
  WechatBridgeReport,
} from "./types";

const mockServerNode = {
  id: "node-demo-server",
  name: "阿里云 Codex",
  sshTarget: "demo-server",
  remoteBinary: "rcodexmanager",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function createMockServerNodeReport(): ServerNodeReport {
  return {
    generatedAt: new Date().toISOString(),
    storePath: "/Users/demo/.rcodexmanager/server-nodes.json",
    nodes: [mockServerNode],
  };
}

export function createMockServerNodeProbe(): ServerNodeProbeReport {
  return {
    node: mockServerNode,
    status: {
      nodeId: mockServerNode.id,
      checkedAt: new Date().toISOString(),
      reachable: true,
      latencyMs: 42,
      hostname: "aliyun-codex",
      user: "admin",
      os: "ubuntu 24.04",
      arch: "x86_64",
      shell: "/bin/bash",
      codexInstalled: true,
      cliInstalled: true,
      cliVersion: "0.1.2",
      error: null,
    },
  };
}

export function createMockServerNodeOperation(
  operation: ServerNodeOperation,
): ServerNodeOperationReport {
  let command: string = operation.kind;
  let data: unknown = {};
  if (operation.kind === "doctor") {
    command = "doctor";
    data = { ...createMockDoctorReport(), platform: "linux-x86_64" };
  } else if (operation.kind === "list-profiles") {
    command = "list";
    const local = createMockProfileReport();
    const profiles = local.profiles.slice(0, 4).map((profile, index) => ({
      ...profile,
      name: index === 0 ? "codex" : `codex-${String.fromCharCode(110 + index)}`,
      alias: index === 0 ? "服务器默认" : profile.alias,
      codexHome: index === 0 ? "/home/demo/.codex" : `/home/demo/.codex-${String.fromCharCode(110 + index)}`,
      userDataDir: `/home/demo/.local/share/rcodexmanager/profiles/${profile.name}`,
      configPath: index === 0 ? "/home/demo/.codex/config.toml" : `/home/demo/.codex-${String.fromCharCode(110 + index)}/config.toml`,
      launcherKind: "server",
      isRunning: index === 2,
      runningPids: index === 2 ? [18420] : [],
      runningProcessCount: index === 2 ? 1 : 0,
    }));
    data = { ...local, homeDir: "/home/demo", zshrcPath: "/home/demo/.bashrc", profiles, profileCount: profiles.length };
  } else if (operation.kind === "list-sessions") {
    command = "sessions-list";
    data = createMockProfileSessionReport(operation.input);
  } else if (operation.kind === "read-session") {
    command = "sessions-detail";
    data = createMockProfileSessionDetail(operation.input);
  } else if (operation.kind === "auth-status" || operation.kind === "create-auth-backup" || operation.kind === "apply-auth-backup") {
    command = operation.kind === "auth-status" ? "auth-list" : operation.kind;
    data = createMockAuthVaultReport();
  } else if (operation.kind === "model-route-status") {
    command = "model-route-status";
    data = createMockModelRouteReport();
  } else if (operation.kind === "model-route-preview") {
    command = "model-route-preview";
    data = createMockModelRoutePreview(operation.input);
  } else if (operation.kind === "model-route-check") {
    command = "model-route-check";
    data = {
      generatedAt: new Date().toISOString(),
      profileName: operation.profileName,
      ok: true,
      status: "ok",
      statusLabel: "自检通过",
      message: "服务器模型路由可访问。",
      endpoint: "http://127.0.0.1:15721/v1/responses",
      httpStatus: 200,
      latencyMs: 48,
      diagnosticCode: null,
    };
  } else if (operation.kind === "update-profile-model") {
    command = "model-set";
    data = {
      generatedAt: new Date().toISOString(),
      action: "model-update",
      zshrcPath: "/home/demo/.bashrc",
      profile: {
        ...createMockProfileReport().profiles[1],
        name: operation.input.profileName,
        model: operation.input.model,
        reasoningEffort: operation.input.reasoningEffort,
        launcherKind: "server",
      },
      backups: [],
      message: "model updated",
    };
  } else if (["wechat-status", "wechat-start", "wechat-stop", "wechat-restart"].includes(operation.kind)) {
    command = operation.kind;
    data = createMockWechatBridgeReport();
  } else if (["feishu-status", "feishu-start", "feishu-stop", "feishu-restart"].includes(operation.kind)) {
    command = operation.kind;
    data = createMockFeishuRemoteReport();
  }
  return {
    nodeId: mockServerNode.id,
    operationId: `node-op-${Date.now()}-mock`,
    startedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    timeoutSeconds: operation.kind === "read-session" ? 60 : operation.kind === "model-route-check" ? 120 : 30,
    durationMs: 38,
    exitCode: 0,
    ok: true,
    command,
    outputTruncated: false,
    data,
    error: null,
  };
}

export function createMockDoctorReport(): DoctorReport {
  const checks: DoctorReport["checks"] = [
    { id: "system.shell", group: "基础环境", label: "启动配置", status: "ok", message: "Shell 启动配置可读取。", details: [] },
    { id: "profiles.paths", group: "Profiles", label: "Profile 路径", status: "ok", message: "8 个 profile 的核心路径完整。", details: [] },
    { id: "profiles.processes", group: "Profiles", label: "运行实例", status: "ok", message: "检测到 2 个运行中的 profile。", details: [] },
    { id: "auth.profiles", group: "认证", label: "Profile 认证", status: "ok", message: "8/8 个 profile 已有本地认证。", details: [] },
    { id: "auth.backups", group: "认证", label: "备份完整性", status: "ok", message: "20 个认证备份均可读取。", details: [] },
    { id: "remote.wechat", group: "远程渠道", label: "微信桥接", status: "ok", message: "1 个绑定，0 个运行中。", details: [] },
    { id: "remote.feishu", group: "远程渠道", label: "飞书渠道", status: "ok", message: "飞书渠道尚未启用。", details: [] },
    { id: "model-route.config", group: "模型路由", label: "路由配置", status: "warning", message: "1 个模型路由配置需要处理。", details: ["codex-g: 需要外部代理"] },
    { id: "model-route.proxy", group: "模型路由", label: "代理服务", status: "ok", message: "代理可用：rCodexManager 内置代理。", details: [] },
  ];
  return {
    generatedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    platform: "darwin-aarch64",
    ready: true,
    summary: {
      okCount: checks.filter((check) => check.status === "ok").length,
      warningCount: checks.filter((check) => check.status === "warning").length,
      errorCount: checks.filter((check) => check.status === "error").length,
    },
    checks,
  };
}

const mockProfiles: ProfileInfo[] = [
  {
    name: "codex",
    alias: "rDevTool",
    category: "默认",
    note: null,
    codexHome: "/Users/demo/.codex",
    userDataDir: "/Users/demo/Library/Application Support/Codex",
    configPath: "/Users/demo/.codex/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: false,
    isDefault: true,
    launcherKind: "desktop",
    zshrcLine: 0,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: {
      authMode: "chatgpt",
      email: "alex@example.com",
      name: "Alex Demo",
      accountId: "acct_demo_primary",
      userId: "user_demo_primary",
      planType: "plus",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019e86f9-09aa-73b0-989a-fe792db41e7a",
      title: "rTerm",
      renamedTitle: "rTerm",
      summary: "检查本地开发服务状态，并生成可回滚的关闭步骤。",
      updatedAt: "2026-07-14T01:10:00.000000Z",
      startedAt: "2026-07-14T00:52:11.231Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex/sessions/2026/06/02/rollout-2026-06-02T13-52-11-019e86f9-09aa-73b0-989a-fe792db41e7a.jsonl",
    },
    recentSessions: [
      {
        id: "019e86f9-09aa-73b0-989a-fe792db41e7a",
        title: "rTerm",
        renamedTitle: "rTerm",
        summary: "检查本地开发服务状态，并生成可回滚的关闭步骤。",
        updatedAt: "2026-07-14T01:10:00.000000Z",
        startedAt: "2026-07-14T00:52:11.231Z",
        cwd: "/Users/demo/Documents/r-series-public",
        path: "/Users/demo/.codex/sessions/2026/06/02/rollout-2026-06-02T13-52-11-019e86f9-09aa-73b0-989a-fe792db41e7a.jsonl",
      },
      {
        id: "019e82be-9c4f-7a22-b3e6-1f0fd4a2b518",
        title: "rDevTool 标题栏规范",
        renamedTitle: "rDevTool 标题栏规范",
        summary: "沉淀 rDevTool 风格的标题栏、shell、按钮和拖动区域规范。",
        updatedAt: "2026-06-01T12:11:20.000000Z",
        startedAt: "2026-06-01T11:48:02.000Z",
        cwd: "/Users/demo/Documents/r-series-public",
        path: "/Users/demo/.codex/sessions/2026/06/01/rollout-2026-06-01T19-48-02-019e82be-9c4f-7a22-b3e6-1f0fd4a2b518.jsonl",
      },
    ],
  },
  {
    name: "codex-b",
    alias: null,
    category: "free",
    note: "免费账号验证和普通页面修改。",
    codexHome: "/Users/demo/.codex-isolated-test",
    userDataDir: "/Users/demo/Library/Application Support/Codex-Isolated-Test",
    configPath: "/Users/demo/.codex-isolated-test/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "medium",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: false,
    managedByApp: false,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 23,
    isRunning: true,
    runningPids: [3831],
    runningProcessCount: 1,
    account: {
      authMode: "chatgpt",
      email: "sam@example.com",
      name: "Sam Demo",
      accountId: "acct_demo_free",
      userId: "user_demo_free",
      planType: "free",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019e8b38-c4f3-7281-8b15-acc716cd7a3f",
      title: "重设计持仓与量化页面",
      renamedTitle: "重设计持仓与量化页面",
      summary: "整理持仓列表、量化指标和交易页的信息层级。",
      updatedAt: "2026-07-13T08:42:00.000000Z",
      startedAt: "2026-07-13T08:03:34.047Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-isolated-test/sessions/2026/06/03/rollout-2026-06-03T10-03-34-019e8b38-c4f3-7281-8b15-acc716cd7a3f.jsonl",
    },
    recentSessions: [
      {
        id: "019e8b38-c4f3-7281-8b15-acc716cd7a3f",
        title: "重设计持仓与量化页面",
        renamedTitle: "重设计持仓与量化页面",
        summary: "整理持仓列表、量化指标和交易页的信息层级。",
        updatedAt: "2026-07-13T08:42:00.000000Z",
        startedAt: "2026-07-13T08:03:34.047Z",
        cwd: "/Users/demo/Documents/r-series-public",
        path: "/Users/demo/.codex-isolated-test/sessions/2026/06/03/rollout-2026-06-03T10-03-34-019e8b38-c4f3-7281-8b15-acc716cd7a3f.jsonl",
      },
      {
        id: "019e8a44-4eb2-7085-8fe2-cf95bd57fd21",
        title: "配置 profile 登录态",
        renamedTitle: "配置 profile 登录态",
        summary: "检查不同 CODEX_HOME 的 auth.json、账号展示和额度查询边界。",
        updatedAt: "2026-06-02T15:22:41.000000Z",
        startedAt: "2026-06-02T15:01:19.000Z",
        cwd: "/Users/demo/Documents/r-series-public/rcodexmanager",
        path: "/Users/demo/.codex-isolated-test/sessions/2026/06/02/rollout-2026-06-02T23-01-19-019e8a44-4eb2-7085-8fe2-cf95bd57fd21.jsonl",
      },
    ],
  },
  {
    name: "codex-g",
    alias: null,
    category: "free",
    note: "rDevTool 调试闭环。",
    codexHome: "/Users/demo/.codex-g",
    userDataDir: "/Users/demo/Library/Application Support/Codex-G",
    configPath: "/Users/demo/.codex-g/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 44,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: {
      authMode: "chatgpt",
      email: "taylor@example.com",
      name: "Taylor Demo",
      accountId: "acct_demo_research",
      userId: "user_demo_research",
      planType: "free",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019fa8a1-09aa-73b0-989a-fe792db41e7g",
      title: "完善 rDevTool 调试闭环",
      renamedTitle: "完善 rDevTool 调试闭环",
      summary: "补齐调试、预览、构建和回归检查的闭环体验。",
      updatedAt: "2026-07-13T03:27:00.000000Z",
      startedAt: "2026-07-13T03:03:34.047Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-g/sessions/2026/07/13/rollout-2026-07-13T11-03-34-019fa8a1-09aa-73b0-989a-fe792db41e7g.jsonl",
    },
    recentSessions: [
      {
        id: "019fa8a1-09aa-73b0-989a-fe792db41e7g",
        title: "完善 rDevTool 调试闭环",
        renamedTitle: "完善 rDevTool 调试闭环",
        summary: "补齐调试、预览、构建和回归检查的闭环体验。",
        updatedAt: "2026-07-13T03:27:00.000000Z",
        startedAt: "2026-07-13T03:03:34.047Z",
        cwd: "/Users/demo/Documents/r-series-public",
        path: "/Users/demo/.codex-g/sessions/2026/07/13/rollout-2026-07-13T11-03-34-019fa8a1-09aa-73b0-989a-fe792db41e7g.jsonl",
      },
    ],
  },
  {
    name: "codex-h",
    alias: null,
    category: "深度",
    note: "样式和打包状态优化。",
    codexHome: "/Users/demo/.codex-h",
    userDataDir: "/Users/demo/Library/Application Support/Codex-H",
    configPath: "/Users/demo/.codex-h/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "medium",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 48,
    isRunning: true,
    runningPids: [4024],
    runningProcessCount: 1,
    account: {
      authMode: "chatgpt",
      email: "jordan@example.com",
      name: "Jordan Demo",
      accountId: "acct_demo_design",
      userId: "user_demo_design",
      planType: "plus",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019fa8a1-09aa-73b0-989a-fe792db41e7h",
      title: "优化 rdevtool 样式与打包状态",
      renamedTitle: "优化 rdevtool 样式与打包状态",
      summary: "收紧列表密度、右侧详情和打包状态反馈。",
      updatedAt: "2026-07-12T12:18:00.000000Z",
      startedAt: "2026-07-12T11:51:10.000Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-h/sessions/2026/07/12/rollout-2026-07-12T19-51-10-019fa8a1-09aa-73b0-989a-fe792db41e7h.jsonl",
    },
    recentSessions: [],
  },
  {
    name: "codex-o",
    alias: null,
    category: "非plus",
    note: "非 plus 账号验证。",
    codexHome: "/Users/demo/.codex-o",
    userDataDir: "/Users/demo/Library/Application Support/Codex-O",
    configPath: "/Users/demo/.codex-o/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: false,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 52,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: {
      authMode: "chatgpt",
      email: "casey@example.com",
      name: "Casey Demo",
      accountId: "acct_demo_server",
      userId: "user_demo_server",
      planType: "free",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019fa8a1-09aa-73b0-989a-fe792db41e7o",
      title: "Say hello",
      renamedTitle: "Say hello",
      summary: "验证 profile 启动、会话读取和检索状态。",
      updatedAt: "2026-07-12T07:31:00.000000Z",
      startedAt: "2026-07-12T07:02:10.000Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-o/sessions/2026/07/12/rollout-2026-07-12T15-02-10-019fa8a1-09aa-73b0-989a-fe792db41e7o.jsonl",
    },
    recentSessions: [],
  },
  {
    name: "codex-p",
    alias: null,
    category: "upi",
    note: "持仓和交易页重构。",
    codexHome: "/Users/demo/.codex-p",
    userDataDir: "/Users/demo/Library/Application Support/Codex-P",
    configPath: "/Users/demo/.codex-p/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 56,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: {
      authMode: "chatgpt",
      email: "morgan@example.com",
      name: "Morgan Demo",
      accountId: "acct_demo_ops",
      userId: "user_demo_ops",
      planType: "plus",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019fa8a1-09aa-73b0-989a-fe792db41e7p",
      title: "重构持仓与交易页",
      renamedTitle: "重构持仓与交易页",
      summary: "收敛交易页字段、持仓卡片和筛选行为。",
      updatedAt: "2026-07-12T02:09:00.000000Z",
      startedAt: "2026-07-12T01:50:10.000Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-p/sessions/2026/07/12/rollout-2026-07-12T09-50-10-019fa8a1-09aa-73b0-989a-fe792db41e7p.jsonl",
    },
    recentSessions: [],
  },
  {
    name: "codex-q",
    alias: null,
    category: "upi",
    note: "优客贷车后管。",
    codexHome: "/Users/demo/.codex-q",
    userDataDir: "/Users/demo/Library/Application Support/Codex-Q",
    configPath: "/Users/demo/.codex-q/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: false,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 60,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: null,
    latestSession: {
      id: "019fa8a1-09aa-73b0-989a-fe792db41e7q",
      title: "优客贷车后管",
      renamedTitle: "优客贷车后管",
      summary: "整理后管列表、详情和操作状态。",
      updatedAt: "2026-07-11T14:14:00.000000Z",
      startedAt: "2026-07-11T13:50:10.000Z",
      cwd: "/Users/demo/Documents/r-series-public",
      path: "/Users/demo/.codex-q/sessions/2026/07/11/rollout-2026-07-11T21-50-10-019fa8a1-09aa-73b0-989a-fe792db41e7q.jsonl",
    },
    recentSessions: [],
  },
  {
    name: "codex-r",
    alias: null,
    category: "默认",
    note: "默认环境备用 profile。",
    codexHome: "/Users/demo/.codex-r",
    userDataDir: "/Users/demo/Library/Application Support/Codex-R",
    configPath: "/Users/demo/.codex-r/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "medium",
    homeExists: true,
    userDataExists: true,
    configExists: true,
    websocketFeaturesEnabled: true,
    managedByApp: true,
    isDefault: false,
    launcherKind: "desktop",
    zshrcLine: 64,
    isRunning: false,
    runningPids: [],
    runningProcessCount: 0,
    account: null,
    latestSession: null,
    recentSessions: [],
  },
];

export function createMockProfileReport(): ProfileReport {
  return {
    generatedAt: new Date().toISOString(),
    zshrcPath: "/Users/demo/.zshrc",
    metadataPath: "/Users/demo/.rcodexmanager/profile-metadata.json",
    homeDir: "/Users/demo",
    profileCount: mockProfiles.length,
    profiles: mockProfiles,
  };
}

export function createMockProfileSessionReport(input?: ListProfileSessionsInput): ProfileSessionReport {
  const offset = input?.offset ?? 0;
  const limit = input?.limit ?? 10;
  const query = (input?.query ?? "").trim().toLowerCase();
  let sessions = mockProfiles.flatMap((profile) =>
    profile.recentSessions.map((session) => ({
      profileName: profile.name,
      profileAlias: profile.alias,
      profileCategory: profile.category,
      isDefault: profile.isDefault,
      session,
    })),
  );

  sessions = sessions.filter((item) => {
    if (input?.profileName && input.profileName !== "all" && item.profileName !== input.profileName) {
      return false;
    }
    if (input?.category && input.category !== "all" && item.profileCategory !== input.category) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      item.profileName,
      item.profileAlias ?? "",
      item.profileCategory,
      item.session.id,
      item.session.title,
      item.session.renamedTitle ?? "",
      item.session.summary ?? "",
      item.session.cwd ?? "",
      item.session.path ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  sessions.sort((left, right) => {
    const leftTime = Date.parse(left.session.updatedAt ?? left.session.startedAt ?? "");
    const rightTime = Date.parse(right.session.updatedAt ?? right.session.startedAt ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });

  return {
    generatedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    offset,
    limit,
    hasMore: offset + limit < sessions.length,
    sessions: sessions.slice(offset, offset + limit),
  };
}

export function createMockProfileSessionDetail(
  input: ReadProfileSessionDetailInput,
): CodexSessionSummary {
  const profile = mockProfiles.find((item) => item.name === input.profileName);
  const session = profile?.recentSessions.find((item) => item.id === input.sessionId);
  if (!session) {
    throw new Error(`未找到会话：${input.sessionId}`);
  }
  return { ...session };
}

export function createMockAuthVaultReport(): AuthVaultReport {
  const profiles = mockProfiles.map((profile) => ({
    profileName: profile.name,
    profileAlias: profile.alias,
    profileCategory: profile.category,
    isDefault: profile.isDefault,
    isRunning: profile.isRunning,
    codexHome: profile.codexHome,
    authPath: `${profile.codexHome}/auth.json`,
    authExists: Boolean(profile.account),
    account: profile.account,
  }));
  const backupProfiles = mockProfiles.filter((profile) => profile.account).slice(0, 6);
  const backups = backupProfiles.map((profile, index) => {
    const modifiedAt = new Date(Date.now() - (index + 1) * 3600_000).toISOString();
    return {
      id: `2026061810300${index}-${profile.name}`,
      label: `${profile.name} 认证备份`,
      note: index === 0 ? "主力 Plus 账号，适合深度任务。" : null,
      createdAt: modifiedAt,
      updatedAt: null,
      sourceProfileName: profile.name,
      sourceProfileLabel: profile.alias || profile.name,
      sourceCodexHome: profile.codexHome,
      path: `/Users/demo/.rcodexmanager/auth-vault/2026061810300${index}-${profile.name}.auth.json`,
      exists: true,
      valid: true,
      validationMessage: null,
      fileSizeBytes: 2184 + index * 16,
      modifiedAt,
      pinned: index === 0,
      account: profile.account,
      hasRefreshToken: true,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    vaultPath: "/Users/demo/.rcodexmanager/auth-vault",
    indexPath: "/Users/demo/.rcodexmanager/auth-vault.json",
    profileCount: profiles.length,
    backupCount: backups.length,
    profiles,
    backups,
    recentApplications: [
      {
        id: "20260626084200-apply-codex-e",
        appliedAt: new Date(Date.now() - 1800_000).toISOString(),
        backupId: backups[0].id,
        backupLabel: backups[0].label,
        targetProfileName: "codex-e",
        targetProfileLabel: "Deep Draft",
        targetCodexHome: "/Users/demo/.codex-e",
        previousAuthPath: "/Users/demo/.codex-e/auth.json.rcodexmanager-auth-vault-apply-20260626084200.bak",
        previousAuthExists: true,
        previousAccount: null,
        appliedAccount: backups[0].account,
        rolledBackAt: null,
      },
    ],
  };
}

export function createMockWechatBridgeReport(): WechatBridgeReport {
  const bridges = mockProfiles.map((profile, index) => {
    const instance = profile.name;
    const runtimeRoot = `/Users/demo/.rcodexmanager/wechat-bridges/${instance}`;
    const storageRoot = `/Users/demo/.wechat-acp/instances/${instance}`;
    return {
      profileName: profile.name,
      profileLabel: profile.alias || profile.name,
      profileCategory: profile.category,
      codexHome: profile.codexHome,
      authExists: Boolean(profile.account) || profile.isDefault,
      account: profile.account,
      instance,
      storageDir: storageRoot,
      tokenPath: `${storageRoot}/token.json`,
      inboxDir: `${runtimeRoot}/inbox`,
      wrapperPath: `${runtimeRoot}/codex-acp-server`,
      appLogPath: `${runtimeRoot}/wechat-acp.log`,
      defaultLogPath: `${storageRoot}/wechat-acp.log`,
      tokenExists: index === 1,
      running: index === 1,
      managedByApp: true,
      connectionState: index === 1 ? "running" : "unbound",
      runningPids: index === 1 ? [8421] : [],
      lastStartedAt: index === 1 ? new Date(Date.now() - 900_000).toISOString() : null,
      lastStoppedAt: null,
      lastError: null,
      logTail:
        index === 1
          ? [
              "[wechat-acp] instance codex-b ready",
              "[wechat-acp] scan QR code with WeChat to bind this instance",
              "████ ▄▄▄▄▄ █▀█ ███ ▄▄▄▄▄ ████",
              "████ █   █ █▄█ ▀▄█ █   █ ████",
            ]
          : [],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    storePath: "/Users/demo/.rcodexmanager/wechat-bridges.json",
    bridgeCount: bridges.length,
    runningCount: bridges.filter((bridge) => bridge.running).length,
    wechatAcpPackage: "wechat-acp@0.2.3",
    codexAcpPackage: "@zed-industries/codex-acp@0.15.0",
    bridges,
  };
}

export function createMockFeishuRemoteReport(): FeishuRemoteReport {
  const profile = mockProfiles[2];
  return {
    generatedAt: new Date().toISOString(),
    instance: "rcodexmanager",
    installed: true,
    binaryPath: "/Users/demo/.local/bin/codex-remote",
    version: "codex-remote 0.8.0",
    profileName: profile.name,
    profileLabel: profile.alias || profile.name,
    codexHome: profile.codexHome,
    authExists: true,
    configured: true,
    running: true,
    healthy: true,
    connectionState: "connected",
    pid: 9321,
    configPath: "/Users/demo/.rcodexmanager/feishu-remote/.config/codex-remote-rcodexmanager/codex-remote/config.json",
    statePath: "/Users/demo/.rcodexmanager/feishu-remote/.local/share/codex-remote-rcodexmanager/codex-remote/install-state.json",
    logPath: "/Users/demo/.rcodexmanager/feishu-remote/.local/share/codex-remote-rcodexmanager/codex-remote/logs/codex-remote-relayd.log",
    adminPort: 9511,
    setupUrl: "http://127.0.0.1:9511/setup",
    adminUrl: "http://127.0.0.1:9511/",
    gatewayCount: 1,
    connectedGatewayCount: 1,
    lastStartedAt: new Date(Date.now() - 600_000).toISOString(),
    lastStoppedAt: null,
    lastError: null,
    logTail: [
      "[codex-remote] admin listening on 127.0.0.1:9511",
      "[feishu] gateway connected",
      "[codex] profile codex-g ready",
    ],
    projectUrl: "https://github.com/kxn/codex-remote-feishu",
  };
}

const mockModelRoutePresets: ModelRoutePresetInfo[] = [
  {
    id: "aliyun-qwen",
    label: "阿里百炼 / Qwen",
    description: "DashScope compatible-mode 原生支持 Responses，可直连；Chat-only 模型再走外部代理。",
    defaultModel: "qwen3-coder-plus",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    chatOnly: false,
    requiresProxy: false,
  },
  {
    id: "glm",
    label: "GLM / Z.ai",
    description: "智谱 GLM 系列，默认走外部代理。",
    defaultModel: "glm-5.2",
    defaultBaseUrl: null,
    chatOnly: true,
    requiresProxy: true,
  },
  {
    id: "openai-chat",
    label: "Chat-compatible 上游",
    description: "DeepSeek、Kimi、火山等 Chat-compatible provider，需要转换代理。",
    defaultModel: "chat-model",
    defaultBaseUrl: null,
    chatOnly: true,
    requiresProxy: true,
  },
  {
    id: "local-openai",
    label: "本地 OpenAI-compatible",
    description: "本地 chat/completions 服务，需要转换代理。",
    defaultModel: "local-model",
    defaultBaseUrl: null,
    chatOnly: true,
    requiresProxy: true,
  },
  {
    id: "custom-responses",
    label: "自定义 Responses",
    description: "原生 Responses-compatible 服务，可直接配置 base URL。",
    defaultModel: "gpt-5.5",
    defaultBaseUrl: null,
    chatOnly: false,
    requiresProxy: false,
  },
];

export function createMockModelRouteProxyStatus(
  overrides: Partial<ModelRouteProxyStatus> = {},
): ModelRouteProxyStatus {
  return {
    generatedAt: new Date().toISOString(),
    listenHost: "127.0.0.1",
    listenPort: 15721,
    baseUrl: "http://127.0.0.1:15721/v1",
    serviceKind: "none",
    serviceLabel: "未检测到代理",
    serviceDetail: null,
    reachable: false,
    managed: false,
    canStart: true,
    canStop: false,
    status: "offline",
    statusLabel: "未检测到",
    message: "未检测到本机代理；GLM、本地 OpenAI-compatible 等 Chat-only provider 需要先启动外部代理。",
    diagnostics: [
      {
        generatedAt: new Date().toISOString(),
        level: "warning",
        code: "proxy_offline",
        label: "代理未启动",
        message: "未检测到本机代理；GLM、本地 OpenAI-compatible 等 Chat-only provider 需要先启动外部代理。",
        detail: null,
      },
    ],
    recentLogs: [
      {
        generatedAt: new Date().toISOString(),
        kind: "self-check",
        profileName: "codex-g",
        model: "glm-4.6",
        endpoint: "http://127.0.0.1:15721/v1/responses",
        ok: true,
        status: "ok",
        statusLabel: "自检通过",
        message: "模型路由自检已打通。",
        httpStatus: 200,
        latencyMs: 36,
        diagnosticCode: null,
      },
    ],
    ...overrides,
  };
}

function createMockModelRouteState(profile: ProfileInfo, index: number): ProfileModelRouteState {
  const routed = index === 2;
  const needsProxy = index === 4;
  const readOnlyReason = profile.isDefault
    ? "默认 profile 受保护"
    : profile.isRunning
      ? "profile 正在运行"
      : null;
  return {
    profileName: profile.name,
    profileLabel: profile.alias || profile.name,
    profileCategory: profile.category,
    codexHome: profile.codexHome,
    configPath: profile.configPath,
    configExists: profile.configExists,
    isDefault: profile.isDefault,
    isRunning: profile.isRunning,
    model: routed ? "glm-4.6" : profile.model,
    reasoningEffort: profile.reasoningEffort,
    modelProvider: routed ? "rcodexmanager-route" : needsProxy ? "zai-glm" : null,
    baseUrl: routed ? "http://127.0.0.1:15721/v1" : needsProxy ? "https://api.z.ai/api/paas/v4" : null,
    wireApi: routed ? "responses" : needsProxy ? "chat" : null,
    hasApiKey: routed || needsProxy,
    routeStatus: readOnlyReason ? "readonly" : routed ? "routed" : needsProxy ? "needs-proxy" : "official",
    routeStatusLabel: readOnlyReason
      ? "不可修改"
      : routed
        ? "已配置路由"
        : needsProxy
          ? "需要外部代理"
          : "官方默认",
    readOnlyReason,
    routed,
    needsProxy,
    needsAttention: needsProxy || !profile.configExists,
    canApply: !readOnlyReason,
    canRestore: !readOnlyReason && routed,
  };
}

export function createMockModelRouteReport(): ModelRouteReport {
  const profiles = mockProfiles.map(createMockModelRouteState);
  return {
    generatedAt: new Date().toISOString(),
    profileCount: profiles.length,
    routedCount: profiles.filter((profile) => profile.routed).length,
    needsAttentionCount: profiles.filter((profile) => profile.needsAttention).length,
    proxy: createMockModelRouteProxyStatus(),
    presets: mockModelRoutePresets,
    profiles,
  };
}

export function createMockModelRoutePreview(input: PreviewModelRouteInput): ModelRoutePreview {
  const preset = mockModelRoutePresets.find((item) => item.id === input.preset) ?? mockModelRoutePresets[1];
  const baseUrl = preset.requiresProxy
    ? input.proxyBaseUrl?.trim() || "http://127.0.0.1:15721/v1"
    : input.upstreamBaseUrl?.trim() || preset.defaultBaseUrl || "https://api.openai.com/v1";
  const apiKeySource = input.apiKeyEnv?.trim()
    ? `env:${input.apiKeyEnv.trim()}`
    : input.apiKey?.trim()
      ? "inline"
      : null;
  const model = input.model.trim() || preset.defaultModel;
  const reasoningEffort = input.reasoningEffort?.trim() || "xhigh";
  return {
    generatedAt: new Date().toISOString(),
    profileName: input.profileName,
    preset: input.preset,
    presetLabel: preset.label,
    providerId: "rcodexmanager-route",
    providerName: `rCodexManager ${preset.label}`,
    model,
    reasoningEffort,
    baseUrl,
    wireApi: "responses",
    chatOnly: preset.chatOnly,
    usesProxy: preset.requiresProxy,
    apiKeySource,
    configPreview: [
      `model = "${model}"`,
      `model_provider = "rcodexmanager-route"`,
      `model_reasoning_effort = "${reasoningEffort}"`,
      "",
      `[model_providers.rcodexmanager-route]`,
      `name = "rCodexManager ${preset.label}"`,
      `base_url = "${baseUrl}"`,
      `wire_api = "responses"`,
      apiKeySource ? `env_key = "${apiKeySource.replace("env:", "")}"` : "# api key 未配置",
    ].join("\n"),
    warnings: preset.requiresProxy
      ? ["这个预设是 Chat-only，上游地址不会直接写入 Codex；请确认外部代理可用。"]
      : [],
  };
}

export function createMockActionReport(action: string, name: string): ProfileActionReport {
  return {
    generatedAt: new Date().toISOString(),
    action,
    zshrcPath: "/Users/demo/.zshrc",
    profile: mockProfiles.find((profile) => profile.name === name) ?? null,
    backups: [],
    message: `${action} ${name}`,
  };
}
