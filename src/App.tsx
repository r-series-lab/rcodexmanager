import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import DataUsageRoundedIcon from "@mui/icons-material/DataUsageRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import UnarchiveRoundedIcon from "@mui/icons-material/UnarchiveRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import "./App.css";
import {
  applyModelRoute,
  applyAuthBackup,
  archiveProfile,
  checkModelRouteDraft,
  checkModelRouteProxy,
  cleanupAuthBackups,
  configureFeishuRemote,
  copyProfile,
  createAuthBackups,
  createProfile,
  deleteProfile,
  deleteAuthBackup,
  exportAuthBackup,
  importAuthBackupPackage,
  importProfileAuth,
  listAuthVault,
  listFeishuRemote,
  listModelRoutes,
  listWechatBridges,
  launchProfile,
  listProfileRuntimeStatuses,
  listProfileSessions,
  listProfiles,
  previewModelRoute,
  readProfileQuota,
  readProfileSessionDetail,
  readModelRouteProxyStatus,
  readFeishuRemoteLog,
  readWechatBridgeLog,
  runDoctor,
  resetProfile,
  revealPath,
  openCcSwitch,
  openFeishuRemotePage,
  rollbackAuthApplication,
  restoreModelRoute,
  restoreArchivedProfile,
  restartFeishuRemote,
  restartWechatBridge,
  startModelRouteProxy,
  startFeishuRemote,
  startWechatBridge,
  stopModelRouteProxy,
  stopFeishuRemote,
  stopWechatBridge,
  unbindWechatBridge,
  terminateProfile,
  updateProfileMetadata,
  updateProfileLauncher,
  updateProfileModel,
  updateAuthBackup,
} from "./lib/api";
import type {
  AuthProfileSlot,
  AuthVaultReport,
  CodexSessionSummary,
  CopyProfileInput,
  CreateProfileInput,
  DoctorReport,
  FeishuRemotePage,
  FeishuRemoteReport,
  ApplyModelRouteInput,
  ModelRouteProxyCheckResult,
  ModelRouteProxyStatus,
  ModelRouteReport,
  PreviewModelRouteInput,
  ProfileInfo,
  ProfileReport,
  ProfileSessionReport,
  RestoreModelRouteInput,
  WechatBridgeReport,
} from "./lib/types";
import type { QuotaWindowInfo } from "./lib/types";
import {
  createRcodexManagerTheme,
  type CodexManagerStyleMode,
} from "./theme/rcodexmanager-theme";
import { SessionCenterDialog } from "./features/session-center/SessionCenterDialog";
import { AuthVaultDialog } from "./features/auth-vault/AuthVaultDialog";
import { WechatBridgeDialog } from "./features/wechat-bridge/WechatBridgeDialog";
import { ModelRouteDialog } from "./features/model-route/ModelRouteDialog";
import {
  AuthLoginDialog,
  type AuthLoginTarget,
} from "./features/auth-login/AuthLoginDialog";
import { isDialogResourceFresh } from "./components/manager";
import { useActionRegistry } from "./hooks/useActionRegistry";
import {
  PROFILE_SORT_OPTIONS,
  parseProfileSortMode,
  sortProfiles,
  type ProfileSortMode,
} from "./lib/profileSorting";
import {
  compactQuotaWindowLabel,
  formatQuotaDateTime,
  isProfileQuotaCacheFresh,
  mapWithConcurrency,
  PROFILE_QUOTA_BATCH_CONCURRENCY,
  persistProfileQuotaCache,
  readPersistedProfileQuotaCache,
  quotaRemainingPercent,
  quotaWindowsForList,
  type ProfileQuotaCacheState,
} from "./lib/profileQuota";
import { mergeProfileRuntimeReport } from "./lib/profileRuntime";
import {
  createTranslator,
  I18nProvider,
  initialAppLanguage,
  persistAppLanguage,
  type AppLanguage,
  type Translate,
  useI18n,
} from "./i18n";

type FeedbackState = {
  severity: "success" | "info" | "warning" | "error";
  text: string;
};

const actionKeys = {
  doctor: "doctor.run",
  profileRefresh: "profile.refresh",
  profileCreate: "profile.create",
  profileCopy: "profile.copy",
  profileMetadata: (name: string) => `profile.metadata:${name}`,
  profileArchive: (name: string) => `profile.archive:${name}`,
  profileLifecycle: (name: string) => `profile.lifecycle:${name}`,
  profileDelete: (name: string) => `profile.delete:${name}`,
  profileReset: (name: string) => `profile.reset:${name}`,
  profileLauncher: (name: string) => `profile.launcher:${name}`,
  profileImportAuth: (name: string) => `profile.import-auth:${name}`,
  authCreate: "auth.create",
  authImport: "auth.import",
  authApply: (name: string) => `auth.apply:${name}`,
  authExport: (id: string) => `auth.export:${id}`,
  authRollback: (id: string) => `auth.rollback:${id}`,
  authUpdate: (id: string) => `auth.update:${id}`,
  authCleanup: (accountKey: string) => `auth.cleanup:${accountKey}`,
  authDelete: (id: string) => `auth.delete:${id}`,
  wechatLifecycle: (name: string) => `remote.wechat:${name}`,
  feishuLifecycle: "remote.feishu",
  modelRouteApply: (name: string) => `modelRoute.apply:${name}`,
  modelRouteRestore: (name: string) => `modelRoute.restore:${name}`,
  modelRouteCheck: (name: string) => `modelRoute.check:${name}`,
  modelRouteDraft: (name: string) => `modelRoute.draft:${name}`,
  modelRouteProxy: "modelRoute.proxy",
  modelRouteCcSwitch: "modelRoute.cc-switch",
};

const PROFILE_RUNTIME_REFRESH_INTERVAL_MS = 5_000;

type ProfileContextMenuState = {
  mouseX: number;
  mouseY: number;
  profileName: string;
  mode: "context" | "actions";
};


type ProfileEditDraft = {
  name: string;
  alias: string;
  category: string;
  note: string;
  model: string;
  reasoningEffort: string;
};

type ProfileColumnSortKey = "category" | "usage";
type ProfileColumnSortDirection = "asc" | "desc";
type ProfileColumnSortState = {
  key: ProfileColumnSortKey;
  direction: ProfileColumnSortDirection;
} | null;

type SessionSourceProfile = Pick<ProfileInfo, "name" | "alias" | "category" | "isDefault">;

type SessionCenterItem = {
  profile: SessionSourceProfile;
  session: CodexSessionSummary;
};

type FeatureCommandItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  ariaLabel?: string;
  countLabel?: string;
  actionLabel?: string;
  onClick: () => void;
};

type ThemePreference = CodexManagerStyleMode | "system";

const NO_AUTH_SOURCE = "__none__";
const PROFILE_SORT_STORAGE_KEY = "rcodexmanager-profile-sort";
const ACTIVE_PROFILE_STORAGE_KEY = "rcodexmanager-active-profile";

const DEFAULT_FORM: CreateProfileInput = {
  name: "codex-f",
  codexHome: "",
  userDataDir: "",
  model: "gpt-5.5",
  reasoningEffort: "xhigh",
  alias: "",
  category: "深度",
  note: null,
};

const PROFILE_CATEGORY_ORDER = ["默认", "付费", "free", "upi", "非plus", "深度", "平衡"];
const REASONING_EFFORT_OPTIONS = ["minimal", "low", "medium", "high", "xhigh"];
const FREE_PLAN_LABELS = new Set(["free", "trial"]);

function initialThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem("rcodexmanager-style");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function initialProfileSortMode(): ProfileSortMode {
  return parseProfileSortMode(window.localStorage.getItem(PROFILE_SORT_STORAGE_KEY));
}

function initialActiveProfileName(): string {
  return window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)?.trim() || "";
}

function getSystemStyleMode(): CodexManagerStyleMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) {
      return message;
    }
  }
  return fallback;
}

function textFieldSlotProps(name: string) {
  return {
    htmlInput: {
      name,
      autoComplete: "off",
      spellCheck: false,
    },
  };
}

function profileLabel(profile: Pick<ProfileInfo, "name" | "alias">): string {
  return profile.alias || profile.name;
}

function profileColumnSortValue(
  profile: ProfileInfo,
  sortKey: ProfileColumnSortKey,
  quotaByProfile: Record<string, ProfileQuotaCacheState>,
): string | number | null {
  if (sortKey === "category") {
    return profile.category.trim() || null;
  }
  const remaining = quotaWindowsForList(quotaByProfile[profile.name]?.report ?? null)
    .map(quotaRemainingPercent)
    .filter((value): value is number => value !== null);
  return remaining.length ? Math.min(...remaining) : null;
}

function sortProfilesByColumn(
  profiles: readonly ProfileInfo[],
  sortState: ProfileColumnSortState,
  quotaByProfile: Record<string, ProfileQuotaCacheState>,
): ProfileInfo[] {
  if (!sortState) {
    return [...profiles];
  }
  const direction = sortState.direction === "asc" ? 1 : -1;
  return [...profiles].sort((left, right) => {
    const leftValue = profileColumnSortValue(left, sortState.key, quotaByProfile);
    const rightValue = profileColumnSortValue(right, sortState.key, quotaByProfile);
    if (leftValue === null && rightValue === null) {
      return left.name.localeCompare(right.name, "en", { numeric: true });
    }
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction
        || left.name.localeCompare(right.name, "en", { numeric: true });
    }
    return String(leftValue).localeCompare(String(rightValue), "zh-CN", { numeric: true }) * direction
      || left.name.localeCompare(right.name, "en", { numeric: true });
  });
}

function isCustomQuotaProfile(profile: ProfileInfo): boolean {
  const provider = profile.modelProvider?.trim().toLowerCase();
  return Boolean(provider && provider !== "openai" && provider !== "openai-responses");
}

function isQuotaUnsupported(profile: ProfileInfo, state: ProfileQuotaCacheState | undefined): boolean {
  return Boolean(
    state?.error
      && !state.report
      && isCustomQuotaProfile(profile)
      && state.error.includes("does not have a configured quota provider"),
  );
}

function ProfileColumnSortHeader({
  label,
  sortKey,
  sortState,
  onSort,
  sortLabel,
}: {
  label: string;
  sortKey: ProfileColumnSortKey;
  sortState: ProfileColumnSortState;
  onSort: (sortKey: ProfileColumnSortKey) => void;
  sortLabel: string;
}) {
  const active = sortState?.key === sortKey;
  const direction = active ? sortState.direction : null;
  return (
    <span
      className={`profile-sort-header ${active ? "active" : ""}`}
      role="columnheader"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      <button
        type="button"
        className="profile-sort-header-button"
        aria-label={`${label} ${sortLabel}`}
        onClick={() => onSort(sortKey)}
      >
        <span className="profile-sort-label">{label}</span>
        {direction === "asc" ? (
          <ArrowUpwardRoundedIcon className="profile-sort-icon" fontSize="inherit" />
        ) : direction === "desc" ? (
          <ArrowDownwardRoundedIcon className="profile-sort-icon" fontSize="inherit" />
        ) : (
          <UnfoldMoreRoundedIcon className="profile-sort-icon" fontSize="inherit" />
        )}
      </button>
    </span>
  );
}

function ProfileCategoryAutocomplete({
  value,
  options,
  inputName,
  label,
  placeholder,
  className,
  onChange,
}: {
  value: string;
  options: ReadonlyArray<string>;
  inputName: string;
  label?: string;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const fieldSlotProps = textFieldSlotProps(inputName);

  return (
    <Autocomplete
      className={`profile-category-autocomplete ${className ?? ""}`.trim()}
      freeSolo
      disableClearable
      forcePopupIcon
      popupIcon={<KeyboardArrowDownRoundedIcon fontSize="small" />}
      options={options}
      filterOptions={(candidateOptions, { inputValue }) => {
        const normalizedValue = inputValue.trim();
        const normalizedQuery = normalizedValue.toLowerCase();
        const filtered = candidateOptions.filter((option) =>
          option.toLowerCase().includes(normalizedQuery),
        );

        return normalizedValue && !filtered.includes(normalizedValue)
          ? [normalizedValue, ...filtered]
          : filtered;
      }}
      slotProps={{
        popper: { className: "profile-category-popper" },
        paper: { className: "profile-category-menu" },
      }}
      value={value}
      onInputChange={(_, nextValue) => onChange(nextValue)}
      onChange={(_, nextValue) => onChange(typeof nextValue === "string" ? nextValue : "")}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t("分类")}
          placeholder={placeholder}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              ...fieldSlotProps.htmlInput,
            },
          }}
        />
      )}
    />
  );
}

type ProfileSignalTone = "good" | "warning" | "error" | "neutral";

function profileAuthSignal(profile: ProfileInfo): { label: string; tone: ProfileSignalTone; detail: string } {
  switch (profile.authState?.status) {
    case "valid":
      return { label: "有效", tone: "good", detail: "认证有效" };
    case "api-key":
      return { label: "API Key", tone: "good", detail: "使用 API Key 认证" };
    case "refresh-required":
      return { label: "需刷新", tone: "warning", detail: "认证需要刷新" };
    case "expired":
      return { label: "已过期", tone: "error", detail: "认证已过期" };
    case "invalid":
      return { label: "已失效", tone: "error", detail: "认证无效" };
    case "missing":
      return { label: "未登录", tone: "neutral", detail: "未找到认证" };
    case "unknown":
      return { label: "未验证", tone: "neutral", detail: "认证状态尚未验证" };
    default:
      return profile.account
        ? { label: "已登录", tone: "neutral", detail: "已读取账号，认证状态尚未验证" }
        : { label: "未登录", tone: "neutral", detail: "未找到认证" };
  }
}

function profileEnvironmentSignal(profile: ProfileInfo): { label: string; tone: ProfileSignalTone; detail: string } {
  if (!profile.homeExists || !profile.userDataExists) {
    return { label: "路径异常", tone: "error", detail: "CODEX_HOME 或 User Data 路径不存在" };
  }
  if (!profile.configExists) {
    if (profile.authState?.status === "api-key") {
      return { label: "API Key 模式", tone: "good", detail: "使用 API Key 认证，config.toml 可选" };
    }
    return { label: "缺少配置", tone: "warning", detail: "未找到 config.toml" };
  }
  if (!profile.managedByApp) {
    return { label: "外部管理", tone: "neutral", detail: "Profile 配置不由 rCodexManager 管理" };
  }
  return { label: "正常", tone: "good", detail: "路径与配置正常" };
}

function doctorStatusLabel(status: DoctorReport["checks"][number]["status"]): string {
  if (status === "ok") {
    return "正常";
  }
  if (status === "warning") {
    return "提醒";
  }
  return "错误";
}

