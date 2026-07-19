export interface ProfileInfo {
  name: string;
  alias: string | null;
  category: string;
  note: string | null;
  codexHome: string;
  userDataDir: string;
  configPath: string;
  model: string | null;
  reasoningEffort: string | null;
  homeExists: boolean;
  userDataExists: boolean;
  configExists: boolean;
  websocketFeaturesEnabled: boolean;
  managedByApp: boolean;
  isDefault: boolean;
  launcherKind: "desktop" | "server" | string;
  zshrcLine: number;
  isRunning: boolean;
  runningPids: number[];
  runningProcessCount: number;
  account: CodexAccountInfo | null;
  latestSession: CodexSessionSummary | null;
  recentSessions: CodexSessionSummary[];
}

export interface CodexSessionSummary {
  id: string;
  title: string;
  renamedTitle: string | null;
  summary: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  cwd: string | null;
  path: string | null;
}

export interface CodexAccountInfo {
  authMode: string | null;
  email: string | null;
  name: string | null;
  accountId: string | null;
  userId: string | null;
  planType: string | null;
  organizationTitle: string | null;
  lastRefresh: string | null;
}

export interface QuotaWindowInfo {
  id: string;
  label: string;
  usedPercent: number | null;
  remainingPercent: number | null;
  windowMinutes: number | null;
  resetsAt: number | null;
  allowed: boolean | null;
  limitReached: boolean | null;
  status: "available" | "low" | "exhausted" | "unknown" | string;
}

export interface ProfileQuotaReport {
  generatedAt: string;
  profileName: string;
  account: CodexAccountInfo | null;
  capturedAt: number;
  endpoint: string;
  windows: QuotaWindowInfo[];
}

export interface ProxyEnvSettings {
  httpProxy: string | null;
  httpsProxy: string | null;
  allProxy: string | null;
  wsProxy: string | null;
  wssProxy: string | null;
  noProxy: string;
}

export interface CodexNetworkRepairReport {
  generatedAt: string;
  profileName: string;
  configPath: string;
  configUpdated: boolean;
  featureFlags: string[];
  proxy: ProxyEnvSettings | null;
  launchEnvUpdated: boolean;
  launchEnvError: string | null;
  message: string;
}

export type DoctorCheckStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  id: string;
  group: string;
  label: string;
  status: DoctorCheckStatus;
  message: string;
  details: string[];
}

export interface DoctorReport {
  generatedAt: string;
  appVersion: string;
  platform: string;
  ready: boolean;
  summary: {
    okCount: number;
    warningCount: number;
    errorCount: number;
  };
  checks: DoctorCheck[];
}

