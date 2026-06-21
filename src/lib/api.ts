import { invoke } from "@tauri-apps/api/core";
import {
  createMockActionReport,
  createMockAuthVaultReport,
  createMockProfileReport,
  createMockProfileSessionReport,
} from "./mock-data";
import type {
  ApplyAuthBackupInput,
  AuthVaultReport,
  CreateProfileInput,
  CreateAuthBackupInput,
  DeleteAuthBackupInput,
  ImportAuthInput,
  ListProfileSessionsInput,
  CodexNetworkRepairReport,
  ProfileMetadataInput,
  ProfileActionReport,
  ProfileQuotaReport,
  ProfileReport,
  ProfileSessionReport,
  ResetProfileInput,
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

export async function deleteAuthBackup(input: DeleteAuthBackupInput): Promise<AuthVaultReport> {
  if (!isTauriRuntime()) {
    return createMockAuthVaultReport();
  }
  return invoke<AuthVaultReport>("delete_auth_backup_command", { input });
}

export async function createProfile(input: CreateProfileInput): Promise<ProfileActionReport> {
  if (!isTauriRuntime()) {
    return createMockActionReport("create", input.name);
  }
  return invoke<ProfileActionReport>("create_profile_command", { input });
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
