import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import DataUsageRoundedIcon from "@mui/icons-material/DataUsageRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import ShortcutRoundedIcon from "@mui/icons-material/ShortcutRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
} from "@mui/material";
import "./App.css";
import {
  applyAuthBackup,
  cleanupAuthBackups,
  copyProfile,
  createAuthBackup,
  createProfile,
  deleteProfile,
  deleteAuthBackup,
  exportAuthBackup,
  importAuthBackupPackage,
  importProfileAuth,
  listAuthVault,
  listWechatBridges,
  launchProfile,
  listProfileSessions,
  listProfiles,
  readProfileQuota,
  readWechatBridgeLog,
  repairProfileNetwork,
  resetProfile,
  revealPath,
  rollbackAuthApplication,
  startWechatBridge,
  stopWechatBridge,
  terminateProfile,
  updateProfileMetadata,
  updateAuthBackup,
} from "./lib/api";
import type {
  AuthApplicationEntry,
  AuthBackupEntry,
  AuthProfileSlot,
  AuthVaultReport,
  CodexSessionSummary,
  CopyProfileInput,
  CreateProfileInput,
  ProfileInfo,
  ProfileReport,
  ProfileSessionReport,
  WechatBridgeEntry,
  WechatBridgeReport,
} from "./lib/types";
import type { ProfileQuotaReport, QuotaWindowInfo } from "./lib/types";
import {
  createRcodexManagerTheme,
  type CodexManagerStyleMode,
} from "./theme/rcodexmanager-theme";

type FeedbackState = {
  severity: "success" | "info" | "warning" | "error";
  text: string;
};

