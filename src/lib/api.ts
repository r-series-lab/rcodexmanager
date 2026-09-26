import { invoke } from "@tauri-apps/api/core";
import {
  createMockActionReport,
  createMockAuthVaultReport,
  createMockDoctorReport,
  createMockFeishuRemoteReport,
  createMockModelRoutePreview,
  createMockModelRouteProxyStatus,
  createMockModelRouteReport,
  createMockProfileReport,
  createMockProfileSessionDetail,
  createMockProfileSessionReport,
  createMockWechatBridgeReport,
  renameMockProfile,
  setMockProfileArchived,
} from "./mock-data";
import type {
  ApplyAuthBackupInput,
  ApplyModelRouteInput,
  AuthLoginSessionReport,
  AuthBackupImportPreview,
  AuthBackupExportReport,
  AuthBatchBackupResult,
  AuthVaultReport,
  CheckModelRouteProxyInput,
  CleanupAuthBackupsInput,
  CopyProfileInput,
  ConfigureFeishuRemoteInput,
  CodexSessionSummary,
  CreateProfileInput,
  CreateAuthBackupInput,
  CreateAuthBackupsInput,
  DeleteAuthBackupInput,
  ExportAuthBackupInput,
  FeishuRemotePage,
  FeishuRemoteReport,
  ImportAuthBackupPackageInput,
  ImportAuthInput,
  ListProfileSessionsInput,
  ReadProfileSessionDetailInput,
  ReadFeishuRemoteLogInput,
  DoctorReport,
  ModelRoutePreview,
  ModelRouteProxyCheckResult,
  ModelRouteProxyStatus,
  ModelRouteReport,
  PreviewModelRouteInput,
  PreviewAuthBackupPackageInput,
  ProfileMetadataInput,
  ProfileActionReport,
  ProfileInfo,
  ProfileQuotaReport,
  ProfileReport,
  ProfileRuntimeReport,
  ProfileSessionReport,
  ReadWechatBridgeLogInput,
  ResetProfileInput,
  RestoreModelRouteInput,
  RestartWechatBridgeInput,
  RollbackAuthApplicationInput,
  StartWechatBridgeInput,
  StartFeishuRemoteInput,
  StopWechatBridgeInput,
  UnbindWechatBridgeInput,
  UpdateAuthBackupInput,
  UpdateProfileLauncherInput,
  UpdateProfileModelInput,
  WechatBridgeLogReport,
  WechatBridgeReport,
} from "./types";

const mockAuthLoginSessions = new Map<string, { report: AuthLoginSessionReport; polls: number }>();

function createMockAuthLoginSession(
  profileName: string,
): AuthLoginSessionReport {
  const now = new Date();
  const report: AuthLoginSessionReport = {
    sessionId: `auth-login-mock-${Date.now()}`,
    targetKind: "local-profile",
    profileName,
    mode: "browser-oauth",
    status: "waiting",
    verificationUrl: "https://auth.openai.com/oauth/authorize?state=mock",
    userCode: null,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    message: "授权页已就绪，正在等待浏览器完成登录。",
  };
  mockAuthLoginSessions.set(report.sessionId, { report, polls: 0 });
  return report;
}

export async function startLocalProfileLogin(profileName: string): Promise<AuthLoginSessionReport> {
  if (!isTauriRuntime()) {
    return createMockAuthLoginSession(profileName);
  }
  return invoke<AuthLoginSessionReport>("start_local_profile_login_command", {
    input: { profileName },
  });
}

export async function readAuthLoginSession(sessionId: string): Promise<AuthLoginSessionReport> {
  if (!isTauriRuntime()) {
    const session = mockAuthLoginSessions.get(sessionId);
    if (!session) throw new Error("authentication session was not found or has expired");
    session.polls += 1;
    if (session.polls >= 2 && session.report.status === "waiting") {
      session.report = {
        ...session.report,
        status: "completed",
        verificationUrl: null,
        userCode: null,
        message: "认证已完成。",
      };
    }
    return session.report;
  }
  return invoke<AuthLoginSessionReport>("read_auth_login_session_command", {
    input: { sessionId },
  });
}

export async function cancelAuthLoginSession(sessionId: string): Promise<AuthLoginSessionReport> {
  if (!isTauriRuntime()) {
    const session = mockAuthLoginSessions.get(sessionId);
    if (!session) throw new Error("authentication session was not found or has expired");
    session.report = {
      ...session.report,
      status: "cancelled",
      verificationUrl: null,
      userCode: null,
      message: "登录已取消。",
    };
    return session.report;
  }
  return invoke<AuthLoginSessionReport>("cancel_auth_login_session_command", {
    input: { sessionId },
  });
}

