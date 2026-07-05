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

export interface StartWechatBridgeInput {
  profileName: string;
}

export interface StopWechatBridgeInput {
  profileName: string;
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

export interface ProfileMetadataInput {
  name: string;
  alias: string | null;
  category: string | null;
  note: string | null;
}