type AuthBackupGroup = {
  key: string;
  accountKey: string;
  label: string;
  backups: AuthBackupEntry[];
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

const SESSION_PAGE_SIZE = 10;
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

function initialStyleMode(): CodexManagerStyleMode {
  const stored = window.localStorage.getItem("rcodexmanager-style");
  return stored === "dark" ? "dark" : "light";
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

function App() {
  const [styleMode, setStyleMode] = useState<CodexManagerStyleMode>(initialStyleMode);
  const theme = useMemo(() => createRcodexManagerTheme(styleMode), [styleMode]);
  const [report, setReport] = useState<ProfileReport | null>(null);
  const [activeName, setActiveName] = useState("");
  const [query, setQuery] = useState("");
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
  const [busyLabel, setBusyLabel] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [quotaByProfile, setQuotaByProfile] = useState<Record<string, QuotaState>>({});
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionReport, setSessionReport] = useState<ProfileSessionReport | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionProfileName, setSessionProfileName] = useState("all");
  const [sessionCategory, setSessionCategory] = useState("all");
  const [sessionPage, setSessionPage] = useState(1);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authReport, setAuthReport] = useState<AuthVaultReport | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authProfileName, setAuthProfileName] = useState("");
  const [authBackupLabel, setAuthBackupLabel] = useState("");
  const [selectedAuthBackupId, setSelectedAuthBackupId] = useState("");
  const [selectedAuthProfileNames, setSelectedAuthProfileNames] = useState<string[]>([]);
  const [confirmAuthApply, setConfirmAuthApply] = useState(false);
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [wechatReport, setWechatReport] = useState<WechatBridgeReport | null>(null);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatProfileName, setWechatProfileName] = useState("");
  const sessionRequestIdRef = useRef(0);

  const profiles = report?.profiles ?? [];
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.name === activeName) ?? profiles[0] ?? null,
    [activeName, profiles],
  );
  const existingNames = useMemo(() => new Set(profiles.map((profile) => profile.name)), [profiles]);
  const visibleProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (!normalizedQuery) {
        return true;
      }
      return [
        profile.name,
        profile.alias ?? "",
        profile.category,
        profile.model ?? "",
        profile.reasoningEffort ?? "",
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
  }, [profiles, query]);
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
  const runningCount = useMemo(
    () => profiles.filter((profile) => profile.isRunning).length,
    [profiles],
  );
  const signedInCount = useMemo(
    () => profiles.filter((profile) => Boolean(profile.account)).length,
    [profiles],
  );
  const wechatBoundCount = useMemo(
    () => wechatReport?.bridges.filter((bridge) => bridge.tokenExists).length ?? 0,
    [wechatReport],
  );
  const sessionCountLabel = sessionReport
    ? `${sessionReport.sessionCount}${sessionReport.hasMore ? "+" : ""}`
    : "按页";
  const authCountLabel = authReport ? `${authReport.backupCount}` : `${signedInCount}`;
  const wechatCountLabel = wechatReport
    ? `${wechatReport.runningCount}/${wechatBoundCount}`
    : `${wechatBoundCount}`;
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

  useEffect(() => {
    window.localStorage.setItem("rcodexmanager-style", styleMode);
    document.documentElement.dataset.style = styleMode;
  }, [styleMode]);

  async function refreshProfiles(nextFeedback?: FeedbackState) {
    try {
      setBusyLabel("刷新中");
      const nextReport = await listProfiles();
      setReport(nextReport);
      setActiveName((current) => {
        if (nextReport.profiles.some((profile) => profile.name === current)) {
          return current;
        }
        return nextReport.profiles[0]?.name ?? "";
      });
      setSessionReport(null);
      setSessionProfileName("all");
      setFeedback(nextFeedback ?? null);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取 profile 失败"),
      });
    } finally {
      setBusyLabel("");
    }
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
      const nextReport = await listProfileSessions({
        profileName: nextProfileName === "all" ? null : nextProfileName,
        category: nextCategory === "all" ? null : nextCategory,
        query: nextQuery.trim() || null,
        offset: (Math.max(nextPage, 1) - 1) * SESSION_PAGE_SIZE,
        limit: SESSION_PAGE_SIZE,
      });
      if (requestId !== sessionRequestIdRef.current) {
        return;
      }
      setSessionReport(nextReport);
    } catch (error) {
      if (requestId !== sessionRequestIdRef.current) {
        return;
      }
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取会话中心失败"),
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
      const nextReport = await listAuthVault();
      setAuthReport(nextReport);
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
      setSelectedAuthProfileNames((current) => {
        const backupableNames = new Set(
          nextReport.profiles.filter((profile) => profile.authExists).map((profile) => profile.profileName),
        );
        const kept = current.filter((name) => backupableNames.has(name));
        if (kept.length > 0) {
          return kept;
        }
        if (activeProfile?.name && backupableNames.has(activeProfile.name)) {
          return [activeProfile.name];
        }
        return [];
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取认证库失败"),
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
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取微信桥接失败"),
      });
    } finally {
      if (!options?.silent) {
        setWechatLoading(false);
      }
    }
  }

  function handleOpenSessionCenter() {
    setSessionDialogOpen(true);
  }

  function handleOpenAuthVault() {
    setAuthDialogOpen(true);
    setConfirmAuthApply(false);
    setAuthProfileName(activeProfile?.name ?? authProfileName);
    if (!authReport && !authLoading) {
      void refreshAuthVault();
    }
  }

  function handleOpenWechatBridge() {
    setWechatDialogOpen(true);
    setWechatProfileName(activeProfile?.name ?? wechatProfileName);
    if (!wechatReport && !wechatLoading) {
      void refreshWechatBridges();
    }
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
    const timeout = window.setTimeout(() => {
      void refreshProfileSessions({
        query: sessionQuery,
        profileName: sessionProfileName,
        category: sessionCategory,
        page: sessionPage,
      });
    }, sessionQuery.trim() ? 280 : 0);
    return () => window.clearTimeout(timeout);
  }, [sessionDialogOpen, sessionQuery, sessionProfileName, sessionCategory, sessionPage]);

  useEffect(() => {
    if (authDialogOpen && !authReport && !authLoading) {
      void refreshAuthVault();
    }
  }, [authDialogOpen, authReport, authLoading]);

  useEffect(() => {
    if (wechatDialogOpen && !wechatReport && !wechatLoading) {
      void refreshWechatBridges();
    }
  }, [wechatDialogOpen, wechatReport, wechatLoading]);

  useEffect(() => {
    if (
      !wechatDialogOpen ||
      !wechatReport?.bridges.some((bridge) => bridge.running && !bridge.tokenExists)
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshWechatBridges({ silent: true });
    }, 3500);
    return () => window.clearInterval(interval);
  }, [wechatDialogOpen, wechatReport]);

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

    try {
      setBusyLabel("创建中");
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
      setBusyLabel("");
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

    try {
      setBusyLabel("复制中");
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
      setBusyLabel("");
    }
  }

  async function handleSaveMetadata() {
    if (!activeProfile) {
      return;
    }

    try {
      setBusyLabel("保存中");
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
      setBusyLabel("");
    }
  }

  async function handleLaunchProfile(profile: ProfileInfo) {
    try {
      setBusyLabel("启动中");
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
      setBusyLabel("");
    }
  }

  async function handleTerminateProfile(profile: ProfileInfo) {
    if (profile.isDefault) {
      setFeedback({ severity: "warning", text: "默认 codex 不支持安全终止，请在 Codex 里手动退出。" });
      return;
    }

    try {
      setBusyLabel("终止中");
      const result = await terminateProfile(profile.name);
      await refreshProfiles({ severity: "success", text: result.message });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "终止失败"),
      });
    } finally {
      setBusyLabel("");
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

    try {
      setBusyLabel("删除中");
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
      setBusyLabel("");
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

    try {
      setBusyLabel("重置中");
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
      setBusyLabel("");
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

    try {
      setBusyLabel("导入中");
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
      setBusyLabel("");
    }
  }

  async function handleCreateAuthBackups(profileNames: string[]) {
    const requestedNames = new Set(profileNames);
    const selectedProfiles =
      authReport?.profiles.filter(
        (profile) => requestedNames.has(profile.profileName) && profile.authExists,
      ) ?? [];
    if (selectedProfiles.length === 0) {
      setFeedback({ severity: "warning", text: "请选择至少一个已有 auth.json 的 profile。" });
      return;
    }

    try {
      setBusyLabel(selectedProfiles.length > 1 ? "批量备份" : "备份认证");
      let nextReport: AuthVaultReport | null = authReport;
      for (const profile of selectedProfiles) {
        nextReport = await createAuthBackup({
          name: profile.profileName,
          label: selectedProfiles.length === 1 ? authBackupLabel.trim() || null : null,
        });
      }
      if (nextReport) {
        setAuthReport(nextReport);
        setSelectedAuthBackupId(nextReport.backups[0]?.id ?? "");
      }
      setAuthBackupLabel("");
      setFeedback({ severity: "success", text: `已备份 ${selectedProfiles.length} 个认证信息` });
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "备份认证失败"),
      });
    } finally {
      setBusyLabel("");
    }
  }

  async function handleImportAuthBackupPackage(file: File) {
    if (!file) {
      return;
    }
    if (!window.confirm(`导入认证备份包「${file.name}」到认证库？这不会覆盖任何 profile。`)) {
      return;
    }

    try {
      setBusyLabel("导入备份包");
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
      setBusyLabel("");
    }
  }

  async function handleApplyAuthBackup(backupId: string, targetProfileName: string) {
    if (!backupId || !targetProfileName) {
      setFeedback({ severity: "warning", text: "请选择备份和目标 profile。" });
      return;
    }

    try {
      setBusyLabel("应用认证");
      const result = await applyAuthBackup({
        backupId,
        targetProfileName,
        confirmSensitive: confirmAuthApply,
      });
      setConfirmAuthApply(false);
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
      setBusyLabel("");
    }
  }

  async function handleExportAuthBackup(backupId: string) {
    if (!backupId) {
      return;
    }

    try {
      setBusyLabel("导出备份");
      const result = await exportAuthBackup({ backupId });
      setFeedback({ severity: "success", text: `已导出认证备份：${result.fileName}` });
      void revealPath(result.path);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "导出认证备份失败"),
      });
    } finally {
      setBusyLabel("");
    }
  }

  async function handleRollbackAuthApplication(applicationId: string) {
    if (!applicationId) {
      return;
    }
    const application = authReport?.recentApplications.find((item) => item.id === applicationId);
    const targetLabel =
      application?.targetProfileLabel || application?.targetProfileName || "目标 profile";
    if (!window.confirm(`回滚 ${targetLabel} 到应用「${application?.backupLabel ?? applicationId}」之前的登录状态？`)) {
      return;
    }

    try {
      setBusyLabel("回滚认证");
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
      setBusyLabel("");
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

    try {
      setBusyLabel("保存备份");
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
      setBusyLabel("");
    }
  }

  async function handleCleanupAuthBackups(accountKey: string, accountLabel: string, count: number) {
    if (!accountKey || count <= 1) {
      return;
    }
    if (
      !window.confirm(
        `清理「${accountLabel}」的重复认证备份？会优先保留置顶备份，否则保留最新备份，并删除其余 ${count - 1} 份。`,
      )
    ) {
      return;
    }

    try {
      setBusyLabel("清理备份");
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
      setBusyLabel("");
    }
  }

  async function handleDeleteAuthBackup(backupId: string) {
    if (!backupId) {
      return;
    }
    const backup = authReport?.backups.find((item) => item.id === backupId);
    const label = backup?.label ?? backupId;
    if (!window.confirm(`删除认证备份「${label}」？`)) {
      return;
    }

    try {
      setBusyLabel("删除备份");
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
      setBusyLabel("");
    }
  }

  async function handleStartWechatBridge(profileName: string) {
    if (!profileName) {
      setFeedback({ severity: "warning", text: "请选择要绑定微信的 profile。" });
      return;
    }

    try {
      setBusyLabel("启动微信桥接");
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
      setBusyLabel("");
    }
  }

  async function handleStopWechatBridge(profileName: string) {
    if (!profileName) {
      return;
    }

    try {
      setBusyLabel("停止微信桥接");
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
      setBusyLabel("");
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

  async function handleRepairNetwork(profile: ProfileInfo) {
    try {
      setBusyLabel("修复网络");
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
      setBusyLabel("");
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
            {busyLabel ? <Chip size="small" label={busyLabel} /> : null}
            <Tooltip title={inspectorCollapsed ? "展开详情栏" : "收起详情栏"}>
              <button
                type="button"
                className="inspector-toggle-button window-inspector-toggle"
                aria-label={inspectorCollapsed ? "展开详情栏" : "收起详情栏"}
                aria-expanded={!inspectorCollapsed}
                onClick={() => setInspectorCollapsed((current) => !current)}
              >
                {inspectorCollapsed ? (
                  <KeyboardDoubleArrowLeftRoundedIcon fontSize="small" />
                ) : (
                  <KeyboardDoubleArrowRightRoundedIcon fontSize="small" />
                )}
              </button>
            </Tooltip>
            <Tooltip title={styleMode === "light" ? "暗色模式" : "亮色模式"}>
              <IconButton
                aria-label={styleMode === "light" ? "切换到暗色模式" : "切换到亮色模式"}
                onClick={() => setStyleMode(styleMode === "light" ? "dark" : "light")}
              >
                {styleMode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

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
                <Stack className="profile-icon-actions browser-header-actions" direction="row" spacing={0.4}>
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
                        disabled={Boolean(busyLabel)}
                      >
                        <RefreshRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>

              <Box className="browser-action-row">
                <Box className="browser-command-grid" aria-label="核心功能">
                  <button
                    type="button"
                    className="command-card"
                    onClick={handleOpenSessionCenter}
                  >
                    <span className="command-icon"><TerminalRoundedIcon fontSize="small" /></span>
                    <span className="command-copy">
                      <span className="command-title">会话中心</span>
                      <span className="command-subtitle">分页查看摘要</span>
                    </span>
                    <span className="command-count">{sessionCountLabel}</span>
                  </button>
                  <button
                    type="button"
                    className="command-card"
                    onClick={handleOpenAuthVault}
                  >
                    <span className="command-icon"><VpnKeyRoundedIcon fontSize="small" /></span>
                    <span className="command-copy">
                      <span className="command-title">认证库</span>
                      <span className="command-subtitle">{authReport ? "备份可应用" : "账号备份管理"}</span>
                    </span>
                    <span className="command-count">{authCountLabel}</span>
                  </button>
                  <button
                    type="button"
                    className="command-card"
                    onClick={handleOpenWechatBridge}
                  >
                    <span className="command-icon"><QrCodeScannerRoundedIcon fontSize="small" /></span>
                    <span className="command-copy">
                      <span className="command-title">微信桥接</span>
                      <span className="command-subtitle">扫码绑定 profile</span>
                    </span>
                    <span className="command-count">{wechatCountLabel}</span>
                  </button>
                </Box>
                <Box className="browser-status-strip" aria-label="profile 状态">
                  <span><strong>{visibleProfiles.length}/{profiles.length}</strong> profiles</span>
                  <span><strong>{runningCount}</strong> 运行</span>
                  <span><strong>{signedInCount}</strong> 账号</span>
                </Box>
              </Box>

              <Box className="browser-tools">
                <Box className="filter-row">
                  <TextField
                    className="search-field"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索 profile…"
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
                      },
                    }}
                  />
                </Box>
                <Box className="feedback-slot">
                  {feedback ? (
                    <Alert className="feedback-line" severity={feedback.severity} aria-live="polite">
                      {feedback.text}
                    </Alert>
                  ) : null}
                </Box>
              </Box>

              <Box className="profile-grid" aria-label="profile 列表">
                {visibleProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.name}
                    profile={profile}
                    selected={activeProfile?.name === profile.name}
                    onSelect={() => setActiveName(profile.name)}
                    onLaunch={() => void handleLaunchProfile(profile)}
                    onTerminate={() => void handleTerminateProfile(profile)}
                    busy={Boolean(busyLabel)}
                  />
                ))}
              </Box>

              {profiles.length === 0 ? (
                <Box className="empty-state">
                  <TerminalRoundedIcon />
                  <Typography variant="body2">没有 profile。</Typography>
                </Box>
              ) : visibleProfiles.length === 0 ? (
                <Box className="empty-state">
                  <SearchRoundedIcon />
                  <Typography variant="body2">没有匹配结果。</Typography>
                </Box>
              ) : null}
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
                  </Box>

                  <Box className="inspector-body">
                    <Box className="path-list">
                      <PathBlock title="CODEX_HOME" path={activeProfile.codexHome} exists={activeProfile.homeExists} />
                      <PathBlock
                        title="User Data"
                        path={activeProfile.userDataDir}
                        exists={activeProfile.userDataExists}
                      />
                    </Box>

                    <AccountBlock profile={activeProfile} />

                    <SessionBlock session={activeProfile.latestSession} />

                    <QuotaBlock
                      profile={activeProfile}
                      state={quotaByProfile[activeProfile.name]}
                      onRefresh={() => void handleReadQuota(activeProfile)}
                    />
                  </Box>

                  <Box className="inspector-action-dock">
                    <Box className="action-panel">
                      <Box className="action-strip runtime-actions">
                        <Button
                          className={`launch-action ${activeProfile.isRunning ? "running" : ""}`}
                          variant={activeProfile.isRunning ? "outlined" : "contained"}
                          startIcon={<PlayArrowRoundedIcon />}
                          onClick={() => void handleLaunchProfile(activeProfile)}
                          disabled={Boolean(busyLabel) || activeProfile.isRunning}
                        >
                          {activeProfile.isRunning ? "运行中" : "启动"}
                        </Button>
                        <Button
                          color="warning"
                          variant="outlined"
                          startIcon={<StopCircleRoundedIcon />}
                          onClick={() => void handleTerminateProfile(activeProfile)}
                          disabled={Boolean(busyLabel) || !activeProfile.isRunning || activeProfile.isDefault}
                        >
                          终止
                        </Button>
                      </Box>
                      <Box className="action-strip tool-actions">
                        <Button
                          className={`network-action ${
                            activeProfile.websocketFeaturesEnabled ? "enabled" : ""
                          }`}
                          variant="outlined"
                          startIcon={<SettingsEthernetRoundedIcon />}
                          onClick={() => void handleRepairNetwork(activeProfile)}
                          disabled={Boolean(busyLabel)}
                        >
                          {activeProfile.websocketFeaturesEnabled ? "WS 已启用" : "修复 WS"}
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<ContentCopyRoundedIcon />}
                          onClick={() => handleOpenCopyDialog(activeProfile)}
                          disabled={Boolean(busyLabel)}
                        >
                          复制
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<EditRoundedIcon />}
                          onClick={() => setEditDialogOpen(true)}
                          disabled={Boolean(busyLabel)}
                        >
                          编辑
                        </Button>
                      </Box>
                      <Box className="action-strip management-actions">
                        <Button
                          variant="outlined"
                          startIcon={<FileUploadRoundedIcon />}
                          onClick={() => setImportDialogOpen(true)}
                          disabled={Boolean(busyLabel) || activeProfile.isDefault}
                        >
                          导入
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<RestartAltRoundedIcon />}
                          onClick={() => setResetDialogOpen(true)}
                          disabled={Boolean(busyLabel) || activeProfile.isDefault}
                        >
                          重置
                        </Button>
                        <Button
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => setDeleteDialogOpen(true)}
                          disabled={Boolean(busyLabel) || activeProfile.isDefault}
                        >
                          删除
                        </Button>
                      </Box>
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

        <SessionCenterDialog
          open={sessionDialogOpen}
          items={sessionItems}
          profiles={profiles}
          report={sessionReport}
          activeProfileName={activeProfile?.name ?? ""}
          loading={sessionLoading}
          query={sessionQuery}
          profileName={sessionProfileName}
          category={sessionCategory}
          page={sessionPage}
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
          busy={Boolean(busyLabel)}
          activeProfileName={activeProfile?.name ?? ""}
          selectedProfileName={authProfileName}
          selectedProfileNames={selectedAuthProfileNames}
          selectedBackupId={selectedAuthBackupId}
          backupLabel={authBackupLabel}
          confirmApply={confirmAuthApply}
          onClose={() => setAuthDialogOpen(false)}
          onRefresh={() => void refreshAuthVault()}
          onProfileChange={setAuthProfileName}
          onSelectedProfileNamesChange={setSelectedAuthProfileNames}
          onBackupSelect={setSelectedAuthBackupId}
          onBackupLabelChange={setAuthBackupLabel}
          onConfirmApplyChange={setConfirmAuthApply}
          onCreateBackups={(profileNames) => void handleCreateAuthBackups(profileNames)}
          onImportPackage={(file) => void handleImportAuthBackupPackage(file)}
          onApplyBackup={(backupId, targetProfileName) => void handleApplyAuthBackup(backupId, targetProfileName)}
          onRollbackApplication={(applicationId) => void handleRollbackAuthApplication(applicationId)}
          onUpdateBackup={(backupId, label, note, pinned) =>
            void handleUpdateAuthBackup(backupId, label, note, pinned)
          }
          onExportBackup={(backupId) => void handleExportAuthBackup(backupId)}
          onCleanupBackups={(accountKey, accountLabel, count) =>
            void handleCleanupAuthBackups(accountKey, accountLabel, count)
          }
          onDeleteBackup={(backupId) => void handleDeleteAuthBackup(backupId)}
          onReveal={(path) => void revealPath(path)}
        />

        <WechatBridgeDialog
          open={wechatDialogOpen}
          report={wechatReport}
          loading={wechatLoading}
          busy={Boolean(busyLabel)}
          activeProfileName={activeProfile?.name ?? ""}
          selectedProfileName={wechatProfileName}
          onClose={() => setWechatDialogOpen(false)}
          onRefresh={() => void refreshWechatBridges()}
          onProfileChange={setWechatProfileName}
          onStart={(profileName) => void handleStartWechatBridge(profileName)}
          onStop={(profileName) => void handleStopWechatBridge(profileName)}
          onRefreshLog={(profileName) => void handleRefreshWechatLog(profileName)}
          onReveal={(path) => void revealPath(path)}
        />

        <CopyProfileDialog
          open={copyDialogOpen}
          draft={copyDraft}
          profiles={profiles}
          authProfiles={authReport?.profiles ?? []}
          authLoading={authLoading}
          busy={Boolean(busyLabel)}
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

        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>新增 profile</DialogTitle>
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
            <Button variant="contained" onClick={() => void handleCreateProfile()} disabled={!canCreate}>
              新增
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>编辑 {activeProfile?.name}</DialogTitle>
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
              disabled={!metadataChanged || Boolean(busyLabel)}
            >
              保存
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>删除 {activeProfile?.name}</DialogTitle>
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
            <Button color="error" variant="contained" onClick={() => void handleDeleteProfile()}>
              删除
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>导入账号到 {activeProfile?.name}</DialogTitle>
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
                Boolean(busyLabel) ||
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

        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>重置 {activeProfile?.name}</DialogTitle>
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
            <Button variant="contained" onClick={() => void handleResetProfile()}>
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