export async function openAuthLoginUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke<void>("open_auth_login_url_command", { input: { url } });
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function runDoctor(): Promise<DoctorReport> {
  if (!isTauriRuntime()) {
    return createMockDoctorReport();
  }
  return invoke<DoctorReport>("run_doctor_command");
}

export async function listProfiles(): Promise<ProfileReport> {
  if (!isTauriRuntime()) {
    return createMockProfileReport();
  }
  return invoke<ProfileReport>("list_profiles_command");
}

export async function listProfileRuntimeStatuses(
  profiles: ProfileInfo[],
): Promise<ProfileRuntimeReport> {
  if (!isTauriRuntime()) {
    return {
      generatedAt: new Date().toISOString(),
      profiles: profiles.map((profile) => ({
        name: profile.name,
        isRunning: profile.isRunning,
        runningPids: profile.runningPids,
        runningProcessCount: profile.runningProcessCount,
      })),
    };
  }
  const targets = profiles.map((profile) => ({
    name: profile.name,
    codexHome: profile.codexHome,
    userDataDir: profile.userDataDir,
    launcherKind: profile.launcherKind,
    isDefault: profile.isDefault,
  }));
  return invoke<ProfileRuntimeReport>("list_profile_runtime_statuses_command", { targets });
}

export async function listProfileSessions(input: ListProfileSessionsInput): Promise<ProfileSessionReport> {
  if (!isTauriRuntime()) {
    return createMockProfileSessionReport(input);
  }
  return invoke<ProfileSessionReport>("list_profile_sessions_command", { input });
}

export async function readProfileSessionDetail(
  input: ReadProfileSessionDetailInput,
): Promise<CodexSessionSummary> {
  if (!isTauriRuntime()) {
    return createMockProfileSessionDetail(input);
  }
  return invoke<CodexSessionSummary>("read_profile_session_detail_command", { input });
}

export async function listAuthVault(): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("list_auth_vault_command");
}

export async function createAuthBackup(input: CreateAuthBackupInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("create_auth_backup_command", { input });
}

export async function createAuthBackups(input: CreateAuthBackupsInput): Promise<AuthBatchBackupResult> {
  if (!isTauriRuntime()) {
    const vault = createMockAuthVaultReport();
    return {
      generatedAt: new Date().toISOString(),
      successCount: input.profileNames.length,
      failureCount: 0,
      results: input.profileNames.map((profileName, index) => ({
        profileName,
        ok: true,
        backupId: vault.backups[index % Math.max(vault.backups.length, 1)]?.id ?? `mock-${index}`,
        message: "认证备份已创建",
      })),
      vault,
    };
  }
  return invoke<AuthBatchBackupResult>("create_auth_backups_command", { input });
}

export async function applyAuthBackup(input: ApplyAuthBackupInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("applyAuthBackup", input.targetProfileName);
  }
  return invoke<ProfileActionReport>("apply_auth_backup_command", { input });
}

export async function rollbackAuthApplication(input: RollbackAuthApplicationInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("rollbackAuthApplication", input.applicationId);
  }
  return invoke<ProfileActionReport>("rollback_auth_application_command", { input });
}

export async function deleteAuthBackup(input: DeleteAuthBackupInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("delete_auth_backup_command", { input });
}

export async function updateAuthBackup(input: UpdateAuthBackupInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("update_auth_backup_command", { input });
}

export async function exportAuthBackup(input: ExportAuthBackupInput): Promise<AuthBackupExportReport> {
  if (!isTauriRuntime()) {
    return {
      generatedAt: new Date().toISOString(),
      path: "/tmp/mock-auth-backup.rcodex-auth.json",
      fileName: "mock-auth-backup.rcodex-auth.json",
      backup: createMockAuthVaultReport().backups[0],
      message: "exported mock auth backup",
    };
  }
  return invoke<AuthBackupExportReport>("export_auth_backup_command", { input });
}

export async function importAuthBackupPackage(input: ImportAuthBackupPackageInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("import_auth_backup_package_command", { input });
}

