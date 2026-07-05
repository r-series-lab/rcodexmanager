import type {
  AuthVaultReport,
  ListProfileSessionsInput,
  ProfileActionReport,
  ProfileInfo,
  ProfileReport,
  ProfileSessionReport,
  WechatBridgeReport,
} from "./types";

const mockProfiles: ProfileInfo[] = [
  {
    name: "codex",
    alias: "Default",
    category: "默认",
    note: null,
    codexHome: "/Users/ikiru/.codex",
    userDataDir: "/Users/ikiru/Library/Application Support/Codex",
    configPath: "/Users/ikiru/.codex/config.toml",
    model: "gpt-5.5",
    reasoningEffort: "medium",
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
    account: null,
    latestSession: {
      id: "019e86f9-09aa-73b0-989a-fe792db41e7a",
      title: "优惠券配置优化",
      renamedTitle: "优惠券配置优化",
      summary: "梳理优惠券配置表单、校验规则和发布流程的交互细节。",
      updatedAt: "2026-06-02T06:17:04.571447Z",
      startedAt: "2026-06-02T05:52:11.231Z",
      cwd: "/Users/ikiru/Documents/r-series-public",
      path: "/Users/ikiru/.codex/sessions/2026/06/02/rollout-2026-06-02T13-52-11-019e86f9-09aa-73b0-989a-fe792db41e7a.jsonl",
    },
    recentSessions: [
      {
        id: "019e86f9-09aa-73b0-989a-fe792db41e7a",
        title: "优惠券配置优化",
        renamedTitle: "优惠券配置优化",
        summary: "梳理优惠券配置表单、校验规则和发布流程的交互细节。",
        updatedAt: "2026-06-02T06:17:04.571447Z",
        startedAt: "2026-06-02T05:52:11.231Z",
        cwd: "/Users/ikiru/Documents/r-series-public",
        path: "/Users/ikiru/.codex/sessions/2026/06/02/rollout-2026-06-02T13-52-11-019e86f9-09aa-73b0-989a-fe792db41e7a.jsonl",
      },
      {
        id: "019e82be-9c4f-7a22-b3e6-1f0fd4a2b518",
        title: "rDevTool 标题栏规范",
        renamedTitle: "rDevTool 标题栏规范",
        summary: "沉淀 rDevTool 风格的标题栏、shell、按钮和拖动区域规范。",
        updatedAt: "2026-06-01T12:11:20.000000Z",
        startedAt: "2026-06-01T11:48:02.000Z",
        cwd: "/Users/ikiru/Documents/r-series-public",
        path: "/Users/ikiru/.codex/sessions/2026/06/01/rollout-2026-06-01T19-48-02-019e82be-9c4f-7a22-b3e6-1f0fd4a2b518.jsonl",
      },
    ],
  },
  {
    name: "codex-b",
    alias: "Balance",
    category: "平衡",
    note: "日常修改和常规编码。",
    codexHome: "/Users/ikiru/.codex-isolated-test",
    userDataDir: "/Users/ikiru/Library/Application Support/Codex-Isolated-Test",
    configPath: "/Users/ikiru/.codex-isolated-test/config.toml",
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
      email: "demo@example.com",
      name: "Demo",
      accountId: "acct_demo",
      userId: "user_demo",
      planType: "plus",
      organizationTitle: "Personal",
      lastRefresh: new Date().toISOString(),
    },
    latestSession: {
      id: "019e8b38-c4f3-7281-8b15-acc716cd7a3f",
      title: "优化 Codex Manage",
      renamedTitle: "优化 Codex Manage",
      summary: "能展示最新的会话摘要标题、摘要信息吗;",
      updatedAt: "2026-06-03T02:47:55.000000Z",
      startedAt: "2026-06-03T02:03:34.047Z",
      cwd: "/Users/ikiru/Documents/r-series-public",
      path: "/Users/ikiru/.codex-isolated-test/sessions/2026/06/03/rollout-2026-06-03T10-03-34-019e8b38-c4f3-7281-8b15-acc716cd7a3f.jsonl",
    },
    recentSessions: [
      {
        id: "019e8b38-c4f3-7281-8b15-acc716cd7a3f",
        title: "优化 Codex Manage",
        renamedTitle: "优化 Codex Manage",
        summary: "能展示最新的会话摘要标题、摘要信息吗;",
        updatedAt: "2026-06-03T02:47:55.000000Z",
        startedAt: "2026-06-03T02:03:34.047Z",
        cwd: "/Users/ikiru/Documents/r-series-public",
        path: "/Users/ikiru/.codex-isolated-test/sessions/2026/06/03/rollout-2026-06-03T10-03-34-019e8b38-c4f3-7281-8b15-acc716cd7a3f.jsonl",
      },
      {
        id: "019e8a44-4eb2-7085-8fe2-cf95bd57fd21",
        title: "配置 profile 登录态",
        renamedTitle: "配置 profile 登录态",
        summary: "检查不同 CODEX_HOME 的 auth.json、账号展示和额度查询边界。",
        updatedAt: "2026-06-02T15:22:41.000000Z",
        startedAt: "2026-06-02T15:01:19.000Z",
        cwd: "/Users/ikiru/Documents/r-series-public/rcodexmanager",
        path: "/Users/ikiru/.codex-isolated-test/sessions/2026/06/02/rollout-2026-06-02T23-01-19-019e8a44-4eb2-7085-8fe2-cf95bd57fd21.jsonl",
      },
    ],
  },
  {
    name: "codex-e",
    alias: "Deep Draft",
    category: "深度",
    note: "复杂设计和长任务。",
    codexHome: "/Users/ikiru/.codex-e",
    userDataDir: "/Users/ikiru/Library/Application Support/Codex-E",
    configPath: "/Users/ikiru/.codex-e/config.toml",
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
    account: null,
    latestSession: null,
    recentSessions: [],
  },
];

