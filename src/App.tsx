import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
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
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
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
  listProfileSessions,
  listProfiles,
  previewModelRoute,
  readProfileQuota,
  readProfileSessionDetail,
  readModelRouteProxyStatus,
  readFeishuRemoteLog,
  readWechatBridgeLog,
  repairProfileNetwork,
  runDoctor,
  resetProfile,
  revealPath,
  openCcSwitch,
  openFeishuRemotePage,
  rollbackAuthApplication,
  restoreModelRoute,
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
import type { ProfileQuotaReport, QuotaWindowInfo } from "./lib/types";
import {
  createRcodexManagerTheme,
  type CodexManagerStyleMode,
} from "./theme/rcodexmanager-theme";
import { SessionCenterDialog } from "./features/session-center/SessionCenterDialog";
import { AuthVaultDialog } from "./features/auth-vault/AuthVaultDialog";
import { WechatBridgeDialog } from "./features/wechat-bridge/WechatBridgeDialog";
import { ModelRouteDialog } from "./features/model-route/ModelRouteDialog";
import { ServerNodesDialog } from "./features/server-nodes/ServerNodesDialog";
import { isDialogResourceFresh } from "./components/manager";
import { useActionRegistry } from "./hooks/useActionRegistry";

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
  profileLifecycle: (name: string) => `profile.lifecycle:${name}`,
  profileDelete: (name: string) => `profile.delete:${name}`,
  profileReset: (name: string) => `profile.reset:${name}`,
  profileImportAuth: (name: string) => `profile.import-auth:${name}`,
  profileRepair: (name: string) => `profile.repair:${name}`,
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

type ProfileContextMenuState = {
  mouseX: number;
  mouseY: number;
  profileName: string;
};


type MetadataDraft = {
  alias: string;
  category: string;
};

type QuotaState = {
  loading: boolean;
  report: ProfileQuotaReport | null;
  error: string | null;
};

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
  countLabel?: string;
  actionLabel?: string;
  onClick: () => void;
};

type ThemePreference = CodexManagerStyleMode | "system";

const NO_AUTH_SOURCE = "__none__";

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
const FREE_PLAN_LABELS = new Set(["free", "trial"]);

function initialThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem("rcodexmanager-style");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
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
  return (
    <Box className="browser-command-grid" aria-label="核心功能">
      {items.map((item) => (
        <button key={item.key} type="button" className="command-card" onClick={item.onClick}>
          <span className="command-icon">{item.icon}</span>
          <span className="command-copy">
            <span className="command-title">{item.title}</span>
            <span className="command-subtitle">{item.subtitle}</span>
          </span>
          {item.countLabel ? (
            <span className="command-count">{item.countLabel}</span>
          ) : (
            <span className="command-action">{item.actionLabel ?? "打开"}</span>
          )}
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
  return (
    <DialogTitle className="task-dialog-title">
      <Stack direction="row" spacing={1} className="task-dialog-title-main">
        <Box className="task-dialog-title-icon">{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" className="task-dialog-heading">{title}</Typography>
          {subtitle ? <Typography className="task-dialog-subtitle">{subtitle}</Typography> : null}
        </Box>
      </Stack>
      <Tooltip title="关闭">
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon />
        </IconButton>
      </Tooltip>
    </DialogTitle>
  );
}

function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialThemePreference);
  const [systemStyleMode, setSystemStyleMode] = useState<CodexManagerStyleMode>(getSystemStyleMode);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [serverNodesDialogOpen, setServerNodesDialogOpen] = useState(false);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const styleMode = themePreference === "system" ? systemStyleMode : themePreference;
  const theme = useMemo(() => createRcodexManagerTheme(styleMode), [styleMode]);
  const [report, setReport] = useState<ProfileReport | null>(null);
  const [activeName, setActiveName] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProfileInput>(DEFAULT_FORM);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyDraft, setCopyDraft] = useState<CopyProfileInput | null>(null);
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>({
    alias: "",
    category: "",
  });
  const [resetDraft, setResetDraft] = useState({
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    resetUserData: true,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [archiveOnDelete, setArchiveOnDelete] = useState(false);
  const [importSourcePath, setImportSourcePath] = useState("");
  const [confirmImportSensitive, setConfirmImportSensitive] = useState(false);
  const { activeActions, startAction, finishAction, isActionBusy } = useActionRegistry();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [quotaByProfile, setQuotaByProfile] = useState<Record<string, QuotaState>>({});
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionReport, setSessionReport] = useState<ProfileSessionReport | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionProfileName, setSessionProfileName] = useState("");
  const [sessionCategory, setSessionCategory] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState(10);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authReport, setAuthReport] = useState<AuthVaultReport | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProfileName, setAuthProfileName] = useState("");
  const [selectedAuthBackupId, setSelectedAuthBackupId] = useState("");
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
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.name === activeName) ?? profiles[0] ?? null,
    [activeName, profiles],
  );
  const contextMenuProfile = useMemo(
    () =>
      profileContextMenu
        ? profiles.find((profile) => profile.name === profileContextMenu.profileName) ?? null
        : null,
    [profileContextMenu, profiles],
  );
  const existingNames = useMemo(() => new Set(profiles.map((profile) => profile.name)), [profiles]);
  const categoryFilterOptions = useMemo(() => {
    const categories = Array.from(new Set(profiles.map((profile) => profile.category).filter(Boolean)));
    const orderedCategories = [
      ...PROFILE_CATEGORY_ORDER.filter((category) => categories.includes(category) && category !== "付费"),
      ...categories
        .filter((category) => !PROFILE_CATEGORY_ORDER.includes(category))
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    ];

    return [
      { key: "all", label: "全部", count: profiles.length },
      { key: "paid", label: "付费", count: profiles.filter(isPaidProfile).length },
      ...orderedCategories.map((category) => ({
        key: `category:${category}`,
        label: category,
        count: profiles.filter((profile) => profile.category === category).length,
      })),
    ].filter((option) => option.key === "all" || option.count > 0);
  }, [profiles]);
  const statusFilterOptions = useMemo(
    () => [
      { key: "all", label: "全部", count: profiles.length },
      { key: "running", label: "运行中", count: profiles.filter((profile) => profile.isRunning).length },
      { key: "signed-in", label: "已登录", count: profiles.filter((profile) => Boolean(profile.account)).length },
      { key: "signed-out", label: "未登录", count: profiles.filter((profile) => !profile.account).length },
      { key: "has-session", label: "有会话", count: profiles.filter((profile) => Boolean(profile.latestSession)).length },
    ],
    [profiles],
  );
  const visibleProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (!matchesCategoryFilter(profile, categoryFilter)) {
        return false;
      }
      if (!matchesStatusFilter(profile, statusFilter)) {
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
  }, [categoryFilter, profiles, query, statusFilter]);
  useEffect(() => {
    if (
      visibleProfiles.length > 0 &&
      activeProfile &&
      !visibleProfiles.some((profile) => profile.name === activeProfile.name)
    ) {
      setActiveName(visibleProfiles[0].name);
    }
  }, [activeProfile, visibleProfiles]);
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
      title: "会话中心",
      subtitle: "最近会话与摘要",
      icon: <TerminalRoundedIcon fontSize="small" />,
      countLabel: sessionCountLabel,
      actionLabel: "打开",
      onClick: handleOpenSessionCenter,
    },
    {
      key: "auth",
      title: "认证库",
      subtitle: authReport ? "备份可应用" : "登录态备份与回滚",
      icon: <VpnKeyRoundedIcon fontSize="small" />,
      countLabel: authCountLabel,
      actionLabel: "管理",
      onClick: handleOpenAuthVault,
    },
    {
      key: "remote-channels",
      title: "远程渠道",
      subtitle: "微信 · 飞书",
      icon: <HubRoundedIcon fontSize="small" />,
      countLabel: remoteChannelCountLabel,
      actionLabel: "管理",
      onClick: handleOpenWechatBridge,
    },
    {
      key: "model-route",
      title: "模型路由",
      subtitle: "阿里 · GLM · 本地模型",
      icon: <AltRouteRoundedIcon fontSize="small" />,
      countLabel: modelRouteCountLabel,
      actionLabel: "配置",
      onClick: handleOpenModelRoute,
    },
  ];
  const createNameExists = existingNames.has(createDraft.name.trim());
  const canCreate = createDraft.name.trim().startsWith("codex-") && !createNameExists;
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
    ((activeProfile?.alias ?? "") !== metadataDraft.alias.trim() ||
      (activeProfile?.category ?? "") !== metadataDraft.category.trim());

  function selectProfileAndOpenInspector(profileName: string) {
    setActiveName(profileName);
    setInspectorCollapsed(false);
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
    document.documentElement.dataset.style = styleMode;
  }, [styleMode]);

  async function refreshProfiles(nextFeedback?: FeedbackState) {
    if (!startAction(actionKeys.profileRefresh, "刷新中")) {
      return;
    }
    try {
      const nextReport = await listProfiles();
      setReport(nextReport);
      setActiveName((current) => {
        if (nextReport.profiles.some((profile) => profile.name === current)) {
          return current;
        }
        return nextReport.profiles[0]?.name ?? "";
      });
      setSessionReport(null);
      sessionResourceRef.current = { key: "", updatedAt: null };
      setSessionProfileName("");
      setFeedback(nextFeedback ?? null);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取 profile 失败"),
      });
    } finally {
      finishAction(actionKeys.profileRefresh);
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
        return activeProfile?.name ?? profiles[0]?.name ?? "";
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
        if (activeProfile && nextReport.profiles.some((profile) => profile.profileName === activeProfile.name)) {
          return activeProfile.name;
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
    setAuthProfileName(activeProfile?.name ?? authProfileName);
    if (!authReport && !authLoading) {
      void refreshAuthVault();
    }
  }

  function handleOpenWechatBridge() {
    blurActiveElement();
    setWechatDialogOpen(true);
    setWechatProfileName(activeProfile?.name ?? wechatProfileName);
    if (!wechatReport && !wechatLoading) {
      void refreshWechatBridges();
    }
    setFeishuProfileName(feishuReport?.profileName ?? activeProfile?.name ?? feishuProfileName);
    if (!feishuReport && !feishuLoading) {
      void refreshFeishuRemote();
    }
  }

  function handleOpenModelRoute() {
    blurActiveElement();
    setModelRouteDialogOpen(true);
    setModelRouteProfileName(activeProfile?.name ?? modelRouteProfileName);
    if (!modelRouteReport && !modelRouteLoading) {
      void refreshModelRoutes();
    }
  }

  function handleOpenProfileContextMenu(event: MouseEvent<HTMLElement>, profile: ProfileInfo) {
    event.preventDefault();
    event.stopPropagation();
    setActiveName(profile.name);
    setProfileContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      profileName: profile.name,
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
    setMetadataDraft({
      alias: profile.alias ?? "",
      category: profile.category,
    });
    setEditDialogOpen(true);
  }

  function handleOpenCopyDialog(profile: ProfileInfo) {
    setCopyDraft(createCopyDraft(profile, profiles));
    setCopyDialogOpen(true);
    if (!authReport && !authLoading) {
      void refreshAuthVault();
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
      setMetadataDraft({ alias: "", category: "" });
      return;
    }
    setMetadataDraft({
      alias: activeProfile.alias ?? "",
      category: activeProfile.category,
    });
    setResetDraft({
      model: activeProfile.model ?? "gpt-5.5",
      reasoningEffort: activeProfile.reasoningEffort ?? "xhigh",
      resetUserData: true,
    });
  }, [activeProfile]);

  async function handleCreateProfile() {
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
      setActiveName(result.profile?.name ?? profileName);
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

  async function handleSaveMetadata() {
    if (!activeProfile) {
      return;
    }

    const actionKey = actionKeys.profileMetadata(activeProfile.name);
    if (!startAction(actionKey, "保存中")) {
      return;
    }
    try {
      const result = await updateProfileMetadata({
        name: activeProfile.name,
        alias: metadataDraft.alias.trim(),
        category: metadataDraft.category.trim(),
        note: null,
      });
      setEditDialogOpen(false);
      await refreshProfiles({ severity: "success", text: result.message });
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

  async function handleReadQuota(profile: ProfileInfo) {
    setQuotaByProfile((current) => ({
      ...current,
      [profile.name]: {
        loading: true,
        report: current[profile.name]?.report ?? null,
        error: null,
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
        },
      }));
    } catch (error) {
      setQuotaByProfile((current) => ({
        ...current,
        [profile.name]: {
          loading: false,
          report: current[profile.name]?.report ?? null,
          error: errorMessage(error, "额度查询失败"),
        },
      }));
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

  async function handleRepairNetwork(profile: ProfileInfo) {
    const actionKey = actionKeys.profileRepair(profile.name);
    if (!startAction(actionKey, "修复网络")) {
      return;
    }
    try {
      const result = await repairProfileNetwork(profile.name);
      await refreshProfiles({
        severity: result.launchEnvError ? "warning" : "success",
        text: result.message,
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "修复 Codex 网络失败"),
      });
    } finally {
      finishAction(actionKey);
    }
  }

  async function copyTextToClipboard(text: string, successText: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("当前环境不支持写入剪贴板");
      }
      await navigator.clipboard.writeText(text);
      setFeedback({ severity: "success", text: successText });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "复制失败"),
      });
    }
  }

  function handleCopySessionSummary(item: SessionCenterItem) {
    void copyTextToClipboard(
      buildSessionSummaryText(item),
      `已复制 ${profileLabel(item.profile)} 的会话摘要`,
    );
  }

  function handleCopySessionReference(item: SessionCenterItem) {
    void copyTextToClipboard(
      buildSessionReferenceText(item, activeProfile),
      `已复制给 ${activeProfile ? profileLabel(activeProfile) : "当前 profile"} 使用的引用`,
    );
  }

  function updateCreateDraft<K extends keyof CreateProfileInput>(key: K, value: CreateProfileInput[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateCopyDraft<K extends keyof CopyProfileInput>(key: K, value: CopyProfileInput[K]) {
    setCopyDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell" data-style={styleMode}>
        <a className="skip-link" href="#profile-browser">
          跳到 profile 列表
        </a>
        <Box className="window-drag-region" data-tauri-drag-region />
        <Box className="window-toolbar" aria-label="窗口工具">
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            {activeActions.length > 0 ? (
              <Chip
                size="small"
                label={`${activeActions[0].label}${activeActions.length > 1 ? ` +${activeActions.length - 1}` : ""}`}
              />
            ) : null}
            <Tooltip title="服务器节点">
              <IconButton
                aria-label="打开服务器节点"
                onClick={() => setServerNodesDialogOpen(true)}
              >
                <StorageRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={inspectorCollapsed ? "展开详情栏" : "收起详情栏"}>
              <button
                type="button"
                className="inspector-toggle-button window-inspector-toggle"
                aria-label={inspectorCollapsed ? "展开详情栏" : "收起详情栏"}
                aria-expanded={!inspectorCollapsed}
                onClick={() => setInspectorCollapsed((current) => !current)}
              >
                <span className="inspector-toggle-glyph" aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip title="设置">
              <IconButton
                aria-label="打开设置"
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
          <TaskDialogTitle icon={<SettingsRoundedIcon />} title="设置" subtitle="外观与诊断" onClose={() => setSettingsDialogOpen(false)} />
          <DialogContent className="settings-dialog-content">
            <Typography className="settings-section-label" variant="subtitle2">
              色调模式
            </Typography>
            <ToggleButtonGroup
              className="theme-mode-selector"
              value={themePreference}
              exclusive
              onChange={(_, value: ThemePreference | null) => {
                if (value) {
                  setThemePreference(value);
                }
              }}
              aria-label="色调模式"
            >
              <ToggleButton value="system" aria-label="跟随系统">
                <ComputerRoundedIcon />
                <span>跟随系统</span>
              </ToggleButton>
              <ToggleButton value="light" aria-label="浅色">
                <LightModeRoundedIcon />
                <span>浅色</span>
              </ToggleButton>
              <ToggleButton value="dark" aria-label="深色">
                <DarkModeRoundedIcon />
                <span>深色</span>
              </ToggleButton>
            </ToggleButtonGroup>
            <Divider className="settings-section-divider" />
            <Box className="settings-doctor-heading">
              <Box>
                <Typography className="settings-section-label" variant="subtitle2">
                  运行诊断
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  只读检查本地配置，报告会自动隐藏敏感信息。
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  isActionBusy(actionKeys.doctor) ? (
                    <CircularProgress size={15} />
                  ) : (
                    <FactCheckRoundedIcon />
                  )
                }
                disabled={isActionBusy(actionKeys.doctor)}
                onClick={() => void handleRunDoctor()}
              >
                {doctorReport ? "重新检查" : "开始检查"}
              </Button>
            </Box>
            {doctorError ? <Alert severity="error">{doctorError}</Alert> : null}
            {doctorReport ? (
              <Box className="doctor-report" aria-live="polite">
                <Box className={`doctor-summary ${doctorReport.ready ? "ready" : "error"}`}>
                  <FactCheckRoundedIcon />
                  <Box>
                    <Typography variant="subtitle2">
                      {doctorReport.ready ? "核心功能可用" : "发现需要处理的问题"}
                    </Typography>
                    <Typography variant="caption">
                      {doctorReport.summary.okCount} 正常 · {doctorReport.summary.warningCount} 提醒 · {doctorReport.summary.errorCount} 错误
                    </Typography>
                  </Box>
                  <span>{doctorReport.platform}</span>
                </Box>
                <Box className="doctor-check-list">
                  {doctorReport.checks.map((check) => (
                    <Box className={`doctor-check-row ${check.status}`} key={check.id}>
                      <Box className="doctor-check-icon" aria-label={doctorStatusLabel(check.status)}>
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
                <Typography variant="caption">尚未运行诊断</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              startIcon={<ContentCopyRoundedIcon />}
              disabled={!doctorReport}
              onClick={handleCopyDoctorReport}
            >
              复制报告
            </Button>
            <Button variant="contained" onClick={() => setSettingsDialogOpen(false)}>完成</Button>
          </DialogActions>
        </Dialog>

        <ServerNodesDialog
          open={serverNodesDialogOpen}
          onClose={() => setServerNodesDialogOpen(false)}
          onFeedback={setFeedback}
        />

        <Box className={`workbench-grid ${inspectorCollapsed ? "inspector-collapsed" : ""}`}>
          <main id="profile-browser" className="profile-browser">
            <Paper className="browser-panel" elevation={0}>
              <Box className="browser-header">
                <Box className="browser-title">
                  <Typography variant="h5" component="h1">Profiles</Typography>
                  <Typography className="browser-subtitle" variant="caption">
                    Codex profile 工作区
                  </Typography>
                </Box>
              </Box>

              <Box className="browser-action-row">
                <FeatureCommandGrid items={featureCommands} />
              </Box>

              <Box className="browser-tools">
                <Box className="filter-row">
                  <TextField
                    className="search-field"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索 profile、账号或会话"
                    slotProps={{
                      htmlInput: {
                        "aria-label": "搜索 profile",
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
                        "aria-label": "分类筛选",
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
                </Box>
                <Box className="status-filter-strip" aria-label="状态筛选">
                  {statusFilterOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`status-filter-chip ${statusFilter === option.key ? "selected" : ""}`}
                      aria-pressed={statusFilter === option.key}
                      onClick={() => setStatusFilter(option.key)}
                    >
                      {renderStatusFilterIcon(option.key)}
                      <span>{option.label}</span>
                      <strong>{option.count}</strong>
                    </button>
                  ))}
                  <Stack className="profile-icon-actions status-filter-actions" direction="row" spacing={0.4}>
                    <Tooltip title="新增 profile">
                      <IconButton aria-label="新增 profile" onClick={() => setCreateDialogOpen(true)}>
                        <AddRoundedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="刷新 profile">
                      <span>
                        <IconButton
                          aria-label="刷新 profile 列表"
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
                <Box className="profile-grid" aria-label="profile 列表">
                  <Box className="profile-list-header" aria-hidden="true">
                    <Box className="profile-header-main">
                      <span>Profile</span>
                      <span>分类</span>
                      <span>账号</span>
                      <span>最近会话</span>
                      <span>状态</span>
                    </Box>
                    <span className="profile-action-header">操作</span>
                  </Box>
                  {profiles.length === 0 ? (
                    <Box className="empty-state list-empty">
                      <TerminalRoundedIcon />
                      <Typography variant="body2">没有 profile。</Typography>
                    </Box>
                  ) : visibleProfiles.length === 0 ? (
                    <Box className="empty-state list-empty">
                      <SearchRoundedIcon />
                      <Typography variant="body2">没有匹配结果。</Typography>
                    </Box>
                  ) : (
                    visibleProfiles.map((profile) => (
                      <ProfileCard
                        key={profile.name}
                        profile={profile}
                        selected={activeProfile?.name === profile.name}
                        onSelect={() => selectProfileAndOpenInspector(profile.name)}
                        onContextMenu={(event) => handleOpenProfileContextMenu(event, profile)}
                        onLaunch={() => void handleLaunchProfile(profile)}
                        onTerminate={() => void handleTerminateProfile(profile)}
                        busy={isActionBusy(actionKeys.profileLifecycle(profile.name))}
                      />
                    ))
                  )}
                </Box>
                <Box className="profile-list-footer">
                  <Typography variant="caption">共 {visibleProfiles.length} 个 profile</Typography>
                  <Stack direction="row" spacing={0.5} className="profile-page-controls">
                    <IconButton aria-label="上一页" disabled>
                      <KeyboardArrowLeftRoundedIcon fontSize="small" />
                    </IconButton>
                    <span>1</span>
                    <IconButton aria-label="下一页" disabled={visibleProfiles.length <= 100}>
                      <KeyboardArrowRightRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Button
                    className="profile-page-size"
                    size="small"
                    variant="outlined"
                    endIcon={<KeyboardArrowDownRoundedIcon />}
                  >
                    100 条/页
                  </Button>
                </Box>
              </Box>
            </Paper>
          </main>

          <aside className="inspector-rail" aria-label="profile 详情" hidden={inspectorCollapsed}>
            <Paper className="inspector-panel" elevation={0}>
              {activeProfile ? (
                <Box className="inspector-content">
                  <Box className="inspector-hero">
                    <Box className="inspector-title">
                      <Box className="inspector-title-main">
                        <Typography variant="caption" color="text.secondary">
                          当前 profile
                        </Typography>
                        <Typography variant="h5" component="h2" translate="no">
                          {activeProfile.alias || activeProfile.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" translate="no">
                          {activeProfile.name}
                        </Typography>
                      </Box>
                      <Stack className="inspector-title-badges" direction="row" spacing={0.5}>
                        <Chip size="small" label={profileSourceLabel(activeProfile)} />
                      </Stack>
                    </Box>

                    <Box className="detail-tags">
                      <Chip size="small" variant="outlined" label={activeProfile.category} />
                      <Chip size="small" label={activeProfile.model ?? "unknown"} />
                      <Chip size="small" label={activeProfile.reasoningEffort ?? "unknown"} />
                    </Box>

                    <Box className="inspector-primary-actions" aria-label="profile 常用操作">
                      <Button
                        className={`hero-launch-action ${activeProfile.isRunning ? "running" : ""}`}
                        variant={activeProfile.isRunning ? "outlined" : "contained"}
                        startIcon={<PlayArrowRoundedIcon />}
                        onClick={() => void handleLaunchProfile(activeProfile)}
                        disabled={isActionBusy(actionKeys.profileLifecycle(activeProfile.name)) || activeProfile.isRunning}
                      >
                        {activeProfile.isRunning ? "运行中" : "启动"}
                      </Button>
                      <Button
                        className="hero-repair-action"
                        variant="outlined"
                        startIcon={<SettingsEthernetRoundedIcon />}
                        onClick={() => void handleRepairNetwork(activeProfile)}
                        disabled={isActionBusy(actionKeys.profileRepair(activeProfile.name))}
                      >
                        修复 WS
                      </Button>
                      <Button
                        className="hero-quota-action"
                        variant="outlined"
                        startIcon={<BarChartRoundedIcon />}
                        onClick={() => void handleReadQuota(activeProfile)}
                        disabled={
                          !activeProfile.account ||
                          Boolean(quotaByProfile[activeProfile.name]?.loading)
                        }
                      >
                        {quotaByProfile[activeProfile.name]?.report ? "刷新额度" : "查额度"}
                      </Button>
                    </Box>

                    <Box className="profile-health-strip" aria-label="profile 状态">
                      <span className={`health-item ${activeProfile.account ? "good" : "muted"}`}>
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                        {activeProfile.account ? "已登录" : "未登录"}
                      </span>
                      <span className={`health-item ${activeProfile.homeExists && activeProfile.userDataExists ? "good" : "warning"}`}>
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                        {activeProfile.homeExists && activeProfile.userDataExists ? "路径正常" : "路径需检查"}
                      </span>
                      <span className="health-item">
                        <StarOutlineRoundedIcon fontSize="small" />
                        {activeProfile.isDefault ? "默认 profile" : profileSourceLabel(activeProfile)}
                      </span>
                    </Box>
                  </Box>

                  <Box className="inspector-body">
                    <Box className="inspector-system-list">
                      <PathBlock title="CODEX_HOME" path={activeProfile.codexHome} exists={activeProfile.homeExists} />
                      <PathBlock
                        title="User Data"
                        path={activeProfile.userDataDir}
                        exists={activeProfile.userDataExists}
                      />

                      <AccountBlock profile={activeProfile} />
                    </Box>

                    <SessionBlock session={activeProfile.latestSession} />

                    <QuotaBlock
                      profile={activeProfile}
                      state={quotaByProfile[activeProfile.name]}
                      onRefresh={() => void handleReadQuota(activeProfile)}
                    />
                  </Box>

                  <Box className="inspector-action-dock">
                    <Box className="secondary-action-bar" aria-label="低风险维护操作">
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyRoundedIcon />}
                        onClick={() => handleOpenCopyDialog(activeProfile)}
                      >
                        复制
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<EditRoundedIcon />}
                        onClick={() => setEditDialogOpen(true)}
                      >
                        编辑
                      </Button>
                    </Box>
                  </Box>

                </Box>
              ) : (
                <Box className="empty-state tall">
                  <TerminalRoundedIcon />
                  <Typography variant="body2">选择一个 profile。</Typography>
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
          {contextMenuProfile ? (
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
                <span>{contextMenuProfile.isRunning ? "停止运行" : "启动 profile"}</span>
              </MenuItem>

              <Divider className="profile-context-menu-divider" />

              <MenuItem
                onClick={() => runProfileContextAction((profile) => void revealPath(profile.codexHome))}
                disabled={!contextMenuProfile.homeExists}
              >
                <FolderRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>打开 CODEX_HOME</span>
              </MenuItem>
              <MenuItem
                onClick={() => runProfileContextAction((profile) => void revealPath(profile.userDataDir))}
                disabled={!contextMenuProfile.userDataExists}
              >
                <FolderRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>打开 User Data</span>
              </MenuItem>

              <Divider className="profile-context-menu-divider" />

              <MenuItem
                onClick={() => runProfileContextAction(handleOpenCopyDialog)}
              >
                <ContentCopyRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>复制 profile</span>
              </MenuItem>
              <MenuItem
                onClick={() => runProfileContextAction(openEditDialogForProfile)}
              >
                <EditRoundedIcon className="profile-context-menu-icon" fontSize="small" />
                <span>编辑信息</span>
              </MenuItem>
            </>
          ) : null}
        </Menu>

        <SessionCenterDialog
          open={sessionDialogOpen}
          items={sessionItems}
          profiles={profiles}
          report={sessionReport}
          activeProfileName={activeProfile?.name ?? ""}
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
          activeProfileName={activeProfile?.name ?? ""}
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

        <WechatBridgeDialog
          open={wechatDialogOpen}
          report={wechatReport}
          feishuReport={feishuReport}
          loading={wechatLoading}
          feishuLoading={feishuLoading}
          error={wechatError}
          feishuError={feishuError}
          busy={isActionBusy("remote.")}
          activeProfileName={activeProfile?.name ?? ""}
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
          activeProfileName={activeProfile?.name ?? ""}
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
          <TaskDialogTitle icon={<AddRoundedIcon />} title="新增 profile" subtitle="新建独立工作区" onClose={() => setCreateDialogOpen(false)} />
          <DialogContent>
            <Box className="create-dialog-grid">
              <TextField
                label="命令"
                value={createDraft.name}
                onChange={(event) => updateCreateDraft("name", event.target.value)}
                error={createNameExists}
                helperText={createNameExists ? "已存在" : "codex-*"}
                slotProps={textFieldSlotProps("create-profile-name")}
              />
              <TextField
                label="别名"
                value={createDraft.alias ?? ""}
                onChange={(event) => updateCreateDraft("alias", event.target.value)}
                slotProps={textFieldSlotProps("create-profile-alias")}
              />
              <TextField
                label="分类"
                value={createDraft.category ?? ""}
                onChange={(event) => updateCreateDraft("category", event.target.value)}
                slotProps={textFieldSlotProps("create-profile-category")}
              />
              <TextField
                label="模型"
                value={createDraft.model ?? ""}
                onChange={(event) => updateCreateDraft("model", event.target.value)}
                slotProps={textFieldSlotProps("create-profile-model")}
              />
              <TextField
                label="努力等级"
                value={createDraft.reasoningEffort ?? ""}
                onChange={(event) => updateCreateDraft("reasoningEffort", event.target.value)}
                slotProps={textFieldSlotProps("create-profile-reasoning-effort")}
              />
              <TextField
                label="CODEX_HOME"
                value={createDraft.codexHome ?? ""}
                onChange={(event) => updateCreateDraft("codexHome", event.target.value)}
                placeholder="留空自动生成…"
                slotProps={textFieldSlotProps("create-profile-codex-home")}
              />
              <TextField
                label="user-data-dir"
                value={createDraft.userDataDir ?? ""}
                onChange={(event) => updateCreateDraft("userDataDir", event.target.value)}
                placeholder="留空自动生成…"
                slotProps={textFieldSlotProps("create-profile-user-data-dir")}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={() => void handleCreateProfile()}
              disabled={!canCreate || isActionBusy(actionKeys.profileCreate)}
            >
              新增
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog" open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<EditRoundedIcon />} title="编辑 profile" subtitle={activeProfile?.name} onClose={() => setEditDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <TextField
                label="别名"
                value={metadataDraft.alias}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, alias: event.target.value }))
                }
                slotProps={textFieldSlotProps("edit-profile-alias")}
              />
              <TextField
                label="分类"
                value={metadataDraft.category}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, category: event.target.value }))
                }
                slotProps={textFieldSlotProps("edit-profile-category")}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={() => void handleSaveMetadata()}
              disabled={
                !metadataChanged ||
                Boolean(activeProfile && isActionBusy(actionKeys.profileMetadata(activeProfile.name)))
              }
            >
              保存
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog danger-task-dialog" open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<DeleteOutlineRoundedIcon />} title="删除 profile" subtitle={activeProfile?.name} onClose={() => setDeleteDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                默认只移除 `.zshrc` 启动函数。
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={archiveOnDelete}
                    onChange={(event) => setArchiveOnDelete(event.target.checked)}
                  />
                }
                label="归档 profile 目录"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void handleDeleteProfile()}
              disabled={Boolean(activeProfile && isActionBusy(actionKeys.profileDelete(activeProfile.name)))}
            >
              删除
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog import-auth-dialog" open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm">
          <TaskDialogTitle icon={<FileUploadRoundedIcon />} title="导入账号" subtitle={activeProfile?.name} onClose={() => setImportDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1.4} sx={{ pt: 1 }}>
              {activeProfile?.isDefault ? (
                <Alert severity="warning">默认 codex 受保护。为避免影响正在使用的主账号，不支持覆盖导入。</Alert>
              ) : activeProfile?.isRunning ? (
                <Alert severity="warning">目标 profile 正在运行。为避免影响正在使用的 Codex，请先终止目标实例。</Alert>
              ) : (
                <Alert severity="info">
                  只会写入当前目标的 CODEX_HOME/auth.json；已有 auth.json 会先复制备份。
                </Alert>
              )}
              <TextField
                label="来源 JSON 路径"
                value={importSourcePath}
                onChange={(event) => setImportSourcePath(event.target.value)}
                placeholder="另一个 profile 的 auth.json，或 ChatGPT session JSON…"
                slotProps={textFieldSlotProps("import-auth-source-path")}
              />
              <Typography variant="caption" color="text.secondary">
                目标：{activeProfile ? `${activeProfile.codexHome}/auth.json` : ""}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmImportSensitive}
                    onChange={(event) => setConfirmImportSensitive(event.target.checked)}
                  />
                }
                label="我确认来源可信，并理解会覆盖目标 profile 的登录状态"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
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
              导入
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog className="app-task-dialog compact-task-dialog" open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="xs">
          <TaskDialogTitle icon={<RestartAltRoundedIcon />} title="重置 profile" subtitle={activeProfile?.name} onClose={() => setResetDialogOpen(false)} />
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <TextField
                label="模型"
                value={resetDraft.model}
                onChange={(event) => setResetDraft((current) => ({ ...current, model: event.target.value }))}
                slotProps={textFieldSlotProps("reset-profile-model")}
              />
              <TextField
                label="努力等级"
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
                label="重置 user-data-dir"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={() => void handleResetProfile()}
              disabled={Boolean(activeProfile && isActionBusy(actionKeys.profileReset(activeProfile.name)))}
            >
              重置
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function buildSessionSummaryText(item: SessionCenterItem): string {
  const { profile, session } = item;
  return [
    `Profile: ${profileLabel(profile)} (${profile.name})`,
    `Profile Type: ${profile.category}`,
    `Title: ${session.title}`,
    session.renamedTitle ? `Renamed Title: ${session.renamedTitle}` : null,
    session.summary ? `Summary: ${session.summary}` : null,
    session.cwd ? `CWD: ${session.cwd}` : null,
    `Time: ${formatSessionTime(session.updatedAt ?? session.startedAt)}`,
    session.path ? `Path: ${session.path}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSessionReferenceText(item: SessionCenterItem, targetProfile: ProfileInfo | null): string {
  const { profile, session } = item;
  return [
    "请参考下面这个 Codex 会话摘要继续工作。",
    "",
    `目标 profile: ${targetProfile ? `${profileLabel(targetProfile)} (${targetProfile.name})` : "当前 profile"}`,
    `来源 profile: ${profileLabel(profile)} (${profile.name})`,
    `来源类型: ${profile.category}`,
    `会话标题: ${session.title}`,
    session.renamedTitle ? `重命名标题: ${session.renamedTitle}` : null,
    session.summary ? `会话摘要: ${session.summary}` : null,
    session.cwd ? `工作目录: ${session.cwd}` : null,
    `时间: ${formatSessionTime(session.updatedAt ?? session.startedAt)}`,
    session.path ? `源会话文件: ${session.path}` : null,
    "",
    "只把它作为只读背景参考，不要修改或迁移源会话文件。",
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
  nameExists: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSourceChange: (value: string) => void;
  onDraftChange: <K extends keyof CopyProfileInput>(key: K, value: CopyProfileInput[K]) => void;
  onSubmit: () => void;
}) {
  const sourceProfile = draft
    ? profiles.find((profile) => profile.name === draft.sourceName) ?? null
    : null;
  const authOptions = authProfiles.filter((profile) => profile.authExists);
  const selectedAuthSource = draft?.authSourceName ?? NO_AUTH_SOURCE;
  const authSelected = selectedAuthSource !== NO_AUTH_SOURCE;

  return (
    <Dialog className="app-task-dialog copy-profile-dialog" open={open} onClose={onClose} fullWidth maxWidth="sm">
      <TaskDialogTitle icon={<ContentCopyRoundedIcon />} title="复制 profile" subtitle={sourceProfile ? `来源：${profileLabel(sourceProfile)}` : undefined} onClose={onClose} />
      <DialogContent>
        {draft ? (
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Box className="copy-dialog-summary">
              <Typography variant="subtitle2" translate="no">
                {sourceProfile ? profileLabel(sourceProfile) : draft.sourceName}
              </Typography>
              <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", rowGap: 0.6 }}>
                <Chip size="small" label={sourceProfile?.category ?? "未知"} />
                <Chip size="small" label={sourceProfile?.model ?? draft.model ?? "unknown"} />
                <Chip size="small" label={sourceProfile?.reasoningEffort ?? draft.reasoningEffort ?? "unknown"} />
              </Stack>
            </Box>
            <Box className="copy-dialog-grid">
              <TextField
                select
                label="来源 profile"
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
                label="新命令"
                value={draft.name}
                onChange={(event) => onDraftChange("name", event.target.value)}
                error={nameExists || (draft.name.trim() !== "" && !isValidProfileName(draft.name))}
                helperText={nameExists ? "已存在" : "codex-*"}
                slotProps={textFieldSlotProps("copy-profile-name")}
              />
              <TextField
                label="别名"
                value={draft.alias ?? ""}
                onChange={(event) => onDraftChange("alias", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-alias")}
              />
              <TextField
                label="分类"
                value={draft.category ?? ""}
                onChange={(event) => onDraftChange("category", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-category")}
              />
              <TextField
                label="模型"
                value={draft.model ?? ""}
                onChange={(event) => onDraftChange("model", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-model")}
              />
              <TextField
                label="努力等级"
                value={draft.reasoningEffort ?? ""}
                onChange={(event) => onDraftChange("reasoningEffort", event.target.value)}
                slotProps={textFieldSlotProps("copy-profile-reasoning-effort")}
              />
              <TextField
                label="CODEX_HOME"
                value={draft.codexHome ?? ""}
                onChange={(event) => onDraftChange("codexHome", event.target.value)}
                placeholder="留空自动生成…"
                slotProps={textFieldSlotProps("copy-profile-codex-home")}
              />
              <TextField
                label="user-data-dir"
                value={draft.userDataDir ?? ""}
                onChange={(event) => onDraftChange("userDataDir", event.target.value)}
                placeholder="留空自动生成…"
                slotProps={textFieldSlotProps("copy-profile-user-data-dir")}
              />
              <TextField
                className="copy-dialog-wide"
                select
                label="认证来源"
                value={selectedAuthSource}
                onChange={(event) => {
                  const value = event.target.value;
                  onDraftChange("authSourceName", value);
                  onDraftChange("confirmSensitive", false);
                }}
                slotProps={textFieldSlotProps("copy-auth-source")}
              >
                <MenuItem value={NO_AUTH_SOURCE}>不复制 auth</MenuItem>
                {authLoading ? <MenuItem disabled>正在读取认证信息…</MenuItem> : null}
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
                  label="我确认要把所选认证写入新 profile"
                />
              </Alert>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!canSubmit || busy}>
          复制
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProfileCard({
  profile,
  selected,
  onSelect,
  onContextMenu,
  onLaunch,
  onTerminate,
  busy,
}: {
  profile: ProfileInfo;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onLaunch: () => void;
  onTerminate: () => void;
  busy: boolean;
}) {
  const canTerminate = profile.isRunning && !profile.isDefault;
  const iconTitle = profile.isDefault && profile.isRunning ? "默认 codex 请手动退出" : profile.isRunning ? "终止" : "启动";
  const statusLabel = profile.isRunning ? "运行中" : profile.account ? "已登录" : "未登录";
  const statusTone = profile.isRunning ? "running" : profile.account ? "signed-in" : "signed-out";

  return (
    <Box className={`profile-card ${selected ? "selected" : ""}`} onContextMenu={onContextMenu}>
      <button
        type="button"
        className="profile-card-main"
        aria-pressed={selected}
        aria-current={selected ? "true" : undefined}
        onPointerDown={onSelect}
        onClick={onSelect}
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
          <Typography variant="caption">{accountLabel(profile)}</Typography>
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
                {formatSessionTime(profile.latestSession.updatedAt ?? profile.latestSession.startedAt)}
              </Typography>
            </>
          ) : (
            <Typography className="profile-session-time" variant="caption">暂无会话</Typography>
          )}
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
              className={`profile-action-button ${profile.isRunning ? "running" : "idle"}`}
              aria-label={`${profile.isRunning ? "终止" : "启动"} ${profile.name}`}
              onClick={(event) => {
                event.stopPropagation();
                if (canTerminate) {
                  onTerminate();
                } else if (!profile.isRunning) {
                  onLaunch();
                }
              }}
              disabled={busy || (profile.isDefault && profile.isRunning)}
            >
              {profile.isRunning ? (
                <StopCircleRoundedIcon fontSize="small" />
              ) : (
                <PlayArrowRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

function SessionBlock({ session }: { session: CodexSessionSummary | null }) {
  return (
    <Box className="session-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <ChatBubbleOutlineRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">最新会话</Typography>
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
            打开
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
                暂无摘要内容
              </Typography>
            )}
            <Stack className="session-meta" direction="row" spacing={0.8}>
              <Typography variant="caption">{formatSessionTime(session.updatedAt ?? session.startedAt)}</Typography>
              {session.cwd ? (
                <Typography variant="caption" translate="no" title={session.cwd}>
                  {compactPath(session.cwd)}
                </Typography>
              ) : null}
            </Stack>
          </Box>
          <Tooltip title="打开会话">
            <span>
              <IconButton
                className="session-open-button"
                aria-label="打开最新会话"
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
          暂无会话摘要
        </Typography>
      )}
    </Box>
  );
}

function AccountBlock({ profile }: { profile: ProfileInfo }) {
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
              : "未在该 CODEX_HOME 中发现可展示账号"}
          </Typography>
        </Box>
        <Tooltip title="复制账号">
          <span>
            <IconButton
              className="account-copy-button"
              aria-label="复制账号"
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
  state: QuotaState | undefined;
  onRefresh: () => void;
}) {
  const loading = state?.loading ?? false;
  const report = state?.report ?? null;
  const error = state?.error ?? null;
  const disabled = loading || !profile.account;

  return (
    <Box className="quota-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
          <DataUsageRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">额度</Typography>
        </Stack>
        <Button size="small" variant="text" onClick={onRefresh} disabled={disabled}>
          {report ? "刷新" : "查询"}
        </Button>
      </Stack>

      {loading ? <LinearProgress className="quota-progress" /> : null}

      {!profile.account ? (
        <Typography className="quota-muted" variant="caption">
          未登录
        </Typography>
      ) : error ? (
        <Typography className="quota-error" variant="caption">
          {error}
        </Typography>
      ) : report ? (
        <Box className="quota-window-list">
          {report.windows.map((window) => (
            <QuotaWindowRow key={window.id} window={window} />
          ))}
        </Box>
      ) : (
        <Typography className="quota-muted" variant="caption">
          未查询
        </Typography>
      )}
    </Box>
  );
}

function QuotaWindowRow({ window }: { window: QuotaWindowInfo }) {
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
        <Typography variant="caption">{formatResetAt(window.resetsAt)}</Typography>
      </Stack>
    </Box>
  );
}

function renderStatusFilterIcon(key: string) {
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

function formatResetAt(value: number | null): string {
  if (value === null) {
    return "reset --";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

function formatSessionTime(value: string | null): string {
  if (!value) {
    return "时间 --";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
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
  return (
    <Box className="path-block">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack className="path-title" direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <FolderRoundedIcon fontSize="small" />
          <Typography variant="subtitle2" component="span">{title}</Typography>
        </Stack>
        <Stack className="path-actions" direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Chip size="small" label={exists ? "已存在" : "缺失"} color={exists ? "success" : "warning"} />
          <Tooltip title="打开路径">
            <span>
              <IconButton
                className="path-open-button"
                aria-label={`打开 ${title}`}
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