function sessionReportLabel(count: number, hasMore = false): string {
  return count > 0 ? `${count}${hasMore ? "+" : ""} 条会话` : "没有会话";
}

function sessionCenterKey(item: SessionCenterItem): string {
  return `${item.profile.name}:${item.session.id}:${item.session.path ?? ""}`;
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>复制 profile</DialogTitle>
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

function SessionCenterDialog({
  open,
  items,
  profiles,
  report,
  activeProfileName,
  loading,
  query,
  profileName,
  category,
  page,
  onClose,
  onRefresh,
  onQueryChange,
  onProfileChange,
  onCategoryChange,
  onPageChange,
  onOpen,
  onCopySummary,
  onCopyReference,
}: {
  open: boolean;
  items: SessionCenterItem[];
  profiles: ProfileInfo[];
  report: ProfileSessionReport | null;
  activeProfileName: string;
  loading: boolean;
  query: string;
  profileName: string;
  category: string;
  page: number;
  onClose: () => void;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (session: CodexSessionSummary) => void;
  onCopySummary: (item: SessionCenterItem) => void;
  onCopyReference: (item: SessionCenterItem) => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const profileOptions = useMemo(() => {
    return profiles.map((profile) => ({
      name: profile.name,
      alias: profile.alias,
      category: profile.category,
      isDefault: profile.isDefault,
    })).sort((left, right) =>
      profileLabel(left).localeCompare(profileLabel(right), "zh-CN"),
    );
  }, [profiles]);
  const categories = useMemo(
    () =>
      Array.from(new Set(profiles.map((profile) => profile.category).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
      ),
    [profiles],
  );
  const pageCount = Math.max(1, Math.ceil((report?.sessionCount ?? 0) / SESSION_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const pageStart = report && items.length > 0 ? report.offset : 0;
  const pageEnd = report ? report.offset + items.length : 0;
  const pageItems = items;
  const selectedItem =
    pageItems.find((item) => sessionCenterKey(item) === selectedKey) ?? pageItems[0] ?? null;
  const currentProfileOption =
    profileOptions.find((profile) => profile.name === activeProfileName) ?? null;
  const currentProfileFilterActive = Boolean(activeProfileName && profileName === activeProfileName);
  const filtersActive = Boolean(query.trim() || profileName !== "all" || category !== "all");

  useEffect(() => {
    if (page !== currentPage) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange, page]);

  useEffect(() => {
    if (pageItems.length === 0) {
      setSelectedKey("");
      return;
    }
    if (pageItems.length > 0 && !pageItems.some((item) => sessionCenterKey(item) === selectedKey)) {
      setSelectedKey(sessionCenterKey(pageItems[0]));
    }
  }, [pageItems, selectedKey]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" className="session-center-dialog">
      <DialogTitle className="session-dialog-title">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <TerminalRoundedIcon fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span">
              会话中心
            </Typography>
            <Typography variant="caption">
              {loading
                ? "正在读取当前页…"
                : report
                  ? sessionReportLabel(report.sessionCount, report.hasMore)
                  : "按页读取会话"}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
          <Tooltip title="刷新">
            <span>
              <IconButton size="small" aria-label="刷新会话" onClick={onRefresh} disabled={loading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button size="small" variant="text" onClick={onClose}>
            关闭
          </Button>
        </Stack>
      </DialogTitle>

      {loading ? <LinearProgress className="session-dialog-progress" /> : null}

      <DialogContent className="session-dialog-content">
        <Box className="session-dialog-tools">
          <TextField
            className="session-dialog-search"
            size="small"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索标题、摘要、路径或 profile…"
            slotProps={{
              htmlInput: {
                "aria-label": "搜索会话",
                name: "session-search",
                autoComplete: "off",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            className="session-dialog-profile"
            select
            size="small"
            value={profileName}
            onChange={(event) => onProfileChange(event.target.value)}
            slotProps={textFieldSlotProps("session-profile-name")}
          >
            <MenuItem value="all">全部 profile</MenuItem>
            {profileOptions.map((profile) => (
              <MenuItem key={profile.name} value={profile.name}>
                {profileLabel(profile)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            className="session-dialog-category"
            select
            size="small"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            slotProps={textFieldSlotProps("session-profile-category")}
          >
            <MenuItem value="all">全部类型</MenuItem>
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <Box className="session-dialog-tool-actions">
            <Button
              className={`session-current-filter ${currentProfileFilterActive ? "active" : ""}`}
              size="small"
              variant={currentProfileFilterActive ? "contained" : "outlined"}
              onClick={() => onProfileChange(currentProfileFilterActive ? "all" : activeProfileName)}
              disabled={!activeProfileName}
              title={currentProfileOption ? `筛选 ${profileLabel(currentProfileOption)}` : undefined}
            >
              当前
            </Button>
            <Button
              className="session-dialog-clear"
              size="small"
              variant="text"
              onClick={() => {
                onQueryChange("");
                onProfileChange("all");
                onCategoryChange("all");
              }}
              disabled={!filtersActive}
            >
              清空
            </Button>
          </Box>
        </Box>

        <Box className="session-dialog-layout">
          <Box className="session-list-pane" aria-label="会话列表">
            {pageItems.length > 0 ? (
              pageItems.map((item) => {
                const key = sessionCenterKey(item);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`session-list-item ${key === selectedKey ? "selected" : ""} ${
                      item.profile.name === activeProfileName ? "current-profile" : ""
                    }`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <Box className="session-dialog-row-main">
                      <Stack direction="row" spacing={0.7} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Typography
                          className="session-dialog-row-title"
                          variant="subtitle2"
                          component="span"
                          translate="no"
                          title={item.session.title}
                        >
                          {item.session.title}
                        </Typography>
                        {item.session.renamedTitle ? (
                          <Chip className="session-rename-chip" size="small" variant="outlined" label="重命名" />
                        ) : null}
                      </Stack>
                      <Stack className="session-dialog-meta" direction="row" spacing={0.8}>
                        <Typography variant="caption">
                          {profileLabel(item.profile)}
                        </Typography>
                        <Typography variant="caption">
                          {formatSessionTime(item.session.updatedAt ?? item.session.startedAt)}
                        </Typography>
                      </Stack>
                      {item.session.summary ? (
                        <Typography className="session-dialog-summary compact" variant="body2" title={item.session.summary}>
                          {item.session.summary}
                        </Typography>
                      ) : null}
                    </Box>
                  </button>
                );
              })
            ) : (
              <Box className="session-dialog-empty">
                {loading ? <RefreshRoundedIcon /> : <SearchRoundedIcon />}
                <Typography variant="body2">{loading ? "正在读取会话…" : "没有匹配会话。"}</Typography>
              </Box>
            )}
          </Box>

          <Box className="session-detail-pane">
            {selectedItem ? (
              <>
                <Stack className="session-detail-head" direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <TerminalRoundedIcon fontSize="small" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" translate="no" title={selectedItem.session.title}>
                      {selectedItem.session.title}
                    </Typography>
                    <Stack className="session-detail-chips" direction="row" spacing={0.6}>
                      <Chip
                        size="small"
                        variant={selectedItem.profile.name === activeProfileName ? "filled" : "outlined"}
                        label={profileLabel(selectedItem.profile)}
                      />
                      <Chip size="small" variant="outlined" label={selectedItem.profile.category} />
                      {selectedItem.session.renamedTitle ? (
                        <Chip className="session-rename-chip" size="small" variant="outlined" label="已重命名" />
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>
                {selectedItem.session.renamedTitle ? (
                  <Typography className="session-rename-line" variant="caption" translate="no">
                    重命名：{selectedItem.session.renamedTitle}
                  </Typography>
                ) : null}
                {selectedItem.session.summary ? (
                  <Typography className="session-detail-summary" variant="body2">
                    {selectedItem.session.summary}
                  </Typography>
                ) : (
                  <Typography className="session-dialog-muted" variant="caption">
                    暂无摘要内容
                  </Typography>
                )}
                <Box className="session-detail-meta">
                  <Typography variant="caption">
                    时间：{formatSessionTime(selectedItem.session.updatedAt ?? selectedItem.session.startedAt)}
                  </Typography>
                  {selectedItem.session.cwd ? (
                    <Typography variant="caption" translate="no" title={selectedItem.session.cwd}>
                      目录：{compactPath(selectedItem.session.cwd)}
                    </Typography>
                  ) : null}
                  {selectedItem.session.path ? (
                    <Typography variant="caption" translate="no" title={selectedItem.session.path}>
                      文件：{compactPath(selectedItem.session.path)}
                    </Typography>
                  ) : null}
                </Box>
                <Box className="session-dialog-actions">
                  <Button size="small" variant="outlined" onClick={() => onOpen(selectedItem.session)} disabled={!selectedItem.session.path}>
                    打开
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyRoundedIcon />}
                    onClick={() => onCopySummary(selectedItem)}
                  >
                    复制摘要
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ShortcutRoundedIcon />}
                    onClick={() => onCopyReference(selectedItem)}
                  >
                    引用到当前
                  </Button>
                </Box>
              </>
            ) : (
              <Box className="session-dialog-empty tall">
                <TerminalRoundedIcon />
                <Typography variant="body2">选择一个会话查看摘要。</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="session-dialog-footer">
        <Typography variant="caption">
          {items.length === 0
            ? "0 / 0"
            : `${pageStart + 1}-${pageEnd} / ${report?.sessionCount ?? items.length}${report?.hasMore ? "+" : ""}`}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Tooltip title="上一页">
            <span>
              <IconButton
                size="small"
                aria-label="上一页"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <KeyboardArrowLeftRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Typography className="session-dialog-page" variant="caption">
            {currentPage} / {pageCount}
          </Typography>
          <Tooltip title="下一页">
            <span>
              <IconButton
                size="small"
                aria-label="下一页"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!report?.hasMore && currentPage >= pageCount}
              >
                <KeyboardArrowRightRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

function WechatBridgeDialog({
  open,
  report,
  loading,
  busy,
  activeProfileName,
  selectedProfileName,
  onClose,
  onRefresh,
  onProfileChange,
  onStart,
  onStop,
  onRefreshLog,
  onReveal,
}: {
  open: boolean;
  report: WechatBridgeReport | null;
  loading: boolean;
  busy: boolean;
  activeProfileName: string;
  selectedProfileName: string;
  onClose: () => void;
  onRefresh: () => void;
  onProfileChange: (value: string) => void;
  onStart: (profileName: string) => void;
  onStop: (profileName: string) => void;
  onRefreshLog: (profileName: string) => void;
  onReveal: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const bridges = report?.bridges ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBridges = useMemo(() => {
    if (!normalizedQuery) {
      return bridges;
    }
    return bridges.filter((bridge) =>
      [
        bridge.profileName,
        bridge.profileLabel,
        bridge.profileCategory,
        bridge.codexHome,
        bridge.instance,
        bridge.storageDir,
        accountInfoLabel(bridge.account),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [bridges, normalizedQuery]);
  const selectedBridge =
    bridges.find((bridge) => bridge.profileName === selectedProfileName) ?? bridges[0] ?? null;
  const boundCount = bridges.filter((bridge) => bridge.tokenExists).length;
  const selectedLogPath = selectedBridge?.appLogPath || selectedBridge?.defaultLogPath || "";
  const canStart = Boolean(selectedBridge?.authExists && !selectedBridge.running && !busy && !loading);
  const canStop = Boolean(selectedBridge?.running && !busy && !loading);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" className="wechat-bridge-dialog">
      <DialogTitle className="wechat-dialog-title">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <QrCodeScannerRoundedIcon fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span">
              微信桥接
            </Typography>
            <Typography variant="caption">
              {loading
                ? "正在读取…"
                : `${bridges.length} 个 profile · ${boundCount} 个已绑定 · ${report?.runningCount ?? 0} 个运行中`}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
          {report ? (
            <Button size="small" variant="text" onClick={() => onReveal(report.storePath)}>
              打开目录
            </Button>
          ) : null}
          <Tooltip title="刷新">
            <span>
              <IconButton size="small" aria-label="刷新微信桥接" onClick={onRefresh} disabled={loading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button size="small" variant="text" onClick={onClose}>
            关闭
          </Button>
        </Stack>
      </DialogTitle>

      {loading ? <LinearProgress className="wechat-dialog-progress" /> : null}

      <DialogContent className="wechat-dialog-content">
        <Box className="wechat-dialog-tools">
          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 profile、实例、路径或账号…"
            slotProps={{
              htmlInput: {
                "aria-label": "搜索微信桥接 profile",
                name: "wechat-bridge-search",
                autoComplete: "off",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            value={selectedBridge?.profileName ?? ""}
            onChange={(event) => onProfileChange(event.target.value)}
            slotProps={textFieldSlotProps("wechat-bridge-profile")}
          >
            {bridges.map((bridge) => (
              <MenuItem key={bridge.profileName} value={bridge.profileName}>
                {wechatBridgeLabel(bridge)}
              </MenuItem>
            ))}
          </TextField>
          <Stack className="wechat-dialog-actions" direction="row" spacing={0.6}>
            <Button
              size="small"
              variant="contained"
              startIcon={<QrCodeScannerRoundedIcon />}
              onClick={() => selectedBridge && onStart(selectedBridge.profileName)}
              disabled={!canStart}
            >
              启动扫码
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<PowerSettingsNewRoundedIcon />}
              onClick={() => selectedBridge && onStop(selectedBridge.profileName)}
              disabled={!canStop}
            >
              停止
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => selectedBridge && onRefreshLog(selectedBridge.profileName)}
              disabled={!selectedBridge}
            >
              日志
            </Button>
          </Stack>
        </Box>

        <Box className="wechat-dialog-layout">
          <Box className="wechat-list-pane">
            {filteredBridges.length > 0 ? (
              filteredBridges.map((bridge) => (
                <button
                  key={bridge.profileName}
                  type="button"
                  className={`wechat-bridge-row ${
                    bridge.profileName === selectedBridge?.profileName ? "selected" : ""
                  } ${bridge.profileName === activeProfileName ? "current" : ""}`}
                  onClick={() => onProfileChange(bridge.profileName)}
                >
                  <Box className="wechat-row-main">
                    <Typography variant="subtitle2" translate="no" title={bridge.profileLabel}>
                      {bridge.profileLabel}
                    </Typography>
                    <Typography variant="caption" translate="no">
                      {bridge.profileName} · {bridge.instance}
                    </Typography>
                    <Typography variant="caption">{accountInfoLabel(bridge.account)}</Typography>
                  </Box>
                  <Box className="wechat-row-tags">
                    <Chip size="small" variant="outlined" label={bridge.profileCategory} />
                    <Chip
                      size="small"
                      color={bridge.running ? "success" : bridge.tokenExists ? "primary" : "default"}
                      label={wechatBridgeStatusLabel(bridge)}
                    />
                  </Box>
                </button>
              ))
            ) : (
              <Box className="wechat-empty">
                <QrCodeScannerRoundedIcon />
                <Typography variant="body2">
                  {bridges.length > 0 ? "没有匹配的微信桥接。" : "暂无可绑定 profile。"}
                </Typography>
              </Box>
            )}
          </Box>

          <Box className="wechat-detail-pane">
            {selectedBridge ? (
              <>
                <Stack className="wechat-detail-head" direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <LinkRoundedIcon fontSize="small" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" translate="no" title={selectedBridge.profileLabel}>
                      {selectedBridge.profileLabel}
                    </Typography>
                    <Typography variant="caption" translate="no">
                      instance: {selectedBridge.instance}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={selectedBridge.running ? "success" : selectedBridge.tokenExists ? "primary" : "default"}
                    label={wechatBridgeStatusLabel(selectedBridge)}
                  />
                </Stack>

                <Box className="wechat-detail-grid">
                  <Box className="wechat-info-card">
                    <Typography variant="caption">Codex profile</Typography>
                    <Typography variant="subtitle2" translate="no" title={selectedBridge.codexHome}>
                      {compactPath(selectedBridge.codexHome)}
                    </Typography>
                    <Typography variant="caption">{accountInfoLabel(selectedBridge.account)}</Typography>
                  </Box>
                  <Box className="wechat-info-card">
                    <Typography variant="caption">微信绑定</Typography>
                    <Typography variant="subtitle2">
                      {selectedBridge.tokenExists ? "已扫码绑定" : "未扫码绑定"}
                    </Typography>
                    <Typography variant="caption" translate="no" title={selectedBridge.storageDir}>
                      {compactPath(selectedBridge.storageDir)}
                    </Typography>
                  </Box>
                  <Box className="wechat-info-card">
                    <Typography variant="caption">运行状态</Typography>
                    <Typography variant="subtitle2">
                      {selectedBridge.running ? `运行中 ${selectedBridge.runningPids.join(", ")}` : "未运行"}
                    </Typography>
                    <Typography variant="caption">
                      {selectedBridge.lastStartedAt
                        ? `启动 ${formatSessionTime(selectedBridge.lastStartedAt)}`
                        : "还未由 app 启动"}
                    </Typography>
                  </Box>
                </Box>

                {!selectedBridge.authExists ? (
                  <Alert className="wechat-detail-alert" severity="warning">
                    这个 profile 还没有 auth.json，先在认证库应用或导入账号后再启动扫码。
                  </Alert>
                ) : selectedBridge.lastError ? (
                  <Alert className="wechat-detail-alert" severity="error">
                    {selectedBridge.lastError}
                  </Alert>
                ) : (
                  <Alert className="wechat-detail-alert" severity="info">
                    启动后用微信扫码，扫码成功后该微信会固定连接到这个 profile 的 CODEX_HOME。
                  </Alert>
                )}

                <Box className="wechat-log-panel">
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
                      <TerminalRoundedIcon fontSize="small" />
                      <Typography variant="subtitle2">扫码日志</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="text" onClick={() => onReveal(selectedLogPath)} disabled={!selectedLogPath}>
                        定位
                      </Button>
                      <Button size="small" variant="text" onClick={() => onReveal(selectedBridge.storageDir)}>
                        实例
                      </Button>
                    </Stack>
                  </Stack>
                  {selectedBridge.logTail.length > 0 ? (
                    <pre>{selectedBridge.logTail.join("\n")}</pre>
                  ) : (
                    <Box className="wechat-log-empty">
                      <TerminalRoundedIcon />
                      <Typography variant="body2">还没有日志。点击“启动扫码”后在这里查看二维码输出。</Typography>
                    </Box>
                  )}
                </Box>
              </>
            ) : (
              <Box className="wechat-empty tall">
                <QrCodeScannerRoundedIcon />
                <Typography variant="body2">选择一个 profile 绑定微信。</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function AuthVaultDialog({
  open,
  report,
  loading,
  busy,
  activeProfileName,
  selectedProfileName,
  selectedProfileNames,
  selectedBackupId,
  backupLabel,
  confirmApply,
  onClose,
  onRefresh,
  onProfileChange,
  onSelectedProfileNamesChange,
  onBackupSelect,
  onBackupLabelChange,
  onConfirmApplyChange,
  onCreateBackups,
  onImportPackage,
  onApplyBackup,
  onRollbackApplication,
  onUpdateBackup,
  onExportBackup,
  onCleanupBackups,
  onDeleteBackup,
  onReveal,
}: {
  open: boolean;
  report: AuthVaultReport | null;
  loading: boolean;
  busy: boolean;
  activeProfileName: string;
  selectedProfileName: string;
  selectedProfileNames: string[];
  selectedBackupId: string;
  backupLabel: string;
  confirmApply: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onProfileChange: (value: string) => void;
  onSelectedProfileNamesChange: (value: string[]) => void;
  onBackupSelect: (value: string) => void;
  onBackupLabelChange: (value: string) => void;
  onConfirmApplyChange: (value: boolean) => void;
  onCreateBackups: (profileNames: string[]) => void;
  onImportPackage: (file: File) => void;
  onApplyBackup: (backupId: string, targetProfileName: string) => void;
  onRollbackApplication: (applicationId: string) => void;
  onUpdateBackup: (backupId: string, label: string, note: string, pinned: boolean) => void;
  onExportBackup: (backupId: string) => void;
  onCleanupBackups: (accountKey: string, accountLabel: string, count: number) => void;
  onDeleteBackup: (backupId: string) => void;
  onReveal: (path: string) => void;
}) {
  const [profileQuery, setProfileQuery] = useState("");
  const [backupQuery, setBackupQuery] = useState("");
  const importPackageInputRef = useRef<HTMLInputElement | null>(null);
  const [backupEdit, setBackupEdit] = useState({
    label: "",
    note: "",
    pinned: false,
  });
  const profiles = report?.profiles ?? [];
  const backups = report?.backups ?? [];
  const applications = report?.recentApplications ?? [];
  const backupAccountCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const backup of backups) {
      const key = codexAccountKey(backup.account);
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [backups]);
  const filteredProfiles = useMemo(() => {
    const normalizedQuery = profileQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return profiles;
    }
    return profiles.filter((profile) =>
      [
        profile.profileName,
        profile.profileAlias ?? "",
        profile.profileCategory,
        profile.codexHome,
        profile.authPath,
        accountInfoLabel(profile.account),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [profileQuery, profiles]);
  const filteredBackups = useMemo(() => {
    const normalizedQuery = backupQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return backups;
    }
    return backups.filter((backup) =>
      [
        backup.label,
        backup.note ?? "",
        backup.id,
        backup.sourceProfileName ?? "",
        backup.sourceProfileLabel ?? "",
        backup.sourceCodexHome ?? "",
        backup.path,
        accountInfoLabel(backup.account),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [backupQuery, backups]);
  const filteredBackupGroups = useMemo(() => {
    const groups = new Map<string, AuthBackupGroup>();
    for (const backup of filteredBackups) {
      const accountKey = codexAccountKey(backup.account);
      const groupKey = accountKey ? `account:${accountKey}` : `backup:${backup.id}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.backups.push(backup);
        continue;
      }
      groups.set(groupKey, {
        key: groupKey,
        accountKey,
        label: accountKey ? accountInfoLabel(backup.account) : "无法识别账号",
        backups: [backup],
      });
    }
    return Array.from(groups.values());
  }, [filteredBackups]);
  const selectedProfile =
    profiles.find((profile) => profile.profileName === selectedProfileName) ?? profiles[0] ?? null;
  const selectedBackup = backups.find((backup) => backup.id === selectedBackupId) ?? backups[0] ?? null;
  const targetApplications = applications
    .filter((application) => application.targetProfileName === selectedProfile?.profileName)
    .slice(0, 3);
  const backupableProfiles = profiles.filter((profile) => profile.authExists);
  const selectedBackupableNames = selectedProfileNames.filter((name) =>
    backupableProfiles.some((profile) => profile.profileName === name),
  );
  const allBackupableSelected =
    backupableProfiles.length > 0 &&
    backupableProfiles.every((profile) => selectedBackupableNames.includes(profile.profileName));
  const targetLocked = Boolean(selectedProfile?.isDefault || selectedProfile?.isRunning);
  const canCreateBackup = selectedBackupableNames.length > 0 && !busy && !loading;
  const canApplyBackup = Boolean(selectedProfile && selectedBackup?.exists && confirmApply && !targetLocked) && !busy;
  const backupEditDirty = Boolean(
    selectedBackup &&
      (backupEdit.label.trim() !== selectedBackup.label ||
        backupEdit.note.trim() !== (selectedBackup.note ?? "") ||
        backupEdit.pinned !== selectedBackup.pinned),
  );
  const selectedDuplicateCount = selectedBackup
    ? backupAccountCounts.get(codexAccountKey(selectedBackup.account)) ?? 0
    : 0;
  const sameAccount = sameCodexAccount(selectedBackup?.account ?? null, selectedProfile?.account ?? null);
  const targetHint = selectedProfile?.isDefault
    ? "默认 codex 受保护，不能覆盖。"
    : selectedProfile?.isRunning
      ? "目标 profile 正在运行，先终止再应用。"
      : selectedBackup?.exists
        ? "应用前会自动备份目标现有 auth.json。"
        : "选择一个可用备份。";

  useEffect(() => {
    if (!open) {
      setProfileQuery("");
      setBackupQuery("");
    }
  }, [open]);

  useEffect(() => {
    setBackupEdit({
      label: selectedBackup?.label ?? "",
      note: selectedBackup?.note ?? "",
      pinned: Boolean(selectedBackup?.pinned),
    });
  }, [selectedBackup?.id, selectedBackup?.label, selectedBackup?.note, selectedBackup?.pinned]);

  function toggleBackupProfile(profileName: string, checked: boolean) {
    const next = new Set(selectedBackupableNames);
    if (checked) {
      next.add(profileName);
    } else {
      next.delete(profileName);
    }
    onSelectedProfileNamesChange(Array.from(next));
  }

  function handleImportPackageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      onImportPackage(file);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" className="auth-vault-dialog">
      <DialogTitle className="auth-dialog-title">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <SecurityRoundedIcon fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span">
              认证库
            </Typography>
            <Typography variant="caption">
              {loading ? "正在读取…" : `${backups.length} 个备份 · ${profiles.length} 个 profile`}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
          {report ? (
            <Button size="small" variant="text" onClick={() => onReveal(report.vaultPath)}>
              打开目录
            </Button>
          ) : null}
          <Tooltip title="刷新">
            <span>
              <IconButton size="small" aria-label="刷新认证库" onClick={onRefresh} disabled={loading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button size="small" variant="text" onClick={onClose}>
            关闭
          </Button>
        </Stack>
      </DialogTitle>

      {loading ? <LinearProgress className="auth-dialog-progress" /> : null}

      <DialogContent className="auth-dialog-content">
        <Box className="auth-dialog-tools">
          <TextField
            select
            size="small"
            value={selectedProfile?.profileName ?? ""}
            onChange={(event) => onProfileChange(event.target.value)}
            slotProps={textFieldSlotProps("auth-target-profile")}
          >
            {profiles.map((profile) => (
              <MenuItem key={profile.profileName} value={profile.profileName}>
                {authSlotLabel(profile)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="备份名称"
            value={backupLabel}
            onChange={(event) => onBackupLabelChange(event.target.value)}
            placeholder={selectedBackupableNames.length === 1 ? "可自定义单个备份名称" : "批量备份时自动命名"}
            slotProps={textFieldSlotProps("auth-backup-label")}
          />
          <Stack className="auth-dialog-tool-actions" direction="row" spacing={0.6}>
            <input
              ref={importPackageInputRef}
              className="auth-import-input"
              type="file"
              accept=".json,.rcodex-auth.json,application/json"
              onChange={handleImportPackageChange}
            />
            <Button
              className="auth-backup-action"
              size="small"
              variant="outlined"
              startIcon={<FileUploadRoundedIcon />}
              onClick={() => importPackageInputRef.current?.click()}
              disabled={busy || loading}
            >
              导入包
            </Button>
            <Button
              className="auth-backup-action"
              size="small"
              variant="outlined"
              startIcon={<SaveRoundedIcon />}
              onClick={() => onCreateBackups(selectedBackupableNames)}
              disabled={!canCreateBackup}
            >
              备份已选
              {selectedBackupableNames.length > 0 ? (
                <span className="session-launch-count">{selectedBackupableNames.length}</span>
              ) : null}
            </Button>
            <Button
              className="auth-backup-action"
              size="small"
              variant="outlined"
              onClick={() => onCreateBackups(backupableProfiles.map((profile) => profile.profileName))}
              disabled={backupableProfiles.length === 0 || busy || loading}
            >
              全部备份
            </Button>
            <Button
              className="auth-backup-action"
              size="small"
              variant="text"
              onClick={() =>
                onSelectedProfileNamesChange(
                  allBackupableSelected ? [] : backupableProfiles.map((profile) => profile.profileName),
                )
              }
              disabled={backupableProfiles.length === 0}
            >
              {allBackupableSelected ? "清空" : "全选"}
            </Button>
          </Stack>
        </Box>

        <Box className="auth-dialog-filters">
          <TextField
            size="small"
            value={profileQuery}
            onChange={(event) => setProfileQuery(event.target.value)}
            placeholder="搜索 profile、账号或路径…"
            slotProps={{
              htmlInput: {
                "aria-label": "搜索认证 profile",
                name: "auth-profile-search",
                autoComplete: "off",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            size="small"
            value={backupQuery}
            onChange={(event) => setBackupQuery(event.target.value)}
            placeholder="搜索备份、来源或账号…"
            slotProps={{
              htmlInput: {
                "aria-label": "搜索认证备份",
                name: "auth-backup-search",
                autoComplete: "off",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Box className="auth-dialog-grid">
          <Box className="auth-pane auth-profile-pane">
            <Stack className="auth-pane-title" direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AccountCircleRoundedIcon fontSize="small" />
              <Typography variant="subtitle2">当前认证</Typography>
              <Chip size="small" label={`${filteredProfiles.length}/${profiles.length}`} />
            </Stack>
            <Box className="auth-list">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile) => {
                  const checked = selectedBackupableNames.includes(profile.profileName);
                  return (
                    <Box
                      key={profile.profileName}
                      className={`auth-profile-row ${
                        profile.profileName === selectedProfile?.profileName ? "selected" : ""
                      } ${profile.profileName === activeProfileName ? "current" : ""}`}
                    >
                      <Checkbox
                        size="small"
                        checked={checked}
                        disabled={!profile.authExists}
                        onChange={(event) => toggleBackupProfile(profile.profileName, event.target.checked)}
                        slotProps={{ input: { "aria-label": `选择备份 ${authSlotLabel(profile)}` } }}
                      />
                      <button
                        type="button"
                        className="auth-row-select"
                        onClick={() => onProfileChange(profile.profileName)}
                      >
                        <Box className="auth-row-main">
                          <Typography variant="subtitle2" translate="no">
                            {authSlotLabel(profile)}
                          </Typography>
                          <Typography variant="caption">{accountInfoLabel(profile.account)}</Typography>
                          <Typography variant="caption" translate="no" title={profile.codexHome}>
                            {compactPath(profile.codexHome)}
                          </Typography>
                        </Box>
                      </button>
                      <Box className="auth-row-tags">
                        {profile.isDefault ? <Chip size="small" label="默认" /> : null}
                        {profile.isRunning ? <Chip size="small" color="success" label="运行" /> : null}
                        <Chip
                          size="small"
                          variant="outlined"
                          label={profile.authExists ? "有 auth" : "无 auth"}
                          color={profile.authExists ? "success" : "warning"}
                        />
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Box className="auth-empty">
                  <AccountCircleRoundedIcon />
                  <Typography variant="body2">
                    {profiles.length > 0 ? "没有匹配的认证 profile。" : "暂无 profile。"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box className="auth-pane auth-backup-pane">
            <Stack className="auth-pane-title" direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <VpnKeyRoundedIcon fontSize="small" />
              <Typography variant="subtitle2">认证备份</Typography>
              <Chip size="small" label={`${filteredBackups.length}/${backups.length}`} />
            </Stack>
            <Box className="auth-list">
              {filteredBackups.length > 0 ? (
                filteredBackupGroups.map((group) => {
                  const groupDuplicateCount = group.accountKey
                    ? backupAccountCounts.get(group.accountKey) ?? group.backups.length
                    : group.backups.length;
                  return (
                    <Box key={group.key} className="auth-backup-group">
                      <Box className="auth-backup-group-header">
                        <Box className="auth-backup-group-title">
                          <Typography variant="caption" translate="no" title={group.label}>
                            {group.label}
                          </Typography>
                          <Typography variant="caption">
                            {groupDuplicateCount > 1 ? `${groupDuplicateCount} 份备份` : "1 份备份"}
                          </Typography>
                        </Box>
                        {group.accountKey && groupDuplicateCount > 1 ? (
                          <Button
                            className="auth-cleanup-action"
                            size="small"
                            variant="text"
                            color="warning"
                            onClick={() => onCleanupBackups(group.accountKey, group.label, groupDuplicateCount)}
                            disabled={busy}
                          >
                            清理重复
                          </Button>
                        ) : null}
                      </Box>
                      <Box className="auth-backup-group-list">
                        {group.backups.map((backup) => {
                          const duplicateCount = backupAccountCounts.get(codexAccountKey(backup.account)) ?? 0;
                          return (
                            <button
                              key={backup.id}
                              type="button"
                              className={`auth-backup-row ${backup.id === selectedBackup?.id ? "selected" : ""}`}
                              onClick={() => onBackupSelect(backup.id)}
                            >
                              <Box className="auth-row-main">
                                <Typography variant="subtitle2" translate="no" title={backup.label}>
                                  {backup.label}
                                </Typography>
                                <Typography variant="caption">{accountInfoLabel(backup.account)}</Typography>
                                {backup.note ? (
                                  <Typography variant="caption" title={backup.note}>
                                    {backup.note}
                                  </Typography>
                                ) : null}
                                <Typography variant="caption">
                                  {formatSessionTime(backup.createdAt)}
                                  {backup.sourceProfileName
                                    ? ` · ${backup.sourceProfileLabel ?? backup.sourceProfileName}`
                                    : ""}
                                </Typography>
                              </Box>
                              <Box className="auth-row-tags">
                                {backup.pinned ? <Chip size="small" label="置顶" /> : null}
                                {duplicateCount > 1 ? (
                                  <Chip size="small" variant="outlined" label={`重复 ${duplicateCount}`} />
                                ) : null}
                                {backup.hasRefreshToken ? <Chip size="small" color="success" label="可刷新" /> : null}
                                <Chip size="small" variant="outlined" label={backup.exists ? "可用" : "缺失"} />
                              </Box>
                            </button>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Box className="auth-empty">
                  <VpnKeyRoundedIcon />
                  <Typography variant="body2">
                    {backups.length > 0 ? "没有匹配的认证备份。" : "还没有认证备份。"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box className="auth-detail-pane">
            <Stack className="auth-pane-title" direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <SecurityRoundedIcon fontSize="small" />
              <Typography variant="subtitle2">应用到 profile</Typography>
            </Stack>
            {selectedBackup ? (
              <Box className="auth-detail-card">
                <Box className="auth-backup-editor">
                  <TextField
                    className="auth-backup-label-input"
                    size="small"
                    label="备份名称"
                    value={backupEdit.label}
                    onChange={(event) =>
                      setBackupEdit((current) => ({ ...current, label: event.target.value }))
                    }
                    slotProps={textFieldSlotProps("auth-edit-backup-label")}
                  />
                  <Button
                    className={`auth-pin-action ${backupEdit.pinned ? "active" : ""}`}
                    size="small"
                    variant={backupEdit.pinned ? "contained" : "outlined"}
                    startIcon={<PushPinRoundedIcon />}
                    onClick={() =>
                      setBackupEdit((current) => ({ ...current, pinned: !current.pinned }))
                    }
                  >
                    置顶
                  </Button>
                  <TextField
                    className="auth-backup-note-input"
                    size="small"
                    label="备注"
                    value={backupEdit.note}
                    onChange={(event) =>
                      setBackupEdit((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="例如账号用途、适用场景…"
                    slotProps={textFieldSlotProps("auth-edit-backup-note")}
                  />
                  <Button
                    className="auth-save-backup-action"
                    size="small"
                    variant="outlined"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() =>
                      onUpdateBackup(
                        selectedBackup.id,
                        backupEdit.label,
                        backupEdit.note,
                        backupEdit.pinned,
                      )
                    }
                    disabled={!backupEditDirty || !backupEdit.label.trim() || busy}
                  >
                    保存
                  </Button>
                </Box>
                <Typography variant="body2">{accountInfoLabel(selectedBackup.account)}</Typography>
                <Typography variant="caption" title={selectedBackup.path} translate="no">
                  {compactPath(selectedBackup.path)}
                </Typography>
                <Stack className="auth-detail-tags" direction="row" spacing={0.6}>
                  {selectedBackup.pinned ? <Chip size="small" label="已置顶" /> : null}
                  {selectedDuplicateCount > 1 ? (
                    <Chip size="small" variant="outlined" label={`同账号 ${selectedDuplicateCount} 份`} />
                  ) : null}
                  <Chip size="small" label={selectedBackup.exists ? "文件可用" : "文件缺失"} />
                  {selectedBackup.hasRefreshToken ? <Chip size="small" color="success" label="含 refresh_token" /> : null}
                  {sameAccount ? <Chip size="small" variant="outlined" label="同账号" /> : null}
                </Stack>
                <Box className="auth-apply-preview">
                  <Box className="auth-preview-card source">
                    <Typography variant="caption">来源备份</Typography>
                    <Typography variant="subtitle2" title={selectedBackup.label} translate="no">
                      {selectedBackup.label}
                    </Typography>
                    <Typography variant="caption">{accountInfoLabel(selectedBackup.account)}</Typography>
                  </Box>
                  <Box className="auth-preview-card target">
                    <Typography variant="caption">目标当前</Typography>
                    <Typography variant="subtitle2" translate="no">
                      {selectedProfile ? authSlotLabel(selectedProfile) : "未选择"}
                    </Typography>
                    <Typography variant="caption">{accountInfoLabel(selectedProfile?.account ?? null)}</Typography>
                  </Box>
                  <Box className="auth-preview-card result">
                    <Typography variant="caption">应用后</Typography>
                    <Typography variant="subtitle2" translate="no">
                      {selectedProfile ? authSlotLabel(selectedProfile) : "未选择"}
                    </Typography>
                    <Typography variant="caption">{accountInfoLabel(selectedBackup.account)}</Typography>
                  </Box>
                </Box>
                <Alert className="auth-detail-alert" severity={targetLocked ? "warning" : "info"}>
                  {targetHint}
                </Alert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={confirmApply}
                      onChange={(event) => onConfirmApplyChange(event.target.checked)}
                    />
                  }
                  label="我确认要覆盖目标 profile 的登录状态"
                />
                <Box className="auth-detail-actions">
                  <Button
                    variant="contained"
                    startIcon={<VpnKeyRoundedIcon />}
                    disabled={!canApplyBackup}
                    onClick={() => selectedProfile && onApplyBackup(selectedBackup.id, selectedProfile.profileName)}
                  >
                    应用到 {selectedProfile ? authSlotLabel(selectedProfile) : "profile"}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() => onExportBackup(selectedBackup.id)}
                    disabled={!selectedBackup.exists || busy}
                  >
                    导出
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FolderRoundedIcon />}
                    onClick={() => onReveal(selectedBackup.path)}
                    disabled={!selectedBackup.exists}
                  >
                    定位
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() => onDeleteBackup(selectedBackup.id)}
                    disabled={busy}
                  >
                    删除
                  </Button>
                </Box>
                <Box className="auth-rollback-panel">
                  <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
                    <RestartAltRoundedIcon fontSize="small" />
                    <Typography variant="subtitle2">最近应用</Typography>
                  </Stack>
                  {targetApplications.length > 0 ? (
                    <Box className="auth-application-list">
                      {targetApplications.map((application) => {
                        const canRollback =
                          application.previousAuthExists &&
                          !application.rolledBackAt &&
                          !targetLocked &&
                          !busy;
                        return (
                          <Box key={application.id} className="auth-application-row">
                            <Box className="auth-row-main">
                              <Typography variant="subtitle2" title={application.backupLabel} translate="no">
                                {application.backupLabel}
                              </Typography>
                              <Typography variant="caption">
                                {formatSessionTime(application.appliedAt)}
                                {application.rolledBackAt
                                  ? ` · 已回滚 ${formatSessionTime(application.rolledBackAt)}`
                                  : ""}
                              </Typography>
                              <Typography variant="caption">{accountInfoLabel(application.appliedAccount)}</Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onRollbackApplication(application.id)}
                              disabled={!canRollback}
                            >
                              回滚
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography className="auth-rollback-empty" variant="caption">
                      这个 profile 还没有应用记录。
                    </Typography>
                  )}
                </Box>
              </Box>
            ) : (
              <Box className="auth-empty tall">
                <VpnKeyRoundedIcon />
                <Typography variant="body2">选择或创建一个认证备份。</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({
  profile,
  selected,
  onSelect,
  onLaunch,
  onTerminate,
  busy,
}: {
  profile: ProfileInfo;
  selected: boolean;
  onSelect: () => void;
  onLaunch: () => void;
  onTerminate: () => void;
  busy: boolean;
}) {
  const canTerminate = profile.isRunning && !profile.isDefault;
  const iconTitle = profile.isDefault && profile.isRunning ? "默认 codex 请手动退出" : profile.isRunning ? "终止" : "启动";

  return (
    <Box className={`profile-card ${selected ? "selected" : ""}`}>
      <button
        type="button"
        className="profile-card-main"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <Box className="profile-card-top">
          <Box sx={{ minWidth: 0 }}>
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
          <span translate="no">{profile.model ?? "unknown"}</span>
          <span translate="no">{profile.reasoningEffort ?? "unknown"}</span>
        </Box>
        <Box className="profile-card-foot">
          <Box className="profile-card-subline">
            <AccountCircleRoundedIcon fontSize="small" />
            <Typography variant="caption">{accountLabel(profile)}</Typography>
          </Box>
          {profile.latestSession ? (
            <Box
              className="profile-session-line"
              title={profile.latestSession.summary ?? profile.latestSession.title}
            >
              <TerminalRoundedIcon fontSize="small" />
              <Typography variant="caption" translate="no">
                {profile.latestSession.title}
              </Typography>
              {profile.latestSession.renamedTitle ? (
                <span className="profile-session-rename">重命名</span>
              ) : null}
            </Box>
          ) : null}
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
          <TerminalRoundedIcon fontSize="small" />
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
          {session.renamedTitle ? (
            <Typography className="session-rename-line" variant="caption" translate="no">
              重命名：{session.renamedTitle}
            </Typography>
          ) : null}
          <Stack className="session-meta" direction="row" spacing={0.8}>
            <Typography variant="caption">{formatSessionTime(session.updatedAt ?? session.startedAt)}</Typography>
            {session.cwd ? (
              <Typography variant="caption" translate="no" title={session.cwd}>
                {compactPath(session.cwd)}
              </Typography>
            ) : null}
          </Stack>
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
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <AccountCircleRoundedIcon fontSize="small" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" component="span">{accountLabel(profile)}</Typography>
          <Typography variant="caption">
            {account
              ? [account.planType, account.organizationTitle, account.authMode].filter(Boolean).join(" · ")
              : "未在该 CODEX_HOME 中发现可展示账号"}
          </Typography>
        </Box>
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

function accountLabel(profile: ProfileInfo): string {
  return accountInfoLabel(profile.account);
}

function accountInfoLabel(
  account: ProfileInfo["account"] | AuthBackupEntry["account"] | AuthApplicationEntry["appliedAccount"],
): string {
  if (!account) {
    return "未登录";
  }
  return account.email ?? account.name ?? account.accountId ?? account.authMode ?? "已登录";
}

function codexAccountKey(
  account: ProfileInfo["account"] | AuthBackupEntry["account"] | AuthApplicationEntry["appliedAccount"],
): string {
  if (!account) {
    return "";
  }
  return account.accountId ?? account.userId ?? account.email ?? account.name ?? "";
}

function sameCodexAccount(
  left: ProfileInfo["account"] | AuthBackupEntry["account"] | AuthApplicationEntry["appliedAccount"],
  right: ProfileInfo["account"] | AuthBackupEntry["account"] | AuthApplicationEntry["appliedAccount"],
): boolean {
  const leftKey = codexAccountKey(left);
  const rightKey = codexAccountKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function authSlotLabel(profile: AuthProfileSlot): string {
  return profile.profileAlias || profile.profileName;
}

function wechatBridgeLabel(bridge: WechatBridgeEntry): string {
  return bridge.profileLabel || bridge.profileName;
}

function wechatBridgeStatusLabel(bridge: WechatBridgeEntry): string {
  if (bridge.running) {
    return "运行中";
  }
  if (bridge.tokenExists) {
    return "已绑定";
  }
  return "未绑定";
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
          <Button size="small" variant="text" onClick={() => void revealPath(path)} disabled={!exists}>
            打开
          </Button>
        </Stack>
      </Stack>
      <Typography variant="caption" translate="no">
        {path}
      </Typography>
    </Box>
  );
}

export default App;