export interface ServerNodeConfig {
  id: string;
  name: string;
  sshTarget: string;
  remoteBinary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerNodeReport {
  generatedAt: string;
  storePath: string;
  nodes: ServerNodeConfig[];
}

export interface UpsertServerNodeInput {
  id: string | null;
  name: string;
  sshTarget: string;
  remoteBinary: string | null;
}

export interface ServerNodeStatus {
  nodeId: string;
  checkedAt: string;
  reachable: boolean;
  latencyMs: number;
  hostname: string | null;
  user: string | null;
  os: string | null;
  arch: string | null;
  shell: string | null;
  codexInstalled: boolean;
  cliInstalled: boolean;
  cliVersion: string | null;
  error: string | null;
}

export interface ServerNodeProbeReport {
  node: ServerNodeConfig;
  status: ServerNodeStatus;
}

export type ServerNodeOperation =
  | { kind: "doctor" }
  | { kind: "list-profiles" }
  | { kind: "list-sessions"; input: ListProfileSessionsInput }
  | { kind: "read-session"; input: ReadProfileSessionDetailInput }
  | { kind: "auth-status" }
  | { kind: "wechat-status"; profileName: string | null }
  | { kind: "feishu-status" }
  | { kind: "feishu-start"; profileName: string }
  | { kind: "feishu-stop" }
  | { kind: "feishu-restart" }
  | { kind: "model-route-status"; profileName: string | null }
  | { kind: "model-route-preview"; input: PreviewModelRouteInput }
  | { kind: "model-route-check"; profileName: string }
  | { kind: "create-profile"; input: CreateProfileInput }
  | { kind: "launch-profile"; profileName: string }
  | { kind: "terminate-profile"; profileName: string }
  | { kind: "create-auth-backup"; profileName: string; label: string | null }
  | {
      kind: "apply-auth-backup";
      backupId: string;
      targetProfileName: string;
      confirmSensitive: boolean;
    }
  | { kind: "wechat-start"; profileName: string }
  | { kind: "wechat-stop"; profileName: string }
  | { kind: "wechat-restart"; profileName: string }
  | { kind: "model-route-apply"; input: ApplyModelRouteInput }
  | { kind: "model-route-restore"; profileName: string; confirmSensitive: boolean };

export interface RunServerNodeOperationInput {
  nodeId: string;
  operation: ServerNodeOperation;
}

export interface ServerNodeOperationReport<T = unknown> {
  nodeId: string;
  operationId: string;
  startedAt: string;
  generatedAt: string;
  timeoutSeconds: number;
  durationMs: number;
  exitCode: number;
  ok: boolean;
  command: string;
  outputTruncated: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
}

export interface ProfileReport {
  generatedAt: string;
  zshrcPath: string;
  metadataPath: string;
  homeDir: string;
  profileCount: number;
  profiles: ProfileInfo[];
}

export interface ProfileSessionReport {
  generatedAt: string;
  sessionCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  sessions: ProfileSessionSummary[];
}

export interface ProfileSessionSummary {
  profileName: string;
  profileAlias: string | null;
  profileCategory: string;
  isDefault: boolean;
  session: CodexSessionSummary;
}

export interface ListProfileSessionsInput {
  profileName: string | null;
  category: string | null;
  query: string | null;
  offset: number;
  limit: number;
}

export interface ReadProfileSessionDetailInput {
  profileName: string;
  sessionId: string;
  updatedAt: string | null;
}

export interface AuthProfileSlot {
  profileName: string;
  profileAlias: string | null;
  profileCategory: string;
  isDefault: boolean;
  isRunning: boolean;
  codexHome: string;
  authPath: string;
  authExists: boolean;
  account: CodexAccountInfo | null;
}

export interface AuthBackupEntry {
  id: string;
  label: string;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  sourceProfileName: string | null;
  sourceProfileLabel: string | null;
  sourceCodexHome: string | null;
  path: string;
  exists: boolean;
  valid: boolean;
  validationMessage: string | null;
  fileSizeBytes: number | null;
  modifiedAt: string | null;
  pinned: boolean;
  account: CodexAccountInfo | null;
  hasRefreshToken: boolean;
}

export interface AuthApplicationEntry {
  id: string;
  appliedAt: string;
  backupId: string;
  backupLabel: string;
  targetProfileName: string;
  targetProfileLabel: string | null;
  targetCodexHome: string;
  previousAuthPath: string | null;
  previousAuthExists: boolean;
  previousAccount: CodexAccountInfo | null;
  appliedAccount: CodexAccountInfo | null;
  rolledBackAt: string | null;
}

export interface AuthVaultReport {
  generatedAt: string;
  vaultPath: string;
  indexPath: string;
  profileCount: number;
  backupCount: number;
  profiles: AuthProfileSlot[];
  backups: AuthBackupEntry[];
  recentApplications: AuthApplicationEntry[];
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  moved: boolean;
}

export interface ProfileActionReport {
  generatedAt: string;
  action: string;
  zshrcPath: string;
  profile: ProfileInfo | null;
  backups: BackupInfo[];
  message: string;
}

export interface CreateProfileInput {
  name: string;
  codexHome: string | null;
  userDataDir: string | null;
  model: string | null;
  reasoningEffort: string | null;
  alias: string | null;
  category: string | null;
  note: string | null;
}

export interface CopyProfileInput {
  sourceName: string;
  name: string;
  codexHome: string | null;
  userDataDir: string | null;
  model: string | null;
  reasoningEffort: string | null;
  alias: string | null;
  category: string | null;
  note: string | null;
  authSourceName: string | null;
  confirmSensitive: boolean;
}

export interface ResetProfileInput {
  name: string;
  model: string | null;
  reasoningEffort: string | null;
  resetUserData: boolean;
}

export interface ImportAuthInput {
  name: string;
  sourcePath: string;
  confirmSensitive: boolean;
}

export interface CreateAuthBackupInput {
  name: string;
  label: string | null;
}

export interface CreateAuthBackupsInput {
  profileNames: string[];
  label: string | null;
}

export interface AuthBatchBackupItemResult {
  profileName: string;
  ok: boolean;
  backupId: string | null;
  message: string;
}

export interface AuthBatchBackupResult {
  generatedAt: string;
  successCount: number;
  failureCount: number;
  results: AuthBatchBackupItemResult[];
  vault: AuthVaultReport;
}

export interface PreviewAuthBackupPackageInput {
  packageJson: string;
}

export interface AuthBackupImportPreview {
  valid: boolean;
  label: string;
  note: string | null;
  sourceProfileName: string | null;
  sourceProfileLabel: string | null;
  account: CodexAccountInfo | null;
  hasRefreshToken: boolean;
  exportedAt: string;
  warnings: string[];
}

export interface ApplyAuthBackupInput {
  backupId: string;
  targetProfileName: string;
  confirmSensitive: boolean;
}

export interface RollbackAuthApplicationInput {
  applicationId: string;
  confirmSensitive: boolean;
}

export interface DeleteAuthBackupInput {
  backupId: string;
}

export interface UpdateAuthBackupInput {
  backupId: string;
  label: string | null;
  note: string | null;
  pinned: boolean;
}

export interface ExportAuthBackupInput {
  backupId: string;
}

export interface ImportAuthBackupPackageInput {
  packageJson: string;
  label: string | null;
  note: string | null;
  pinned: boolean;
  confirmSensitive: boolean;
}

export interface AuthBackupExportReport {
  generatedAt: string;
  path: string;
  fileName: string;
  backup: AuthBackupEntry;
  message: string;
}

export interface CleanupAuthBackupsInput {
  accountKey: string;
  confirmSensitive: boolean;
}

export type ModelRoutePreset = "aliyun-qwen" | "glm" | "openai-chat" | "local-openai" | "custom-responses";

export interface ModelRoutePresetInfo {
  id: ModelRoutePreset;
  label: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl: string | null;
  chatOnly: boolean;
  requiresProxy: boolean;
}

export interface ProfileModelRouteState {
  profileName: string;
  profileLabel: string;
  profileCategory: string;
  codexHome: string;
  configPath: string;
  configExists: boolean;
  isDefault: boolean;
  isRunning: boolean;
  model: string | null;
  reasoningEffort: string | null;
  modelProvider: string | null;
  baseUrl: string | null;
  wireApi: string | null;
  hasApiKey: boolean;
  routeStatus: string;
  routeStatusLabel: string;
  readOnlyReason: string | null;
  routed: boolean;
  needsProxy: boolean;
  needsAttention: boolean;
  canApply: boolean;
  canRestore: boolean;
}

export interface ModelRouteProxyStatus {
  generatedAt: string;
  listenHost: string;
  listenPort: number;
  baseUrl: string;
  serviceKind: string;
  serviceLabel: string;
  serviceDetail: string | null;
  reachable: boolean;
  managed: boolean;
  canStart: boolean;
  canStop: boolean;
  status: string;
  statusLabel: string;
  message: string;
  diagnostics: ModelRouteProxyDiagnostic[];
  recentLogs: ModelRouteProxyLogEntry[];
}

export interface ModelRouteProxyDiagnostic {
  generatedAt: string;
  level: "info" | "warning" | "error" | string;
  code: string;
  label: string;
  message: string;
  detail: string | null;
}

export interface ModelRouteProxyLogEntry {
  generatedAt: string;
  kind: string;
  profileName: string | null;
  model: string | null;
  endpoint: string | null;
  ok: boolean;
  status: string;
  statusLabel: string;
  message: string;
  httpStatus: number | null;
  latencyMs: number;
  diagnosticCode: string | null;
}

export interface ModelRouteReport {
  generatedAt: string;
  profileCount: number;
  routedCount: number;
  needsAttentionCount: number;
  proxy: ModelRouteProxyStatus;
  presets: ModelRoutePresetInfo[];
  profiles: ProfileModelRouteState[];
}

export interface PreviewModelRouteInput {
  profileName: string;
  preset: ModelRoutePreset;
  model: string;
  reasoningEffort: string | null;
  proxyBaseUrl: string | null;
  upstreamBaseUrl: string | null;
  apiKey: string | null;
  apiKeyEnv: string | null;
}

export interface ApplyModelRouteInput extends PreviewModelRouteInput {
  confirmSensitive: boolean;
}

export interface RestoreModelRouteInput {
  profileName: string;
  confirmSensitive: boolean;
}

export interface CheckModelRouteProxyInput {
  profileName: string;
}

export interface ModelRoutePreview {
  generatedAt: string;
  profileName: string;
  preset: ModelRoutePreset;
  presetLabel: string;
  providerId: string;
  providerName: string;
  model: string;
  reasoningEffort: string;
  baseUrl: string;
  wireApi: string;
  chatOnly: boolean;
  usesProxy: boolean;
  apiKeySource: string | null;
  configPreview: string;
  warnings: string[];
}

export interface ModelRouteProxyCheckResult {
  generatedAt: string;
  profileName: string;
  model: string;
  baseUrl: string | null;
  endpoint: string | null;
  ok: boolean;
  status: string;
  statusLabel: string;
  message: string;
  httpStatus: number | null;
  latencyMs: number;
  diagnostic: ModelRouteProxyDiagnostic | null;
  proxy: ModelRouteProxyStatus;
}

export interface StartWechatBridgeInput {
  profileName: string;
}

export interface StopWechatBridgeInput {
  profileName: string;
}

export interface RestartWechatBridgeInput {
  profileName: string;
}

export interface UnbindWechatBridgeInput {
  profileName: string;
  confirmSensitive: boolean;
}

export interface ReadWechatBridgeLogInput {
  profileName: string;
  lines: number | null;
}

export interface WechatBridgeEntry {
  profileName: string;
  profileLabel: string;
  profileCategory: string;
  codexHome: string;
  authExists: boolean;
  account: CodexAccountInfo | null;
  instance: string;
  storageDir: string;
  tokenPath: string;
  inboxDir: string;
  wrapperPath: string;
  appLogPath: string;
  defaultLogPath: string;
  tokenExists: boolean;
  running: boolean;
  managedByApp: boolean;
  connectionState: "unbound" | "awaiting-scan" | "bound" | "running" | "error" | string;
  runningPids: number[];
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastError: string | null;
  logTail: string[];
}

export interface WechatBridgeReport {
  generatedAt: string;
  storePath: string;
  bridgeCount: number;
  runningCount: number;
  wechatAcpPackage: string;
  codexAcpPackage: string;
  bridges: WechatBridgeEntry[];
}

export interface WechatBridgeLogReport {
  generatedAt: string;
  profileName: string;
  instance: string;
  appLogPath: string;
  defaultLogPath: string;
  logTail: string[];
}

export interface ConfigureFeishuRemoteInput {
  profileName: string;
  binaryPath: string | null;
}

export interface StartFeishuRemoteInput {
  profileName: string;
  binaryPath: string | null;
}

export interface ReadFeishuRemoteLogInput {
  lines: number | null;
}

export type FeishuRemotePage = "setup" | "admin" | "project";

export interface FeishuRemoteReport {
  generatedAt: string;
  instance: string;
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  profileName: string | null;
  profileLabel: string | null;
  codexHome: string | null;
  authExists: boolean;
  configured: boolean;
  running: boolean;
  healthy: boolean;
  connectionState: "not-installed" | "unconfigured" | "stopped" | "starting" | "connected" | "error" | string;
  pid: number | null;
  configPath: string;
  statePath: string;
  logPath: string;
  adminPort: number;
  setupUrl: string;
  adminUrl: string;
  gatewayCount: number;
  connectedGatewayCount: number;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastError: string | null;
  logTail: string[];
  projectUrl: string;
}

export interface ProfileMetadataInput {
  name: string;
  alias: string | null;
  category: string | null;
  note: string | null;
}