function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `rCodexManager Doctor ${report.appVersion}`,
    `生成时间: ${report.generatedAt}`,
    `平台: ${report.platform}`,
    `结果: ${report.ready ? "核心功能可用" : "发现错误"}`,
    `汇总: ${report.summary.okCount} 正常 / ${report.summary.warningCount} 提醒 / ${report.summary.errorCount} 错误`,
    "",
  ];
  for (const check of report.checks) {
    lines.push(`[${doctorStatusLabel(check.status)}] ${check.group} · ${check.label}`);
    lines.push(check.message);
    lines.push(...check.details.map((detail) => `- ${detail}`));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function isValidProfileName(name: string): boolean {
  return /^codex-[a-z0-9-]+$/.test(name.trim());
}

function nextCopyProfileName(sourceName: string, profiles: ProfileInfo[]): string {
  const existingNames = new Set(profiles.map((profile) => profile.name));
  const base = sourceName === "codex" ? "codex-copy" : `${sourceName}-copy`;
  if (!existingNames.has(base)) {
    return base;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${Date.now()}`;
}

function createCopyDraft(source: ProfileInfo, profiles: ProfileInfo[]): CopyProfileInput {
  return {
    sourceName: source.name,
    name: nextCopyProfileName(source.name, profiles),
    codexHome: "",
    userDataDir: "",
    model: source.model ?? "gpt-5.5",
    reasoningEffort: source.reasoningEffort ?? "xhigh",
    alias: source.alias ? `${source.alias} 副本` : "",
    category: source.category,
    note: source.note,
    authSourceName: NO_AUTH_SOURCE,
    confirmSensitive: false,
  };
}

function FeatureCommandGrid({ items }: { items: FeatureCommandItem[] }) {
  const { t } = useI18n();
  return (
    <Box className="browser-command-grid" aria-label={t("核心功能")}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="command-card"
          aria-label={item.ariaLabel ?? item.title}
          onClick={item.onClick}
        >
          <span className="command-icon">{item.icon}</span>
          <span className="command-copy">
            <span className="command-title">{item.title}</span>
            <span className="command-subtitle">{item.subtitle}</span>
          </span>
          <span className="command-meta">
            {item.countLabel ? <span className="command-count">{item.countLabel}</span> : null}
            <KeyboardArrowRightRoundedIcon className="command-chevron" aria-hidden="true" />
          </span>
        </button>
      ))}
    </Box>
  );
}

function TaskDialogTitle({
  icon,
  title,
  subtitle,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <DialogTitle className="task-dialog-title">
      <Stack direction="row" spacing={1} className="task-dialog-title-main">
        <Box className="task-dialog-title-icon">{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" className="task-dialog-heading">{t(title)}</Typography>
          {subtitle ? <Typography className="task-dialog-subtitle">{t(subtitle)}</Typography> : null}
        </Box>
      </Stack>
      <Tooltip title={t("关闭")}>
        <IconButton size="small" onClick={onClose} aria-label={t("关闭")}>
          <CloseRoundedIcon />
        </IconButton>
      </Tooltip>
    </DialogTitle>
  );
}

function CreateProfileSection({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Box component="section" className={`create-profile-section ${className}`.trim()}>
      <Box className="create-profile-section-heading">
        <span className="create-profile-section-icon">{icon}</span>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="subtitle2">{title}</Typography>
          <Typography variant="caption">{description}</Typography>
        </Box>
      </Box>
      {children}
    </Box>
  );
}

function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialThemePreference);
  const [systemStyleMode, setSystemStyleMode] = useState<CodexManagerStyleMode>(getSystemStyleMode);
  const [language, setLanguage] = useState<AppLanguage>(initialAppLanguage);
  const t = useMemo(() => createTranslator(language), [language]);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const styleMode = themePreference === "system" ? systemStyleMode : themePreference;
  const theme = useMemo(() => createRcodexManagerTheme(styleMode), [styleMode]);
  const [report, setReport] = useState<ProfileReport | null>(null);
  const profileRuntimeTargetsRef = useRef<ProfileInfo[]>([]);
  const profileRuntimeRefreshInFlightRef = useRef(false);
  const [activeName, setActiveName] = useState(initialActiveProfileName);
  const [profileGridElement, setProfileGridElement] = useState<HTMLDivElement | null>(null);
  const [profileHeaderElement, setProfileHeaderElement] = useState<HTMLElement | null>(null);
  const [profileSort, setProfileSort] = useState<ProfileSortMode>(initialProfileSortMode);
  const [profileColumnSort, setProfileColumnSort] = useState<ProfileColumnSortState>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProfileInput>(DEFAULT_FORM);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyDraft, setCopyDraft] = useState<CopyProfileInput | null>(null);
  const [editDraft, setEditDraft] = useState<ProfileEditDraft>({
    name: "",
    alias: "",
    category: "",
    note: "",
    model: "",
    reasoningEffort: "xhigh",
  });
  const [resetDraft, setResetDraft] = useState({
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    resetUserData: true,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [archiveOnDelete, setArchiveOnDelete] = useState(false);
  const [importSourcePath, setImportSourcePath] = useState("");
  const [confirmImportSensitive, setConfirmImportSensitive] = useState(false);
  const { activeActions, startAction, finishAction, isActionBusy } = useActionRegistry();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [quotaByProfile, setQuotaByProfile] = useState<Record<string, ProfileQuotaCacheState>>(
    () => readPersistedProfileQuotaCache(),
  );
  const [quotaBatchLoading, setQuotaBatchLoading] = useState(false);
  const [quotaRetryAfterAuthRefresh, setQuotaRetryAfterAuthRefresh] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionReport, setSessionReport] = useState<ProfileSessionReport | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionProfileName, setSessionProfileName] = useState("");
  const [sessionCategory, setSessionCategory] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState(10);
  const [profilePage, setProfilePage] = useState(1);
  const [profilePageSize, setProfilePageSize] = useState(100);
  const [profilePageSizeMenuAnchor, setProfilePageSizeMenuAnchor] = useState<HTMLElement | null>(null);
  const [quotaDialogProfileName, setQuotaDialogProfileName] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authReport, setAuthReport] = useState<AuthVaultReport | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProfileName, setAuthProfileName] = useState("");
  const [selectedAuthBackupId, setSelectedAuthBackupId] = useState("");
  const [authLoginTarget, setAuthLoginTarget] = useState<AuthLoginTarget | null>(null);
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [wechatReport, setWechatReport] = useState<WechatBridgeReport | null>(null);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [wechatProfileName, setWechatProfileName] = useState("");
  const [feishuReport, setFeishuReport] = useState<FeishuRemoteReport | null>(null);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuError, setFeishuError] = useState<string | null>(null);
  const [feishuProfileName, setFeishuProfileName] = useState("");
  const [modelRouteDialogOpen, setModelRouteDialogOpen] = useState(false);
  const [modelRouteReport, setModelRouteReport] = useState<ModelRouteReport | null>(null);
  const [modelRouteLoading, setModelRouteLoading] = useState(false);
  const [modelRouteError, setModelRouteError] = useState<string | null>(null);
  const [modelRouteProfileName, setModelRouteProfileName] = useState("");
  const [profileContextMenu, setProfileContextMenu] = useState<ProfileContextMenuState | null>(null);
  const sessionRequestIdRef = useRef(0);
  const sessionResourceRef = useRef({ key: "", updatedAt: null as number | null });
  const resourceUpdatedAtRef = useRef({ auth: null as number | null, wechat: null as number | null, feishu: null as number | null, modelRoute: null as number | null });

  const profiles = report?.profiles ?? [];
  const archivedProfiles = report?.archivedProfiles ?? [];
  const allProfiles = useMemo(
    () => [...profiles, ...archivedProfiles],
    [archivedProfiles, profiles],
  );
  const contextMenuProfile = useMemo(
    () =>
      profileContextMenu
        ? allProfiles.find((profile) => profile.name === profileContextMenu.profileName) ?? null
        : null,
    [allProfiles, profileContextMenu],
  );
  const quotaDialogProfile = useMemo(
    () => allProfiles.find((profile) => profile.name === quotaDialogProfileName) ?? null,
    [allProfiles, quotaDialogProfileName],
  );
  const existingNames = useMemo(() => new Set(allProfiles.map((profile) => profile.name)), [allProfiles]);
  const profileFilterSource = statusFilter === "archived" ? archivedProfiles : profiles;
  const categoryFilterOptions = useMemo(() => {
    const categories = Array.from(new Set(profileFilterSource.map((profile) => profile.category).filter(Boolean)));
    const orderedCategories = [
      ...PROFILE_CATEGORY_ORDER.filter((category) => categories.includes(category) && category !== "付费"),
      ...categories
        .filter((category) => !PROFILE_CATEGORY_ORDER.includes(category))
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    ];

    return [
      { key: "all", label: t("全部"), count: profileFilterSource.length },
      { key: "paid", label: t("付费"), count: profileFilterSource.filter(isPaidProfile).length },
      ...orderedCategories.map((category) => ({
        key: `category:${category}`,
        label: t(category),
        count: profileFilterSource.filter((profile) => profile.category === category).length,
      })),
    ].filter((option) => option.key === "all" || option.count > 0);
  }, [profileFilterSource, t]);
  const profileCategoryOptions = useMemo(() => {
    const categories = allProfiles
      .map((profile) => profile.category.trim())
      .filter(Boolean);

    return [
      ...PROFILE_CATEGORY_ORDER.filter((category) => categories.includes(category)),
      ...Array.from(new Set(categories))
        .filter((category) => !PROFILE_CATEGORY_ORDER.includes(category))
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    ];
  }, [allProfiles]);
  const statusFilterOptions = useMemo(
    () => [
      { key: "all", label: t("全部"), count: profiles.length },
      { key: "running", label: t("运行中"), count: profiles.filter((profile) => profile.isRunning).length },
      { key: "signed-in", label: t("已登录"), count: profiles.filter((profile) => Boolean(profile.account)).length },
      { key: "signed-out", label: t("未登录"), count: profiles.filter((profile) => !profile.account).length },
      { key: "has-session", label: t("有会话"), count: profiles.filter((profile) => Boolean(profile.latestSession)).length },
      { key: "archived", label: t("已归档"), count: archivedProfiles.length },
    ],
    [archivedProfiles.length, profiles, t],
  );
  const visibleProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = profileFilterSource.filter((profile) => {
      if (!matchesCategoryFilter(profile, categoryFilter)) {
        return false;
      }
      if (statusFilter !== "archived" && !matchesStatusFilter(profile, statusFilter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [
        profile.name,
        profile.alias ?? "",
        profile.category,
        profile.model ?? "",
        profile.reasoningEffort ?? "",
        accountLabel(profile),
        profile.account?.planType ?? "",
        profile.account?.organizationTitle ?? "",
        profile.codexHome,
        profile.latestSession?.title ?? "",
        profile.latestSession?.summary ?? "",
        profile.latestSession?.cwd ?? "",
        ...profile.recentSessions.flatMap((session) => [
          session.title,
          session.summary ?? "",
          session.cwd ?? "",
        ]),
      ]
        .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
    });
    const baseSorted = statusFilter === "archived"
      ? filtered.sort((left, right) =>
        (right.archivedAt ?? "").localeCompare(left.archivedAt ?? ""),
      )
      : sortProfiles(filtered, profileSort);
    return sortProfilesByColumn(baseSorted, profileColumnSort, quotaByProfile);
  }, [categoryFilter, profileColumnSort, profileFilterSource, profileSort, query, quotaByProfile, statusFilter]);
  const profilePageCount = Math.max(1, Math.ceil(visibleProfiles.length / profilePageSize));
  const paginatedProfiles = useMemo(
    () => visibleProfiles.slice((profilePage - 1) * profilePageSize, profilePage * profilePageSize),
    [profilePage, profilePageSize, visibleProfiles],
  );
  useLayoutEffect(() => {
    if (!profileGridElement || !profileHeaderElement) return;

    const updateScrollbarSize = () => {
      const scrollbarSize = Math.max(0, profileGridElement.offsetWidth - profileGridElement.clientWidth);
      profileHeaderElement.style.setProperty(
        "--profile-scrollbar-size",
        `${scrollbarSize}px`,
      );
    };

    updateScrollbarSize();
    const resizeObserver = new ResizeObserver(updateScrollbarSize);
    resizeObserver.observe(profileGridElement);
    return () => resizeObserver.disconnect();
  }, [profileGridElement, profileHeaderElement, visibleProfiles.length, profileFilterSource.length]);

  const activeProfile = useMemo(
    () => allProfiles.find((profile) => profile.name === activeName) ?? visibleProfiles[0] ?? null,
    [activeName, allProfiles, visibleProfiles],
  );
  const activeOperationalProfile = activeProfile?.isArchived ? null : activeProfile;
  useEffect(() => {
    if (!report) return;
    if (!visibleProfiles.some((profile) => profile.name === activeName)) {
      setActiveName(visibleProfiles[0]?.name ?? "");
    }
  }, [activeName, report, visibleProfiles]);
  useEffect(() => {
    setProfilePage((current) => Math.min(current, profilePageCount));
  }, [profilePageCount]);
  useEffect(() => {
    setProfilePage(1);
  }, [query, categoryFilter, statusFilter, profileSort, profileColumnSort]);
  useEffect(() => {
    window.localStorage.setItem(PROFILE_SORT_STORAGE_KEY, profileSort);
  }, [profileSort]);
  function toggleProfileColumnSort(sortKey: ProfileColumnSortKey) {
    setProfileColumnSort((current) => current?.key === sortKey
      ? { key: sortKey, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key: sortKey, direction: "asc" });
  }
  useEffect(() => {
    if (activeName) {
      window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeName);
    }
  }, [activeName]);
  const sessionItems = useMemo<SessionCenterItem[]>(
    () =>
      sessionReport
        ? sessionReport.sessions.map((item) => ({
            profile: {
              name: item.profileName,
              alias: item.profileAlias,
              category: item.profileCategory,
              isDefault: item.isDefault,
            },
            session: item.session,
          }))
        : [],
    [sessionReport],
  );
  const wechatBoundCount = useMemo(
    () => wechatReport?.bridges.filter((bridge) => bridge.tokenExists).length ?? 0,
    [wechatReport],
  );
  const sessionCountLabel = sessionReport
    ? `${sessionReport.offset + sessionReport.sessions.length}${sessionReport.hasMore ? "+" : ""}`
    : "";
  const authCountLabel = authReport ? `${authReport.backupCount}` : "";
  const remoteChannelCountLabel = wechatReport || feishuReport
    ? `${(wechatReport?.runningCount ?? 0) + (feishuReport?.running ? 1 : 0)}/${wechatBoundCount + (feishuReport?.configured ? 1 : 0)}`
    : "";
  const modelRouteCountLabel = modelRouteReport
    ? `${modelRouteReport.routedCount}/${modelRouteReport.needsAttentionCount}`
    : "";
  const featureCommands: FeatureCommandItem[] = [
    {
      key: "sessions",
      title: t("会话中心"),
      subtitle: t("最近会话与摘要"),
      icon: <ForumRoundedIcon fontSize="small" />,
      countLabel: sessionCountLabel,
      actionLabel: t("查看"),
      onClick: handleOpenSessionCenter,
    },
    {
      key: "auth",
      title: t("认证库"),
      subtitle: authReport ? t("备份可应用") : t("登录态备份与回滚"),
      icon: <VpnKeyRoundedIcon fontSize="small" />,
      countLabel: authCountLabel,
      actionLabel: t("管理"),
      onClick: handleOpenAuthVault,
    },
    {
      key: "remote-channels",
      title: t("远程渠道"),
      subtitle: t("微信 · 飞书"),
      icon: <HubRoundedIcon fontSize="small" />,
      countLabel: remoteChannelCountLabel,
      actionLabel: t("管理"),
      onClick: handleOpenWechatBridge,
    },
    {
      key: "model-route",
      title: t("模型路由"),
      subtitle: t("按 Profile 管理模型与服务路由"),
      icon: <AltRouteRoundedIcon fontSize="small" />,
      countLabel: modelRouteCountLabel,
      actionLabel: t("配置"),
      onClick: handleOpenModelRoute,
    },
  ];
  const createNameExists = existingNames.has(createDraft.name.trim());
  const createNameInvalid = createDraft.name.trim() !== "" && !isValidProfileName(createDraft.name);
  const canCreate = isValidProfileName(createDraft.name) && !createNameExists;
  const copyNameExists = copyDraft ? existingNames.has(copyDraft.name.trim()) : false;
  const copySourceProfile = copyDraft
    ? profiles.find((profile) => profile.name === copyDraft.sourceName) ?? null
    : null;
  const copyAuthSelected = Boolean(
    copyDraft?.authSourceName && copyDraft.authSourceName !== NO_AUTH_SOURCE,
  );
  const canCopyProfile = Boolean(
    copyDraft &&
      copySourceProfile &&
      isValidProfileName(copyDraft.name) &&
      !copyNameExists &&
      (!copyAuthSelected || copyDraft.confirmSensitive),
  );
  const metadataChanged =
    Boolean(activeProfile) &&
    ((activeProfile?.alias ?? "") !== editDraft.alias.trim() ||
      (activeProfile?.category ?? "") !== editDraft.category.trim() ||
      (activeProfile?.note ?? "") !== editDraft.note.trim());
  const modelChanged =
    Boolean(activeProfile) &&
    ((activeProfile?.model ?? "") !== editDraft.model.trim() ||
      (activeProfile?.reasoningEffort ?? "") !== editDraft.reasoningEffort.trim());
  const canEditModel = Boolean(
    activeProfile &&
      !activeProfile.isDefault &&
      !activeProfile.isRunning &&
      !activeProfile.isArchived,
  );
  const canEditLauncher = Boolean(
    activeProfile &&
      !activeProfile.isDefault &&
      !activeProfile.isRunning &&
      !activeProfile.isArchived,
  );
  const launcherNameChanged = Boolean(activeProfile) && editDraft.name.trim() !== activeProfile?.name;
  const editNameExists = launcherNameChanged && existingNames.has(editDraft.name.trim());
  const editNameInvalid = editDraft.name.trim() !== "" && !isValidProfileName(editDraft.name);
  const editChanged = metadataChanged || (canEditModel && modelChanged) || (canEditLauncher && launcherNameChanged);

  function selectProfile(profileName: string) {
    setActiveName(profileName);
  }

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = () => {
      setSystemStyleMode(colorScheme.matches ? "dark" : "light");
    };

    handleColorSchemeChange();
    colorScheme.addEventListener("change", handleColorSchemeChange);
    return () => colorScheme.removeEventListener("change", handleColorSchemeChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rcodexmanager-style", themePreference);
  }, [themePreference]);

  useEffect(() => {
    persistAppLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    persistProfileQuotaCache(quotaByProfile);
  }, [quotaByProfile]);

  useEffect(() => {
    document.documentElement.dataset.style = styleMode;
  }, [styleMode]);

  async function refreshProfiles(nextFeedback?: FeedbackState): Promise<ProfileReport | null> {
    if (!startAction(actionKeys.profileRefresh, "刷新中")) {
      return null;
    }
    try {
      const nextReport = await listProfiles();
      profileRuntimeTargetsRef.current = [
        ...nextReport.profiles,
        ...(nextReport.archivedProfiles ?? []),
      ];
      setReport(nextReport);
      setActiveName((current) => {
        const availableProfiles = statusFilter === "archived"
          ? nextReport.archivedProfiles ?? []
          : nextReport.profiles;
        if (availableProfiles.some((profile) => profile.name === current)) {
          return current;
        }
        return statusFilter === "archived"
          ? availableProfiles[0]?.name ?? ""
          : sortProfiles(availableProfiles, profileSort)[0]?.name ?? "";
      });
      setSessionReport(null);
      sessionResourceRef.current = { key: "", updatedAt: null };
      setSessionProfileName("");
      setFeedback(nextFeedback ?? null);
      return nextReport;
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取 profile 失败"),
      });
      return null;
    } finally {
      finishAction(actionKeys.profileRefresh);
    }
  }

  async function refreshProfileRuntimeStatuses() {
    if (profileRuntimeRefreshInFlightRef.current || profileRuntimeTargetsRef.current.length === 0) {
      return;
    }
    profileRuntimeRefreshInFlightRef.current = true;
    try {
      const runtimeReport = await listProfileRuntimeStatuses(profileRuntimeTargetsRef.current);
      setReport((current) => current ? mergeProfileRuntimeReport(current, runtimeReport) : current);
    } catch {
      // Manual refresh remains the visible recovery path for transient process-scan failures.
    } finally {
      profileRuntimeRefreshInFlightRef.current = false;
    }
  }

  async function handleRunDoctor() {
    if (!startAction(actionKeys.doctor, "诊断中")) {
      return;
    }
    setDoctorError(null);
    try {
      setDoctorReport(await runDoctor());
    } catch (error) {
      setDoctorError(errorMessage(error, "运行诊断失败"));
    } finally {
      finishAction(actionKeys.doctor);
    }
  }

  function handleCopyDoctorReport() {
    if (!doctorReport) {
      return;
    }
    void copyTextToClipboard(formatDoctorReport(doctorReport), "已复制脱敏诊断报告");
  }

  async function refreshProfileSessions(options?: {
    query?: string;
    profileName?: string;
    category?: string;
    page?: number;
  }) {
    const requestId = sessionRequestIdRef.current + 1;
    sessionRequestIdRef.current = requestId;
    const nextPage = options?.page ?? sessionPage;
    const nextProfileName = options?.profileName ?? sessionProfileName;
    const nextCategory = options?.category ?? sessionCategory;
    const nextQuery = options?.query ?? sessionQuery;

    try {
      setSessionLoading(true);
      setSessionError(null);
      const nextReport = await listProfileSessions({
        profileName: nextProfileName || null,
        category: nextCategory || null,
        query: nextQuery.trim() || null,
        offset: (Math.max(nextPage, 1) - 1) * sessionPageSize,
        limit: sessionPageSize,
      });
      if (requestId !== sessionRequestIdRef.current) {
        return;
      }
      setSessionReport(nextReport);
      sessionResourceRef.current = {
        key: JSON.stringify([nextQuery.trim(), nextProfileName, nextCategory, nextPage, sessionPageSize]),
        updatedAt: Date.now(),
      };
    } catch (error) {
      if (requestId !== sessionRequestIdRef.current) {
        return;
      }
      const message = errorMessage(error, "读取会话中心失败");
      setSessionError(message);
      setFeedback({
        severity: "error",
        text: message,
      });
    } finally {
      if (requestId === sessionRequestIdRef.current) {
        setSessionLoading(false);
      }
    }
  }

  async function refreshAuthVault() {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const nextReport = await listAuthVault();
      setAuthReport(nextReport);
      resourceUpdatedAtRef.current.auth = Date.now();
      setAuthProfileName((current) => {
        if (current && nextReport.profiles.some((profile) => profile.profileName === current)) {
          return current;
        }
        if (activeProfile && nextReport.profiles.some((profile) => profile.profileName === activeProfile.name)) {
          return activeProfile.name;
        }
        return nextReport.profiles[0]?.profileName ?? "";
      });
      setSelectedAuthBackupId((current) => {
        if (current && nextReport.backups.some((backup) => backup.id === current)) {
          return current;
        }
        return nextReport.backups[0]?.id ?? "";
      });
    } catch (error) {
      const message = errorMessage(error, "读取认证库失败");
      setAuthError(message);
      setFeedback({
        severity: "error",
        text: message,
      });
    } finally {
      setAuthLoading(false);
    }
  }

  async function refreshWechatBridges(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setWechatLoading(true);
      }
      const nextReport = await listWechatBridges();
      setWechatReport(nextReport);
      setWechatError(null);
      resourceUpdatedAtRef.current.wechat = Date.now();
      setWechatProfileName((current) => {
        if (current && nextReport.bridges.some((bridge) => bridge.profileName === current)) {
          return current;
        }
        if (activeProfile && nextReport.bridges.some((bridge) => bridge.profileName === activeProfile.name)) {
          return activeProfile.name;
        }
        return nextReport.bridges[0]?.profileName ?? "";
      });
    } catch (error) {
      const message = errorMessage(error, "读取微信桥接失败");
      setWechatError(message);
      setFeedback({
        severity: "error",
        text: message,
      });
    } finally {
      if (!options?.silent) {
        setWechatLoading(false);
      }
    }
  }

  async function refreshFeishuRemote(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setFeishuLoading(true);
      }
      const nextReport = await listFeishuRemote();
      setFeishuReport(nextReport);
      setFeishuError(null);
      resourceUpdatedAtRef.current.feishu = Date.now();
      setFeishuProfileName((current) => {
        if (current && profiles.some((profile) => profile.name === current)) return current;
        if (nextReport.profileName) return nextReport.profileName;
        return activeOperationalProfile?.name ?? profiles[0]?.name ?? "";
      });
    } catch (error) {
      const message = errorMessage(error, "读取飞书渠道失败");
      setFeishuError(message);
      setFeedback({ severity: "error", text: message });
    } finally {
      if (!options?.silent) {
        setFeishuLoading(false);
      }
    }
  }

  async function refreshModelRoutes() {
    try {
      setModelRouteLoading(true);
      setModelRouteError(null);
      const nextReport = await listModelRoutes();
      setModelRouteReport(nextReport);
      resourceUpdatedAtRef.current.modelRoute = Date.now();
      setModelRouteProfileName((current) => {
        if (current && nextReport.profiles.some((profile) => profile.profileName === current)) {
          return current;
        }
        if (activeOperationalProfile && nextReport.profiles.some((profile) => profile.profileName === activeOperationalProfile.name)) {
          return activeOperationalProfile.name;
        }
        return nextReport.profiles[0]?.profileName ?? "";
      });
    } catch (error) {
      const message = errorMessage(error, "读取模型路由失败");
      setModelRouteError(message);
      setFeedback({
        severity: "error",
        text: message,
      });
    } finally {
      setModelRouteLoading(false);
    }
  }

  function blurActiveElement() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function handleOpenSessionCenter() {
    blurActiveElement();
    setSessionDialogOpen(true);
  }

  function handleOpenAuthVault() {
    blurActiveElement();
    setAuthDialogOpen(true);
    setAuthProfileName(activeOperationalProfile?.name ?? authProfileName);
    if (!authReport && !authLoading) {
      void refreshAuthVault();
    }
  }

  function handleOpenWechatBridge() {
    blurActiveElement();
    setWechatDialogOpen(true);
    setWechatProfileName(activeOperationalProfile?.name ?? wechatProfileName);
    if (!wechatReport && !wechatLoading) {
      void refreshWechatBridges();
    }
    setFeishuProfileName(feishuReport?.profileName ?? activeOperationalProfile?.name ?? feishuProfileName);
    if (!feishuReport && !feishuLoading) {
      void refreshFeishuRemote();
    }
  }

  function handleOpenModelRoute() {
    blurActiveElement();
    setModelRouteDialogOpen(true);
    setModelRouteProfileName(activeOperationalProfile?.name ?? modelRouteProfileName);
    if (!modelRouteReport && !modelRouteLoading) {
      void refreshModelRoutes();
    }
  }

  function handleOpenProfileContextMenu(
    event: MouseEvent<HTMLElement>,
    profile: ProfileInfo,
    mode: ProfileContextMenuState["mode"] = "context",
  ) {
    event.preventDefault();
    event.stopPropagation();
    setActiveName(profile.name);
    setProfileContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      profileName: profile.name,
      mode,
    });
  }

  function handleCloseProfileContextMenu() {
    setProfileContextMenu(null);
  }

  function runProfileContextAction(action: (profile: ProfileInfo) => void) {
    const profile = contextMenuProfile;
    handleCloseProfileContextMenu();
    if (!profile) {
      return;
    }
    setActiveName(profile.name);
    action(profile);
  }

  function openEditDialogForProfile(profile: ProfileInfo) {
    setActiveName(profile.name);
    setEditDraft({
      name: profile.name,
      alias: profile.alias ?? "",
      category: profile.category,
      note: profile.note ?? "",
      model: profile.model ?? "",
      reasoningEffort: profile.reasoningEffort ?? "xhigh",
    });
    setEditDialogOpen(true);
  }

  function handleOpenArchiveDialog(profile: ProfileInfo) {
    setActiveName(profile.name);
    setArchiveDialogOpen(true);
  }

  function handleOpenDeleteDialog(profile: ProfileInfo) {
    setActiveName(profile.name);
    setArchiveOnDelete(false);
    setDeleteDialogOpen(true);
  }

  function handleOpenCopyDialog(profile: ProfileInfo) {
    setCopyDraft(createCopyDraft(profile, profiles));
    setCopyDialogOpen(true);
    if (!authReport && !authLoading) {
      void refreshAuthVault();
    }
  }

  function handleOpenAuthLogin(profile: ProfileInfo) {
    setAuthLoginTarget({
      kind: "local-profile",
      profileName: profile.name,
      profileLabel: profile.alias || profile.name,
      hasAccount: Boolean(profile.account),
    });
  }

  function handleOpenQuotaDialog(profile: ProfileInfo) {
    setQuotaDialogProfileName(profile.name);
    if (!quotaByProfile[profile.name]?.report && !quotaByProfile[profile.name]?.loading) {
      requestReadQuota(profile);
    }
  }

  function handleCopySourceChange(sourceName: string) {
    const source = profiles.find((profile) => profile.name === sourceName);
    if (!source) {
      return;
    }
    setCopyDraft(createCopyDraft(source, profiles));
  }

  useEffect(() => {
    void refreshProfiles();
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    const stopPolling = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };
    const syncRuntime = () => {
      if (document.visibilityState === "visible") {
        void refreshProfileRuntimeStatuses();
      }
    };
    const updatePolling = () => {
      stopPolling();
      if (document.visibilityState === "visible") {
        syncRuntime();
        interval = window.setInterval(syncRuntime, PROFILE_RUNTIME_REFRESH_INTERVAL_MS);
      }
    };

    document.addEventListener("visibilitychange", updatePolling);
    window.addEventListener("focus", syncRuntime);
    updatePolling();
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", updatePolling);
      window.removeEventListener("focus", syncRuntime);
    };
  }, []);

  useEffect(() => {
    if (!sessionDialogOpen) {
      return;
    }
    const cacheKey = JSON.stringify([sessionQuery.trim(), sessionProfileName, sessionCategory, sessionPage, sessionPageSize]);
    if (sessionResourceRef.current.key === cacheKey && isDialogResourceFresh(sessionResourceRef.current.updatedAt)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void refreshProfileSessions({
        query: sessionQuery,
        profileName: sessionProfileName,
        category: sessionCategory,
        page: sessionPage,
      });
    }, sessionQuery.trim() ? 480 : 0);
    return () => window.clearTimeout(timeout);
  }, [sessionDialogOpen, sessionQuery, sessionProfileName, sessionCategory, sessionPage, sessionPageSize]);

  useEffect(() => {
    if (authDialogOpen && !authLoading && (!authReport || !isDialogResourceFresh(resourceUpdatedAtRef.current.auth))) {
      void refreshAuthVault();
    }
  }, [authDialogOpen, authReport, authLoading]);

  useEffect(() => {
    if (wechatDialogOpen && !wechatLoading && (!wechatReport || !isDialogResourceFresh(resourceUpdatedAtRef.current.wechat))) {
      void refreshWechatBridges();
    }
  }, [wechatDialogOpen, wechatReport, wechatLoading]);

  useEffect(() => {
    if (wechatDialogOpen && !feishuLoading && (!feishuReport || !isDialogResourceFresh(resourceUpdatedAtRef.current.feishu))) {
      void refreshFeishuRemote();
    }
  }, [wechatDialogOpen, feishuReport, feishuLoading]);

  useEffect(() => {
    if (modelRouteDialogOpen && !modelRouteLoading && (!modelRouteReport || !isDialogResourceFresh(resourceUpdatedAtRef.current.modelRoute))) {
      void refreshModelRoutes();
    }
  }, [modelRouteDialogOpen, modelRouteReport, modelRouteLoading]);

  useEffect(() => {
    if (
      !wechatDialogOpen ||
      !wechatReport?.bridges.some((bridge) => bridge.connectionState === "awaiting-scan" || bridge.connectionState === "running")
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshWechatBridges({ silent: true });
    }, 3500);
    return () => window.clearInterval(interval);
  }, [wechatDialogOpen, wechatReport]);

  useEffect(() => {
    if (!wechatDialogOpen || !feishuReport?.running) return;
    const interval = window.setInterval(() => {
      void refreshFeishuRemote({ silent: true });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [wechatDialogOpen, feishuReport?.running]);

  useEffect(() => {
    if (!modelRouteDialogOpen) {
      return;
    }
    let cancelled = false;
    const refreshProxy = async () => {
      try {
        const proxy = await readModelRouteProxyStatus();
        if (!cancelled) {
          setModelRouteReport((current) => current ? { ...current, proxy } : current);
        }
      } catch {
        // The full report refresh remains the visible retry path.
      }
    };
    void refreshProxy();
    const interval = window.setInterval(() => void refreshProxy(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [modelRouteDialogOpen]);

  useEffect(() => {
    if (!feedback || feedback.severity === "error" || feedback.severity === "warning") {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!activeProfile) {
      setEditDraft({
        name: "",
        alias: "",
        category: "",
        note: "",
        model: "",
        reasoningEffort: "xhigh",
      });
      return;
    }
    setEditDraft({
      name: activeProfile.name,
      alias: activeProfile.alias ?? "",
      category: activeProfile.category,
      note: activeProfile.note ?? "",
      model: activeProfile.model ?? "",
      reasoningEffort: activeProfile.reasoningEffort ?? "xhigh",
    });
    setResetDraft({
      model: activeProfile.model ?? "gpt-5.5",
      reasoningEffort: activeProfile.reasoningEffort ?? "xhigh",
      resetUserData: true,
    });
  }, [activeProfile]);

  async function handleCreateProfile(startLoginAfterCreate: boolean) {
    if (!canCreate) {
      setFeedback({
        severity: "warning",
        text: createNameExists ? "这个启动命令已经存在。" : "命令名需要以 codex- 开头。",
      });
      return;
    }

    if (!startAction(actionKeys.profileCreate, "创建中")) {
      return;
    }
    try {
      const profileName = createDraft.name.trim();
      const createdProfileLabel = createDraft.alias?.trim() || profileName;
      const result = await createProfile({
        ...createDraft,
        name: profileName,
        codexHome: (createDraft.codexHome ?? "").trim() || null,
        userDataDir: (createDraft.userDataDir ?? "").trim() || null,
        model: (createDraft.model ?? "").trim() || null,
        reasoningEffort: (createDraft.reasoningEffort ?? "").trim() || null,
        alias: (createDraft.alias ?? "").trim() || null,
        category: (createDraft.category ?? "").trim() || null,
        note: null,
      });
      setCreateDraft(DEFAULT_FORM);
      setCreateDialogOpen(false);
      await refreshProfiles({ severity: "success", text: result.message });
      const createdProfileName = result.profile?.name ?? profileName;
      setActiveName(createdProfileName);
      if (startLoginAfterCreate) {
        setAuthLoginTarget({
          kind: "local-profile",
          profileName: createdProfileName,
          profileLabel: result.profile ? profileLabel(result.profile) : createdProfileLabel,
          hasAccount: false,
        });
      }
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "创建 profile 失败"),
      });
    } finally {
      finishAction(actionKeys.profileCreate);
    }
  }

  async function handleCopyProfile() {
    if (!copyDraft || !copySourceProfile) {
      return;
    }
    if (!canCopyProfile) {
      setFeedback({
        severity: "warning",
        text: copyNameExists ? "这个启动命令已经存在。" : "检查新命令名或认证确认。",
      });
      return;
    }

    const authSourceName =
      copyDraft.authSourceName && copyDraft.authSourceName !== NO_AUTH_SOURCE
        ? copyDraft.authSourceName
        : null;
    const targetName = copyDraft.name.trim();
    if (!startAction(actionKeys.profileCopy, "复制中")) {
      return;
    }

    try {
      const result = await copyProfile({
        ...copyDraft,
        sourceName: copySourceProfile.name,
        name: targetName,
        codexHome: (copyDraft.codexHome ?? "").trim() || null,
        userDataDir: (copyDraft.userDataDir ?? "").trim() || null,
        model: (copyDraft.model ?? "").trim() || null,
        reasoningEffort: (copyDraft.reasoningEffort ?? "").trim() || null,
        alias: (copyDraft.alias ?? "").trim() || null,
        category: (copyDraft.category ?? "").trim() || null,
        note: copyDraft.note?.trim() || null,
        authSourceName,
        confirmSensitive: Boolean(authSourceName && copyDraft.confirmSensitive),
      });
      setCopyDialogOpen(false);
      setCopyDraft(null);
      await refreshProfiles({ severity: "success", text: result.message });
      if (authSourceName) {
        await refreshAuthVault();
      }
      setActiveName(result.profile?.name ?? targetName);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "复制 profile 失败"),
      });
    } finally {
      finishAction(actionKeys.profileCopy);
    }
  }

  async function handleSaveProfile() {
    if (!activeProfile) {
      return;
    }

    const originalName = activeProfile.name;
    const nextName = editDraft.name.trim();
    const launcherChanged = canEditLauncher && launcherNameChanged;
    const actionKey = launcherChanged
      ? actionKeys.profileLauncher(originalName)
      : actionKeys.profileMetadata(originalName);
    if (!startAction(actionKey, "保存中")) {
      return;
    }
    try {
      const messages: string[] = [];
      if (canEditModel && modelChanged) {
        const result = await updateProfileModel({
          profileName: originalName,
          model: editDraft.model.trim(),
          reasoningEffort: editDraft.reasoningEffort.trim() || null,
        });
        messages.push(result.message);
      }
      if (metadataChanged) {
        const result = await updateProfileMetadata({
          name: originalName,
          alias: editDraft.alias.trim() || null,
          category: editDraft.category.trim() || null,
          note: editDraft.note.trim() || null,
        });
        messages.push(result.message);
      }
      if (launcherChanged) {
        const result = await updateProfileLauncher({
          profileName: originalName,
          newProfileName: nextName,
        });
        messages.push(result.message);
        setActiveName(nextName);
      }
      setEditDialogOpen(false);
      await refreshProfiles({
        severity: "success",
        text:
          launcherChanged
            ? `已更新启动命令为 ${nextName}。`
            : messages.length > 1
              ? `已更新 ${profileLabel(activeProfile)} 的信息和模型配置。`
              : messages[0] ?? `已更新 ${profileLabel(activeProfile)}。`,
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "保存 profile 信息失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleLaunchProfile(profile: ProfileInfo) {
    const actionKey = actionKeys.profileLifecycle(profile.name);
    if (!startAction(actionKey, "启动中")) {
      return;
    }
    try {
      const result = await launchProfile(profile.name);
      setFeedback({ severity: "success", text: result.message });
      window.setTimeout(() => {
        void refreshProfiles({ severity: "success", text: result.message });
      }, 800);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "启动失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleTerminateProfile(profile: ProfileInfo) {
    if (profile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 不支持安全终止，请在 Codex 里手动退出。" });
      return;
    }

    const actionKey = actionKeys.profileLifecycle(profile.name);
    if (!startAction(actionKey, "终止中")) {
      return;
    }
    try {
      const result = await terminateProfile(profile.name);
      await refreshProfiles({ severity: "success", text: result.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "终止失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleAutoRefreshAuth(target: AuthLoginTarget): Promise<boolean> {
    const profile = [...(report?.profiles ?? []), ...(report?.archivedProfiles ?? [])].find(
      (item) => item.name === target.profileName,
    );
    if (!profile || profile.isArchived) {
      return false;
    }

    try {
      if (!profile.isRunning) {
        await launchProfile(profile.name, { background: true });
      }

      for (let attempt = 0; attempt < 15; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        const nextReport = await listProfiles();
        const nextProfile = nextReport.profiles.find((item) => item.name === target.profileName);
        if (nextProfile && ["valid", "api-key", "unknown"].includes(nextProfile.authState?.status ?? "")) {
          const refreshedReport = await refreshProfiles({
            severity: "success",
            text: `${target.profileLabel} 已通过 Codex 自动刷新认证`,
          });
          if (quotaRetryAfterAuthRefresh && refreshedReport) {
            const refreshedProfile = [
              ...refreshedReport.profiles,
              ...(refreshedReport.archivedProfiles ?? []),
            ].find((item) => item.name === target.profileName);
            setQuotaRetryAfterAuthRefresh(false);
            if (refreshedProfile) {
              await handleReadQuota(refreshedProfile);
            }
          }
          return true;
        }
      }
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "Codex 自动刷新失败"),
      });
    }

    return false;
  }

  async function handleReadQuota(profile: ProfileInfo): Promise<boolean> {
    setQuotaByProfile((current) => ({
      ...current,
      [profile.name]: {
        loading: true,
        report: current[profile.name]?.report ?? null,
        error: null,
        updatedAt: current[profile.name]?.updatedAt ?? 0,
      },
    }));
    try {
      const quota = await readProfileQuota(profile.name);
      setQuotaByProfile((current) => ({
        ...current,
        [profile.name]: {
          loading: false,
          report: quota,
          error: null,
          updatedAt: Date.now(),
        },
      }));
      return true;
    } catch (error) {
      setQuotaByProfile((current) => ({
        ...current,
        [profile.name]: {
          loading: false,
          report: current[profile.name]?.report ?? null,
          error: errorMessage(error, t("额度查询失败")),
          updatedAt: Date.now(),
        },
      }));
      return false;
    }
  }

  function requestReadQuota(profile: ProfileInfo) {
    if (profile.authState?.status === "refresh-required") {
      setQuotaRetryAfterAuthRefresh(true);
      setAuthLoginTarget({
        kind: "local-profile",
        profileName: profile.name,
        profileLabel: profileLabel(profile),
        hasAccount: Boolean(profile.account),
      });
      return;
    }
    void handleReadQuota(profile);
  }

  async function handleReadVisibleQuotas() {
    if (quotaBatchLoading) return;
    const refreshRequiredCount = visibleProfiles.filter((profile) => (
      Boolean(profile.account)
      && profile.authState?.status === "refresh-required"
      && !quotaByProfile[profile.name]?.loading
      && !isProfileQuotaCacheFresh(quotaByProfile[profile.name])
    )).length;
    const targets = visibleProfiles.filter((profile) => (
      Boolean(profile.account)
      && profile.authState?.status !== "refresh-required"
      && !quotaByProfile[profile.name]?.loading
      && !isProfileQuotaCacheFresh(quotaByProfile[profile.name])
    ));
    if (targets.length === 0) {
      setFeedback({
        severity: refreshRequiredCount > 0 ? "warning" : "info",
        text: refreshRequiredCount > 0
          ? t("当前列表有 Profile 需要先刷新认证")
          : t("当前列表额度均为最新，或没有可查询的已登录 Profile。"),
      });
      return;
    }

    setQuotaBatchLoading(true);
    try {
      const results = await mapWithConcurrency(
        targets,
        PROFILE_QUOTA_BATCH_CONCURRENCY,
        handleReadQuota,
      );
      const succeeded = results.filter(Boolean).length;
      const failed = results.length - succeeded;
      setFeedback({
        severity: failed > 0 || refreshRequiredCount > 0 ? "warning" : "success",
        text: failed > 0
          ? t("{success} 个已更新，{failed} 个暂不可查。", { success: succeeded, failed })
          : refreshRequiredCount > 0
            ? t("已更新 {success} 个 Profile，另有 {refreshRequired} 个需先刷新认证。", {
              success: succeeded,
              refreshRequired: refreshRequiredCount,
            })
            : t("已更新 {count} 个 Profile 的额度。", { count: succeeded }),
      });
    } finally {
      setQuotaBatchLoading(false);
    }
  }

  async function handleDeleteProfile() {
    if (!activeProfile) {
      return;
    }
    if (activeProfile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 受保护，不能删除。" });
      return;
    }
    if (activeProfile.isRunning) {
      setFeedback({ severity: "warning", text: "请先停止该 Profile，再进行删除。" });
      return;
    }

    const actionKey = actionKeys.profileDelete(activeProfile.name);
    if (!startAction(actionKey, "删除中")) {
      return;
    }
    try {
      const result = await deleteProfile(activeProfile.name, archiveOnDelete);
      setDeleteDialogOpen(false);
      setArchiveOnDelete(false);
      await refreshProfiles({ severity: "success", text: result.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "删除 profile 失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleArchiveProfile() {
    if (!activeProfile || activeProfile.isArchived) return;
    if (activeProfile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 受保护，不能归档。" });
      return;
    }
    if (activeProfile.isRunning) {
      setFeedback({ severity: "warning", text: "请先停止该 Profile，再进行归档。" });
      return;
    }

    const profileName = activeProfile.name;
    const actionKey = actionKeys.profileArchive(profileName);
    if (!startAction(actionKey, "归档中")) return;
    try {
      await archiveProfile(profileName);
      setArchiveDialogOpen(false);
      setStatusFilter("all");
      setCategoryFilter("all");
      await refreshProfiles({ severity: "success", text: `已归档 ${profileLabel(activeProfile)}，所有数据均已保留。` });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "归档 Profile 失败") });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleRestoreArchivedProfile(profile: ProfileInfo) {
    const actionKey = actionKeys.profileArchive(profile.name);
    if (!startAction(actionKey, "恢复中")) return;
    try {
      await restoreArchivedProfile(profile.name);
      setStatusFilter("all");
      setCategoryFilter("all");
      await refreshProfiles({ severity: "success", text: `已恢复 ${profileLabel(profile)}。` });
      setActiveName(profile.name);
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "恢复 Profile 失败") });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleResetProfile() {
    if (!activeProfile) {
      return;
    }
    if (activeProfile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 受保护，不能重置。" });
      return;
    }

    const actionKey = actionKeys.profileReset(activeProfile.name);
    if (!startAction(actionKey, "重置中")) {
      return;
    }
    try {
      const result = await resetProfile({
        name: activeProfile.name,
        model: resetDraft.model.trim() || null,
        reasoningEffort: resetDraft.reasoningEffort.trim() || null,
        resetUserData: resetDraft.resetUserData,
      });
      setResetDialogOpen(false);
      await refreshProfiles({ severity: "success", text: result.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "重置 profile 失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleImportAuth() {
    if (!activeProfile) {
      return;
    }
    if (activeProfile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 受保护，不能导入覆盖登录态。" });
      return;
    }
    if (!importSourcePath.trim()) {
      setFeedback({ severity: "warning", text: "需要填写来源 JSON 路径。" });
      return;
    }
    if (activeProfile.isRunning) {
      setFeedback({ severity: "warning", text: "目标 profile 正在运行，请先终止再导入。" });
      return;
    }

    const actionKey = actionKeys.profileImportAuth(activeProfile.name);
    if (!startAction(actionKey, "导入中")) {
      return;
    }
    try {
      const result = await importProfileAuth({
        name: activeProfile.name,
        sourcePath: importSourcePath.trim(),
        confirmSensitive: confirmImportSensitive,
      });
      setImportDialogOpen(false);
      setImportSourcePath("");
      setConfirmImportSensitive(false);
      setQuotaByProfile((current) => {
        const next = { ...current };
        delete next[activeProfile.name];
        return next;
      });
      await refreshProfiles({ severity: "success", text: result.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "导入账号失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleCreateAuthBackups(profileNames: string[], label: string) {
    const requestedNames = new Set(profileNames);
    const selectedProfiles =
      authReport?.profiles.filter(
        (profile) => requestedNames.has(profile.profileName) && profile.authExists,
      ) ?? [];
    if (selectedProfiles.length === 0) {
      setFeedback({ severity: "warning", text: "请选择至少一个已有 auth.json 的 profile。" });
      return;
    }

    if (!startAction(actionKeys.authCreate, selectedProfiles.length > 1 ? "批量备份" : "备份认证")) {
      return;
    }
    try {
      const result = await createAuthBackups({
        profileNames: selectedProfiles.map((profile) => profile.profileName),
        label: label.trim() || null,
      });
      setAuthReport(result.vault);
      resourceUpdatedAtRef.current.auth = Date.now();
      setSelectedAuthBackupId(result.vault.backups[0]?.id ?? "");
      setFeedback({
        severity: result.failureCount > 0 ? "warning" : "success",
        text: result.failureCount > 0
          ? `已创建 ${result.successCount} 个备份，${result.failureCount} 个失败`
          : `已备份 ${result.successCount} 个认证信息`,
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "备份认证失败"),
      });
    } finally {
      finishAction(actionKeys.authCreate);
    }
  }

  async function handleImportAuthBackupPackage(file: File) {
    if (!file) {
      return;
    }
    if (!startAction(actionKeys.authImport, "导入备份包")) {
      return;
    }
    try {
      const packageJson = await file.text();
      const nextReport = await importAuthBackupPackage({
        packageJson,
        label: null,
        note: null,
        pinned: false,
        confirmSensitive: true,
      });
      setAuthReport(nextReport);
      setSelectedAuthBackupId(nextReport.backups[0]?.id ?? "");
      setFeedback({ severity: "success", text: "已导入认证备份包" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "导入认证备份包失败"),
      });
    } finally {
      finishAction(actionKeys.authImport);
    }
  }

  async function handleApplyAuthBackup(backupId: string, targetProfileName: string) {
    if (!backupId || !targetProfileName) {
      setFeedback({ severity: "warning", text: "请选择备份和目标 profile。" });
      return;
    }

    const actionKey = actionKeys.authApply(targetProfileName);
    if (!startAction(actionKey, "应用认证")) {
      return;
    }
    try {
      const result = await applyAuthBackup({
        backupId,
        targetProfileName,
        confirmSensitive: true,
      });
      setQuotaByProfile((current) => {
        const next = { ...current };
        delete next[targetProfileName];
        return next;
      });
      await refreshProfiles({ severity: "success", text: result.message });
      await refreshAuthVault();
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "应用认证失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleExportAuthBackup(backupId: string) {
    if (!backupId) {
      return;
    }

    const actionKey = actionKeys.authExport(backupId);
    if (!startAction(actionKey, "导出备份")) {
      return;
    }
    try {
      const result = await exportAuthBackup({ backupId });
      setFeedback({ severity: "success", text: `已导出认证备份：${result.fileName}` });
      void revealPath(result.path);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "导出认证备份失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleRollbackAuthApplication(applicationId: string) {
    if (!applicationId) {
      return;
    }
    const application = authReport?.recentApplications.find((item) => item.id === applicationId);
    const actionKey = actionKeys.authRollback(applicationId);
    if (!startAction(actionKey, "回滚认证")) {
      return;
    }
    try {
      const result = await rollbackAuthApplication({
        applicationId,
        confirmSensitive: true,
      });
      if (application?.targetProfileName) {
        setQuotaByProfile((current) => {
          const next = { ...current };
          delete next[application.targetProfileName];
          return next;
        });
      }
      await refreshProfiles({ severity: "success", text: result.message });
      await refreshAuthVault();
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "回滚认证失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleUpdateAuthBackup(
    backupId: string,
    label: string,
    note: string,
    pinned: boolean,
  ) {
    if (!backupId) {
      return;
    }

    const actionKey = actionKeys.authUpdate(backupId);
    if (!startAction(actionKey, "保存备份")) {
      return;
    }
    try {
      const nextReport = await updateAuthBackup({
        backupId,
        label: label.trim() || null,
        note: note.trim() || null,
        pinned,
      });
      setAuthReport(nextReport);
      setSelectedAuthBackupId((current) =>
        nextReport.backups.some((backup) => backup.id === current)
          ? current
          : nextReport.backups[0]?.id ?? "",
      );
      setFeedback({ severity: "success", text: "已更新认证备份" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "更新认证备份失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleCleanupAuthBackups(accountKey: string, _accountLabel: string, count: number) {
    if (!accountKey || count <= 1) {
      return;
    }
    const actionKey = actionKeys.authCleanup(accountKey);
    if (!startAction(actionKey, "清理备份")) {
      return;
    }
    try {
      const nextReport = await cleanupAuthBackups({
        accountKey,
        confirmSensitive: true,
      });
      setAuthReport(nextReport);
      setSelectedAuthBackupId((current) =>
        nextReport.backups.some((backup) => backup.id === current)
          ? current
          : nextReport.backups[0]?.id ?? "",
      );
      setFeedback({ severity: "success", text: "已清理重复认证备份" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "清理认证备份失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleDeleteAuthBackup(backupId: string) {
    if (!backupId) {
      return;
    }
    const actionKey = actionKeys.authDelete(backupId);
    if (!startAction(actionKey, "删除备份")) {
      return;
    }
    try {
      const nextReport = await deleteAuthBackup({ backupId });
      setAuthReport(nextReport);
      setSelectedAuthBackupId((current) =>
        current === backupId ? nextReport.backups[0]?.id ?? "" : current,
      );
      setFeedback({ severity: "success", text: "已删除认证备份" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "删除认证备份失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleStartWechatBridge(profileName: string) {
    if (!profileName) {
      setFeedback({ severity: "warning", text: "请选择要绑定微信的 profile。" });
      return;
    }

    const actionKey = actionKeys.wechatLifecycle(profileName);
    if (!startAction(actionKey, "启动微信桥接")) {
      return;
    }
    try {
      const nextReport = await startWechatBridge({ profileName });
      setWechatReport(nextReport);
      setWechatProfileName(profileName);
      setFeedback({ severity: "success", text: "已启动微信桥接，等待扫码绑定。" });
      [1200, 3200, 8000, 15000, 30000, 60000].forEach((delay) => {
        window.setTimeout(() => void refreshWechatBridges({ silent: true }), delay);
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "启动微信桥接失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleStopWechatBridge(profileName: string) {
    if (!profileName) {
      return;
    }

    const actionKey = actionKeys.wechatLifecycle(profileName);
    if (!startAction(actionKey, "停止微信桥接")) {
      return;
    }
    try {
      const nextReport = await stopWechatBridge({ profileName });
      setWechatReport(nextReport);
      setWechatProfileName(profileName);
      setFeedback({ severity: "success", text: "已停止微信桥接。" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "停止微信桥接失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleRestartWechatBridge(profileName: string) {
    if (!profileName) {
      return;
    }
    const actionKey = actionKeys.wechatLifecycle(profileName);
    if (!startAction(actionKey, "重启微信桥接")) {
      return;
    }
    try {
      const nextReport = await restartWechatBridge({ profileName });
      setWechatReport(nextReport);
      resourceUpdatedAtRef.current.wechat = Date.now();
      setWechatProfileName(profileName);
      setFeedback({ severity: "success", text: "微信桥接已重启。" });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "重启微信桥接失败") });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleUnbindWechatBridge(profileName: string) {
    if (!profileName) {
      return;
    }
    const actionKey = actionKeys.wechatLifecycle(profileName);
    if (!startAction(actionKey, "解除微信绑定")) {
      return;
    }
    try {
      const nextReport = await unbindWechatBridge({ profileName, confirmSensitive: true });
      setWechatReport(nextReport);
      resourceUpdatedAtRef.current.wechat = Date.now();
      setWechatProfileName(profileName);
      setFeedback({ severity: "success", text: "微信绑定已解除，原 token 已移入本地备份目录。" });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "解除微信绑定失败") });
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleRefreshWechatLog(profileName: string) {
    if (!profileName) {
      return;
    }

    try {
      const logReport = await readWechatBridgeLog({ profileName, lines: 120 });
      setWechatReport((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          bridges: current.bridges.map((bridge) =>
            bridge.profileName === profileName
              ? {
                  ...bridge,
                  logTail: logReport.logTail,
                  appLogPath: logReport.appLogPath,
                  defaultLogPath: logReport.defaultLogPath,
                }
              : bridge,
          ),
        };
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "刷新微信日志失败"),
      });
    }
  }

  async function handleConfigureFeishuRemote(profileName: string, binaryPath: string) {
    if (!profileName) {
      setFeedback({ severity: "warning", text: "请选择飞书渠道使用的 profile。" });
      return;
    }
    if (!startAction(actionKeys.feishuLifecycle, "保存飞书渠道")) {
      return;
    }
    try {
      const nextReport = await configureFeishuRemote({
        profileName,
        binaryPath: binaryPath.trim() || null,
      });
      setFeishuReport(nextReport);
      setFeishuProfileName(profileName);
      resourceUpdatedAtRef.current.feishu = Date.now();
      setFeedback({ severity: "success", text: "已保存飞书渠道的 profile 绑定。" });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "保存飞书渠道失败") });
    } finally {
      finishAction(actionKeys.feishuLifecycle);
    }
  }

  async function handleStartFeishuRemote(profileName: string, binaryPath: string) {
    if (!profileName) {
      setFeedback({ severity: "warning", text: "请选择飞书渠道使用的 profile。" });
      return;
    }
    if (!startAction(actionKeys.feishuLifecycle, "启动飞书渠道")) {
      return;
    }
    try {
      const nextReport = await startFeishuRemote({
        profileName,
        binaryPath: binaryPath.trim() || null,
      });
      setFeishuReport(nextReport);
      setFeishuProfileName(profileName);
      resourceUpdatedAtRef.current.feishu = Date.now();
      setFeedback({
        severity: nextReport.connectedGatewayCount > 0 ? "success" : "info",
        text: nextReport.configured
          ? "飞书渠道已启动，正在检查 Bot 长连接。"
          : "飞书渠道已启动，请打开 WebSetup 完成 Bot 配置。",
      });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "启动飞书渠道失败") });
    } finally {
      finishAction(actionKeys.feishuLifecycle);
    }
  }

  async function handleStopFeishuRemote() {
    if (!startAction(actionKeys.feishuLifecycle, "停止飞书渠道")) {
      return;
    }
    try {
      const nextReport = await stopFeishuRemote();
      setFeishuReport(nextReport);
      resourceUpdatedAtRef.current.feishu = Date.now();
      setFeedback({ severity: "success", text: "飞书渠道已停止。" });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "停止飞书渠道失败") });
    } finally {
      finishAction(actionKeys.feishuLifecycle);
    }
  }

  async function handleRestartFeishuRemote() {
    if (!startAction(actionKeys.feishuLifecycle, "重启飞书渠道")) {
      return;
    }
    try {
      const nextReport = await restartFeishuRemote();
      setFeishuReport(nextReport);
      resourceUpdatedAtRef.current.feishu = Date.now();
      setFeedback({ severity: "success", text: "飞书渠道已重启。" });
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "重启飞书渠道失败") });
    } finally {
      finishAction(actionKeys.feishuLifecycle);
    }
  }

  async function handleRefreshFeishuLog() {
    try {
      setFeishuReport(await readFeishuRemoteLog({ lines: 160 }));
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "刷新飞书日志失败") });
    }
  }

  async function handleOpenFeishuPage(page: FeishuRemotePage) {
    try {
      await openFeishuRemotePage(page);
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "打开飞书页面失败") });
    }
  }

  async function handleApplyModelRoute(input: ApplyModelRouteInput) {
    const actionKey = actionKeys.modelRouteApply(input.profileName);
    if (!startAction(actionKey, "应用模型路由")) {
      return;
    }
    try {
      const result = await applyModelRoute(input);
      await refreshProfiles({ severity: "success", text: result.message });
      await refreshModelRoutes();
      setModelRouteProfileName(input.profileName);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "应用模型路由失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  function updateModelRouteProxyStatus(proxy: ModelRouteProxyStatus) {
    setModelRouteReport((current) => (current ? { ...current, proxy } : current));
  }

  async function handleStartModelRouteProxy() {
    if (!startAction(actionKeys.modelRouteProxy, "启动模型代理")) {
      return;
    }
    try {
      const proxy = await startModelRouteProxy();
      updateModelRouteProxyStatus(proxy);
      setFeedback({ severity: proxy.managed ? "success" : "info", text: proxy.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "启动模型代理失败"),
      });
    } finally {
      finishAction(actionKeys.modelRouteProxy);
    }
  }

  async function handleStopModelRouteProxy() {
    if (!startAction(actionKeys.modelRouteProxy, "停止模型代理")) {
      return;
    }
    try {
      const proxy = await stopModelRouteProxy();
      updateModelRouteProxyStatus(proxy);
      setFeedback({ severity: "success", text: "已停止 rCodexManager 内置代理。" });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "停止模型代理失败"),
      });
    } finally {
      finishAction(actionKeys.modelRouteProxy);
    }
  }

  async function handleOpenCcSwitch() {
    if (!startAction(actionKeys.modelRouteCcSwitch, "打开 cc-switch")) {
      return;
    }
    try {
      const message = await openCcSwitch();
      setFeedback({ severity: "info", text: message });
    } catch (error) {
      setFeedback({
        severity: "warning",
        text: errorMessage(error, "未找到 cc-switch，可以先使用内置代理。"),
      });
    } finally {
      finishAction(actionKeys.modelRouteCcSwitch);
    }
  }

  async function handleCheckModelRouteProxy(profileName: string): Promise<ModelRouteProxyCheckResult> {
    const actionKey = actionKeys.modelRouteCheck(profileName);
    if (!startAction(actionKey, "自检模型路由")) {
      throw new Error("模型路由自检正在进行中");
    }
    try {
      const result = await checkModelRouteProxy({ profileName });
      updateModelRouteProxyStatus(result.proxy);
      setFeedback({
        severity: result.ok ? "success" : "warning",
        text: `${result.statusLabel}：${result.message}`,
      });
      return result;
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "模型路由自检失败"),
      });
      throw error;
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleCheckModelRouteDraft(input: PreviewModelRouteInput): Promise<ModelRouteProxyCheckResult> {
    const actionKey = actionKeys.modelRouteDraft(input.profileName);
    if (!startAction(actionKey, "测试路由草稿")) {
      throw new Error("路由草稿测试正在进行中");
    }
    try {
      const result = await checkModelRouteDraft(input);
      updateModelRouteProxyStatus(result.proxy);
      setFeedback({
        severity: result.ok ? "success" : "warning",
        text: `${result.statusLabel}：${result.message}`,
      });
      return result;
    } catch (error) {
      setFeedback({ severity: "error", text: errorMessage(error, "模型路由草稿测试失败") });
      throw error;
    } finally {
      finishAction(actionKey);
    }
  }

  async function handleRestoreModelRoute(input: RestoreModelRouteInput) {
    const actionKey = actionKeys.modelRouteRestore(input.profileName);
    if (!startAction(actionKey, "恢复模型路由")) {
      return;
    }
    try {
      const result = await restoreModelRoute(input);
      await refreshProfiles({ severity: "success", text: result.message });
      await refreshModelRoutes();
      setModelRouteProfileName(input.profileName);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "恢复模型路由失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function copyTextToClipboard(text: string, successText: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("当前环境不支持写入剪贴板"));
      }
      await navigator.clipboard.writeText(text);
      setFeedback({ severity: "success", text: successText });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, t("复制失败")),
      });
    }
  }

  function handleCopySessionSummary(item: SessionCenterItem) {
    void copyTextToClipboard(
      buildSessionSummaryText(item, language),
      t("已复制 {profile} 的会话摘要", { profile: profileLabel(item.profile) }),
    );
  }

  function handleCopySessionReference(item: SessionCenterItem) {
    void copyTextToClipboard(
      buildSessionReferenceText(item, activeOperationalProfile, t, language),
      t("已复制给 {profile} 使用的引用", {
        profile: activeOperationalProfile ? profileLabel(activeOperationalProfile) : t("当前 profile"),
      }),
    );
  }

  function updateCreateDraft<K extends keyof CreateProfileInput>(key: K, value: CreateProfileInput[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateCopyDraft<K extends keyof CopyProfileInput>(key: K, value: CopyProfileInput[K]) {
    setCopyDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <I18nProvider locale={language}>
      <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell" data-style={styleMode}>
        <a className="skip-link" href="#profile-browser">
          {t("跳到 profile 列表")}
        </a>
        <Box className="window-drag-region" data-tauri-drag-region />
        <Box className="window-toolbar" aria-label={t("窗口工具")}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            {activeActions.length > 0 ? (
              <Chip
                size="small"
                label={`${activeActions[0].label}${activeActions.length > 1 ? ` +${activeActions.length - 1}` : ""}`}
              />
            ) : null}
            <Tooltip title={t("设置")}>
              <IconButton
                aria-label={t("打开设置")}
                onClick={() => setSettingsDialogOpen(true)}
              >
                <SettingsRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Dialog
          className="settings-dialog app-task-dialog compact-task-dialog"
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <TaskDialogTitle
            icon={<SettingsRoundedIcon />}
            title={t("设置")}
            subtitle={t("外观、语言与诊断")}
            onClose={() => setSettingsDialogOpen(false)}
          />
          <DialogContent className="settings-dialog-content">
            <Box className="settings-preference-list">
              <Box component="section" className="settings-preference-section">
                <Box className="settings-preference-heading">
                  <span className="settings-preference-icon"><PaletteRoundedIcon /></span>
                  <Box>
                    <Typography component="h3" variant="subtitle2">{t("外观")}</Typography>
                    <Typography variant="caption">{t("选择适合当前环境的界面色调。")}</Typography>
                  </Box>
                </Box>
                <ToggleButtonGroup
                  className="settings-segmented-control theme-mode-selector"
                  value={themePreference}
                  exclusive
                  onChange={(_, value: ThemePreference | null) => {
                    if (value) setThemePreference(value);
                  }}
                  aria-label={t("色调模式")}
                >
                  <ToggleButton value="system" aria-label={t("跟随系统")}>
                    <ComputerRoundedIcon />
                    <span>{t("跟随系统")}</span>
                  </ToggleButton>
                  <ToggleButton value="light" aria-label={t("浅色")}>
                    <LightModeRoundedIcon />
                    <span>{t("浅色")}</span>
                  </ToggleButton>
                  <ToggleButton value="dark" aria-label={t("深色")}>
                    <DarkModeRoundedIcon />
                    <span>{t("深色")}</span>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box component="section" className="settings-preference-section">
                <Box className="settings-preference-heading">
                  <span className="settings-preference-icon"><TranslateRoundedIcon /></span>
                  <Box>
                    <Typography component="h3" variant="subtitle2">{t("语言")}</Typography>
                    <Typography variant="caption">{t("设置界面与工作台显示语言。")}</Typography>
                  </Box>
                </Box>
                <ToggleButtonGroup
                  className="settings-segmented-control language-selector"
                  value={language}
                  exclusive
                  onChange={(_, value: AppLanguage | null) => {
                    if (value) setLanguage(value);
                  }}
                  aria-label={t("语言")}
                >
                  <ToggleButton value="zh-CN" aria-label={t("简体中文")}>
                    <span className="language-code">中</span>
                    <span>{t("简体中文")}</span>
                  </ToggleButton>
                  <ToggleButton value="en-US" aria-label="English">
                    <span className="language-code">EN</span>
                    <span>English</span>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box component="section" className="settings-preference-section settings-diagnostics-section">
                <Box className="settings-doctor-heading">
                  <Box className="settings-preference-heading">
                    <span className="settings-preference-icon"><FactCheckRoundedIcon /></span>
                    <Box>
                      <Typography component="h3" variant="subtitle2">{t("诊断")}</Typography>
                      <Typography variant="caption">
                        {t("只读检查本地配置，报告会自动隐藏敏感信息。")}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      isActionBusy(actionKeys.doctor)
                        ? <CircularProgress size={15} />
                        : <FactCheckRoundedIcon />
                    }
                    disabled={isActionBusy(actionKeys.doctor)}
                    onClick={() => void handleRunDoctor()}
                  >
                    {doctorReport ? t("重新检查") : t("开始检查")}
                  </Button>
                </Box>
                {doctorError ? <Alert severity="error">{doctorError}</Alert> : null}
                {doctorReport ? (
                  <Box className="doctor-report" aria-live="polite">
                    <Box className={`doctor-summary ${doctorReport.ready ? "ready" : "error"}`}>
                      <FactCheckRoundedIcon />
                      <Box>
                        <Typography variant="subtitle2">
                          {doctorReport.ready ? t("核心功能可用") : t("发现需要处理的问题")}
                        </Typography>
                        <Typography variant="caption">
                          {doctorReport.summary.okCount} {t("正常")} · {doctorReport.summary.warningCount} {t("提醒")} · {doctorReport.summary.errorCount} {t("错误")}
                        </Typography>
                      </Box>
                      <span>{doctorReport.platform}</span>
                    </Box>
                    <Box className="doctor-check-list">
                      {doctorReport.checks.map((check) => (
                        <Box className={`doctor-check-row ${check.status}`} key={check.id}>
                          <Box className="doctor-check-icon" aria-label={t(doctorStatusLabel(check.status))}>
                            {check.status === "ok" ? (
                              <CheckCircleOutlineRoundedIcon />
                            ) : check.status === "warning" ? (
                              <WarningAmberRoundedIcon />
                            ) : (
                              <ErrorOutlineRoundedIcon />
                            )}
                          </Box>
                          <Box className="doctor-check-copy">
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
                              <Typography variant="subtitle2">{check.label}</Typography>
                              <Typography variant="caption">{check.group}</Typography>
                            </Stack>
                            <Typography variant="caption">{check.message}</Typography>
                            {check.details.length > 0 ? (
                              <Typography className="doctor-check-detail" variant="caption" title={check.details.join("\n")}>
                                {check.details.join(" · ")}
                              </Typography>
                            ) : null}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box className="doctor-empty-state">
                    <FactCheckRoundedIcon />
                    <Typography variant="caption">{t("尚未运行诊断")}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              startIcon={<ContentCopyRoundedIcon />}
              disabled={!doctorReport}
              onClick={handleCopyDoctorReport}
            >
              {t("复制报告")}
            </Button>
            <Button variant="contained" onClick={() => setSettingsDialogOpen(false)}>{t("完成")}</Button>
          </DialogActions>
        </Dialog>

        <Box className="workbench-grid no-inspector">
          <main id="profile-browser" className="profile-browser">
            <Paper className="browser-panel" elevation={0}>
              <Box className="browser-action-row">
                <FeatureCommandGrid items={featureCommands} />
              </Box>

              <Box className="browser-tools">
                <Box className="filter-row">
                  <TextField
                    className="search-field"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("搜索 profile、账号或会话")}
                    slotProps={{
                      htmlInput: {
                        "aria-label": t("搜索 profile"),
                        name: "profile-search",
                        autoComplete: "off",
                        spellCheck: false,
                      },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <span className="search-shortcut">⌘K</span>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    className="category-select"
                    select
                    size="small"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    slotProps={{
                      htmlInput: {
                        "aria-label": t("分类筛选"),
                        name: "profile-category-filter",
                        autoComplete: "off",
                        spellCheck: false,
                      },
                    }}
                  >
                    {categoryFilterOptions.map((option) => (
                      <MenuItem className="category-select-option" key={option.key} value={option.key}>
                        <span>{option.label}</span>
                        <strong>{option.count}</strong>
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    className="profile-sort-select"
                    select
                    size="small"
                    value={profileSort}
                    disabled={statusFilter === "archived"}
                    onChange={(event) => setProfileSort(event.target.value as ProfileSortMode)}
                    slotProps={{
                      htmlInput: {
                        "aria-label": t("Profile 排序"),
                        name: "profile-sort",
                        autoComplete: "off",
                      },
                    }}
                  >
                    {PROFILE_SORT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{t(option.label)}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box className="status-filter-strip" aria-label={t("状态筛选")}>
                  <Box className="status-filter-options">
                    {statusFilterOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`status-filter-chip ${statusFilter === option.key ? "selected" : ""}`}
                        aria-pressed={statusFilter === option.key}
                        onClick={() => {
                          setStatusFilter(option.key);
                          setCategoryFilter("all");
                        }}
                      >
                        {renderStatusFilterIcon(option.key)}
                        <span>{option.label}</span>
                        <strong>{option.count}</strong>
                      </button>
                    ))}
                  </Box>
                  <Stack className="profile-icon-actions status-filter-actions" direction="row" spacing={0.4}>
                    <Tooltip title={t("新增 profile")}>
                      <Button
                        className="profile-create-button"
                        aria-label={t("新增 profile")}
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        {t("新建")}
                      </Button>
                    </Tooltip>
                    <Tooltip title={t("查询当前列表额度")}>
                      <span>
                        <IconButton
                          aria-label={t("查询当前列表额度")}
                          onClick={() => void handleReadVisibleQuotas()}
                          disabled={quotaBatchLoading || visibleProfiles.every((profile) => !profile.account)}
                        >
                          {quotaBatchLoading ? <CircularProgress size={16} /> : <DataUsageRoundedIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t("刷新 profile")}>
                      <span>
                        <IconButton
                          aria-label={t("刷新 profile 列表")}
                          onClick={() => void refreshProfiles()}
                          disabled={isActionBusy(actionKeys.profileRefresh)}
                        >
                          <RefreshRoundedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
                <Box className="feedback-slot">
                  {feedback ? (
                    <Alert className="feedback-line" severity={feedback.severity} aria-live="polite">
                      {feedback.text}
                    </Alert>
                  ) : null}
                </Box>
              </Box>

              <Box className="profile-list-surface">
                <Box className="profile-table-viewport">
                  <Box className="profile-table-content">
                    <Box
                      className="profile-list-header"
                      ref={setProfileHeaderElement}
                    >
                      <Box className="profile-header-main">
                        <span>Profile</span>
                        <ProfileColumnSortHeader
                          label={t("分类")}
                          sortKey="category"
                          sortState={profileColumnSort}
                          sortLabel={profileColumnSort?.key === "category" && profileColumnSort.direction === "desc" ? t("降序") : t("升序")}
                          onSort={toggleProfileColumnSort}
                        />
                        <span>{t("账号")}</span>
                        <span>{t("认证")}</span>
                        <span>{t("最近会话")}</span>
                        <ProfileColumnSortHeader
                          label={t("额度")}
                          sortKey="usage"
                          sortState={profileColumnSort}
                          sortLabel={profileColumnSort?.key === "usage" && profileColumnSort.direction === "desc" ? t("降序") : t("升序")}
                          onSort={toggleProfileColumnSort}
                        />
                        <span>{t("环境")}</span>
                        <span>{t("状态")}</span>
                      </Box>
                      <span className="profile-action-header">{t("操作")}</span>
                    </Box>
                    <Box
                      className="profile-grid"
                      ref={setProfileGridElement}
                      aria-label={t("profile 列表")}
                    >
                  {profileFilterSource.length === 0 ? (
                    <Box className="empty-state list-empty">
                      {statusFilter === "archived" ? <ArchiveRoundedIcon /> : <TerminalRoundedIcon />}
                      <Typography variant="body2">
                        {statusFilter === "archived" ? t("还没有已归档的 Profile。") : t("没有 profile。")}
                      </Typography>
                    </Box>
                  ) : visibleProfiles.length === 0 ? (
                    <Box className="empty-state list-empty">
                      <SearchRoundedIcon />
                      <Typography variant="body2">{t("没有匹配结果。")}</Typography>
                    </Box>
                  ) : (
                    paginatedProfiles.map((profile) => (
                      <ProfileCard
                        key={profile.name}
                        profile={profile}
                        quotaState={quotaByProfile[profile.name]}
                        selected={activeProfile?.name === profile.name}
                        onSelect={() => selectProfile(profile.name)}
                        onContextMenu={(event) => handleOpenProfileContextMenu(event, profile)}
                        onMore={(event) => handleOpenProfileContextMenu(event, profile, "actions")}
                        onEdit={() => openEditDialogForProfile(profile)}
                        onLaunch={() => void handleLaunchProfile(profile)}
                        onTerminate={() => void handleTerminateProfile(profile)}
                        onReadQuota={() => requestReadQuota(profile)}
                        onRestore={() => void handleRestoreArchivedProfile(profile)}
                        onDelete={() => handleOpenDeleteDialog(profile)}
                        busy={
                          isActionBusy(actionKeys.profileLifecycle(profile.name)) ||
                          isActionBusy(actionKeys.profileArchive(profile.name)) ||
                          isActionBusy(actionKeys.profileDelete(profile.name))
                        }
                      />
                    ))
                  )}
                    </Box>
                  </Box>
                </Box>
                <Box className="profile-list-footer">
                  <Typography variant="caption">
                    {statusFilter === "archived"
                      ? t("共 {count} 个已归档 Profile", { count: visibleProfiles.length })
                      : t("共 {count} 个 profile", { count: visibleProfiles.length })}
                  </Typography>
                  <Stack direction="row" spacing={0.5} className="profile-page-controls">
                    <IconButton
                      aria-label={t("上一页")}
                      disabled={profilePage <= 1}
                      onClick={() => setProfilePage((current) => Math.max(1, current - 1))}
                    >
                      <KeyboardArrowLeftRoundedIcon fontSize="small" />
                    </IconButton>
                    <span>{profilePage}</span>
                    <IconButton
                      aria-label={t("下一页")}
                      disabled={profilePage >= profilePageCount}
                      onClick={() => setProfilePage((current) => Math.min(profilePageCount, current + 1))}
                    >
                      <KeyboardArrowRightRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Button
                    className="profile-page-size"
                    size="small"
                    variant="outlined"
                    endIcon={<KeyboardArrowDownRoundedIcon />}
                    onClick={(event) => setProfilePageSizeMenuAnchor(event.currentTarget)}
                  >
                    {t("{count} 条/页", { count: profilePageSize })}
                  </Button>
                  <Menu
                    anchorEl={profilePageSizeMenuAnchor}
                    open={Boolean(profilePageSizeMenuAnchor)}
                    onClose={() => setProfilePageSizeMenuAnchor(null)}
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    transformOrigin={{ vertical: "bottom", horizontal: "right" }}
                  >
                    {[10, 50, 100].map((size) => (
                      <MenuItem
                        key={size}
                        selected={profilePageSize === size}
                        onClick={() => {
                          setProfilePageSize(size);
                          setProfilePage(1);
                          setProfilePageSizeMenuAnchor(null);
                        }}
                      >
                        {t("{count} 条/页", { count: size })}
                      </MenuItem>
                    ))}
                  </Menu>
                </Box>
              </Box>
            </Paper>
          </main>

          <aside className="inspector-rail" aria-label={t("profile 详情")} hidden>
            <Paper className="inspector-panel" elevation={0}>
              {activeProfile ? (
                <Box className="inspector-content">
                  <Box className="inspector-hero">
                    <Box className="inspector-title">
                      <Box className="inspector-profile-heading">
                        <Typography className="inspector-eyebrow" variant="caption" color="text.secondary">
                          {t(activeProfile.isArchived ? "已归档 profile" : "当前 profile")}
                        </Typography>
                        <Box className="inspector-profile-identity">
                          <span
                            className={`profile-avatar inspector-profile-avatar ${profileAvatarTone(activeProfile)}`}
                            translate="no"
                          >
                            {(activeProfile.alias || activeProfile.name).slice(0, 1)}
                          </span>
                          <Box className="inspector-title-main">
                          <Typography variant="h5" component="h2" translate="no">
                            {activeProfile.alias || activeProfile.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" translate="no">
                            {activeProfile.name}
                          </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Stack className="inspector-title-badges" direction="row" spacing={0.5}>
                        <Chip
                          className={`inspector-runtime-badge ${activeProfile.isArchived ? "archived" : activeProfile.isRunning ? "running" : "idle"}`}
                          size="small"
                          label={t(activeProfile.isArchived ? "已归档" : activeProfile.isRunning ? "运行中" : "已停止")}
                        />
                      </Stack>
                    </Box>

                    <Box className="detail-tags">
                      <Chip size="small" variant="outlined" label={activeProfile.category} />
                      <Chip size="small" label={activeProfile.model ?? "unknown"} />
                      <Chip size="small" label={activeProfile.reasoningEffort ?? "unknown"} />
                    </Box>

                    <Box className="inspector-primary-actions" aria-label={t("profile 常用操作")}>
                      {activeProfile.isArchived ? (
                        <Button
                          className="hero-launch-action"
                          variant="contained"
                          startIcon={<UnarchiveRoundedIcon />}
                          onClick={() => void handleRestoreArchivedProfile(activeProfile)}
                          disabled={isActionBusy(actionKeys.profileArchive(activeProfile.name))}
                        >
                          {t("恢复使用")}
                        </Button>
                      ) : (
                        <>
                          <Button
                            className={`hero-launch-action ${activeProfile.isRunning ? "running" : ""}`}
                            variant={activeProfile.isRunning ? "outlined" : "contained"}
                            startIcon={activeProfile.isRunning ? <StopCircleRoundedIcon /> : <PlayArrowRoundedIcon />}
                            onClick={() => {
                              if (activeProfile.isRunning) {
                                void handleTerminateProfile(activeProfile);
                              } else {
                                void handleLaunchProfile(activeProfile);
                              }
                            }}
                            disabled={
                              isActionBusy(actionKeys.profileLifecycle(activeProfile.name)) ||
                              (activeProfile.isRunning && activeProfile.isDefault)
                            }
                          >
                            {t(activeProfile.isRunning ? "停止运行" : "启动")}
                          </Button>
                          <Button
                            className="hero-quota-action"
                            variant="outlined"
                            startIcon={<BarChartRoundedIcon />}
                            onClick={() => requestReadQuota(activeProfile)}
                            disabled={
                              !activeProfile.account ||
                              Boolean(quotaByProfile[activeProfile.name]?.loading)
                            }
                          >
                            {t(quotaByProfile[activeProfile.name]?.report ? "刷新额度" : "查额度")}
                          </Button>
                        </>
                      )}
                    </Box>

                    <Box className="profile-health-strip" aria-label={t("profile 状态")}>
                      <span className={`health-item ${activeProfile.account ? "good" : "muted"}`}>
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                        {t(activeProfile.account ? "已登录" : "未登录")}
                      </span>
                      <span className={`health-item ${activeProfile.homeExists && activeProfile.userDataExists ? "good" : "warning"}`}>
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                        {t(activeProfile.homeExists && activeProfile.userDataExists ? "路径正常" : "路径需检查")}
                      </span>
                      <span className="health-item">
                        <StarOutlineRoundedIcon fontSize="small" />
                        {t(activeProfile.isArchived ? "已归档" : activeProfile.isDefault ? "默认 profile" : profileSourceLabel(activeProfile))}
                      </span>
                    </Box>
                  </Box>

                  <Box className="inspector-body">
                    <Box className="inspector-section">
                      <Typography className="inspector-section-label" variant="caption">{t("路径与数据")}</Typography>
                      <Box className="inspector-system-list">
                        <PathBlock title="CODEX_HOME" path={activeProfile.codexHome} exists={activeProfile.homeExists} />
                        <PathBlock
                          title="User Data"
                          path={activeProfile.userDataDir}
                          exists={activeProfile.userDataExists}
                        />
                      </Box>
                    </Box>
                    <Box className="inspector-section">
                      <Typography className="inspector-section-label" variant="caption">{t("账号")}</Typography>
                      <AccountBlock
                        profile={activeProfile}
                        onLogin={() => setAuthLoginTarget({
                          kind: "local-profile",
                          profileName: activeProfile.name,
                          profileLabel: activeProfile.alias || activeProfile.name,
                          hasAccount: Boolean(activeProfile.account),
                        })}
                      />
                    </Box>

                    <SessionBlock session={activeProfile.latestSession} />

                    <QuotaBlock
                      profile={activeProfile}
                      state={quotaByProfile[activeProfile.name]}
                      onRefresh={() => requestReadQuota(activeProfile)}
                    />
                  </Box>

                  {!activeProfile.isArchived ? <Box className="inspector-action-dock">
                    <Box className="secondary-action-bar" aria-label={t("低风险维护操作")}>
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyRoundedIcon />}
                        onClick={() => handleOpenCopyDialog(activeProfile)}
                      >
                        {t("复制")}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<EditRoundedIcon />}
                        onClick={() => setEditDialogOpen(true)}
                      >
                        {t("编辑")}
                      </Button>
                      <Tooltip title={t(activeProfile.isDefault ? "默认 Profile 受保护" : activeProfile.isRunning ? "请先停止 Profile" : "从日常列表隐藏，保留全部数据")}>
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<ArchiveRoundedIcon />}
                            onClick={() => setArchiveDialogOpen(true)}
                            disabled={activeProfile.isDefault || activeProfile.isRunning}
                          >
                            {t("归档")}
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box> : null}

                </Box>
              ) : (
                <Box className="empty-state tall">
                  <TerminalRoundedIcon />
                  <Typography variant="body2">{t("选择一个 profile。")}</Typography>
                </Box>
              )}
            </Paper>
          </aside>
        </Box>

        <Menu
          className="profile-context-menu"
          open={Boolean(profileContextMenu && contextMenuProfile)}
          onClose={handleCloseProfileContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            profileContextMenu
              ? { top: profileContextMenu.mouseY, left: profileContextMenu.mouseX }
              : undefined
          }
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          {contextMenuProfile && profileContextMenu?.mode === "actions" ? (
            <>
              <MenuItem
                onClick={() => runProfileContextAction(handleOpenAuthLogin)}
              >
                <LoginRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{contextMenuProfile.account ? t("刷新认证") : t("登录 Profile")}</span>
              </MenuItem>
              <MenuItem
                onClick={() =>
                  runProfileContextAction((profile) =>
                    void copyTextToClipboard(accountLabel(profile), `已复制 ${profileLabel(profile)} 的账号`),
                  )
                }
                disabled={!contextMenuProfile.account}
              >
                <ContentCopyRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("复制账号")}</span>
              </MenuItem>
              <MenuItem
                onClick={() => runProfileContextAction(handleOpenQuotaDialog)}
                disabled={!contextMenuProfile.account}
              >
                <BarChartRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("查看额度")}</span>
              </MenuItem>
              <Divider className="profile-context-menu-divider" />
              <MenuItem onClick={() => runProfileContextAction(openEditDialogForProfile)}>
                <EditRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("编辑信息")}</span>
              </MenuItem>
              <Divider className="profile-context-menu-divider" />
              <MenuItem
                onClick={() => runProfileContextAction(handleOpenArchiveDialog)}
                disabled={
                  contextMenuProfile.isDefault ||
                  contextMenuProfile.isRunning ||
                  isActionBusy(actionKeys.profileArchive(contextMenuProfile.name))
                }
              >
                <ArchiveRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("归档")}</span>
              </MenuItem>
              <MenuItem
                className="danger"
                onClick={() => runProfileContextAction(handleOpenDeleteDialog)}
                disabled={
                  contextMenuProfile.isDefault ||
                  contextMenuProfile.isRunning ||
                  isActionBusy(actionKeys.profileDelete(contextMenuProfile.name))
                }
              >
                <DeleteOutlineRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("删除")}</span>
              </MenuItem>
            </>
          ) : contextMenuProfile ? (
            <>
              <MenuItem
                onClick={() =>
                  runProfileContextAction((profile) => {
                    if (profile.isRunning) {
                      void handleTerminateProfile(profile);
                    } else {
                      void handleLaunchProfile(profile);
                    }
                  })
                }
                disabled={
                  isActionBusy(actionKeys.profileLifecycle(contextMenuProfile.name)) ||
                  (contextMenuProfile.isRunning && contextMenuProfile.isDefault)
                }
              >
                {contextMenuProfile.isRunning ? (
                  <StopCircleRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                ) : (
                  <PlayArrowRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                )}
                <span>{contextMenuProfile.isRunning ? t("停止") : t("启动")}</span>
              </MenuItem>
              <MenuItem onClick={() => runProfileContextAction(openEditDialogForProfile)}>
                <EditRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("编辑")}</span>
              </MenuItem>

              <Divider className="profile-context-menu-divider" />

              <MenuItem
                onClick={() => runProfileContextAction(handleOpenArchiveDialog)}
                disabled={
                  contextMenuProfile.isDefault ||
                  contextMenuProfile.isRunning ||
                  isActionBusy(actionKeys.profileArchive(contextMenuProfile.name))
                }
              >
                <ArchiveRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("归档")}</span>
              </MenuItem>
              <MenuItem
                className="danger"
                onClick={() => runProfileContextAction(handleOpenDeleteDialog)}
                disabled={
                  contextMenuProfile.isDefault ||
                  contextMenuProfile.isRunning ||
                  isActionBusy(actionKeys.profileDelete(contextMenuProfile.name))
                }
              >
                <DeleteOutlineRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>{t("删除")}</span>
              </MenuItem>
            </>
          ) : null}
        </Menu>

        <Dialog
          className="app-task-dialog compact-task-dialog profile-quota-dialog"
          open={Boolean(quotaDialogProfile)}
          onClose={() => setQuotaDialogProfileName("")}
          fullWidth
          maxWidth="xs"
        >
          <TaskDialogTitle
            icon={<DataUsageRoundedIcon />}
            title={t("Profile 额度")}
            subtitle={quotaDialogProfile ? profileLabel(quotaDialogProfile) : undefined}
            onClose={() => setQuotaDialogProfileName("")}
          />
          <DialogContent>
            {quotaDialogProfile ? (
              <QuotaBlock
                profile={quotaDialogProfile}
                state={quotaByProfile[quotaDialogProfile.name]}
                onRefresh={() => requestReadQuota(quotaDialogProfile)}
              />
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setQuotaDialogProfileName("")}>{t("完成")}</Button>
          </DialogActions>
        </Dialog>

        <SessionCenterDialog
          open={sessionDialogOpen}
          items={sessionItems}
          profiles={profiles}
          report={sessionReport}
          activeProfileName={activeOperationalProfile?.name ?? ""}
          loading={sessionLoading}
          error={sessionError}
          query={sessionQuery}
          profileName={sessionProfileName}
          category={sessionCategory}
          page={sessionPage}
          pageSize={sessionPageSize}
          onClose={() => setSessionDialogOpen(false)}
          onRefresh={() => void refreshProfileSessions()}
          onQueryChange={(value) => {
            setSessionQuery(value);
            setSessionPage(1);
          }}
          onProfileChange={(value) => {
            setSessionProfileName(value);
            setSessionPage(1);
          }}
          onCategoryChange={(value) => {
            setSessionCategory(value);
            setSessionPage(1);
          }}
          onPageChange={setSessionPage}
          onPageSizeChange={(size) => {
            setSessionPageSize(size);
            setSessionPage(1);
          }}
          onLoadDetail={readProfileSessionDetail}
          onOpen={(session) => {
            if (session.path) {
              void revealPath(session.path);
            }
          }}
          onCopySummary={handleCopySessionSummary}
          onCopyReference={handleCopySessionReference}
        />

        <AuthVaultDialog
          open={authDialogOpen}
          report={authReport}
          loading={authLoading}
          error={authError}
          busy={isActionBusy("auth.")}
          activeProfileName={activeOperationalProfile?.name ?? ""}
          selectedProfileName={authProfileName}
          selectedBackupId={selectedAuthBackupId}
          onClose={() => setAuthDialogOpen(false)}
          onRefresh={() => void refreshAuthVault()}
          onProfileChange={setAuthProfileName}
          onBackupSelect={setSelectedAuthBackupId}
          onCreateBackups={handleCreateAuthBackups}
          onImportPackage={handleImportAuthBackupPackage}
          onApplyBackup={handleApplyAuthBackup}
          onRollbackApplication={handleRollbackAuthApplication}
          onUpdateBackup={(backupId, label, note, pinned) =>
            handleUpdateAuthBackup(backupId, label, note, pinned)
          }
          onExportBackup={handleExportAuthBackup}
          onCleanupBackups={(accountKey, accountLabel, count) =>
            handleCleanupAuthBackups(accountKey, accountLabel, count)
          }
          onDeleteBackup={handleDeleteAuthBackup}
          onReveal={(path) => void revealPath(path)}
        />

        <AuthLoginDialog
          open={Boolean(authLoginTarget)}
          target={authLoginTarget}
          onClose={() => {
            setAuthLoginTarget(null);
            setQuotaRetryAfterAuthRefresh(false);
          }}
          onCompleted={async (target) => {
            const nextReport = await refreshProfiles({
              severity: "success",
              text: `${target.profileLabel} 认证已更新`,
            });
            if (authDialogOpen) {
              await refreshAuthVault();
            }
            if (quotaRetryAfterAuthRefresh && nextReport) {
              const refreshedProfile = [
                ...nextReport.profiles,
                ...(nextReport.archivedProfiles ?? []),
              ].find((profile) => profile.name === target.profileName);
              setQuotaRetryAfterAuthRefresh(false);
              if (refreshedProfile) {
                await handleReadQuota(refreshedProfile);
              }
            }
          }}
          onAutoRefresh={handleAutoRefreshAuth}
        />

        <WechatBridgeDialog
          open={wechatDialogOpen}
          report={wechatReport}
          feishuReport={feishuReport}
          loading={wechatLoading}
          feishuLoading={feishuLoading}
          error={wechatError}
          feishuError={feishuError}
          busy={isActionBusy("remote.")}
          activeProfileName={activeOperationalProfile?.name ?? ""}
          selectedProfileName={wechatProfileName}
          feishuProfileName={feishuProfileName}
          onClose={() => setWechatDialogOpen(false)}
          onRefresh={() => {
            void refreshWechatBridges();
            void refreshFeishuRemote();
          }}
          onProfileChange={setWechatProfileName}
          onFeishuProfileChange={setFeishuProfileName}
          onStart={handleStartWechatBridge}
          onStop={handleStopWechatBridge}
          onRestart={handleRestartWechatBridge}
          onUnbind={handleUnbindWechatBridge}
          onRefreshLog={handleRefreshWechatLog}
          onConfigureFeishu={handleConfigureFeishuRemote}
          onStartFeishu={handleStartFeishuRemote}
          onStopFeishu={handleStopFeishuRemote}
          onRestartFeishu={handleRestartFeishuRemote}
          onRefreshFeishuLog={handleRefreshFeishuLog}
          onOpenFeishuPage={handleOpenFeishuPage}
          onReveal={(path) => void revealPath(path)}
        />

        <ModelRouteDialog
          open={modelRouteDialogOpen}
          report={modelRouteReport}
          loading={modelRouteLoading}
          error={modelRouteError}
          busy={isActionBusy("modelRoute.")}
          activeProfileName={activeOperationalProfile?.name ?? ""}
          selectedProfileName={modelRouteProfileName}
          onClose={() => setModelRouteDialogOpen(false)}
          onRefresh={() => void refreshModelRoutes()}
          onProfileChange={setModelRouteProfileName}
          onPreview={(input) => previewModelRoute(input)}
          onCheckDraft={handleCheckModelRouteDraft}
          onApply={(input) => handleApplyModelRoute(input)}
          onRestore={(input) => handleRestoreModelRoute(input)}
          onStartProxy={() => void handleStartModelRouteProxy()}
          onStopProxy={() => void handleStopModelRouteProxy()}
          onOpenCcSwitch={() => void handleOpenCcSwitch()}
          onCheckProxy={(profileName) => handleCheckModelRouteProxy(profileName)}
          onReveal={(path) => void revealPath(path)}
        />

        <CopyProfileDialog
          open={copyDialogOpen}
          draft={copyDraft}
          profiles={profiles}
          authProfiles={authReport?.profiles ?? []}
          authLoading={authLoading}
          busy={isActionBusy(actionKeys.profileCopy)}
          categoryOptions={profileCategoryOptions}
          nameExists={copyNameExists}
          canSubmit={canCopyProfile}
          onClose={() => {
            setCopyDialogOpen(false);
            setCopyDraft(null);
          }}
          onSourceChange={handleCopySourceChange}
          onDraftChange={updateCopyDraft}
          onSubmit={() => void handleCopyProfile()}
        />

        <Dialog className="app-task-dialog create-profile-dialog" open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
          <TaskDialogTitle icon={<AddRoundedIcon />} title={t("新增 profile")} subtitle={t("新建独立工作区")} onClose={() => setCreateDialogOpen(false)} />
          <DialogContent>
            <Box className="create-profile-layout">
              <CreateProfileSection
                icon={<TerminalRoundedIcon />}
                title={t("身份与分类")}
                description={t("启动命令用于终端调用，需保持唯一。")}
              >
                <Box className="create-profile-identity-grid">
                  <TextField
                    autoFocus
                    required
                    label={t("启动命令")}
                    value={createDraft.name}
                    onChange={(event) => updateCreateDraft("name", event.target.value)}
                    error={createNameExists || createNameInvalid}
                    helperText={
                      createNameExists
                        ? t("启动命令已存在")
                        : createNameInvalid
                          ? t("仅支持 codex-、小写字母、数字和连字符")
                          : t("例如 codex-work")
                    }
                    slotProps={textFieldSlotProps("create-profile-name")}
                  />
                  <TextField
                    label={t("显示名称")}
                    value={createDraft.alias ?? ""}
                    onChange={(event) => updateCreateDraft("alias", event.target.value)}
                    placeholder={t("选填")}
                    slotProps={textFieldSlotProps("create-profile-alias")}
                  />
                  <ProfileCategoryAutocomplete
                    value={createDraft.category ?? ""}
                    options={profileCategoryOptions}
                    inputName="create-profile-category"
                    placeholder={t("例如 深度")}
                    onChange={(category) => updateCreateDraft("category", category)}
                  />
                </Box>
              </CreateProfileSection>

              <CreateProfileSection
                icon={<AltRouteRoundedIcon />}
                title={t("模型与推理")}
                description={t("创建后仍可在编辑 Profile 或模型路由中调整。")}
              >
                <Box className="create-profile-runtime-grid">
                  <TextField
                    label={t("默认模型")}
                    value={createDraft.model ?? ""}
                    onChange={(event) => updateCreateDraft("model", event.target.value)}
                    placeholder={t("留空跟随 Codex 默认")}
                    slotProps={textFieldSlotProps("create-profile-model")}
                  />
                  <TextField
                    select
                    label={t("推理等级")}
                    value={createDraft.reasoningEffort ?? ""}
                    onChange={(event) => updateCreateDraft("reasoningEffort", event.target.value)}
                    slotProps={textFieldSlotProps("create-profile-reasoning-effort")}
                  >
                    {Array.from(
                      new Set([
                        ...REASONING_EFFORT_OPTIONS,
                        createDraft.reasoningEffort ?? "",
                      ].filter(Boolean)),
                    ).map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </TextField>
                </Box>
              </CreateProfileSection>

              <CreateProfileSection
                className="create-profile-paths"
                icon={<FolderRoundedIcon />}
                title={t("工作区路径")}
                description={t("留空时按启动命令生成独立目录。")}
              >
                <Box className="create-profile-path-grid">
                  <TextField
                    label="CODEX_HOME"
                    value={createDraft.codexHome ?? ""}
                    onChange={(event) => updateCreateDraft("codexHome", event.target.value)}
                    placeholder={t("自动生成")}
                    slotProps={textFieldSlotProps("create-profile-codex-home")}
                  />
                  <TextField
                    label="User Data"
                    value={createDraft.userDataDir ?? ""}
                    onChange={(event) => updateCreateDraft("userDataDir", event.target.value)}
                    placeholder={t("自动生成")}
                    slotProps={textFieldSlotProps("create-profile-user-data-dir")}
                  />
                </Box>
              </CreateProfileSection>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>{t("取消")}</Button>
            <Button
              onClick={() => void handleCreateProfile(false)}
              disabled={!canCreate || isActionBusy(actionKeys.profileCreate)}
            >
              {t("仅创建")}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => void handleCreateProfile(true)}
              disabled={!canCreate || isActionBusy(actionKeys.profileCreate)}
            >
              {t("创建并登录")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog profile-edit-dialog" open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
          <TaskDialogTitle icon={<EditRoundedIcon />} title={t("编辑 profile")} subtitle={activeProfile?.name} onClose={() => setEditDialogOpen(false)} />
          <DialogContent>
            {activeProfile ? (
              <Box className="profile-edit-layout">
                <Box className="profile-edit-summary">
                  <span className={`profile-avatar ${profileAvatarTone(activeProfile)}`} translate="no">
                    {(activeProfile.alias || activeProfile.name).slice(0, 1)}
                  </span>
                  <Box className="profile-edit-summary-copy">
                    <Typography variant="subtitle1" translate="no">
                      {activeProfile.alias || activeProfile.name}
                    </Typography>
                    <Typography variant="caption" translate="no">{activeProfile.name}</Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(activeProfile.isRunning ? "运行中" : activeProfile.isDefault ? "默认 Profile" : "已停止")}
                  />
                </Box>

                <Box className="profile-edit-section">
                  <Box className="profile-edit-section-heading">
                    <span className="profile-edit-section-icon"><TerminalRoundedIcon /></span>
                    <Box>
                      <Typography variant="subtitle2">{t("基本信息")}</Typography>
                      <Typography variant="caption">{t("用于列表识别、筛选和备注。")}</Typography>
                    </Box>
                  </Box>
                  <Box className="profile-edit-field-grid">
                    <TextField
                      label={t("启动命令")}
                      value={editDraft.name}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      disabled={!canEditLauncher}
                      error={canEditLauncher && (editNameExists || editNameInvalid)}
                      helperText={
                        canEditLauncher
                          ? editNameExists
                            ? t("启动命令已存在")
                            : editNameInvalid
                              ? t("仅支持 codex-、小写字母、数字和连字符")
                              : t("修改后会同步更新 .zshrc 中的 shell 函数名")
                          : t("默认、运行中或已归档 Profile 只读")
                      }
                      slotProps={textFieldSlotProps("edit-profile-name")}
                    />
                    <TextField
                      label={t("别名")}
                      value={editDraft.alias}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, alias: event.target.value }))
                      }
                      slotProps={textFieldSlotProps("edit-profile-alias")}
                    />
                    <ProfileCategoryAutocomplete
                      value={editDraft.category}
                      options={profileCategoryOptions}
                      inputName="edit-profile-category"
                      onChange={(category) =>
                        setEditDraft((current) => ({ ...current, category }))
                      }
                    />
                    <TextField
                      className="profile-edit-note"
                      label={t("备注")}
                      value={editDraft.note}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, note: event.target.value }))
                      }
                      multiline
                      minRows={2}
                      maxRows={3}
                      slotProps={textFieldSlotProps("edit-profile-note")}
                    />
                  </Box>
                </Box>

                <Box className="profile-edit-section">
                  <Box className="profile-edit-section-heading">
                    <span className="profile-edit-section-icon"><AltRouteRoundedIcon /></span>
                    <Box>
                      <Typography variant="subtitle2">{t("模型与推理")}</Typography>
                      <Typography variant="caption">{t("保存前会备份 config.toml，并保留其他配置项。")}</Typography>
                    </Box>
                    {!canEditModel ? (
                      <Chip
                        size="small"
                        label={t(activeProfile.isDefault ? "默认 Profile 只读" : activeProfile.isRunning ? "运行中只读" : "不可修改")}
                      />
                    ) : null}
                  </Box>
                  <Box className="profile-edit-field-grid">
                    <TextField
                      label={t("模型")}
                      value={editDraft.model}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, model: event.target.value }))
                      }
                      disabled={!canEditModel}
                      required={canEditModel}
                      slotProps={textFieldSlotProps("edit-profile-model")}
                    />
                    <TextField
                      select
                      label={t("推理等级")}
                      value={editDraft.reasoningEffort}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, reasoningEffort: event.target.value }))
                      }
                      disabled={!canEditModel}
                      slotProps={textFieldSlotProps("edit-profile-reasoning-effort")}
                    >
                      {Array.from(new Set([...REASONING_EFFORT_OPTIONS, editDraft.reasoningEffort].filter(Boolean))).map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </TextField>
                  </Box>
                </Box>

                <Box className="profile-edit-section profile-edit-runtime">
                  <Box className="profile-edit-section-heading">
                    <span className="profile-edit-section-icon"><FolderRoundedIcon /></span>
                    <Box>
                      <Typography variant="subtitle2">{t("路径与运行配置")}</Typography>
                      <Typography variant="caption">{t("路径由启动函数管理，仅提供查看和定位。")}</Typography>
                    </Box>
                  </Box>
                  <Box className="profile-edit-path-list">
                    <Box className="profile-edit-path-item">
                      <FolderRoundedIcon fontSize="small" />
                      <span><strong>CODEX_HOME</strong><small translate="no">{activeProfile.codexHome}</small></span>
                      <Stack className="profile-edit-path-actions" direction="row" spacing={0.25}>
                        <Tooltip title={t("复制路径")}>
                          <IconButton
                            size="small"
                            aria-label={t("复制 {title} 路径", { title: "CODEX_HOME" })}
                            onClick={() => void copyTextToClipboard(activeProfile.codexHome, t("已复制 {title} 路径", { title: "CODEX_HOME" }))}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("打开路径")}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={t("打开 {title}", { title: "CODEX_HOME" })}
                              onClick={() => void revealPath(activeProfile.codexHome)}
                              disabled={!activeProfile.homeExists}
                            >
                              <OpenInNewRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Box className="profile-edit-path-item">
                      <FolderRoundedIcon fontSize="small" />
                      <span><strong>User Data</strong><small translate="no">{activeProfile.userDataDir}</small></span>
                      <Stack className="profile-edit-path-actions" direction="row" spacing={0.25}>
                        <Tooltip title={t("复制路径")}>
                          <IconButton
                            size="small"
                            aria-label={t("复制 {title} 路径", { title: "User Data" })}
                            onClick={() => void copyTextToClipboard(activeProfile.userDataDir, t("已复制 {title} 路径", { title: "User Data" }))}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("打开路径")}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={t("打开 {title}", { title: "User Data" })}
                              onClick={() => void revealPath(activeProfile.userDataDir)}
                              disabled={!activeProfile.userDataExists}
                            >
                              <OpenInNewRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Box className="profile-edit-config-status">
                      <span className={activeProfile.configExists || activeProfile.authState?.status === "api-key" ? "good" : "warning"}>
                        {activeProfile.configExists || activeProfile.authState?.status === "api-key" ? <CheckCircleOutlineRoundedIcon /> : <WarningAmberRoundedIcon />}
                        {t(activeProfile.configExists
                          ? "config.toml 已读取"
                          : activeProfile.authState?.status === "api-key"
                            ? "API Key 认证，config.toml 可选"
                            : "config.toml 缺失")}
                      </span>
                      <span>{t(profileSourceLabel(activeProfile))}</span>
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>{t("取消")}</Button>
            <Button
              variant="contained"
              onClick={() => void handleSaveProfile()}
              disabled={
                !editChanged ||
                (canEditLauncher && (!isValidProfileName(editDraft.name) || editNameExists)) ||
                (canEditModel && modelChanged && !editDraft.model.trim()) ||
                Boolean(activeProfile && (
                  isActionBusy(actionKeys.profileMetadata(activeProfile.name)) ||
                  isActionBusy(actionKeys.profileLauncher(activeProfile.name))
                ))
              }
            >
              {t("保存更改")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog" open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<ArchiveRoundedIcon />} title={t("归档 Profile")} subtitle={activeProfile?.name} onClose={() => setArchiveDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              <Alert severity="info">{t("归档只会将该 Profile 从日常列表隐藏。")}</Alert>
              <Typography variant="body2" color="text.secondary">
                {t("启动配置、CODEX_HOME、User Data、认证、会话和模型配置都会原样保留，之后可从“已归档”列表恢复。")}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setArchiveDialogOpen(false)}>{t("取消")}</Button>
            <Button
              variant="contained"
              startIcon={<ArchiveRoundedIcon />}
              onClick={() => void handleArchiveProfile()}
              disabled={Boolean(activeProfile && isActionBusy(actionKeys.profileArchive(activeProfile.name)))}
            >
              {t("确认归档")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog danger-task-dialog" open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<DeleteOutlineRoundedIcon />} title={t("删除 profile")} subtitle={activeProfile?.name} onClose={() => setDeleteDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("默认只移除 `.zshrc` 启动函数。")}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={archiveOnDelete}
                    onChange={(event) => setArchiveOnDelete(event.target.checked)}
                  />
                }
                label={t("删除前将数据目录移到备份位置")}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>{t("取消")}</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void handleDeleteProfile()}
              disabled={Boolean(activeProfile && isActionBusy(actionKeys.profileDelete(activeProfile.name)))}
            >
              {t("删除")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog import-auth-dialog" open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm">
          <TaskDialogTitle icon={<FileUploadRoundedIcon />} title={t("导入账号")} subtitle={activeProfile?.name} onClose={() => setImportDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              {activeProfile?.isDefault ? (
                <Alert severity="warning">{t("默认 codex 受保护。为避免影响正在使用的主账号，不支持覆盖导入。")}</Alert>
              ) : activeProfile?.isRunning ? (
                <Alert severity="warning">{t("目标 profile 正在运行。为避免影响正在使用的 Codex，请先终止目标实例。")}</Alert>
              ) : (
                <Alert severity="info">
                  {t("只会写入当前目标的 CODEX_HOME/auth.json；已有 auth.json 会先复制备份。")}
                </Alert>
              )}
              <TextField
                label={t("来源 JSON 路径")}
                value={importSourcePath}
                onChange={(event) => setImportSourcePath(event.target.value)}
                placeholder={t("另一个 profile 的 auth.json，或 ChatGPT session JSON…")}
                slotProps={textFieldSlotProps("import-auth-source-path")}
              />
              <Typography variant="caption" color="text.secondary">
                {t("目标：")}{activeProfile ? `${activeProfile.codexHome}/auth.json` : ""}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmImportSensitive}
                    onChange={(event) => setConfirmImportSensitive(event.target.checked)}
                  />
                }
                label={t("我确认来源可信，并理解会覆盖目标 profile 的登录状态")}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportDialogOpen(false)}>{t("取消")}</Button>
            <Button
              variant="contained"
              onClick={() => void handleImportAuth()}
              disabled={
                Boolean(activeProfile && isActionBusy(actionKeys.profileImportAuth(activeProfile.name))) ||
                !importSourcePath.trim() ||
                !confirmImportSensitive ||
                Boolean(activeProfile?.isDefault) ||
                Boolean(activeProfile?.isRunning)
              }
            >
              {t("导入")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog" open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<RestartAltRoundedIcon />} title={t("重置 profile")} subtitle={activeProfile?.name} onClose={() => setResetDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 0.5 }}>
              <TextField
                label={t("模型")}
                value={resetDraft.model}
                onChange={(event) => setResetDraft((current) => ({ ...current, model: event.target.value }))}
                slotProps={textFieldSlotProps("reset-profile-model")}
              />
              <TextField
                label={t("努力等级")}
                value={resetDraft.reasoningEffort}
                onChange={(event) =>
                  setResetDraft((current) => ({ ...current, reasoningEffort: event.target.value }))
                }
                slotProps={textFieldSlotProps("reset-profile-reasoning-effort")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={resetDraft.resetUserData}
                    onChange={(event) =>
                      setResetDraft((current) => ({ ...current, resetUserData: event.target.checked }))
                    }
                  />
                }
                label={t("重置 user-data-dir")}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>{t("取消")}</Button>
            <Button
              variant="contained"
              onClick={() => void handleResetProfile()}
              disabled={Boolean(activeProfile && isActionBusy(actionKeys.profileReset(activeProfile.name)))}
            >
              {t("重置")}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      </ThemeProvider>
    </I18nProvider>
  );
}

function buildSessionSummaryText(item: SessionCenterItem, locale: AppLanguage): string {
  const { profile, session } = item;
  return [
    `Profile: ${profileLabel(profile)} (${profile.name})`,
    `Profile Type: ${profile.category}`,
    `Title: ${session.title}`,
    session.renamedTitle ? `Renamed Title: ${session.renamedTitle}` : null,
    session.summary ? `Summary: ${session.summary}` : null,
    session.cwd ? `CWD: ${session.cwd}` : null,
    `Time: ${formatSessionTime(session.updatedAt ?? session.startedAt, locale)}`,
    session.path ? `Path: ${session.path}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSessionReferenceText(
  item: SessionCenterItem,
  targetProfile: ProfileInfo | null,
  t: Translate,
  locale: AppLanguage,
): string {
  const { profile, session } = item;
  return [
    t("请参考下面这个 Codex 会话摘要继续工作。"),
    "",
    t("目标 profile: {value}", { value: targetProfile ? `${profileLabel(targetProfile)} (${targetProfile.name})` : t("当前 profile") }),
    t("来源 profile: {value}", { value: `${profileLabel(profile)} (${profile.name})` }),
    t("来源类型: {value}", { value: profile.category }),
    t("会话标题: {value}", { value: session.title }),
    session.renamedTitle ? t("重命名标题: {value}", { value: session.renamedTitle }) : null,
    session.summary ? t("会话摘要: {value}", { value: session.summary }) : null,
    session.cwd ? t("工作目录: {value}", { value: session.cwd }) : null,
    t("时间: {value}", { value: formatSessionTime(session.updatedAt ?? session.startedAt, locale) }),
    session.path ? t("源会话文件: {value}", { value: session.path }) : null,
    "",
    t("只把它作为只读背景参考，不要修改或迁移源会话文件。"),
  ]
    .filter(Boolean)
    .join("\n");
}

function CopyProfileDialog({
  open,
  draft,
  profiles,
  authProfiles,
  authLoading,
  busy,
  categoryOptions,
  nameExists,
  canSubmit,
  onClose,
  onSourceChange,
  onDraftChange,
  onSubmit,
}: {
  open: boolean;
  draft: CopyProfileInput | null;
  profiles: ProfileInfo[];
  authProfiles: AuthProfileSlot[];
  authLoading: boolean;
  busy: boolean;
  categoryOptions: ReadonlyArray<string>;
  nameExists: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSourceChange: (value: string) => void;
  onDraftChange: <K extends keyof CopyProfileInput>(key: K, value: CopyProfileInput[K]) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const sourceProfile = draft
    ? profiles.find((profile) => profile.name === draft.sourceName) ?? null
    : null;
  const authOptions = authProfiles.filter((profile) => profile.authExists);
  const selectedAuthSource = draft?.authSourceName ?? NO_AUTH_SOURCE;
  const authSelected = selectedAuthSource !== NO_AUTH_SOURCE;

  return (
    <Dialog className="app-task-dialog copy-profile-dialog" open={open} onClose={onClose} fullWidth maxWidth="sm">
      <TaskDialogTitle
        icon={<ContentCopyRoundedIcon />}
        title={t("复制 profile")}
        subtitle={sourceProfile ? t("来源：{source}", { source: profileLabel(sourceProfile) }) : undefined}
        onClose={onClose}
      />
      <DialogContent>
        {draft ? (
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Box className="copy-dialog-summary">
              <Typography variant="subtitle2" translate="no">
                {sourceProfile ? profileLabel(sourceProfile) : draft.sourceName}
              </Typography>
              <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", rowGap: 0.6 }}>
                <Chip size="small" label={sourceProfile?.category ?? t("未知")} />
                <Chip size="small" label={sourceProfile?.model ?? draft.model ?? "unknown"} />
                <Chip size="small" label={sourceProfile?.reasoningEffort ?? draft.reasoningEffort ?? "unknown"} />
              </Stack>
            </Box>
            <Box className="copy-dialog-grid">
              <TextField
                select
                label={t("来源 profile")}
                value={draft.sourceName}
                onChange={(event) => onSourceChange(event.target.value)}
                slotProps={textFieldSlotProps("copy-source-profile")}
              >
                {profiles.map((profile) => (
                  <MenuItem key={profile.name} value={profile.name}>
                    {profileLabel(profile)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t("新命令")}
                value={draft.name}
                onChange={(event) => onDraftChange("name", event.target.value)}
                error={nameExists || (draft.name.trim() !== "" && !isValidProfileName(draft.name))}
                helperText={nameExists ? t("已存在") : "codex-*"}
                slotProps={textFieldSlotProps("copy-profile-name")}
              />
              <TextField
                label={t("别名")}
                value={draft.alias ?? ""}
                onChange={(event) => onDraftChange("alias", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-alias")}
              />
              <ProfileCategoryAutocomplete
                value={draft.category ?? ""}
                options={categoryOptions}
                inputName="copy-profile-category"
                onChange={(category) => onDraftChange("category", category)}
              />
              <TextField
                label={t("模型")}
                value={draft.model ?? ""}
                onChange={(event) => onDraftChange("model", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-model")}
              />
              <TextField
                label={t("努力等级")}
                value={draft.reasoningEffort ?? ""}
                onChange={(event) => onDraftChange("reasoningEffort", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-reasoning-effort")}
              />
              <TextField
                label="CODEX_HOME"
                value={draft.codexHome ?? ""}
                onChange={(event) => onDraftChange("codexHome", event.target.value)}
                placeholder={t("留空自动生成…")}
                slotProps={textFieldSlotProps("copy-profile-codex-home")}
              />
              <TextField
                label="user-data-dir"
                value={draft.userDataDir ?? ""}
                onChange={(event) => onDraftChange("userDataDir", event.target.value)}
                placeholder={t("留空自动生成…")}
                slotProps={textFieldSlotProps("copy-profile-user-data-dir")}
              />
              <TextField
                className="copy-dialog-wide"
                select
                label={t("认证来源")}
                value={selectedAuthSource}
                onChange={(event) => {
                  const value = event.target.value;
                  onDraftChange("authSourceName", value);
                  onDraftChange("confirmSensitive", false);
                }}
                slotProps={textFieldSlotProps("copy-auth-source")}
              >
                <MenuItem value={NO_AUTH_SOURCE}>{t("不复制 auth")}</MenuItem>
                {authLoading ? <MenuItem disabled>{t("正在读取认证信息…")}</MenuItem> : null}
                {authOptions.map((profile) => (
                  <MenuItem key={profile.profileName} value={profile.profileName}>
                    {authSlotLabel(profile)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            {authSelected ? (
              <Alert className="copy-auth-alert" severity="warning">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.confirmSensitive}
                      onChange={(event) => onDraftChange("confirmSensitive", event.target.checked)}
                    />
                  }
                  label={t("我确认要把所选认证写入新 profile")}
                />
              </Alert>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("取消")}</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!canSubmit || busy}>
          {t("复制")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProfileCard({
  profile,
  quotaState,
  selected,
  onSelect,
  onContextMenu,
  onMore,
  onEdit,
  onLaunch,
  onTerminate,
  onReadQuota,
  onRestore,
  onDelete,
  busy,
}: {
  profile: ProfileInfo;
  quotaState: ProfileQuotaCacheState | undefined;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onMore: (event: MouseEvent<HTMLElement>) => void;
  onEdit: () => void;
  onLaunch: () => void;
  onTerminate: () => void;
  onReadQuota: () => void;
  onRestore: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { language, t } = useI18n();
  const canTerminate = profile.isRunning && !profile.isDefault;
  const iconTitle = profile.isArchived
    ? t("恢复使用")
    : profile.isDefault && profile.isRunning
      ? t("默认 codex 请手动退出")
      : profile.isRunning
        ? t("终止")
        : t("启动");
  const statusLabel = profile.isArchived
    ? t("已归档")
    : profile.isRunning
      ? t("运行中")
      : profile.account
        ? t("已登录")
        : t("未登录");
  const statusTone = profile.isArchived ? "archived" : profile.isRunning ? "running" : profile.account ? "signed-in" : "signed-out";
  const authSignal = profileAuthSignal(profile);
  const environmentSignal = profileEnvironmentSignal(profile);
  const usageActionLabel = t(quotaState?.report ? "刷新额度" : "查看额度");

  return (
    <Box className={`profile-card ${selected ? "selected" : ""} ${profile.isArchived ? "archived" : ""}`} onContextMenu={profile.isArchived ? undefined : onContextMenu}>
      <button
        type="button"
        className="profile-card-main"
        aria-pressed={selected}
        aria-current={selected ? "true" : undefined}
        onPointerDown={onSelect}
        onClick={onSelect}
        onDoubleClick={profile.isArchived ? undefined : onEdit}
      >
        <Box className="profile-identity-cell">
          <span className={`profile-avatar ${profileAvatarTone(profile)}`} translate="no">
            {(profile.alias || profile.name).slice(0, 1)}
          </span>
          <Box className="profile-identity-copy">
            <Typography variant="subtitle1" component="span" translate="no">
              {profile.alias || profile.name}
            </Typography>
            <Typography variant="caption" translate="no">
              {profile.name}
            </Typography>
          </Box>
        </Box>
        <Box className="profile-card-meta">
          <span>{profile.category}</span>
        </Box>
        <Box className="profile-account-cell">
          <AccountCircleRoundedIcon fontSize="small" />
          <Box className="profile-account-copy">
            <Typography variant="caption">{accountLabel(profile)}</Typography>
            <Typography
              className="profile-account-meta"
              variant="caption"
              title={accountMetaLabel(profile)}
            >
              {accountMetaLabel(profile)}
            </Typography>
          </Box>
        </Box>
        <Box className={`profile-signal-cell profile-auth-cell ${authSignal.tone}`} title={authSignal.detail}>
          <VpnKeyRoundedIcon fontSize="small" />
          <Typography variant="caption">{t(authSignal.label)}</Typography>
        </Box>
        <Box className="profile-session-cell">
          {profile.latestSession ? (
            <>
              <Box
                className="profile-session-title"
                title={profile.latestSession.summary ?? profile.latestSession.title}
              >
                <TerminalRoundedIcon fontSize="small" />
                <Typography variant="caption" translate="no">
                  {profile.latestSession.title}
                </Typography>
              </Box>
              <Typography className="profile-session-time" variant="caption">
                {formatSessionTime(profile.latestSession.updatedAt ?? profile.latestSession.startedAt, language)}
              </Typography>
            </>
          ) : (
            <Typography className="profile-session-time" variant="caption">{t("暂无会话")}</Typography>
          )}
        </Box>
        <ProfileQuotaListCell profile={profile} state={quotaState} />
        <Box
          className={`profile-signal-cell profile-environment-cell ${environmentSignal.tone}`}
          title={environmentSignal.detail}
        >
          {environmentSignal.tone === "good" ? (
            <CheckCircleOutlineRoundedIcon fontSize="small" />
          ) : environmentSignal.tone === "neutral" ? (
            <SettingsEthernetRoundedIcon fontSize="small" />
          ) : (
            <WarningAmberRoundedIcon fontSize="small" />
          )}
          <Typography variant="caption">{t(environmentSignal.label)}</Typography>
        </Box>
        <Box className={`profile-status-cell ${statusTone}`}>
          <span className="profile-status-dot" />
          <Typography variant="caption">{statusLabel}</Typography>
        </Box>
      </button>
      <Box className="profile-card-action">
        <Tooltip title={iconTitle}>
          <span>
            <IconButton
              className={`profile-action-button ${profile.isArchived ? "archived" : profile.isRunning ? "running" : "idle"}`}
              aria-label={`${profile.isArchived ? t("恢复") : profile.isRunning ? t("终止") : t("启动")} ${profile.name}`}
              onClick={(event) => {
                event.stopPropagation();
                if (profile.isArchived) {
                  onRestore();
                } else if (canTerminate) {
                  onTerminate();
                } else if (!profile.isRunning) {
                  onLaunch();
                }
              }}
              disabled={busy || (!profile.isArchived && profile.isDefault && profile.isRunning)}
            >
              {profile.isArchived ? (
                <UnarchiveRoundedIcon fontSize="small" />
              ) : profile.isRunning ? (
                <StopCircleRoundedIcon fontSize="small" />
              ) : (
                <PlayArrowRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        {profile.isArchived ? (
          <Tooltip title={t("删除")}>
            <span>
              <IconButton
                className="profile-delete-button"
                aria-label={`${t("删除")} ${profile.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                disabled={busy || profile.isDefault || profile.isRunning}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {!profile.isArchived ? (
          <>
            <Tooltip title={usageActionLabel}>
              <span>
                <IconButton
                  className="profile-usage-button"
                  aria-label={`${usageActionLabel} ${profile.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReadQuota();
                  }}
                  disabled={busy || !profile.account || Boolean(quotaState?.loading)}
                >
                  <DataUsageRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("更多操作")}>
              <IconButton
                className="profile-more-button"
                aria-label={`${t("更多操作")} ${profile.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onMore(event);
                }}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

function ProfileQuotaListCell({
  profile,
  state,
}: {
  profile: ProfileInfo;
  state: ProfileQuotaCacheState | undefined;
}) {
  const { language, t } = useI18n();
  const windows = quotaWindowsForList(state?.report ?? null);
  const quotaUnsupported = isQuotaUnsupported(profile, state);
  const hasExhaustedWindow = windows.some((window) => (
    window.status === "exhausted" || quotaRemainingPercent(window) === 0
  ));
  const hasLowWindow = windows.some((window) => (
    window.status === "low"
    || ((quotaRemainingPercent(window) ?? 100) <= 20)
  ));
  const tone = quotaUnsupported
    ? "muted"
    : state?.error
    ? "warning"
    : hasExhaustedWindow
      ? "error"
      : hasLowWindow
        ? "warning"
        : windows.length
          ? "good"
          : "muted";
  const tooltip = [
    quotaUnsupported
      ? t("当前 Profile 使用自定义模型服务，未提供可读取的额度接口。")
      : state?.error
        ? t("额度查询失败，请稍后重试")
        : null,
    windows.length
      ? windows.map((window) => [
          t("{window} 剩余 {percent}%", {
            window: compactQuotaWindowLabel(window),
            percent: Math.round(quotaRemainingPercent(window) ?? 0),
          }),
          window.resetsAt === null
            ? null
            : t("下次刷新 {time}", {
                time: formatQuotaDateTime(window.resetsAt, language),
              }),
        ].filter(Boolean).join(" · ")).join(" | ")
      : quotaUnsupported
        ? null
        : profile.account
          ? t("点击上方额度按钮查询当前列表")
          : t("未登录，无法查询额度"),
    state?.report && state.updatedAt > 0
      ? t("上次查询 {time}", {
          time: formatQuotaDateTime(Math.floor(state.updatedAt / 1000), language),
        })
      : null,
  ].filter(Boolean).join(" · ");

  return (
    <Tooltip title={tooltip}>
      <Box className={`profile-quota-cell ${tone}`}>
        {state?.loading ? (
          <>
            <CircularProgress size={12} />
            <Typography variant="caption">{t("查询中")}</Typography>
          </>
        ) : quotaUnsupported ? (
          <>
            <InfoOutlinedIcon />
            <Typography variant="caption">{t("暂不支持")}</Typography>
          </>
        ) : state?.error && windows.length === 0 ? (
          <>
            <WarningAmberRoundedIcon />
            <Typography variant="caption">{t("暂不可查")}</Typography>
          </>
        ) : windows.length ? (
          <Box className={`profile-quota-values ${windows.length === 1 ? "single" : ""}`}>
            {windows.map((window) => {
              const remaining = Math.round(quotaRemainingPercent(window) ?? 0);
              const windowTone = window.status === "exhausted" || remaining === 0
                ? "error"
                : window.status === "low" || remaining <= 20
                  ? "warning"
                  : "good";
              return (
                <span key={window.id} className={`profile-quota-metric ${windowTone}`}>
                  <span className="profile-quota-metric-label">
                    <small>{compactQuotaWindowLabel(window)}</small>
                    <strong>{remaining}%</strong>
                  </span>
                  <LinearProgress variant="determinate" value={remaining} />
                </span>
              );
            })}
          </Box>
        ) : (
          <Typography variant="caption">{profile.account ? t("未查询") : "—"}</Typography>
        )}
      </Box>
    </Tooltip>
  );
}

function SessionBlock({ session }: { session: CodexSessionSummary | null }) {
  const { language, t } = useI18n();
  return (
    <Box className="session-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <ChatBubbleOutlineRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">{t("最新会话")}</Typography>
        </Stack>
        {session ? (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              if (session.path) {
                void revealPath(session.path);
              }
            }}
            disabled={!session.path}
          >
            {t("打开")}
          </Button>
        ) : null}
      </Stack>

      {session ? (
        <Box className="session-content">
          <Box className="session-icon-tile">
            <TerminalRoundedIcon fontSize="small" />
            <span />
          </Box>
          <Box className="session-copy">
            <Typography className="session-title" variant="subtitle2" component="span" translate="no" title={session.title}>
              {session.title}
            </Typography>
            {session.summary ? (
              <Typography className="session-summary" variant="body2" title={session.summary}>
                {session.summary}
              </Typography>
            ) : (
              <Typography className="session-muted" variant="caption">
                {t("暂无摘要内容")}
              </Typography>
            )}
            <Stack className="session-meta" direction="row" spacing={0.8}>
              <Typography variant="caption">{formatSessionTime(session.updatedAt ?? session.startedAt, language)}</Typography>
              {session.cwd ? (
                <Typography variant="caption" translate="no" title={session.cwd}>
                  {compactPath(session.cwd)}
                </Typography>
              ) : null}
            </Stack>
          </Box>
          <Tooltip title={t("打开会话")}>
            <span>
              <IconButton
                className="session-open-button"
                aria-label={t("打开最新会话")}
                onClick={() => {
                  if (session.path) {
                    void revealPath(session.path);
                  }
                }}
                disabled={!session.path}
              >
                <OpenInNewRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ) : (
        <Typography className="session-muted" variant="caption">
          {t("暂无会话摘要")}
        </Typography>
      )}
    </Box>
  );
}

function AccountBlock({
  profile,
  onLogin,
}: {
  profile: ProfileInfo;
  onLogin: () => void;
}) {
  const { t } = useI18n();
  const account = profile.account;
  return (
    <Box className="account-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
        <AccountCircleRoundedIcon fontSize="small" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" component="span">{accountLabel(profile)}</Typography>
          <Typography variant="caption">
            {account
              ? [account.planType, account.organizationTitle, account.authMode].filter(Boolean).join(" · ")
              : t("未在该 CODEX_HOME 中发现可展示账号")}
          </Typography>
        </Box>
        <Button
          className="account-login-button"
          size="small"
          startIcon={<LoginRoundedIcon />}
          onClick={onLogin}
        >
          {t(account ? "刷新" : "登录")}
        </Button>
        <Tooltip title={t("复制账号")}>
          <span>
            <IconButton
              className="account-copy-button"
              aria-label={t("复制账号")}
              disabled={!account}
              onClick={() => {
                if (account) {
                  void navigator.clipboard?.writeText(accountLabel(profile));
                }
              }}
            >
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function QuotaBlock({
  profile,
  state,
  onRefresh,
}: {
  profile: ProfileInfo;
  state: ProfileQuotaCacheState | undefined;
  onRefresh: () => void;
}) {
  const { language, t } = useI18n();
  const loading = state?.loading ?? false;
  const report = state?.report ?? null;
  const error = state?.error ?? null;
  const quotaUnsupported = isQuotaUnsupported(profile, state);
  const disabled = loading || !profile.account;

  return (
    <Box className="quota-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
          <DataUsageRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">{t("额度")}</Typography>
        </Stack>
        <Button size="small" variant="text" onClick={onRefresh} disabled={disabled}>
          {t(report ? "刷新" : "查询")}
        </Button>
      </Stack>

      {loading ? <LinearProgress className="quota-progress" /> : null}

      {!profile.account ? (
        <Typography className="quota-muted" variant="caption">
          {t("未登录")}
        </Typography>
      ) : report ? (
        <Box className="quota-window-list">
          {error ? (
            <Typography className="quota-error" variant="caption">
              {error}
            </Typography>
          ) : null}
          {report.windows.map((window) => (
            <QuotaWindowRow key={window.id} window={window} language={language} />
          ))}
          {state?.updatedAt ? (
            <Typography className="quota-muted quota-last-queried" variant="caption">
              {t("上次查询 {time}", {
                time: formatQuotaDateTime(Math.floor(state.updatedAt / 1000), language),
              })}
            </Typography>
          ) : null}
        </Box>
      ) : error ? (
        <Typography className={quotaUnsupported ? "quota-muted" : "quota-error"} variant="caption">
          {quotaUnsupported
            ? t("当前 Profile 使用自定义模型服务，未提供可读取的额度接口。")
            : t("额度查询失败，请稍后重试")}
        </Typography>
      ) : (
        <Typography className="quota-muted" variant="caption">
          {t("未查询")}
        </Typography>
      )}
    </Box>
  );
}

function QuotaWindowRow({
  window,
  language,
}: {
  window: QuotaWindowInfo;
  language: AppLanguage;
}) {
  const { t } = useI18n();
  const usedPercent = clampPercent(window.usedPercent);
  return (
    <Box className={`quota-window-row ${window.status}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption">{window.label}</Typography>
        <Typography variant="caption">{formatQuotaPercent(window.usedPercent)}</Typography>
      </Stack>
      <LinearProgress
        className="quota-meter"
        variant={usedPercent === null ? "indeterminate" : "determinate"}
        value={usedPercent ?? 0}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption">{formatWindowMinutes(window.windowMinutes)}</Typography>
        <Typography variant="caption">
          {window.resetsAt === null
            ? t("reset --")
            : t("下次刷新 {time}", { time: formatQuotaDateTime(window.resetsAt, language) })}
        </Typography>
      </Stack>
    </Box>
  );
}

function renderStatusFilterIcon(key: string) {
  if (key === "archived") {
    return <ArchiveRoundedIcon fontSize="small" />;
  }
  if (key === "running") {
    return <PlayArrowRoundedIcon fontSize="small" />;
  }
  if (key === "signed-in") {
    return <CheckCircleOutlineRoundedIcon fontSize="small" />;
  }
  if (key === "signed-out") {
    return <AccountCircleRoundedIcon fontSize="small" />;
  }
  if (key === "has-session") {
    return <ChatBubbleOutlineRoundedIcon fontSize="small" />;
  }
  return <TerminalRoundedIcon fontSize="small" />;
}

function isPaidProfile(profile: ProfileInfo): boolean {
  if (profile.category === "付费") {
    return true;
  }
  const plan = profile.account?.planType?.trim().toLowerCase();
  return Boolean(profile.account && plan && !FREE_PLAN_LABELS.has(plan));
}

function matchesCategoryFilter(profile: ProfileInfo, filter: string): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "paid") {
    return isPaidProfile(profile);
  }
  if (filter.startsWith("category:")) {
    return profile.category === filter.slice("category:".length);
  }
  return true;
}

function matchesStatusFilter(profile: ProfileInfo, filter: string): boolean {
  if (filter === "running") {
    return profile.isRunning;
  }
  if (filter === "signed-in") {
    return Boolean(profile.account);
  }
  if (filter === "signed-out") {
    return !profile.account;
  }
  if (filter === "has-session") {
    return Boolean(profile.latestSession);
  }
  return true;
}

function profileAvatarTone(profile: ProfileInfo): string {
  const tones = ["tone-navy", "tone-blue", "tone-violet", "tone-green", "tone-orange", "tone-cyan", "tone-rose"];
  const seed = profile.name.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[seed % tones.length];
}

function accountLabel(profile: ProfileInfo): string {
  const account = profile.account;
  if (!account) {
    return "未登录";
  }
  return account.email ?? account.name ?? account.accountId ?? account.authMode ?? "已登录";
}

function accountMetaLabel(profile: ProfileInfo): string {
  const account = profile.account;
  if (!account) {
    return "暂无账号信息";
  }
  return [account.planType, account.organizationTitle, account.authMode].filter(Boolean).join(" · ") || "账号信息不完整";
}

function authSlotLabel(profile: AuthProfileSlot): string {
  return profile.profileAlias || profile.profileName;
}

function profileSourceLabel(profile: ProfileInfo): string {
  if (profile.isDefault) {
    return "默认";
  }
  return profile.managedByApp ? "托管" : "zshrc";
}

function clampPercent(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return Math.min(100, Math.max(0, value));
}

function formatQuotaPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${Math.round(value)}%`;
}

function formatWindowMinutes(value: number | null): string {
  if (value === null) {
    return "窗口 --";
  }
  if (value >= 60 * 24) {
    const days = value / (60 * 24);
    return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
  }
  if (value >= 60) {
    const hours = value / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return `${value}m`;
}

function formatSessionTime(value: string | null, locale: AppLanguage = "zh-CN"): string {
  if (!value) {
    return locale === "en-US" ? "Time --" : "时间 --";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function compactPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

function PathBlock({ title, path, exists }: { title: string; path: string; exists: boolean }) {
  const { t } = useI18n();
  return (
    <Box className="path-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack className="path-title" direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <FolderRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">{title}</Typography>
        </Stack>
        <Stack className="path-actions" direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Chip size="small" label={t(exists ? "已存在" : "缺失")} color={exists ? "success" : "warning"} />
          <Tooltip title={t("打开路径")}>
            <span>
              <IconButton
                className="path-open-button"
                aria-label={t("打开 {title}", { title })}
                onClick={() => void revealPath(path)}
                disabled={!exists}
              >
                <OpenInNewRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Typography variant="caption" translate="no">
        {path}
      </Typography>
    </Box>
  );
}

export default App;