export function createMockProfileReport(): ProfileReport {
  return {
    generatedAt: new Date().toISOString(),
    zshrcPath: "/Users/ikiru/.zshrc",
    metadataPath: "/Users/ikiru/.rcodexmanager/profile-metadata.json",
    homeDir: "/Users/ikiru",
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

  return {
    generatedAt: new Date().toISOString(),
    vaultPath: "/Users/ikiru/.rcodexmanager/auth-vault",
    indexPath: "/Users/ikiru/.rcodexmanager/auth-vault.json",
    profileCount: profiles.length,
    backupCount: 1,
    profiles,
    backups: [
      {
        id: "20260618103000-codex-b",
        label: "Balance 认证备份",
        note: "主力 Plus 账号，适合深度任务。",
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        updatedAt: null,
        sourceProfileName: "codex-b",
        sourceProfileLabel: "Balance",
        sourceCodexHome: "/Users/ikiru/.codex-isolated-test",
        path: "/Users/ikiru/.rcodexmanager/auth-vault/20260618103000-codex-b.auth.json",
        exists: true,
        pinned: true,
        account: mockProfiles[1].account,
        hasRefreshToken: true,
      },
    ],
    recentApplications: [
      {
        id: "20260626084200-apply-codex-e",
        appliedAt: new Date(Date.now() - 1800_000).toISOString(),
        backupId: "20260618103000-codex-b",
        backupLabel: "Balance 认证备份",
        targetProfileName: "codex-e",
        targetProfileLabel: "Deep Draft",
        targetCodexHome: "/Users/ikiru/.codex-e",
        previousAuthPath: "/Users/ikiru/.codex-e/auth.json.rcodexmanager-auth-vault-apply-20260626084200.bak",
        previousAuthExists: true,
        previousAccount: null,
        appliedAccount: mockProfiles[1].account,
        rolledBackAt: null,
      },
    ],
  };
}

export function createMockWechatBridgeReport(): WechatBridgeReport {
  const bridges = mockProfiles.map((profile, index) => {
    const instance = profile.name;
    const runtimeRoot = `/Users/ikiru/.rcodexmanager/wechat-bridges/${instance}`;
    const storageRoot = `/Users/ikiru/.wechat-acp/instances/${instance}`;
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
    storePath: "/Users/ikiru/.rcodexmanager/wechat-bridges.json",
    bridgeCount: bridges.length,
    runningCount: bridges.filter((bridge) => bridge.running).length,
    wechatAcpPackage: "wechat-acp@0.2.3",
    codexAcpPackage: "@zed-industries/codex-acp@0.15.0",
    bridges,
  };
}

export function createMockActionReport(action: string, name: string): ProfileActionReport {
  return {
    generatedAt: new Date().toISOString(),
    action,
    zshrcPath: "/Users/ikiru/.zshrc",
    profile: mockProfiles.find((profile) => profile.name === name) ?? null,
    backups: [],
    message: `${action} ${name}`,
  };
}
