import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShortcutRoundedIcon from "@mui/icons-material/ShortcutRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
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
  createProfile,
  deleteProfile,
  importProfileAuth,
  launchProfile,
  listProfileSessions,
  listProfiles,
  readProfileQuota,
  repairProfileNetwork,
  resetProfile,
  revealPath,
  terminateProfile,
  updateProfileMetadata,
} from "./lib/api";
import type {
  CodexSessionSummary,
  CreateProfileInput,
  ProfileInfo,
  ProfileReport,
  ProfileSessionReport,
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

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
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

function sessionTimestamp(session: CodexSessionSummary): number {
  const value = session.updatedAt ?? session.startedAt;
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function profileLabel(profile: Pick<ProfileInfo, "name" | "alias">): string {
  return profile.alias || profile.name;
}

function App() {
  const [styleMode, setStyleMode] = useState<CodexManagerStyleMode>(initialStyleMode);
  const theme = useMemo(() => createRcodexManagerTheme(styleMode), [styleMode]);
  const [report, setReport] = useState<ProfileReport | null>(null);
  const [activeName, setActiveName] = useState("");
  const [query, setQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProfileInput>(DEFAULT_FORM);
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
  const [sessionCategory, setSessionCategory] = useState("all");
  const [sessionPage, setSessionPage] = useState(1);

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
  const sessionItems = useMemo<SessionCenterItem[]>(() => {
    if (sessionReport) {
      return sessionReport.sessions.map((item) => ({
        profile: {
          name: item.profileName,
          alias: item.profileAlias,
          category: item.profileCategory,
          isDefault: item.isDefault,
        },
        session: item.session,
      }));
    }

    return profiles
      .flatMap((profile) =>
        profile.recentSessions.map((session) => ({
          profile: {
            name: profile.name,
            alias: profile.alias,
            category: profile.category,
            isDefault: profile.isDefault,
          },
          session,
        })),
      )
      .sort((left, right) => sessionTimestamp(right.session) - sessionTimestamp(left.session));
  }, [profiles, sessionReport]);
  const knownSessionCount = sessionReport?.sessionCount ?? sessionItems.length;
  const runningCount = useMemo(
    () => profiles.filter((profile) => profile.isRunning).length,
    [profiles],
  );
  const signedInCount = useMemo(
    () => profiles.filter((profile) => Boolean(profile.account)).length,
    [profiles],
  );
  const createNameExists = existingNames.has(createDraft.name.trim());
  const canCreate = createDraft.name.trim().startsWith("codex-") && !createNameExists;
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

  async function refreshProfileSessions() {
    try {
      setSessionLoading(true);
      const nextReport = await listProfileSessions();
      setSessionReport(nextReport);
      setSessionPage(1);
    } catch (error) {
      setFeedback({
        severity: "error",
        text: errorMessage(error, "读取会话中心失败"),
      });
    } finally {
      setSessionLoading(false);
    }
  }

  function handleOpenSessionCenter() {
    setSessionDialogOpen(true);
    if (!sessionReport && !sessionLoading) {
      void refreshProfileSessions();
    }
  }

  useEffect(() => {
    void refreshProfiles();
  }, []);

  useEffect(() => {
    if (sessionDialogOpen && !sessionReport && !sessionLoading) {
      void refreshProfileSessions();
    }
  }, [sessionDialogOpen, sessionReport, sessionLoading]);

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

  function handleWindowDragMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || !isTauriRuntime()) {
      return;
    }
    void getCurrentWindow().startDragging().catch(() => undefined);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell" data-style={styleMode}>
        <a className="skip-link" href="#profile-browser">
          跳到 profile 列表
        </a>
        <Box
          className="window-drag-region"
          onMouseDown={handleWindowDragMouseDown}
        />
        <Box className="window-toolbar" aria-label="窗口工具">
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            {busyLabel ? <Chip size="small" label={busyLabel} /> : null}
            <Tooltip title="新增 profile">
              <IconButton aria-label="新增 profile" onClick={() => setCreateDialogOpen(true)}>
                <AddRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={styleMode === "light" ? "暗色模式" : "亮色模式"}>
              <IconButton
                aria-label={styleMode === "light" ? "切换到暗色模式" : "切换到亮色模式"}
                onClick={() => setStyleMode(styleMode === "light" ? "dark" : "light")}
              >
                {styleMode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="刷新">
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

        <Box className="workbench-grid">
          <main id="profile-browser" className="profile-browser">
            <Paper className="browser-panel" elevation={0}>
              <Box className="browser-header">
                <Box className="browser-title">
                  <Typography variant="h5" component="h1">Profiles</Typography>
                  <Typography className="browser-subtitle" variant="caption">
                    Codex profile 工作区
                  </Typography>
                </Box>
                <Stack className="browser-actions" direction="row" spacing={0.7}>
                  <Button
                    className="session-launch-button"
                    size="small"
                    variant="outlined"
                    startIcon={<TerminalRoundedIcon />}
                    onClick={handleOpenSessionCenter}
                  >
                    会话中心
                    <span className="session-launch-count">{knownSessionCount}</span>
                  </Button>
                  <Stack className="browser-metrics" direction="row" spacing={0.6}>
                    <Chip size="small" label={`${visibleProfiles.length}/${profiles.length}`} />
                    <Chip size="small" label={`运行 ${runningCount}`} />
                    <Chip size="small" label={`账号 ${signedInCount}`} />
                  </Stack>
                </Stack>
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

          <aside className="inspector-rail" aria-label="profile 详情">
            <Paper className="inspector-panel" elevation={0}>
              {activeProfile ? (
                <Stack className="inspector-content">
                  <Box className="inspector-title">
                    <Box sx={{ minWidth: 0 }}>
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
                    <Chip size="small" label={profileSourceLabel(activeProfile)} />
                  </Box>

                  <Box className="detail-tags">
                    <Chip size="small" variant="outlined" label={activeProfile.category} />
                    <Chip size="small" label={activeProfile.model ?? "unknown"} />
                    <Chip size="small" label={activeProfile.reasoningEffort ?? "unknown"} />
                  </Box>

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

                </Stack>
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
          activeProfileName={activeProfile?.name ?? ""}
          loading={sessionLoading}
          query={sessionQuery}
          category={sessionCategory}
          page={sessionPage}
          onClose={() => setSessionDialogOpen(false)}
          onRefresh={() => void refreshProfileSessions()}
          onQueryChange={(value) => {
            setSessionQuery(value);
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

function SessionCenterDialog({
  open,
  items,
  activeProfileName,
  loading,
  query,
  category,
  page,
  onClose,
  onRefresh,
  onQueryChange,
  onCategoryChange,
  onPageChange,
  onOpen,
  onCopySummary,
  onCopyReference,
}: {
  open: boolean;
  items: SessionCenterItem[];
  activeProfileName: string;
  loading: boolean;
  query: string;
  category: string;
  page: number;
  onClose: () => void;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (session: CodexSessionSummary) => void;
  onCopySummary: (item: SessionCenterItem) => void;
  onCopyReference: (item: SessionCenterItem) => void;
}) {
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.profile.category).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
      ),
    [items],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (category !== "all" && item.profile.category !== category) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [
          item.profile.name,
          item.profile.alias ?? "",
          item.profile.category,
          item.session.id,
          item.session.title,
          item.session.summary ?? "",
          item.session.cwd ?? "",
          item.session.path ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [category, items, normalizedQuery],
  );
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / SESSION_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const pageStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * SESSION_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + SESSION_PAGE_SIZE, filteredItems.length);
  const pageItems = filteredItems.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page !== currentPage) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange, page]);

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
              {items.length} 条会话
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
          <Button size="small" variant="text" startIcon={<RefreshRoundedIcon />} onClick={onRefresh} disabled={loading}>
            刷新
          </Button>
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
            className="session-dialog-category"
            select
            size="small"
            label="Profile 类型"
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
          <Button
            className="session-dialog-clear"
            size="small"
            variant="text"
            onClick={() => {
              onQueryChange("");
              onCategoryChange("all");
            }}
            disabled={!query.trim() && category === "all"}
          >
            清空
          </Button>
        </Box>

        <Box className="session-dialog-list" aria-label="会话列表">
          {pageItems.length > 0 ? (
            pageItems.map((item) => (
              <Box
                key={`${item.profile.name}-${item.session.id}-${item.session.path ?? "index"}`}
                className={`session-dialog-row ${
                  item.profile.name === activeProfileName ? "current-profile" : ""
                }`}
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
                    <Chip
                      className="session-profile-chip"
                      size="small"
                      variant={item.profile.name === activeProfileName ? "filled" : "outlined"}
                      label={profileLabel(item.profile)}
                    />
                    <Chip className="session-type-chip" size="small" variant="outlined" label={item.profile.category} />
                  </Stack>
                  {item.session.summary ? (
                    <Typography className="session-dialog-summary" variant="body2" title={item.session.summary}>
                      {item.session.summary}
                    </Typography>
                  ) : (
                    <Typography className="session-dialog-muted" variant="caption">
                      暂无摘要内容
                    </Typography>
                  )}
                  <Stack className="session-dialog-meta" direction="row" spacing={0.8}>
                    <Typography variant="caption">
                      {formatSessionTime(item.session.updatedAt ?? item.session.startedAt)}
                    </Typography>
                    {item.session.cwd ? (
                      <Typography variant="caption" translate="no" title={item.session.cwd}>
                        {compactPath(item.session.cwd)}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
                <Box className="session-dialog-actions">
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onOpen(item.session)}
                    disabled={!item.session.path}
                  >
                    打开
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ContentCopyRoundedIcon />}
                    onClick={() => onCopySummary(item)}
                  >
                    复制
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ShortcutRoundedIcon />}
                    onClick={() => onCopyReference(item)}
                  >
                    引用
                  </Button>
                </Box>
              </Box>
            ))
          ) : (
            <Box className="session-dialog-empty">
              <SearchRoundedIcon />
              <Typography variant="body2">没有匹配会话。</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions className="session-dialog-footer">
        <Typography variant="caption">
          {filteredItems.length === 0 ? "0 / 0" : `${pageStart + 1}-${pageEnd} / ${filteredItems.length}`}
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
                disabled={currentPage >= pageCount}
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
        <Box className="profile-card-subline">
          <Stack direction="row" spacing={0.7} sx={{ alignItems: "center", minWidth: 0 }}>
            <AccountCircleRoundedIcon fontSize="small" />
            <Typography variant="caption">{accountLabel(profile)}</Typography>
          </Stack>
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
          </Box>
        ) : null}
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
  const account = profile.account;
  if (!account) {
    return "未登录";
  }
  return account.email ?? account.name ?? account.accountId ?? account.authMode ?? "已登录";
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
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