export async function previewAuthBackupPackage(
  input: PreviewAuthBackupPackageInput,
): Promise<AuthBackupImportPreview> {
  if (!isTauriRuntime()) {
    const backup = createMockAuthVaultReport().backups[0];
    return {
      valid: true,
      label: backup?.label ?? "导入认证备份",
      note: backup?.note ?? null,
      sourceProfileName: backup?.sourceProfileName ?? null,
      sourceProfileLabel: backup?.sourceProfileLabel ?? null,
      account: backup?.account ?? null,
      hasRefreshToken: backup?.hasRefreshToken ?? true,
      exportedAt: new Date().toISOString(),
      warnings: [],
    };
  }
  return invoke<AuthBackupImportPreview>("preview_auth_backup_package_command", { input });
}

export async function cleanupAuthBackups(input: CleanupAuthBackupsInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("cleanup_auth_backups_command", { input });
}

export async function listWechatBridges(): Promise<WechatBridgeReport> {
  if (!isTauriRuntime()) {
    return createMockWechatBridgeReport();
  }
  return invoke<WechatBridgeReport>("list_wechat_bridges_command");
}

export async function startWechatBridge(input: StartWechatBridgeInput): Promise<WechatBridgeReport> {
  if (!isTauriRuntime()) {
    const report = createMockWechatBridgeReport();
    return {
      ...report,
      bridges: report.bridges.map((bridge) =>
        bridge.profileName === input.profileName
          ? {
              ...bridge,
              running: true,
              connectionState: bridge.tokenExists ? "running" : "awaiting-scan",
              runningPids: [8421],
              lastStartedAt: new Date().toISOString(),
              logTail: bridge.logTail.length > 0 ? bridge.logTail : ["[mock] waiting for QR scan"],
            }
          : bridge,
      ),
    };
  }
  return invoke<WechatBridgeReport>("start_wechat_bridge_command", { input });
}

export async function stopWechatBridge(input: StopWechatBridgeInput): Promise<WechatBridgeReport> {
  if (!isTauriRuntime()) {
    const report = createMockWechatBridgeReport();
    return {
      ...report,
      bridges: report.bridges.map((bridge) =>
        bridge.profileName === input.profileName
          ? {
              ...bridge,
              running: false,
              connectionState: bridge.tokenExists ? "bound" : "unbound",
              runningPids: [],
              lastStoppedAt: new Date().toISOString(),
            }
          : bridge,
      ),
    };
  }
  return invoke<WechatBridgeReport>("stop_wechat_bridge_command", { input });
}

export async function restartWechatBridge(input: RestartWechatBridgeInput): Promise<WechatBridgeReport> {
  if (!isTauriRuntime()) {
    return startWechatBridge(input);
  }
  return invoke<WechatBridgeReport>("restart_wechat_bridge_command", { input });
}

export async function unbindWechatBridge(input: UnbindWechatBridgeInput): Promise<WechatBridgeReport> {
  if (!isTauriRuntime()) {
    const report = createMockWechatBridgeReport();
    return {
      ...report,
      bridges: report.bridges.map((bridge) =>
        bridge.profileName === input.profileName
          ? {
              ...bridge,
              tokenExists: false,
              running: false,
              connectionState: "unbound",
              runningPids: [],
              lastStoppedAt: new Date().toISOString(),
            }
          : bridge,
      ),
    };
  }
  return invoke<WechatBridgeReport>("unbind_wechat_bridge_command", { input });
}

export async function readWechatBridgeLog(input: ReadWechatBridgeLogInput): Promise<WechatBridgeLogReport> {
  if (!isTauriRuntime()) {
    const bridge = createMockWechatBridgeReport().bridges.find((item) => item.profileName === input.profileName);
    return {
      generatedAt: new Date().toISOString(),
      profileName: input.profileName,
      instance: bridge?.instance ?? input.profileName,
      appLogPath: bridge?.appLogPath ?? "",
      defaultLogPath: bridge?.defaultLogPath ?? "",
      logTail: bridge?.logTail ?? [],
    };
  }
  return invoke<WechatBridgeLogReport>("read_wechat_bridge_log_command", { input });
}

export async function listFeishuRemote(): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return createMockFeishuRemoteReport();
  }
  return invoke<FeishuRemoteReport>("list_feishu_remote_command");
}

export async function configureFeishuRemote(input: ConfigureFeishuRemoteInput): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return { ...createMockFeishuRemoteReport(), profileName: input.profileName, profileLabel: input.profileName };
  }
  return invoke<FeishuRemoteReport>("configure_feishu_remote_command", { input });
}

