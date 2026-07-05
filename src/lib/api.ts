import { invoke } from "@tauri-apps/api/core";
import {
  createMockActionReport,
  createMockAuthVaultReport,
  createMockProfileReport,
  createMockProfileSessionReport,
  createMockWechatBridgeReport,
} from "./mock-data";
import type {
  ApplyAuthBackupInput,
  AuthBackupExportReport,
  AuthVaultReport,
  CleanupAuthBackupsInput,
  CopyProfileInput,
  CreateProfileInput,
  CreateAuthBackupInput,
  DeleteAuthBackupInput,
  ExportAuthBackupInput,
  ImportAuthBackupPackageInput,
  ImportAuthInput,
  ListProfileSessionsInput,
  CodexNetworkRepairReport,
  ProfileMetadataInput,
  ProfileActionReport,
  ProfileQuotaReport,
  ProfileReport,
  ProfileSessionReport,
  ReadWechatBridgeLogInput,
  ResetProfileInput,
  RollbackAuthApplicationInput,
  StartWechatBridgeInput,
  StopWechatBridgeInput,
  UpdateAuthBackupInput,
  WechatBridgeLogReport,
  WechatBridgeReport,
} from "./types";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function listProfiles(): Promise<ProfileReport> {
  if (!isTauriRuntime()) {
    return createMockProfileReport();
  }
  return invoke<ProfileReport>("list_profiles_command");
}

export async function listProfileSessions(input: ListProfileSessionsInput): Promise<ProfileSessionReport> {
  if (!isTauriRuntime()) {
    return createMockProfileSessionReport(input);
  }
  return invoke<ProfileSessionReport>("list_profile_sessions_command", { input });
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
              runningPids: [],
              lastStoppedAt: new Date().toISOString(),
            }
          : bridge,
      ),
    };
  }
  return invoke<WechatBridgeReport>("stop_wechat_bridge_command", { input });
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

export async function updateProfileMetadata(input: ProfileMetadataInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("update", input.name);
  }
  return invoke<ProfileActionReport>("update_profile_metadata_command", { input });
}

export async function resetProfile(input: ResetProfileInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("reset", input.name);
  }
  return invoke<ProfileActionReport>("reset_profile_command", { input });
}

export async function launchProfile(name: string): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("launch", name);
  }
  return invoke<ProfileActionReport>("launch_profile_command", { name });
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

export async function repairProfileNetwork(name: string): Promise<CodexNetworkRepairReport> {
  if (!isTauriRuntime()) {
    return {
      generatedAt: new Date().toISOString(),
      profileName: name,
      configPath: `/Users/ikiru/.${name}/config.toml`,
      configUpdated: true,
      featureFlags: [
        "responses_websockets",
        "responses_websockets_v2",
        "responses_websocket_response_processed",
      ],
      proxy: {
        httpProxy: "http://127.0.0.1:7897",
        httpsProxy: "http://127.0.0.1:7897",
        allProxy: "socks5://127.0.0.1:7897",
        wsProxy: "http://127.0.0.1:7897",
        wssProxy: "http://127.0.0.1:7897",
        noProxy: "localhost,127.0.0.1,::1,*.local",
      },
      launchEnvUpdated: true,
      launchEnvError: null,
      message: `repaired ${name}: enabled WebSocket flags and synced launch proxy`,
    };
  }
  return invoke<CodexNetworkRepairReport>("repair_profile_network_command", { name });
}

export async function revealPath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("reveal_path_command", { path });
}