export async function startFeishuRemote(input: StartFeishuRemoteInput): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return {
      ...createMockFeishuRemoteReport(),
      profileName: input.profileName,
      profileLabel: input.profileName,
      running: true,
      healthy: true,
      connectionState: "connected",
    };
  }
  return invoke<FeishuRemoteReport>("start_feishu_remote_command", { input });
}

export async function stopFeishuRemote(): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return { ...createMockFeishuRemoteReport(), running: false, healthy: false, connectionState: "stopped", pid: null };
  }
  return invoke<FeishuRemoteReport>("stop_feishu_remote_command");
}

export async function restartFeishuRemote(): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return createMockFeishuRemoteReport();
  }
  return invoke<FeishuRemoteReport>("restart_feishu_remote_command");
}

export async function readFeishuRemoteLog(input: ReadFeishuRemoteLogInput): Promise<FeishuRemoteReport> {
  if (!isTauriRuntime()) {
    return createMockFeishuRemoteReport();
  }
  return invoke<FeishuRemoteReport>("read_feishu_remote_log_command", { input });
}

export async function openFeishuRemotePage(page: FeishuRemotePage): Promise<string> {
  if (!isTauriRuntime()) {
    return page === "project" ? createMockFeishuRemoteReport().projectUrl : createMockFeishuRemoteReport()[page === "setup" ? "setupUrl" : "adminUrl"];
  }
  return invoke<string>("open_feishu_remote_page_command", { page });
}

export async function listModelRoutes(): Promise<ModelRouteReport> {
  if (!isTauriRuntime()) {
    return createMockModelRouteReport();
  }
  return invoke<ModelRouteReport>("list_model_routes_command");
}

export async function readModelRouteProxyStatus(): Promise<ModelRouteProxyStatus> {
  if (!isTauriRuntime()) {
    return createMockModelRouteProxyStatus();
  }
  return invoke<ModelRouteProxyStatus>("read_model_route_proxy_status_command");
}

export async function startModelRouteProxy(): Promise<ModelRouteProxyStatus> {
  if (!isTauriRuntime()) {
    return createMockModelRouteProxyStatus({
      reachable: true,
      managed: true,
      canStart: false,
      canStop: true,
      status: "managed",
      statusLabel: "内置运行中",
      serviceKind: "rcodexmanager",
      serviceLabel: "rCodexManager 内置代理",
      serviceDetail: "由当前 rCodexManager 窗口启动，可在这里停止。",
      message: "rCodexManager 内置代理已启动；当前支持基础文本、tool_search 和常见工具调用的 Responses 到 Chat 转换。",
    });
  }
  return invoke<ModelRouteProxyStatus>("start_model_route_proxy_command");
}

export async function stopModelRouteProxy(): Promise<ModelRouteProxyStatus> {
  if (!isTauriRuntime()) {
    return createMockModelRouteProxyStatus();
  }
  return invoke<ModelRouteProxyStatus>("stop_model_route_proxy_command");
}

export async function previewModelRoute(input: PreviewModelRouteInput): Promise<ModelRoutePreview> {
  if (!isTauriRuntime()) {
    return createMockModelRoutePreview(input);
  }
  return invoke<ModelRoutePreview>("preview_model_route_command", { input });
}

export async function applyModelRoute(input: ApplyModelRouteInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("applyModelRoute", input.profileName);
  }
  return invoke<ProfileActionReport>("apply_model_route_command", { input });
}

export async function restoreModelRoute(input: RestoreModelRouteInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("restoreModelRoute", input.profileName);
  }
  return invoke<ProfileActionReport>("restore_model_route_command", { input });
}

export async function checkModelRouteProxy(input: CheckModelRouteProxyInput): Promise<ModelRouteProxyCheckResult> {
  const proxy = createMockModelRouteProxyStatus({
    reachable: true,
    managed: true,
    canStart: false,
    canStop: true,
    status: "managed",
    statusLabel: "内置运行中",
    message: "rCodexManager 内置代理已启动；当前支持基础文本、tool_search 和常见工具调用的 Responses 到 Chat 转换。",
  });
  if (!isTauriRuntime()) {
    return {
      generatedAt: new Date().toISOString(),
      profileName: input.profileName,
      model: "glm-4.6",
      baseUrl: proxy.baseUrl,
      endpoint: `${proxy.baseUrl}/responses`,
      ok: true,
      status: "ok",
      statusLabel: "自检通过",
      message: "模型路由自检已打通。",
      httpStatus: 200,
      latencyMs: 128,
      diagnostic: null,
      proxy,
    };
  }
  return invoke<ModelRouteProxyCheckResult>("check_model_route_proxy_command", { input });
}

export async function checkModelRouteDraft(input: PreviewModelRouteInput): Promise<ModelRouteProxyCheckResult> {
  if (!isTauriRuntime()) {
    const proxy = createMockModelRouteProxyStatus();
    return {
      generatedAt: new Date().toISOString(),
      profileName: input.profileName,
      model: input.model,
      baseUrl: input.upstreamBaseUrl ?? input.proxyBaseUrl,
      endpoint: `${(input.upstreamBaseUrl ?? input.proxyBaseUrl ?? "mock://route").replace(/\/$/, "")}/responses`,
      ok: true,
      status: "ok",
      statusLabel: "草稿测试通过",
      message: "当前表单参数已通过连接测试，尚未写入 profile 配置。",
      httpStatus: 200,
      latencyMs: 96,
      diagnostic: null,
      proxy,
    };
  }
  return invoke<ModelRouteProxyCheckResult>("check_model_route_draft_command", { input });
}

export async function createProfile(input: CreateProfileInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("create", input.name);
  }
  return invoke<ProfileActionReport>("create_profile_command", { input });
}

export async function copyProfile(input: CopyProfileInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("copy", input.name);
  }
  return invoke<ProfileActionReport>("copy_profile_command", { input });
}

export async function deleteProfile(name: string, archiveData: boolean): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("delete", name);
  }
  return invoke<ProfileActionReport>("delete_profile_command", { name, archiveData });
}

export async function archiveProfile(name: string): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    setMockProfileArchived(name, true);
    return createMockActionReport("archive", name);
  }
  return invoke<ProfileActionReport>("archive_profile_command", { name });
}

export async function restoreArchivedProfile(name: string): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    setMockProfileArchived(name, false);
    return createMockActionReport("restore", name);
  }
  return invoke<ProfileActionReport>("restore_archived_profile_command", { name });
}

export async function updateProfileMetadata(input: ProfileMetadataInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("update", input.name);
  }
  return invoke<ProfileActionReport>("update_profile_metadata_command", { input });
}

export async function updateProfileLauncher(input: UpdateProfileLauncherInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    renameMockProfile(input.profileName, input.newProfileName);
    return createMockActionReport("launcher-update", input.newProfileName);
  }
  return invoke<ProfileActionReport>("update_profile_launcher_command", { input });
}

export async function updateProfileModel(input: UpdateProfileModelInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("model-update", input.profileName);
  }
  return invoke<ProfileActionReport>("update_profile_model_command", { input });
}

export async function resetProfile(input: ResetProfileInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("reset", input.name);
  }
  return invoke<ProfileActionReport>("reset_profile_command", { input });
}

export async function launchProfile(
  name: string,
  options: { background?: boolean } = {},
): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("launch", name);
  }
  return invoke<ProfileActionReport>("launch_profile_command", {
    name,
    background: options.background ?? false,
  });
}

export async function terminateProfile(name: string): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("terminate", name);
  }
  return invoke<ProfileActionReport>("terminate_profile_command", { name });
}

export async function readProfileQuota(name: string): Promise<ProfileQuotaReport> {
  if (!isTauriRuntime()) {
    return {
      generatedAt: new Date().toISOString(),
      profileName: name,
      account: null,
      capturedAt: Math.floor(Date.now() / 1000),
      endpoint: "mock://usage",
      windows: [
        {
          id: "primary",
          label: "主窗口",
          usedPercent: 38,
          remainingPercent: 62,
          windowMinutes: 300,
          resetsAt: Math.floor(Date.now() / 1000) + 7200,
          allowed: true,
          limitReached: false,
          status: "available",
        },
        {
          id: "secondary",
          label: "长窗口",
          usedPercent: 71,
          remainingPercent: 29,
          windowMinutes: 10080,
          resetsAt: Math.floor(Date.now() / 1000) + 172800,
          allowed: true,
          limitReached: false,
          status: "available",
        },
      ],
    };
  }
  return invoke<ProfileQuotaReport>("read_profile_quota_command", { name });
}

export async function importProfileAuth(input: ImportAuthInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("importAuth", input.name);
  }
  return invoke<ProfileActionReport>("import_profile_auth_command", { input });
}

export async function revealPath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("reveal_path_command", { path });
}

export async function openCcSwitch(): Promise<string> {
  if (!isTauriRuntime()) {
    return "已尝试打开 cc-switch。";
  }
  return invoke<string>("open_cc_switch_command");
}
