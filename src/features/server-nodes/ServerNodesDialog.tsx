import { useEffect, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import SyncAltRoundedIcon from "@mui/icons-material/SyncAltRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DialogTabs,
  DialogToolbar,
  EmptyState,
  ErrorState,
  ManagerDialogShell,
  MasterDetailLayout,
  SensitiveActionConfirmDialog,
  StatusBadge,
  type StatusTone,
} from "../../components/manager";
import {
  deleteServerNode,
  listProfiles as listLocalProfiles,
  listServerNodes,
  listSshHosts,
  probeServerNode,
  runServerNodeOperation,
  syncServerProfile,
  upsertServerNode,
} from "../../lib/api";
import type {
  CodexSessionSummary,
  CreateProfileInput,
  DoctorReport,
  AuthVaultReport,
  FeishuRemoteReport,
  ListProfileSessionsInput,
  ModelRoutePreset,
  ModelRoutePreview,
  ModelRouteProxyCheckResult,
  ModelRouteReport,
  ProfileInfo,
  ProfileReport,
  ProfileSessionReport,
  ProfileSessionSummary,
  ServerNodeProbeReport,
  ServerNodeReport,
  SshHostOption,
  SshHostReport,
  SyncServerProfileReport,
  ServerNodeOperation,
  ServerNodeOperationReport,
  UpsertServerNodeInput,
  WechatBridgeReport,
} from "../../lib/types";
import {
  clearServerNodeCacheForNode,
  readServerNodeCache,
  SERVER_NODE_CACHE_TTL_MS,
  serverNodeCacheKey,
  writeServerNodeCache,
} from "./serverNodeCache";
import {
  appendServerNodeTask,
  classifyServerNodeError,
  failedServerNodeTask,
  formatServerNodeDiagnostic,
  redactServerNodeText,
  serverNodeOperationLabel,
  taskFromServerNodeReport,
  type ServerNodeTaskEntry,
} from "./serverNodeTasks";
import { visibleWechatLog, wechatStatePresentation } from "./serverWechat";
import {
  PROFILE_SORT_OPTIONS,
  parseProfileSortMode,
  sortProfiles,
  type ProfileSortMode,
} from "../../lib/profileSorting";
import "../manager-dialogs.css";

type Feedback = { severity: "success" | "warning" | "error"; text: string };
type ServerResource = "profiles" | "sessions" | "auth" | "routes" | "channels" | "doctor";
type CachedChannels = { wechat: WechatBridgeReport; feishu: FeishuRemoteReport };

const EMPTY_NODE_DRAFT: UpsertServerNodeInput = {
  id: null,
  name: "",
  sshTarget: "",
  remoteBinary: "rcodexmanager",
};

const EMPTY_PROFILE_DRAFT: CreateProfileInput = {
  name: "codex-o",
  codexHome: null,
  userDataDir: null,
  model: "gpt-5.5",
  reasoningEffort: "xhigh",
  alias: "",
  category: "服务器",
  note: null,
};

const MIN_PROFILE_MODEL_UPDATE_VERSION = "0.1.2";
const COMMON_REASONING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"];
const SERVER_PROFILE_SORT_STORAGE_KEY = "rcodexmanager-server-profile-sort";
const SELECTED_SERVER_NODE_STORAGE_KEY = "rcodexmanager-selected-server-node";

function selectedServerProfileStorageKey(nodeId: string): string {
  return `rcodexmanager-selected-server-profile:${nodeId}`;
}

function storedServerNodeId(): string {
  return window.localStorage.getItem(SELECTED_SERVER_NODE_STORAGE_KEY)?.trim() || "";
}

function storedServerProfileName(nodeId: string): string {
  return window.localStorage.getItem(selectedServerProfileStorageKey(nodeId))?.trim() || "";
}

function storedServerProfileSort(): ProfileSortMode {
  return parseProfileSortMode(window.localStorage.getItem(SERVER_PROFILE_SORT_STORAGE_KEY));
}

function versionAtLeast(value: string | null | undefined, minimum: string): boolean {
  if (!value) return false;
  const current = value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const required = minimum.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    if ((current[index] || 0) > (required[index] || 0)) return true;
    if ((current[index] || 0) < (required[index] || 0)) return false;
  }
  return true;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return redactServerNodeText(error.message);
  if (typeof error === "string" && error) return redactServerNodeText(error);
  return redactServerNodeText(fallback);
}

function statusTone(probe: ServerNodeProbeReport | null): StatusTone {
  if (!probe) return "neutral";
  if (!probe.status.reachable) return "error";
  if (!probe.status.cliInstalled || !probe.status.codexInstalled) return "warning";
  return "success";
}

function statusLabel(probe: ServerNodeProbeReport | null): string {
  if (!probe) return "未检查";
  if (!probe.status.reachable) return "连接失败";
  if (!probe.status.cliInstalled) return "待安装节点 CLI";
  if (!probe.status.codexInstalled) return "未安装 Codex";
  return "可用";
}

function actionLabel(action: string): string {
  if (action.startsWith("retry:")) return "正在重试只读任务";
  if (action === "refresh") return "检查节点连接";
  if (action === "sessions") return "读取服务器会话";
  if (action === "auth") return "读取服务器认证库";
  if (action === "routes") return "读取模型路由";
  if (action === "channels") return "读取远程渠道";
  if (action === "doctor") return "运行服务器诊断";
  if (action === "create-profile") return "创建服务器 Profile";
  if (action === "load-local-profiles") return "读取本机 Profiles";
  if (action === "sync-profile") return "同步 Profile 到服务器";
  if (action === "update-model") return "更新服务器模型";
  if (action.startsWith("launch-profile:")) return "启动服务器 Profile";
  if (action.startsWith("terminate-profile:")) return "停止服务器 Profile";
  if (action.startsWith("auth-")) return "更新服务器认证库";
  if (action.startsWith("route-")) return "处理服务器模型路由";
  if (action.startsWith("wechat-")) return "更新微信桥接";
  if (action.startsWith("feishu-")) return "更新飞书渠道";
  return "处理服务器任务";
}

function shortOperationId(operationId: string): string {
  const compact = operationId.replace(/^node-op-/, "");
  return `任务 ${compact.length > 11 ? `…${compact.slice(-11)}` : compact}`;
}

function taskTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function sessionListVariant(input: ListProfileSessionsInput): string {
  return [
    input.profileName || "all",
    input.query?.trim().toLowerCase() || "all",
    input.offset,
    input.limit,
  ].join("|");
}

function sessionDetailVariant(item: ProfileSessionSummary): string {
  return `${item.profileName}|${item.session.id}|${item.session.updatedAt || "unknown"}`;
}

function remoteSessionKey(item: ProfileSessionSummary): string {
  return sessionDetailVariant(item);
}

function formatRemoteTime(value: string | null | undefined): string {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function accountIdentity(profile: ProfileInfo | null): string {
  if (!profile?.account) return "未登录";
  return profile.account.email || profile.account.name || "已登录";
}

function accountPlan(profile: ProfileInfo | null): string {
  if (!profile?.account) return "-";
  return [profile.account.planType, profile.account.organizationTitle]
    .filter(Boolean)
    .join(" · ") || profile.account.authMode || "-";
}

export function ServerNodesDialog({
  open,
  onClose,
  onFeedback,
}: {
  open: boolean;
  onClose: () => void;
  onFeedback?: (feedback: Feedback) => void;
}) {
  const [report, setReport] = useState<ServerNodeReport | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(storedServerNodeId);
  const [probe, setProbe] = useState<ServerNodeProbeReport | null>(null);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfileName, setSelectedProfileName] = useState("");
  const [profileSort, setProfileSort] = useState<ProfileSortMode>(storedServerProfileSort);
  const [sessions, setSessions] = useState<ProfileSessionReport | null>(null);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionProfileName, setSessionProfileName] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState(10);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [sessionDetail, setSessionDetail] = useState<CodexSessionSummary | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [sessionDetailError, setSessionDetailError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthVaultReport | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [routes, setRoutes] = useState<ModelRouteReport | null>(null);
  const [routePreset, setRoutePreset] = useState<ModelRoutePreset>("aliyun-qwen");
  const [routeModel, setRouteModel] = useState("qwen3-coder-plus");
  const [routeProxyUrl, setRouteProxyUrl] = useState("http://127.0.0.1:15721/v1");
  const [routeUpstreamUrl, setRouteUpstreamUrl] = useState("https://dashscope.aliyuncs.com/compatible-mode/v1");
  const [routeApiKeyEnv, setRouteApiKeyEnv] = useState("");
  const [routePreview, setRoutePreview] = useState<ModelRoutePreview | null>(null);
  const [routeCheck, setRouteCheck] = useState<ModelRouteProxyCheckResult | null>(null);
  const [wechat, setWechat] = useState<WechatBridgeReport | null>(null);
  const [feishu, setFeishu] = useState<FeishuRemoteReport | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [taskHistory, setTaskHistory] = useState<ServerNodeTaskEntry[]>([]);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);
  const [resourceUpdatedAt, setResourceUpdatedAt] = useState<Partial<Record<ServerResource, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [nodeDraft, setNodeDraft] = useState<UpsertServerNodeInput>(EMPTY_NODE_DRAFT);
  const [sshHostReport, setSshHostReport] = useState<SshHostReport | null>(null);
  const [sshHostsLoading, setSshHostsLoading] = useState(false);
  const [sshHostsError, setSshHostsError] = useState<string | null>(null);
  const [nodeAdvancedOpen, setNodeAdvancedOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<CreateProfileInput>(EMPTY_PROFILE_DRAFT);
  const [profileModelDialogOpen, setProfileModelDialogOpen] = useState(false);
  const [profileModelDraft, setProfileModelDraft] = useState({ model: "", reasoningEffort: "xhigh" });
  const [profileSyncDialogOpen, setProfileSyncDialogOpen] = useState(false);
  const [localProfiles, setLocalProfiles] = useState<ProfileInfo[]>([]);
  const [syncSourceProfileName, setSyncSourceProfileName] = useState("");
  const [syncTargetProfileName, setSyncTargetProfileName] = useState("");
  const [syncAuth, setSyncAuth] = useState(true);
  const [confirmAction, setConfirmAction] = useState<
    "delete-node" | "terminate-profile" | "apply-auth" | "apply-route" | "restore-route" | "sync-profile" | "update-model" | null
  >(null);
  const sessionListRequestRef = useRef(0);
  const sessionDetailRequestRef = useRef(0);
  const selectedNodeIdRef = useRef("");

  const nodes = report?.nodes ?? [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const sortedProfiles = useMemo(() => sortProfiles(profiles, profileSort), [profileSort, profiles]);
  const selectedProfile = profiles.find((profile) => profile.name === selectedProfileName) ?? null;
  const selectedBackup = auth?.backups.find((backup) => backup.id === selectedBackupId) ?? null;
  const selectedRoute = routes?.profiles.find((profile) => profile.profileName === selectedProfileName) ?? null;
  const selectedWechat = wechat?.bridges.find((bridge) => bridge.profileName === selectedProfileName) ?? null;
  const selectedWechatIsExternal = Boolean(
    selectedWechat
    && selectedWechat.managedByApp === false
    && (selectedWechat.tokenExists || selectedWechat.running),
  );
  const selectedWechatState = wechatStatePresentation(selectedWechat?.connectionState);
  const selectedWechatLog = selectedWechat ? visibleWechatLog(selectedWechat.logTail) : "";
  const syncSourceProfile = localProfiles.find((profile) => profile.name === syncSourceProfileName) ?? null;
  const syncTargetExists = profiles.some((profile) => profile.name === syncTargetProfileName.trim());
  const supportsProfileModelUpdate = versionAtLeast(
    probe?.status.cliVersion,
    MIN_PROFILE_MODEL_UPDATE_VERSION,
  );
  const profileModelOptions = useMemo(() => Array.from(new Set([
    ...profiles.map((profile) => profile.model),
    ...(routes?.presets.map((preset) => preset.defaultModel) ?? []),
  ].filter((value): value is string => Boolean(value?.trim())))).sort(), [profiles, routes]);
  const reasoningOptions = useMemo(() => Array.from(new Set([
    ...COMMON_REASONING_LEVELS,
    ...profiles.map((profile) => profile.reasoningEffort).filter((value): value is string => Boolean(value)),
  ])), [profiles]);
  const selectedSession = sessions?.sessions.find((item) => remoteSessionKey(item) === selectedSessionKey) ?? null;
  const selectedTasks = useMemo(
    () => taskHistory.filter((task) => task.nodeId === selectedNodeId),
    [selectedNodeId, taskHistory],
  );
  const latestTask = selectedTasks[0] ?? null;
  const errorGuide = error ? classifyServerNodeError(error) : null;
  const activeResource = (["profiles", "sessions", "auth", "routes", "channels", "doctor"] as const)
    .find((resource) => resource === tab) ?? null;
  const activeResourceUpdatedAt = activeResource ? resourceUpdatedAt[activeResource] : undefined;
  const filteredNodes = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return nodes;
    return nodes.filter((node) => `${node.name} ${node.sshTarget}`.toLowerCase().includes(value));
  }, [nodes, query]);

  useEffect(() => {
    if (!open) return;
    void loadNodes();
  }, [open]);

  useEffect(() => {
    if (!nodeDialogOpen || sshHostReport || sshHostsLoading || sshHostsError) return;
    void loadAvailableSshHosts();
  }, [nodeDialogOpen, sshHostReport, sshHostsError, sshHostsLoading]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    if (selectedNodeId) {
      window.localStorage.setItem(SELECTED_SERVER_NODE_STORAGE_KEY, selectedNodeId);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    window.localStorage.setItem(SERVER_PROFILE_SORT_STORAGE_KEY, profileSort);
  }, [profileSort]);

  useEffect(() => {
    if (selectedNodeId && selectedProfileName) {
      window.localStorage.setItem(selectedServerProfileStorageKey(selectedNodeId), selectedProfileName);
    }
  }, [selectedNodeId, selectedProfileName]);

  useEffect(() => {
    if (!open || !selectedNodeId) return;
    const rememberedProfileName = storedServerProfileName(selectedNodeId);
    setSelectedProfileName(rememberedProfileName);
    hydrateNodeCache(selectedNodeId, rememberedProfileName);
    setRoutePreview(null);
    setRouteCheck(null);
    setTaskHistoryOpen(false);
    setSessionQuery("");
    setSessionProfileName("");
    setSessionPage(1);
    setSelectedSessionKey("");
    setSessionDetail(null);
    setSessionDetailError(null);
    setSessionLoading(false);
    setSessionDetailLoading(false);
    sessionListRequestRef.current += 1;
    sessionDetailRequestRef.current += 1;
    setTab("overview");
    void refreshSelectedNode(selectedNodeId);
  }, [open, selectedNodeId]);

  useEffect(() => {
    setRoutePreview(null);
    setRouteCheck(null);
  }, [selectedProfileName]);

  useEffect(() => {
    if (
      !open
      || tab !== "channels"
      || !selectedNodeId
      || !selectedProfileName
      || selectedWechat?.connectionState !== "awaiting-scan"
    ) return;

    let cancelled = false;
    const pollWechat = async () => {
      try {
        const result = await runServerNodeOperation<WechatBridgeReport>({
          nodeId: selectedNodeId,
          operation: { kind: "wechat-status", profileName: null },
        });
        if (cancelled || !result.ok || !result.data) return;
        setWechat(result.data);
        if (feishu) rememberResource(selectedNodeId, "channels", { wechat: result.data, feishu });
        const bridge = result.data.bridges.find((item) => item.profileName === selectedProfileName);
        if (bridge?.connectionState === "running" || bridge?.tokenExists) {
          onFeedback?.({ severity: "success", text: `${selectedProfileName} 微信绑定成功` });
        }
      } catch {
        // Keep the existing channel state; the next manual refresh can surface transport errors.
      }
    };
    const timer = window.setInterval(() => void pollWechat(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    open,
    tab,
    selectedNodeId,
    selectedProfileName,
    selectedWechat?.connectionState,
    feishu,
    onFeedback,
  ]);

  useEffect(() => {
    if (!open || tab !== "sessions" || !selectedNodeId || !probe?.status.cliInstalled) return;
    const timeout = window.setTimeout(() => void loadSessions(), 280);
    return () => window.clearTimeout(timeout);
  }, [
    open,
    tab,
    selectedNodeId,
    probe?.status.cliInstalled,
    sessionQuery,
    sessionProfileName,
    sessionPage,
    sessionPageSize,
  ]);

  useEffect(() => {
    setSelectedSessionKey("");
    setSessionDetail(null);
    setSessionDetailError(null);
    setSessionDetailLoading(false);
    sessionDetailRequestRef.current += 1;
  }, [selectedNodeId, sessionQuery, sessionProfileName, sessionPage, sessionPageSize]);

  async function executeRemote<T>(
    operation: ServerNodeOperation,
    nodeId = selectedNodeId,
  ): Promise<ServerNodeOperationReport<T>> {
    if (!nodeId) throw new Error("请先选择服务器节点");
    const startedAt = new Date().toISOString();
    const started = performance.now();
    try {
      const result = await runServerNodeOperation<T>({ nodeId, operation });
      setTaskHistory((current) => appendServerNodeTask(
        current,
        taskFromServerNodeReport(operation, result as ServerNodeOperationReport),
      ));
      return result;
    } catch (remoteError) {
      const message = messageOf(remoteError, "远程任务执行失败");
      setTaskHistory((current) => appendServerNodeTask(
        current,
        failedServerNodeTask(nodeId, operation, message, startedAt, Math.round(performance.now() - started)),
      ));
      throw remoteError;
    }
  }

  async function copyTaskDiagnostic(task: ServerNodeTaskEntry | null = latestTask) {
    if (!selectedNode) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("当前环境不支持写入剪贴板");
      await navigator.clipboard.writeText(formatServerNodeDiagnostic(
        selectedNode.name,
        selectedNode.sshTarget,
        task,
        error,
      ));
      onFeedback?.({ severity: "success", text: "服务器诊断信息已复制" });
    } catch (copyError) {
      onFeedback?.({ severity: "error", text: messageOf(copyError, "复制诊断信息失败") });
    }
  }

  async function retryRemoteTask(task: ServerNodeTaskEntry) {
    const operation = task.retryOperation;
    const nodeId = selectedNodeId;
    if (!operation || !nodeId) return;
    setAction(`retry:${operation.kind}`);
    setError(null);
    try {
      const result = await executeRemote<unknown>(operation, nodeId);
      if (!result.ok || result.data == null) {
        throw new Error(result.error?.message || `${serverNodeOperationLabel(operation)}失败`);
      }
      switch (operation.kind) {
        case "doctor":
          setDoctor(result.data as DoctorReport);
          rememberResource(nodeId, "doctor", result.data as DoctorReport);
          setTab("doctor");
          break;
        case "list-profiles": {
          const next = result.data as ProfileReport;
          setProfiles(next.profiles);
          rememberResource(nodeId, "profiles", next);
          setSelectedProfileName((current) => (
            next.profiles.some((profile) => profile.name === current)
              ? current
              : sortProfiles(next.profiles, profileSort)[0]?.name ?? ""
          ));
          break;
        }
        case "list-sessions": {
          const next = result.data as ProfileSessionReport;
          setSessions(next);
          rememberResource(nodeId, "sessions", next, sessionListVariant(operation.input));
          break;
        }
        case "auth-status": {
          const next = result.data as AuthVaultReport;
          setAuth(next);
          rememberResource(nodeId, "auth", next);
          setSelectedBackupId((current) => (
            next.backups.some((backup) => backup.id === current)
              ? current
              : next.backups[0]?.id ?? ""
          ));
          break;
        }
        case "wechat-status":
          setWechat(result.data as WechatBridgeReport);
          break;
        case "feishu-status":
          setFeishu(result.data as FeishuRemoteReport);
          break;
        case "model-route-status":
          setRoutes(result.data as ModelRouteReport);
          rememberResource(nodeId, "routes", result.data as ModelRouteReport);
          break;
        case "model-route-preview":
          setRoutePreview(result.data as ModelRoutePreview);
          break;
        case "model-route-check":
          setRouteCheck(result.data as ModelRouteProxyCheckResult);
          break;
        case "read-session":
          break;
      }
      onFeedback?.({ severity: "success", text: `${serverNodeOperationLabel(operation)}已完成` });
    } catch (retryError) {
      setError(messageOf(retryError, `${serverNodeOperationLabel(operation)}失败`));
    } finally {
      setAction(null);
    }
  }

  async function remoteData<T>(operation: ServerNodeOperation, nodeId = selectedNodeId): Promise<T> {
    const result = await executeRemote<T>(operation, nodeId);
    if (!result.ok || result.data == null) {
      throw new Error(result.error?.message || `远程命令 ${result.command} 执行失败`);
    }
    return result.data;
  }

  function rememberResource<T>(
    nodeId: string,
    resource: ServerResource,
    data: T,
    variant = "default",
  ) {
    const cached = writeServerNodeCache(serverNodeCacheKey(nodeId, resource, variant), data);
    setResourceUpdatedAt((current) => ({ ...current, [resource]: cached.updatedAt }));
  }

  function hydrateNodeCache(nodeId: string, rememberedProfileName = storedServerProfileName(nodeId)) {
    const cachedProbe = readServerNodeCache<ServerNodeProbeReport>(serverNodeCacheKey(nodeId, "probe"));
    const cachedProfiles = readServerNodeCache<ProfileReport>(serverNodeCacheKey(nodeId, "profiles"));
    const cachedAuth = readServerNodeCache<AuthVaultReport>(serverNodeCacheKey(nodeId, "auth"));
    const cachedRoutes = readServerNodeCache<ModelRouteReport>(serverNodeCacheKey(nodeId, "routes"));
    const cachedChannels = readServerNodeCache<CachedChannels>(serverNodeCacheKey(nodeId, "channels"));
    const cachedDoctor = readServerNodeCache<DoctorReport>(serverNodeCacheKey(nodeId, "doctor"));

    setProbe(cachedProbe?.data ?? null);
    setProfiles(cachedProfiles?.data.profiles ?? []);
    const nextProfiles = cachedProfiles?.data.profiles ?? [];
    setSelectedProfileName(
      nextProfiles.length === 0
        ? rememberedProfileName
        : nextProfiles.some((profile) => profile.name === rememberedProfileName)
        ? rememberedProfileName
        : sortProfiles(nextProfiles, profileSort)[0]?.name ?? "",
    );
    setSessions(null);
    setAuth(cachedAuth?.data ?? null);
    setSelectedBackupId((current) => {
      const backups = cachedAuth?.data.backups ?? [];
      return backups.some((backup) => backup.id === current) ? current : backups[0]?.id ?? "";
    });
    setRoutes(cachedRoutes?.data ?? null);
    setWechat(cachedChannels?.data.wechat ?? null);
    setFeishu(cachedChannels?.data.feishu ?? null);
    setDoctor(cachedDoctor?.data ?? null);
    setResourceUpdatedAt({
      ...(cachedProfiles ? { profiles: cachedProfiles.updatedAt } : {}),
      ...(cachedAuth ? { auth: cachedAuth.updatedAt } : {}),
      ...(cachedRoutes ? { routes: cachedRoutes.updatedAt } : {}),
      ...(cachedChannels ? { channels: cachedChannels.updatedAt } : {}),
      ...(cachedDoctor ? { doctor: cachedDoctor.updatedAt } : {}),
    });
  }

  function currentSessionInput(): ListProfileSessionsInput {
    return {
      profileName: sessionProfileName || null,
      category: null,
      query: sessionQuery.trim() || null,
      offset: (sessionPage - 1) * sessionPageSize,
      limit: sessionPageSize,
    };
  }

  async function loadSessions(force = false) {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    const input = currentSessionInput();
    const variant = sessionListVariant(input);
    const key = serverNodeCacheKey(nodeId, "sessions", variant);
    const cached = readServerNodeCache<ProfileSessionReport>(key);
    if (cached) {
      setSessions(cached.data);
      setResourceUpdatedAt((current) => ({ ...current, sessions: cached.updatedAt }));
      if (cached.fresh && !force) return;
    } else {
      setSessions(null);
    }
    const requestId = ++sessionListRequestRef.current;
    setSessionLoading(true);
    setError(null);
    try {
      const next = await remoteData<ProfileSessionReport>({
        kind: "list-sessions",
        input,
      }, nodeId);
      if (requestId !== sessionListRequestRef.current || nodeId !== selectedNodeIdRef.current) return;
      setSessions(next);
      rememberResource(nodeId, "sessions", next, variant);
    } catch (loadError) {
      if (requestId !== sessionListRequestRef.current || nodeId !== selectedNodeIdRef.current) return;
      setError(messageOf(loadError, "读取服务器会话失败"));
    } finally {
      if (requestId === sessionListRequestRef.current) setSessionLoading(false);
    }
  }

  async function selectRemoteSession(item: ProfileSessionSummary, force = false) {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    const itemKey = remoteSessionKey(item);
    const cacheKey = serverNodeCacheKey(nodeId, "session-detail", sessionDetailVariant(item));
    setSelectedSessionKey(itemKey);
    setSessionDetailError(null);
    const cached = readServerNodeCache<CodexSessionSummary>(cacheKey);
    if (cached) {
      setSessionDetail(cached.data);
      if (cached.fresh && !force) return;
    } else {
      setSessionDetail(null);
    }
    const requestId = ++sessionDetailRequestRef.current;
    setSessionDetailLoading(true);
    try {
      const next = await remoteData<CodexSessionSummary>({
        kind: "read-session",
        input: {
          profileName: item.profileName,
          sessionId: item.session.id,
          updatedAt: item.session.updatedAt,
        },
      }, nodeId);
      if (
        requestId !== sessionDetailRequestRef.current
        || nodeId !== selectedNodeIdRef.current
      ) return;
      writeServerNodeCache(cacheKey, next);
      setSessionDetail(next);
    } catch (detailError) {
      if (requestId !== sessionDetailRequestRef.current || nodeId !== selectedNodeIdRef.current) return;
      setSessionDetailError(messageOf(detailError, "读取服务器会话详情失败"));
    } finally {
      if (requestId === sessionDetailRequestRef.current) setSessionDetailLoading(false);
    }
  }

  async function loadAuth() {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    setAction("auth");
    setError(null);
    try {
      const next = await remoteData<AuthVaultReport>({ kind: "auth-status" }, nodeId);
      if (nodeId !== selectedNodeIdRef.current) return;
      setAuth(next);
      rememberResource(nodeId, "auth", next);
      setSelectedBackupId((current) =>
        next.backups.some((backup) => backup.id === current) ? current : next.backups[0]?.id ?? "",
      );
    } catch (loadError) {
      setError(messageOf(loadError, "读取服务器认证库失败"));
    } finally {
      setAction(null);
    }
  }

  async function loadRoutes() {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    setAction("routes");
    setError(null);
    try {
      const next = await remoteData<ModelRouteReport>({
        kind: "model-route-status",
        profileName: null,
      }, nodeId);
      if (nodeId !== selectedNodeIdRef.current) return;
      setRoutes(next);
      rememberResource(nodeId, "routes", next);
    } catch (loadError) {
      setError(messageOf(loadError, "读取服务器模型路由失败"));
    } finally {
      setAction(null);
    }
  }

  async function loadChannels() {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    setAction("channels");
    setError(null);
    try {
      const nextWechat = await remoteData<WechatBridgeReport>({
        kind: "wechat-status",
        profileName: null,
      }, nodeId);
      const nextFeishu = await remoteData<FeishuRemoteReport>({ kind: "feishu-status" }, nodeId);
      if (nodeId !== selectedNodeIdRef.current) return;
      setWechat(nextWechat);
      setFeishu(nextFeishu);
      rememberResource(nodeId, "channels", { wechat: nextWechat, feishu: nextFeishu });
    } catch (loadError) {
      setError(messageOf(loadError, "读取服务器远程渠道失败"));
    } finally {
      setAction(null);
    }
  }

  function selectTab(value: string) {
    setTab(value);
    if (!probe?.status.cliInstalled) return;
    const stale = (resource: ServerResource) => (
      !resourceUpdatedAt[resource]
      || Date.now() - resourceUpdatedAt[resource]! >= SERVER_NODE_CACHE_TTL_MS
    );
    if (value === "auth" && (!auth || stale("auth"))) void loadAuth();
    if (value === "routes" && (!routes || stale("routes"))) void loadRoutes();
    if (value === "channels" && ((!wechat && !feishu) || stale("channels"))) void loadChannels();
    if (value === "doctor" && (!doctor || stale("doctor"))) void runDoctor();
  }

  function refreshActiveResource() {
    if (!selectedNodeId) {
      void loadNodes();
      return;
    }
    if (tab === "sessions") {
      void loadSessions(true);
    } else if (tab === "auth") {
      void loadAuth();
    } else if (tab === "routes") {
      void loadRoutes();
    } else if (tab === "channels") {
      void loadChannels();
    } else if (tab === "doctor") {
      void runDoctor();
    } else {
      void refreshSelectedNode();
    }
  }

  async function loadNodes() {
    setLoading(true);
    setError(null);
    try {
      const next = await listServerNodes();
      setReport(next);
      setSelectedNodeId((current) =>
        next.nodes.some((node) => node.id === current) ? current : next.nodes[0]?.id ?? "",
      );
    } catch (loadError) {
      setError(messageOf(loadError, "读取服务器节点失败"));
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableSshHosts() {
    if (sshHostsLoading) return;
    setSshHostsLoading(true);
    setSshHostsError(null);
    try {
      setSshHostReport(await listSshHosts());
    } catch (loadError) {
      setSshHostsError(messageOf(loadError, "读取 SSH 主机配置失败"));
    } finally {
      setSshHostsLoading(false);
    }
  }

  function selectSshHost(value: string | SshHostOption | null) {
    const sshTarget = typeof value === "string" ? value : value?.alias ?? "";
    setNodeDraft((current) => ({
      ...current,
      sshTarget,
      name: !current.id && !current.name.trim() && sshTarget ? sshTarget : current.name,
    }));
  }

  async function refreshSelectedNode(nodeId = selectedNodeId) {
    if (!nodeId) return;
    setAction("refresh");
    setError(null);
    try {
      const nextProbe = await probeServerNode(nodeId);
      if (nodeId !== selectedNodeIdRef.current) return;
      setProbe(nextProbe);
      writeServerNodeCache(serverNodeCacheKey(nodeId, "probe"), nextProbe);
      if (!nextProbe.status.reachable) {
        setError(nextProbe.status.error || "无法通过 SSH 连接服务器节点");
        return;
      }
      if (nextProbe.status.reachable && nextProbe.status.cliInstalled) {
        const result = await executeRemote<ProfileReport>({ kind: "list-profiles" }, nodeId);
        if (!result.ok || !result.data) {
          throw new Error(result.error?.message || "远程 profile 列表读取失败");
        }
        if (nodeId !== selectedNodeIdRef.current) return;
        setProfiles(result.data.profiles);
        rememberResource(nodeId, "profiles", result.data);
        setSelectedProfileName((current) =>
          result.data?.profiles.some((profile) => profile.name === current)
            ? current
            : sortProfiles(result.data?.profiles ?? [], profileSort)[0]?.name ?? "",
        );
      }
    } catch (refreshError) {
      setError(messageOf(refreshError, "服务器连接检查失败"));
    } finally {
      setAction(null);
    }
  }

  async function runDoctor() {
    const nodeId = selectedNodeId;
    if (!nodeId) return;
    setAction("doctor");
    setError(null);
    try {
      const result = await executeRemote<DoctorReport>({ kind: "doctor" }, nodeId);
      if (!result.ok || !result.data) throw new Error(result.error?.message || "远程诊断失败");
      if (nodeId !== selectedNodeIdRef.current) return;
      setDoctor(result.data);
      rememberResource(nodeId, "doctor", result.data);
    } catch (doctorError) {
      setError(messageOf(doctorError, "远程诊断失败"));
    } finally {
      setAction(null);
    }
  }

  async function saveNode() {
    setAction("save-node");
    try {
      if (nodeDraft.id) clearServerNodeCacheForNode(nodeDraft.id);
      const next = await upsertServerNode(nodeDraft);
      setReport(next);
      const selected = nodeDraft.id
        ? next.nodes.find((node) => node.id === nodeDraft.id)
        : next.nodes.find((node) => node.sshTarget === nodeDraft.sshTarget.trim());
      setSelectedNodeId(selected?.id ?? next.nodes[0]?.id ?? "");
      setNodeDialogOpen(false);
      onFeedback?.({ severity: "success", text: "服务器节点已保存" });
    } catch (saveError) {
      setError(messageOf(saveError, "保存服务器节点失败"));
    } finally {
      setAction(null);
    }
  }

  async function deleteSelectedNode() {
    if (!selectedNode) return;
    setAction("delete-node");
    try {
      clearServerNodeCacheForNode(selectedNode.id);
      window.localStorage.removeItem(selectedServerProfileStorageKey(selectedNode.id));
      const next = await deleteServerNode(selectedNode.id);
      setReport(next);
      setSelectedNodeId(next.nodes[0]?.id ?? "");
      setProbe(null);
      setProfiles([]);
      setConfirmAction(null);
      onFeedback?.({ severity: "success", text: "服务器节点配置已移除，服务器数据未改动" });
    } catch (deleteError) {
      setError(messageOf(deleteError, "移除服务器节点失败"));
    } finally {
      setAction(null);
    }
  }

  async function runProfileAction(kind: "launch-profile" | "terminate-profile", profileName: string) {
    if (!selectedNodeId) return;
    setAction(`${kind}:${profileName}`);
    try {
      const result = await executeRemote({ kind, profileName });
      if (!result.ok) throw new Error(result.error?.message || "远程操作失败");
      setConfirmAction(null);
      await refreshSelectedNode(selectedNodeId);
      onFeedback?.({ severity: "success", text: kind === "launch-profile" ? `${profileName} 已启动` : `${profileName} 已停止` });
    } catch (profileError) {
      setError(messageOf(profileError, "远程 profile 操作失败"));
    } finally {
      setAction(null);
    }
  }

  async function createServerProfile() {
    if (!selectedNodeId) return;
    setAction("create-profile");
    try {
      const result = await executeRemote({ kind: "create-profile", input: profileDraft });
      if (!result.ok) throw new Error(result.error?.message || "创建服务器 profile 失败");
      setProfileDialogOpen(false);
      await refreshSelectedNode(selectedNodeId);
      onFeedback?.({ severity: "success", text: `${profileDraft.name} 已在服务器创建` });
    } catch (createError) {
      setError(messageOf(createError, "创建服务器 profile 失败"));
    } finally {
      setAction(null);
    }
  }

  function openProfileModelDialog() {
    if (!selectedProfile) return;
    setProfileModelDraft({
      model: selectedProfile.model || "",
      reasoningEffort: selectedProfile.reasoningEffort || "xhigh",
    });
    setProfileModelDialogOpen(true);
  }

  async function updateSelectedProfileModel() {
    if (!selectedNodeId || !selectedProfile) return;
    setAction("update-model");
    setError(null);
    try {
      const result = await executeRemote({
        kind: "update-profile-model",
        input: {
          profileName: selectedProfile.name,
          model: profileModelDraft.model.trim(),
          reasoningEffort: profileModelDraft.reasoningEffort.trim() || null,
        },
      });
      if (!result.ok) throw new Error(result.error?.message || "更新服务器模型失败");
      setConfirmAction(null);
      setProfileModelDialogOpen(false);
      clearServerNodeCacheForNode(selectedNodeId);
      await refreshSelectedNode(selectedNodeId);
      onFeedback?.({
        severity: "success",
        text: `${selectedProfile.name} 已切换为 ${profileModelDraft.model.trim()}`,
      });
    } catch (updateError) {
      setConfirmAction(null);
      setError(messageOf(updateError, "更新服务器模型失败"));
    } finally {
      setAction(null);
    }
  }

  async function openProfileSyncDialog() {
    setAction("load-local-profiles");
    setError(null);
    try {
      const local = await listLocalProfiles();
      const preferred = local.profiles.find((profile) => (
        profile.name.startsWith("codex-")
        && !profiles.some((remoteProfile) => remoteProfile.name === profile.name)
      )) ?? local.profiles.find((profile) => profile.name.startsWith("codex-"));
      setLocalProfiles(local.profiles);
      setSyncSourceProfileName(preferred?.name ?? "");
      setSyncTargetProfileName(preferred?.name ?? "");
      setSyncAuth(Boolean(preferred?.account));
      setProfileSyncDialogOpen(true);
    } catch (loadError) {
      setError(messageOf(loadError, "读取本机 Profiles 失败"));
    } finally {
      setAction(null);
    }
  }

  async function syncSelectedProfile() {
    if (!selectedNodeId || !syncSourceProfile) return;
    setAction("sync-profile");
    setError(null);
    try {
      const result: SyncServerProfileReport = await syncServerProfile({
        nodeId: selectedNodeId,
        sourceProfileName: syncSourceProfile.name,
        targetProfileName: syncTargetProfileName,
        syncAuth,
        confirmSensitive: syncAuth,
      });
      clearServerNodeCacheForNode(selectedNodeId);
      setConfirmAction(null);
      setProfileSyncDialogOpen(false);
      await refreshSelectedNode(selectedNodeId);
      setSelectedProfileName(result.targetProfileName);
      setTab("profiles");
      onFeedback?.({
        severity: "success",
        text: `${result.targetProfileName} 已同步到服务器${result.authSynced ? "并完成认证" : ""}`,
      });
    } catch (syncError) {
      setConfirmAction(null);
      setError(messageOf(syncError, "同步服务器 Profile 失败"));
    } finally {
      setAction(null);
    }
  }

  async function createRemoteAuthBackup() {
    if (!selectedProfile) return;
    setAction("auth-backup");
    setError(null);
    try {
      const next = await remoteData<AuthVaultReport>({
        kind: "create-auth-backup",
        profileName: selectedProfile.name,
        label: `${selectedProfile.alias || selectedProfile.name} 服务器备份`,
      });
      setAuth(next);
      rememberResource(selectedNodeId, "auth", next);
      setSelectedBackupId(next.backups[0]?.id ?? "");
      onFeedback?.({ severity: "success", text: `${selectedProfile.name} 认证备份已创建` });
    } catch (backupError) {
      setError(messageOf(backupError, "创建服务器认证备份失败"));
    } finally {
      setAction(null);
    }
  }

  async function applyRemoteAuth() {
    if (!selectedProfile || !selectedBackup) return;
    setAction("auth-apply");
    setError(null);
    try {
      await remoteData({
        kind: "apply-auth-backup",
        backupId: selectedBackup.id,
        targetProfileName: selectedProfile.name,
        confirmSensitive: true,
      });
      setConfirmAction(null);
      await refreshSelectedNode(selectedNodeId);
      await loadAuth();
      onFeedback?.({ severity: "success", text: `认证备份已应用到 ${selectedProfile.name}` });
    } catch (applyError) {
      setError(messageOf(applyError, "应用服务器认证备份失败"));
    } finally {
      setAction(null);
    }
  }

  function routeDraft() {
    if (!selectedProfile) return null;
    return {
      profileName: selectedProfile.name,
      preset: routePreset,
      model: routeModel.trim(),
      reasoningEffort: selectedProfile.reasoningEffort || "xhigh",
      proxyBaseUrl: routeProxyUrl.trim() || null,
      upstreamBaseUrl: routeUpstreamUrl.trim() || null,
      apiKey: null,
      apiKeyEnv: routeApiKeyEnv.trim() || null,
    };
  }

  async function previewRemoteRoute() {
    const input = routeDraft();
    if (!input) return;
    setAction("route-preview");
    setError(null);
    try {
      setRoutePreview(await remoteData<ModelRoutePreview>({ kind: "model-route-preview", input }));
    } catch (previewError) {
      setError(messageOf(previewError, "预览服务器模型路由失败"));
    } finally {
      setAction(null);
    }
  }

  async function applyRemoteRoute() {
    const input = routeDraft();
    if (!input || !routePreview) return;
    setAction("route-apply");
    setError(null);
    try {
      await remoteData({ kind: "model-route-apply", input: { ...input, confirmSensitive: true } });
      setConfirmAction(null);
      setRoutePreview(null);
      await loadRoutes();
      await refreshSelectedNode(selectedNodeId);
      await checkRemoteRoute();
      onFeedback?.({ severity: "success", text: `${input.profileName} 模型路由已应用` });
    } catch (applyError) {
      setError(messageOf(applyError, "应用服务器模型路由失败"));
    } finally {
      setAction(null);
    }
  }

  async function restoreRemoteRoute() {
    if (!selectedProfile) return;
    setAction("route-restore");
    setError(null);
    try {
      await remoteData({
        kind: "model-route-restore",
        profileName: selectedProfile.name,
        confirmSensitive: true,
      });
      setConfirmAction(null);
      setRoutePreview(null);
      await loadRoutes();
      await refreshSelectedNode(selectedNodeId);
      onFeedback?.({ severity: "success", text: `${selectedProfile.name} 已恢复官方模型配置` });
    } catch (restoreError) {
      setError(messageOf(restoreError, "恢复服务器模型路由失败"));
    } finally {
      setAction(null);
    }
  }

  async function checkRemoteRoute() {
    if (!selectedProfile) return;
    setAction("route-check");
    setError(null);
    try {
      setRouteCheck(await remoteData<ModelRouteProxyCheckResult>({
        kind: "model-route-check",
        profileName: selectedProfile.name,
      }));
    } catch (checkError) {
      setError(messageOf(checkError, "服务器模型路由自检失败"));
    } finally {
      setAction(null);
    }
  }

  async function runWechatAction(kind: "wechat-start" | "wechat-stop" | "wechat-restart") {
    if (!selectedProfile) return;
    setAction(kind);
    setError(null);
    try {
      const next = await remoteData<WechatBridgeReport>({ kind, profileName: selectedProfile.name });
      setWechat(next);
      if (feishu) rememberResource(selectedNodeId, "channels", { wechat: next, feishu });
      const bridge = next.bridges.find((item) => item.profileName === selectedProfile.name);
      const text = bridge?.connectionState === "awaiting-scan"
        ? `${selectedProfile.name} 已启动，请扫描二维码`
        : `服务器微信桥接已${kind === "wechat-stop" ? "停止" : kind === "wechat-start" ? "启动" : "重启"}`;
      onFeedback?.({ severity: "success", text });
    } catch (channelError) {
      setError(messageOf(channelError, "服务器微信桥接操作失败"));
    } finally {
      setAction(null);
    }
  }

  async function runFeishuAction(kind: "feishu-start" | "feishu-stop" | "feishu-restart") {
    if (!selectedProfile) return;
    setAction(kind);
    setError(null);
    try {
      const operation: ServerNodeOperation = kind === "feishu-start"
        ? { kind, profileName: selectedProfile.name }
        : { kind };
      const next = await remoteData<FeishuRemoteReport>(operation);
      setFeishu(next);
      if (wechat) rememberResource(selectedNodeId, "channels", { wechat, feishu: next });
      onFeedback?.({ severity: "success", text: "服务器飞书渠道状态已更新" });
    } catch (channelError) {
      setError(messageOf(channelError, "服务器飞书渠道操作失败"));
    } finally {
      setAction(null);
    }
  }

  const list = loading && nodes.length === 0 ? (
    <Stack className="feature-skeleton-list" spacing={1}>{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} variant="rounded" height={66} />)}</Stack>
  ) : error && nodes.length === 0 ? (
    <ErrorState message={error} onRetry={() => void loadNodes()} />
  ) : filteredNodes.length === 0 ? (
    <EmptyState icon={<StorageRoundedIcon />} title="还没有服务器节点" description="添加 SSH 主机后即可从 Mac 管理服务器 Codex。" />
  ) : (
    <Box className="feature-list-items server-node-list">
      {filteredNodes.map((node) => {
        const currentProbe = node.id === selectedNodeId ? probe : null;
        return (
          <button
            type="button"
            key={node.id}
            className={`feature-list-row server-node-row ${node.id === selectedNodeId ? "selected" : ""}`}
            onClick={() => setSelectedNodeId(node.id)}
          >
            <span className="feature-list-icon"><StorageRoundedIcon /></span>
            <span className="feature-list-copy">
              <strong>{node.name}</strong>
              <small>{node.sshTarget}</small>
              <span className={`server-node-inline-status ${statusTone(currentProbe)}`}>
                {statusLabel(currentProbe)}
              </span>
            </span>
          </button>
        );
      })}
    </Box>
  );

  const detail = !selectedNode ? (
    <EmptyState icon={<ComputerRoundedIcon />} title="选择一个服务器节点" />
  ) : (
    <Box className="feature-detail server-node-detail">
      <Box className="feature-detail-heading">
        <Box>
          <Typography component="h3" variant="h6">{selectedNode.name}</Typography>
          <Typography variant="body2" color="text.secondary">{selectedNode.sshTarget}</Typography>
        </Box>
        <StatusBadge label={statusLabel(probe)} tone={statusTone(probe)} />
      </Box>
      <DialogTabs
        value={tab}
        onChange={selectTab}
        label="服务器节点详情"
        tabs={[
          { value: "overview", label: "概览" },
          { value: "profiles", label: `Profiles ${profiles.length || ""}` },
          { value: "sessions", label: "会话" },
          { value: "auth", label: "认证" },
          { value: "routes", label: "路由" },
          { value: "channels", label: "渠道" },
          { value: "doctor", label: "诊断" },
        ]}
      />
      {activeResource && activeResourceUpdatedAt ? (
        <Box className="server-node-resource-state">
          <Typography variant="caption">
            内存缓存 · 更新于 {taskTime(new Date(activeResourceUpdatedAt).toISOString())}
          </Typography>
          <Typography variant="caption">
            {Date.now() - activeResourceUpdatedAt < SERVER_NODE_CACHE_TTL_MS ? "30 秒内有效" : "可刷新"}
          </Typography>
        </Box>
      ) : null}
      {tab === "profiles" && probe?.status.cliInstalled ? (
        <Box className="server-profile-toolbar">
          <TextField
            className="server-profile-sort"
            select
            size="small"
            value={profileSort}
            onChange={(event) => setProfileSort(event.target.value as ProfileSortMode)}
            slotProps={{ htmlInput: { "aria-label": "服务器 Profile 排序" } }}
          >
            {PROFILE_SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setProfileDraft(EMPTY_PROFILE_DRAFT);
              setProfileDialogOpen(true);
            }}
          >
            新增服务器 Profile
          </Button>
          <Button
            size="small"
            startIcon={<SyncAltRoundedIcon />}
            onClick={() => void openProfileSyncDialog()}
            disabled={Boolean(action)}
          >
            从本机同步
          </Button>
        </Box>
      ) : null}
      {error && errorGuide ? (
        <Box className={`server-node-recovery ${errorGuide.code}`}>
          <WarningAmberRoundedIcon />
          <Box className="server-node-recovery-copy">
            <Typography variant="subtitle2">{errorGuide.title}</Typography>
            <Typography variant="caption">{errorGuide.description}</Typography>
            <Typography component="code" variant="caption">{error}</Typography>
          </Box>
          <Stack className="server-node-recovery-actions" direction="row" spacing={0.5}>
            {latestTask?.status === "failed" && latestTask.retryOperation ? (
              <Button
                size="small"
                startIcon={<ReplayRoundedIcon />}
                onClick={() => void retryRemoteTask(latestTask)}
                disabled={Boolean(action)}
              >重试</Button>
            ) : null}
            <Button
              size="small"
              startIcon={<RestartAltRoundedIcon />}
              onClick={() => void refreshSelectedNode()}
              disabled={Boolean(action)}
            >重新检查</Button>
            <Tooltip title="复制诊断信息">
              <IconButton
                size="small"
                aria-label="复制服务器诊断信息"
                onClick={() => void copyTaskDiagnostic()}
              ><ContentCopyRoundedIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Box>
      ) : null}
      {action ? (
        <Box className="server-node-task-strip running">
          <CircularProgress size={16} />
          <Typography variant="caption">{actionLabel(action)}</Typography>
          {selectedTasks.length ? (
            <Button
              className="server-node-history-toggle"
              size="small"
              startIcon={<HistoryRoundedIcon />}
              endIcon={taskHistoryOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              onClick={() => setTaskHistoryOpen((value) => !value)}
            >{selectedTasks.length}</Button>
          ) : null}
        </Box>
      ) : latestTask ? (
        <Box
          className={`server-node-task-strip ${latestTask.status === "success" ? "complete" : "failed"}`}
          title={latestTask.operationId}
        >
          {latestTask.status === "success" ? <CheckCircleOutlineRoundedIcon /> : <WarningAmberRoundedIcon />}
          <Typography variant="caption">
            {latestTask.label} · {latestTask.durationMs} ms
          </Typography>
          <Typography component="code" variant="caption">
            {shortOperationId(latestTask.operationId)}
          </Typography>
          <Tooltip title="最近任务">
            <IconButton
              className="server-node-history-toggle"
              size="small"
              aria-label="查看最近任务"
              onClick={() => setTaskHistoryOpen((value) => !value)}
            >
              {taskHistoryOpen ? <ExpandLessRoundedIcon /> : <HistoryRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
      <Collapse in={taskHistoryOpen && selectedTasks.length > 0}>
        <Box className="server-node-task-history">
          <Box className="server-node-task-history-heading">
            <Typography variant="subtitle2">最近任务</Typography>
            <Typography variant="caption">当前窗口 · 最多 10 条</Typography>
          </Box>
          {selectedTasks.map((task) => (
            <Box key={task.operationId} className={`server-node-task-row ${task.status}`}>
              {task.status === "success" ? <CheckCircleOutlineRoundedIcon /> : <WarningAmberRoundedIcon />}
              <Box className="server-node-task-copy">
                <Typography variant="body2">{task.label}</Typography>
                <Typography variant="caption">
                  {taskTime(task.generatedAt)} · {task.durationMs} ms · {shortOperationId(task.operationId)}
                </Typography>
                {task.error ? <Typography component="code" variant="caption">{task.error}</Typography> : null}
              </Box>
              <Box className="server-node-task-actions">
                {task.retryOperation ? (
                  <Tooltip title="重试只读任务">
                    <IconButton
                      size="small"
                      aria-label={`重试 ${task.label}`}
                      onClick={() => void retryRemoteTask(task)}
                      disabled={Boolean(action)}
                    ><ReplayRoundedIcon /></IconButton>
                  </Tooltip>
                ) : null}
                <Tooltip title="复制诊断信息">
                  <IconButton
                    size="small"
                    aria-label={`复制 ${task.label} 诊断信息`}
                    onClick={() => void copyTaskDiagnostic(task)}
                  ><ContentCopyRoundedIcon /></IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>

      {tab === "overview" ? (
        <Box className="server-node-overview">
          <Box className="server-node-health">
            <StatusItem label="SSH 连接" ok={Boolean(probe?.status.reachable)} pending={!probe} />
            <StatusItem label="节点 CLI" ok={Boolean(probe?.status.cliInstalled)} pending={!probe} />
            <StatusItem label="Codex CLI" ok={Boolean(probe?.status.codexInstalled)} pending={!probe} />
          </Box>
          {probe ? (
            <Box className="server-node-facts">
              <Fact label="主机" value={probe.status.hostname || "未知"} />
              <Fact label="系统" value={[probe.status.os, probe.status.arch].filter(Boolean).join(" · ") || "未知"} />
              <Fact label="用户" value={probe.status.user || "未知"} />
              <Fact label="Shell" value={probe.status.shell || "自动识别"} />
              <Fact label="节点版本" value={probe.status.cliVersion || "未安装"} />
              <Fact label="延迟" value={`${probe.status.latencyMs} ms`} />
            </Box>
          ) : (
            <Stack spacing={1}>{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} height={44} />)}</Stack>
          )}
          {probe?.status.reachable && !probe.status.cliInstalled ? (
            <Alert severity="warning">SSH 已连接，但服务器尚未安装 rCodexManager 节点 CLI。</Alert>
          ) : null}
          {probe?.status.reachable && !probe.status.codexInstalled ? (
            <Alert severity="warning">服务器尚未安装 Codex CLI；节点诊断可用，但 Profile 无法启动。</Alert>
          ) : null}
          {probe?.status.cliInstalled && !supportsProfileModelUpdate ? (
            <Alert severity="info">
              服务器节点版本为 {probe.status.cliVersion || "未知"}；升级到 {MIN_PROFILE_MODEL_UPDATE_VERSION} 后可直接反显并选择 Profile 模型。
            </Alert>
          ) : null}
        </Box>
      ) : null}

      {tab !== "overview" && tab !== "profiles" && !probe?.status.cliInstalled ? (
        <EmptyState
          icon={<TerminalRoundedIcon />}
          title="节点 CLI 尚未就绪"
          description="安装并重新检查节点后，才能读取服务器资源。"
        />
      ) : null}

      {tab === "profiles" ? (
        !probe?.status.cliInstalled ? (
          <EmptyState icon={<TerminalRoundedIcon />} title="节点 CLI 尚未就绪" description="安装后才能读取服务器 profile。" />
        ) : profiles.length === 0 ? (
          <EmptyState icon={<TerminalRoundedIcon />} title="服务器暂无 profile" />
        ) : (
          <Box className="server-profile-layout">
            <Box className="server-profile-list">
              {sortedProfiles.map((profile) => (
                <button
                  type="button"
                  key={profile.name}
                  className={`server-profile-row ${selectedProfileName === profile.name ? "selected" : ""}`}
                  onClick={() => setSelectedProfileName(profile.name)}
                >
                  <span><strong>{profile.alias || profile.name}</strong><small>{profile.name} · {profile.model || "未配置模型"}</small></span>
                  <StatusBadge label={profile.isRunning ? "运行中" : profile.account ? "已登录" : "未登录"} tone={profile.isRunning ? "success" : "neutral"} />
                </button>
              ))}
            </Box>
            {selectedProfile ? (
              <Box className="server-profile-inspector">
                <Typography variant="subtitle1">{selectedProfile.alias || selectedProfile.name}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedProfile.codexHome}</Typography>
                <Box className="server-profile-meta">
                  <Fact label="模型" value={selectedProfile.model || "未配置"} />
                  <Fact label="Provider" value={selectedProfile.modelProvider || "OpenAI 官方 / 默认"} />
                  <Fact label="推理等级" value={selectedProfile.reasoningEffort || "默认"} />
                  <Fact label="认证账户" value={accountIdentity(selectedProfile)} />
                  <Fact label="账户套餐" value={accountPlan(selectedProfile)} />
                  <Fact label="认证方式" value={selectedProfile.account?.authMode || "-"} />
                  <Fact label="运行状态" value={selectedProfile.isRunning ? "运行中" : "已停止"} />
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title={!supportsProfileModelUpdate ? `服务器节点需升级到 ${MIN_PROFILE_MODEL_UPDATE_VERSION}` : selectedProfile.isDefault ? "默认 Profile 受保护" : selectedProfile.isRunning ? "请先停止 Profile" : "配置模型与推理等级"}>
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<TuneRoundedIcon />}
                        onClick={openProfileModelDialog}
                        disabled={!supportsProfileModelUpdate || selectedProfile.isDefault || selectedProfile.isRunning}
                      >配置模型</Button>
                    </span>
                  </Tooltip>
                  {selectedProfile.isRunning ? (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<StopCircleRoundedIcon />}
                      onClick={() => setConfirmAction("terminate-profile")}
                      disabled={action === `terminate-profile:${selectedProfile.name}` || selectedProfile.isDefault}
                    >停止</Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<PlayArrowRoundedIcon />}
                      onClick={() => void runProfileAction("launch-profile", selectedProfile.name)}
                      disabled={action === `launch-profile:${selectedProfile.name}`}
                    >启动</Button>
                  )}
                </Stack>
              </Box>
            ) : null}
          </Box>
        )
      ) : null}

      {tab === "sessions" && probe?.status.cliInstalled ? (
        <Box className="server-session-panel">
          <Box className="server-session-toolbar">
            <TextField
              size="small"
              value={sessionQuery}
              onChange={(event) => { setSessionQuery(event.target.value); setSessionPage(1); }}
              placeholder="搜索会话标题或摘要"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
            />
            <TextField
              select
              size="small"
              aria-label="筛选服务器会话 Profile"
              value={sessionProfileName}
              onChange={(event) => { setSessionProfileName(event.target.value); setSessionPage(1); }}
            >
              <MenuItem value="">全部 Profile</MenuItem>
              {sortedProfiles.map((profile) => (
                <MenuItem key={profile.name} value={profile.name}>{profile.alias || profile.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              aria-label="服务器会话每页数量"
              value={sessionPageSize}
              onChange={(event) => { setSessionPageSize(Number(event.target.value)); setSessionPage(1); }}
            >
              {[10, 20, 50].map((size) => <MenuItem key={size} value={size}>{size} / 页</MenuItem>)}
            </TextField>
          </Box>
          <Box className="server-session-layout">
            <Box className="server-session-list-panel">
              {sessionLoading && !sessions ? (
                <Stack className="server-session-skeleton" spacing={0.5}>
                  {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} variant="rounded" height={58} />)}
                </Stack>
              ) : sessions?.sessions.length ? (
                <Box className="server-session-list">
                  {sessions.sessions.map((item) => {
                    const key = remoteSessionKey(item);
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`server-session-row ${selectedSessionKey === key ? "selected" : ""}`}
                        onClick={() => void selectRemoteSession(item)}
                      >
                        <TerminalRoundedIcon />
                        <span>
                          <strong>{item.session.renamedTitle || item.session.title || "未命名会话"}</strong>
                          <small>{item.profileAlias || item.profileName} · {formatRemoteTime(item.session.updatedAt)}</small>
                          <em>{item.session.summary || "暂无摘要"}</em>
                        </span>
                      </button>
                    );
                  })}
                </Box>
              ) : (
                <EmptyState icon={<ChatBubbleOutlineRoundedIcon />} title="没有匹配的服务器会话" description="调整搜索或 Profile 筛选后再试。" />
              )}
              <Box className="server-session-pagination">
                <Tooltip title="上一页"><span><IconButton size="small" onClick={() => setSessionPage((page) => page - 1)} disabled={sessionLoading || sessionPage <= 1}><KeyboardArrowLeftRoundedIcon /></IconButton></span></Tooltip>
                <Typography variant="caption">
                  {sessions?.sessions.length ? `${sessions.offset + 1}-${sessions.offset + sessions.sessions.length}` : "0 条"} · 第 {sessionPage} 页
                </Typography>
                <Tooltip title="下一页"><span><IconButton size="small" onClick={() => setSessionPage((page) => page + 1)} disabled={sessionLoading || !sessions?.hasMore}><KeyboardArrowRightRoundedIcon /></IconButton></span></Tooltip>
              </Box>
            </Box>
            <Box className="server-session-detail">
              {!selectedSession ? (
                <EmptyState icon={<ChatBubbleOutlineRoundedIcon />} title="选择一条会话" description="详情会在选中后按需读取。" />
              ) : sessionDetailLoading && !sessionDetail ? (
                <Stack spacing={1}><Skeleton width="56%" /><Skeleton /><Skeleton /><Skeleton width="72%" /></Stack>
              ) : sessionDetailError ? (
                <ErrorState message={sessionDetailError} onRetry={() => void selectRemoteSession(selectedSession, true)} />
              ) : (
                <Box className="server-session-detail-content">
                  <Box>
                    <Typography variant="subtitle1">{sessionDetail?.title || selectedSession.session.title || "未命名会话"}</Typography>
                    <Typography variant="caption">{selectedSession.profileAlias || selectedSession.profileName} · {formatRemoteTime(sessionDetail?.updatedAt || selectedSession.session.updatedAt)}</Typography>
                  </Box>
                  <section>
                    <Typography variant="caption">会话摘要</Typography>
                    <Typography variant="body2">{sessionDetail?.summary || selectedSession.session.summary || "这条会话还没有可用摘要。"}</Typography>
                  </section>
                  <section>
                    <Typography variant="caption">工作目录</Typography>
                    <Typography component="code" variant="body2">{sessionDetail?.cwd || selectedSession.session.cwd || "未知"}</Typography>
                  </section>
                  <section>
                    <Typography variant="caption">会话 ID</Typography>
                    <Typography component="code" variant="body2">{selectedSession.session.id}</Typography>
                  </section>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ) : null}

      {tab === "auth" && probe?.status.cliInstalled ? (
        action === "auth" && !auth ? (
          <Box className="server-node-loading"><CircularProgress size={24} /><Typography variant="body2">正在读取服务器认证库…</Typography></Box>
        ) : auth ? (
          <Box className="server-resource-panel">
            <Box className="server-resource-heading">
              <Box><Typography variant="subtitle2">服务器认证备份</Typography><Typography variant="caption">认证材料始终留在服务器，Mac 只接收状态元数据。</Typography></Box>
              <Button size="small" startIcon={<VpnKeyRoundedIcon />} onClick={() => void createRemoteAuthBackup()} disabled={!selectedProfile || action === "auth-backup"}>备份当前</Button>
            </Box>
            <TextField select label="目标 Profile" size="small" value={selectedProfileName} onChange={(event) => setSelectedProfileName(event.target.value)}>
              {sortedProfiles.map((profile) => <MenuItem key={profile.name} value={profile.name}>{profile.alias || profile.name} · {profile.isRunning ? "运行中" : profile.isDefault ? "默认保护" : "已停止"}</MenuItem>)}
            </TextField>
            {selectedProfile ? (
              <Box className="server-profile-meta">
                <Fact label="当前认证账户" value={accountIdentity(selectedProfile)} />
                <Fact label="账户套餐" value={accountPlan(selectedProfile)} />
              </Box>
            ) : null}
            {auth.backups.length ? (
              <Box className="server-backup-list">
                {auth.backups.map((backup) => (
                  <button type="button" key={backup.id} className={`server-backup-row ${selectedBackupId === backup.id ? "selected" : ""}`} onClick={() => setSelectedBackupId(backup.id)}>
                    <span><strong>{backup.label}</strong><small>{backup.account?.email || backup.sourceProfileName || "未知来源"}</small></span>
                    <StatusBadge label={backup.valid ? "有效" : "不可用"} tone={backup.valid ? "success" : "error"} />
                  </button>
                ))}
              </Box>
            ) : <EmptyState icon={<VpnKeyRoundedIcon />} title="服务器还没有认证备份" />}
            <Box className="server-resource-actions">
              <Button
                variant="contained"
                onClick={() => setConfirmAction("apply-auth")}
                disabled={!selectedBackup?.valid || !selectedProfile || selectedProfile.isDefault || selectedProfile.isRunning}
              >应用到当前 Profile</Button>
            </Box>
          </Box>
        ) : null
      ) : null}

      {tab === "routes" && probe?.status.cliInstalled ? (
        action === "routes" && !routes ? (
          <Box className="server-node-loading"><CircularProgress size={24} /><Typography variant="body2">正在读取服务器模型路由…</Typography></Box>
        ) : routes && selectedProfile ? (
          <Box className="server-resource-panel server-route-panel">
            <Box className="server-resource-heading">
              <Box><Typography variant="subtitle2">{selectedProfile.alias || selectedProfile.name}</Typography><Typography variant="caption">{selectedRoute?.routeStatusLabel || "未读取路由状态"}</Typography></Box>
              <StatusBadge label={selectedRoute?.routeStatusLabel || "未知"} tone={selectedRoute?.routed ? "success" : selectedRoute?.needsAttention ? "warning" : "neutral"} />
            </Box>
            <Box className="server-route-form">
              <TextField select label="Provider 预设" size="small" value={routePreset} onChange={(event) => { setRoutePreset(event.target.value as ModelRoutePreset); setRoutePreview(null); }}>
                <MenuItem value="aliyun-qwen">阿里百炼 / Qwen</MenuItem>
                <MenuItem value="glm">智谱 / GLM</MenuItem>
                <MenuItem value="local-openai">本地 OpenAI-compatible</MenuItem>
                <MenuItem value="custom-responses">自定义 Responses</MenuItem>
              </TextField>
              <TextField label="模型" size="small" value={routeModel} onChange={(event) => { setRouteModel(event.target.value); setRoutePreview(null); }} />
              <TextField label="代理 URL" size="small" value={routeProxyUrl} onChange={(event) => { setRouteProxyUrl(event.target.value); setRoutePreview(null); }} />
              <TextField label="上游 URL" size="small" value={routeUpstreamUrl} onChange={(event) => { setRouteUpstreamUrl(event.target.value); setRoutePreview(null); }} />
              <TextField label="API Key 环境变量" size="small" value={routeApiKeyEnv} onChange={(event) => { setRouteApiKeyEnv(event.target.value); setRoutePreview(null); }} helperText="只传环境变量名，不从 Mac 发送明文密钥" />
            </Box>
            {routePreview ? <Box component="pre" className="server-route-preview">{routePreview.configPreview}</Box> : null}
            {routeCheck ? <Alert severity={routeCheck.ok ? "success" : "warning"}>{routeCheck.message}</Alert> : null}
            <Box className="server-resource-actions">
              <Button startIcon={<AltRouteRoundedIcon />} onClick={() => void previewRemoteRoute()} disabled={!routeModel.trim() || selectedProfile.isDefault || selectedProfile.isRunning}>预览</Button>
              <Button variant="contained" onClick={() => setConfirmAction("apply-route")} disabled={!routePreview || selectedProfile.isDefault || selectedProfile.isRunning}>应用路由</Button>
              <Button onClick={() => void checkRemoteRoute()} disabled={!selectedRoute?.routed}>自检</Button>
              <Button color="warning" onClick={() => setConfirmAction("restore-route")} disabled={!selectedRoute?.canRestore}>恢复官方</Button>
            </Box>
          </Box>
        ) : (
          <EmptyState icon={<AltRouteRoundedIcon />} title="选择一个服务器 Profile" />
        )
      ) : null}

      {tab === "channels" && probe?.status.cliInstalled ? (
        action === "channels" && !wechat && !feishu ? (
          <Box className="server-node-loading"><CircularProgress size={24} /><Typography variant="body2">正在读取服务器远程渠道…</Typography></Box>
        ) : (
          <Box className="server-resource-panel server-channel-panel">
            <Box className="server-channel-block">
              <Box className="server-resource-heading"><Box><Typography variant="subtitle2">微信桥接</Typography><Typography variant="caption">{selectedWechat ? `实例 ${selectedWechat.instance}${selectedWechatIsExternal ? " · 外部服务" : ""}` : "未配置"}</Typography></Box><StatusBadge label={selectedWechatState.label} tone={selectedWechatState.tone} /></Box>
              {selectedWechatIsExternal ? <Alert severity="info">检测到服务器已有微信服务，当前仅监控状态，不会从 Mac 停止、重启或解绑。</Alert> : null}
              {selectedWechat?.lastError ? <Alert severity="error">{selectedWechat.lastError}</Alert> : null}
              {selectedWechat?.connectionState === "awaiting-scan" && selectedWechatLog ? (
                <Box className="server-wechat-scan">
                  <Box>
                    <Typography variant="subtitle2">微信扫码绑定</Typography>
                    <Typography variant="caption">使用微信扫描下方二维码；二维码过期会自动刷新，绑定状态也会自动更新。</Typography>
                  </Box>
                  <Box component="pre" className="feature-code-block server-wechat-qr-log">{selectedWechatLog}</Box>
                </Box>
              ) : null}
              <Stack direction="row" spacing={1}>
                <Button startIcon={<PlayArrowRoundedIcon />} onClick={() => void runWechatAction("wechat-start")} disabled={!selectedProfile || Boolean(selectedWechat?.running) || selectedWechatIsExternal}>启动</Button>
                <Button startIcon={<StopCircleRoundedIcon />} onClick={() => void runWechatAction("wechat-stop")} disabled={!selectedWechat?.running || selectedWechatIsExternal}>停止</Button>
                <Button startIcon={<RestartAltRoundedIcon />} onClick={() => void runWechatAction("wechat-restart")} disabled={!selectedProfile || selectedWechatIsExternal}>重启</Button>
                {selectedWechat?.connectionState === "awaiting-scan" ? <Button startIcon={<ReplayRoundedIcon />} onClick={() => void loadChannels()} disabled={Boolean(action)}>刷新扫码状态</Button> : null}
              </Stack>
            </Box>
            <Box className="server-channel-block">
              <Box className="server-resource-heading"><Box><Typography variant="subtitle2">飞书 Bot</Typography><Typography variant="caption">{feishu?.connectionState || "未配置"}</Typography></Box><StatusBadge label={feishu?.running ? "运行中" : feishu?.configured ? "已配置" : "未配置"} tone={feishu?.running ? "success" : "neutral"} /></Box>
              <Stack direction="row" spacing={1}>
                <Button startIcon={<PlayArrowRoundedIcon />} onClick={() => void runFeishuAction("feishu-start")} disabled={!selectedProfile || Boolean(feishu?.running)}>启动</Button>
                <Button startIcon={<StopCircleRoundedIcon />} onClick={() => void runFeishuAction("feishu-stop")} disabled={!feishu?.running}>停止</Button>
                <Button startIcon={<RestartAltRoundedIcon />} onClick={() => void runFeishuAction("feishu-restart")} disabled={!feishu?.configured}>重启</Button>
              </Stack>
            </Box>
            <Alert severity="info" icon={<HubRoundedIcon />}>渠道凭据仍由服务器端运行时保存，Mac 不读取微信 token 或飞书 App Secret。</Alert>
          </Box>
        )
      ) : null}

      {tab === "doctor" && probe?.status.cliInstalled ? (
        action === "doctor" && !doctor ? (
          <Box className="server-node-loading"><CircularProgress size={24} /><Typography variant="body2">正在读取服务器诊断…</Typography></Box>
        ) : doctor ? (
          <Box className="server-doctor-report">
            <Box className={`doctor-summary ${doctor.ready ? "ready" : "error"}`}>
              <FactCheckRoundedIcon />
              <Box><Typography variant="subtitle2">{doctor.ready ? "服务器核心功能可用" : "服务器存在需要处理的问题"}</Typography><Typography variant="caption">{doctor.summary.okCount} 正常 · {doctor.summary.warningCount} 提醒 · {doctor.summary.errorCount} 错误</Typography></Box>
            </Box>
            <Box className="doctor-check-list">
              {doctor.checks.map((check) => (
                <Box key={check.id} className={`doctor-check-row ${check.status}`}>
                  <Box className="doctor-check-icon">{check.status === "ok" ? <CheckCircleOutlineRoundedIcon /> : <WarningAmberRoundedIcon />}</Box>
                  <Box className="doctor-check-copy"><Typography variant="subtitle2">{check.label}</Typography><Typography variant="caption">{check.message}</Typography></Box>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <EmptyState icon={<FactCheckRoundedIcon />} title="尚未读取服务器诊断" description="诊断只读执行，输出会自动脱敏。" />
        )
      ) : null}
    </Box>
  );

  return (
    <>
      <ManagerDialogShell
        open={open}
        title="服务器节点"
        subtitle={nodes.length ? `${nodes.length} 个节点 · SSH 安全连接` : "Mac 管理 Linux Codex"}
        icon={<StorageRoundedIcon />}
        refreshing={Boolean(action) || sessionLoading || sessionDetailLoading}
        onRefresh={refreshActiveResource}
        onClose={onClose}
        status={probe ? <StatusBadge label={statusLabel(probe)} tone={statusTone(probe)} /> : undefined}
        className="server-nodes-dialog"
        actions={selectedNode ? (
          <>
            <Button startIcon={<EditRoundedIcon />} onClick={() => { setNodeDraft({ id: selectedNode.id, name: selectedNode.name, sshTarget: selectedNode.sshTarget, remoteBinary: selectedNode.remoteBinary }); setNodeAdvancedOpen(selectedNode.remoteBinary !== "rcodexmanager"); setNodeDialogOpen(true); }}>编辑节点</Button>
            <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setConfirmAction("delete-node")}>移除</Button>
          </>
        ) : undefined}
      >
        <DialogToolbar>
          <TextField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索服务器节点"
            fullWidth
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
          />
          <Tooltip title="新增服务器节点"><IconButton aria-label="新增服务器节点" onClick={() => { setNodeDraft({ ...EMPTY_NODE_DRAFT }); setNodeAdvancedOpen(false); setNodeDialogOpen(true); }}><AddRoundedIcon /></IconButton></Tooltip>
        </DialogToolbar>
        <MasterDetailLayout list={list} detail={detail} detailOpen={Boolean(selectedNode)} onBack={() => setSelectedNodeId("")} />
      </ManagerDialogShell>

      <Dialog open={nodeDialogOpen} onClose={() => setNodeDialogOpen(false)} fullWidth maxWidth="xs" className="app-task-dialog">
        <DialogTitle>{nodeDraft.id ? "编辑服务器节点" : "新增服务器节点"}</DialogTitle>
        <DialogContent className="server-node-form">
          <TextField label="名称" value={nodeDraft.name} onChange={(event) => setNodeDraft((current) => ({ ...current, name: event.target.value }))} fullWidth />
          <Autocomplete<SshHostOption, false, false, true>
            freeSolo
            options={sshHostReport?.hosts ?? []}
            value={(sshHostReport?.hosts ?? []).find((host) => host.alias === nodeDraft.sshTarget) ?? null}
            inputValue={nodeDraft.sshTarget}
            loading={sshHostsLoading}
            filterOptions={(options, state) => {
              const value = state.inputValue.trim().toLowerCase();
              if (!value) return options;
              return options.filter((option) =>
                `${option.alias} ${option.user ?? ""} ${option.hostname ?? ""} ${option.port ?? ""}`
                  .toLowerCase()
                  .includes(value),
              );
            }}
            getOptionLabel={(option) => typeof option === "string" ? option : option.alias}
            isOptionEqualToValue={(option, value) => typeof value !== "string" && option.alias === value.alias}
            onChange={(_event, value) => selectSshHost(value)}
            onInputChange={(_event, value) => setNodeDraft((current) => ({ ...current, sshTarget: value }))}
            loadingText="正在读取 SSH 配置..."
            noOptionsText="没有匹配的主机，可直接输入"
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              const endpoint = [
                option.user && option.hostname ? `${option.user}@${option.hostname}` : option.hostname,
                option.port ? `端口 ${option.port}` : null,
              ].filter(Boolean).join(" · ");
              return (
                <Box component="li" key={key} {...optionProps} className="ssh-host-option">
                  <Box className="ssh-host-option-copy">
                    <Typography className="ssh-host-option-alias">{option.alias}</Typography>
                    <Typography className="ssh-host-option-detail">{endpoint || option.sourcePath}</Typography>
                  </Box>
                  <Typography className="ssh-host-option-source">{option.sourcePath}</Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="SSH 主机"
                helperText={sshHostsError
                  ? "SSH 配置读取失败，仍可直接输入主机别名或 user@host"
                  : sshHostReport?.configExists === false
                    ? `未找到 ${sshHostReport.configPath}，仍可直接输入`
                    : sshHostReport
                      ? `来自 ${sshHostReport.configPath} · ${sshHostReport.hosts.length} 个可用主机`
                      : "读取 ~/.ssh/config，也可直接输入主机别名或 user@host"}
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        <Tooltip title="重新读取 SSH 配置">
                          <span>
                            <IconButton
                              aria-label="重新读取 SSH 配置"
                              size="small"
                              disabled={sshHostsLoading}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => { setSshHostReport(null); setSshHostsError(null); void loadAvailableSshHosts(); }}
                            >
                              {sshHostsLoading ? <CircularProgress size={16} /> : <ReplayRoundedIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
          <Button
            className="server-node-advanced-toggle"
            onClick={() => setNodeAdvancedOpen((current) => !current)}
            endIcon={nodeAdvancedOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
          >
            高级设置
          </Button>
          <Collapse in={nodeAdvancedOpen} unmountOnExit>
            <TextField label="远端 CLI" value={nodeDraft.remoteBinary || ""} onChange={(event) => setNodeDraft((current) => ({ ...current, remoteBinary: event.target.value }))} helperText="默认使用 rcodexmanager，也可填写绝对路径；不会保存 SSH 密钥" fullWidth />
          </Collapse>
        </DialogContent>
        <DialogActions><Button onClick={() => setNodeDialogOpen(false)}>取消</Button><Button variant="contained" onClick={() => void saveNode()} disabled={!nodeDraft.name.trim() || !nodeDraft.sshTarget.trim() || action === "save-node"}>{action === "save-node" ? <CircularProgress size={18} /> : "保存并检查"}</Button></DialogActions>
      </Dialog>

      <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)} fullWidth maxWidth="xs" className="app-task-dialog">
        <DialogTitle>新增服务器 Profile</DialogTitle>
        <DialogContent className="server-node-form">
          <TextField label="名称" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} helperText="必须以 codex- 开头" fullWidth />
          <TextField label="别名" value={profileDraft.alias || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, alias: event.target.value }))} fullWidth />
          <TextField label="模型" value={profileDraft.model || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, model: event.target.value }))} fullWidth />
        </DialogContent>
        <DialogActions><Button onClick={() => setProfileDialogOpen(false)}>取消</Button><Button variant="contained" onClick={() => void createServerProfile()} disabled={!/^codex-[a-z0-9-]+$/.test(profileDraft.name) || action === "create-profile"}>创建</Button></DialogActions>
      </Dialog>

      <Dialog open={profileModelDialogOpen} onClose={() => setProfileModelDialogOpen(false)} fullWidth maxWidth="xs" className="app-task-dialog">
        <DialogTitle>配置服务器模型</DialogTitle>
        <DialogContent className="server-node-form">
          <Box className="server-profile-meta">
            <Fact label="Profile" value={selectedProfile?.alias || selectedProfile?.name || "-"} />
            <Fact label="当前 Provider" value={selectedProfile?.modelProvider || "OpenAI 官方 / 默认"} />
          </Box>
          <Autocomplete
            freeSolo
            options={profileModelOptions}
            value={profileModelDraft.model}
            onChange={(_event, value) => setProfileModelDraft((current) => ({ ...current, model: value || "" }))}
            onInputChange={(_event, value) => setProfileModelDraft((current) => ({ ...current, model: value }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="模型"
                helperText="候选来自服务器已发现配置，也可以输入自定义模型名"
              />
            )}
          />
          <Autocomplete
            freeSolo
            options={reasoningOptions}
            value={profileModelDraft.reasoningEffort}
            onChange={(_event, value) => setProfileModelDraft((current) => ({ ...current, reasoningEffort: value || "" }))}
            onInputChange={(_event, value) => setProfileModelDraft((current) => ({ ...current, reasoningEffort: value }))}
            renderInput={(params) => <TextField {...params} label="推理等级" />}
          />
          <Alert severity={selectedProfile?.modelProvider ? "info" : "success"}>
            {selectedProfile?.modelProvider
              ? `将保留现有 Provider“${selectedProfile.modelProvider}”及路由配置，只更新模型和推理等级。`
              : "将保留认证、会话和 User Data，只更新模型和推理等级。"}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileModelDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            startIcon={<TuneRoundedIcon />}
            onClick={() => setConfirmAction("update-model")}
            disabled={!profileModelDraft.model.trim() || !profileModelDraft.reasoningEffort.trim() || action === "update-model"}
          >应用模型</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={profileSyncDialogOpen} onClose={() => setProfileSyncDialogOpen(false)} fullWidth maxWidth="sm" className="app-task-dialog">
        <DialogTitle>从本机同步 Profile</DialogTitle>
        <DialogContent className="server-node-form">
          <TextField
            select
            label="本机 Profile"
            value={syncSourceProfileName}
            onChange={(event) => {
              const name = event.target.value;
              const source = localProfiles.find((profile) => profile.name === name);
              setSyncSourceProfileName(name);
              setSyncTargetProfileName(name);
              setSyncAuth(Boolean(source?.account));
            }}
            fullWidth
          >
            {localProfiles.filter((profile) => profile.name.startsWith("codex-")).map((profile) => (
              <MenuItem key={profile.name} value={profile.name}>
                {profile.alias || profile.name} · {profile.account?.email || "未登录"}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="服务器 Profile 名称"
            value={syncTargetProfileName}
            onChange={(event) => setSyncTargetProfileName(event.target.value.trim().toLowerCase())}
            error={syncTargetExists}
            helperText={syncTargetExists ? "服务器上已经存在同名 Profile" : "必须以 codex- 开头"}
            fullWidth
          />
          {syncSourceProfile ? (
            <Box className="server-profile-meta">
              <Fact label="模型" value={syncSourceProfile.model || "默认"} />
              <Fact label="推理等级" value={syncSourceProfile.reasoningEffort || "默认"} />
              <Fact label="认证账户" value={accountIdentity(syncSourceProfile)} />
              <Fact label="账户套餐" value={accountPlan(syncSourceProfile)} />
            </Box>
          ) : null}
          <FormControlLabel
            control={(
              <Switch
                checked={syncAuth}
                onChange={(event) => setSyncAuth(event.target.checked)}
                disabled={!syncSourceProfile?.account}
              />
            )}
            label="同步认证信息"
          />
          <Alert severity={syncAuth ? "warning" : "info"}>
            {syncAuth
              ? "认证仅通过 SSH 标准输入传输，服务器导入后立即清理临时文件，不保存到 Mac 应用元数据或任务日志。"
              : "只同步模型、推理等级、别名和分类，不复制本机会话与 User Data。"}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileSyncDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            startIcon={<SyncAltRoundedIcon />}
            onClick={() => syncAuth ? setConfirmAction("sync-profile") : void syncSelectedProfile()}
            disabled={
              !syncSourceProfile
              || !/^codex-[a-z0-9-]+$/.test(syncTargetProfileName)
              || syncTargetExists
              || action === "sync-profile"
            }
          >同步到服务器</Button>
        </DialogActions>
      </Dialog>

      <SensitiveActionConfirmDialog
        open={confirmAction === "update-model"}
        title={`更新 ${selectedProfile?.name || "服务器 Profile"} 的模型？`}
        description={`将把模型切换为 ${profileModelDraft.model || "未填写"}，推理等级为 ${profileModelDraft.reasoningEffort || "默认"}。写入前会备份 config.toml，不修改认证、会话和 User Data。`}
        confirmLabel="更新模型"
        busy={action === "update-model"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void updateSelectedProfileModel()}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "sync-profile"}
        title={`同步 ${syncSourceProfile?.name || "本机 Profile"} 的认证？`}
        description={`将通过 SSH 加密连接把认证应用到服务器新 Profile ${syncTargetProfileName}。源文件不会修改，敏感内容不会进入任务日志。`}
        confirmLabel="创建并同步"
        busy={action === "sync-profile"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void syncSelectedProfile()}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "delete-node"}
        title="移除服务器节点？"
        description="只移除 Mac 上保存的 SSH 节点配置，不删除服务器上的 Codex 数据。"
        confirmLabel="移除"
        tone="error"
        busy={action === "delete-node"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void deleteSelectedNode()}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "terminate-profile"}
        title={`停止 ${selectedProfile?.name || "服务器 profile"}？`}
        description="将终止服务器上识别到的 Codex 进程，不会删除 profile 数据。"
        confirmLabel="停止"
        busy={Boolean(selectedProfile && action === `terminate-profile:${selectedProfile.name}`)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => selectedProfile && void runProfileAction("terminate-profile", selectedProfile.name)}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "apply-auth"}
        title={`应用认证到 ${selectedProfile?.name || "服务器 profile"}？`}
        description={`将使用服务器备份“${selectedBackup?.label || "未选择"}”替换目标认证，写入前会自动备份目标 auth.json。`}
        confirmLabel="应用认证"
        busy={action === "auth-apply"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void applyRemoteAuth()}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "apply-route"}
        title={`应用模型路由到 ${selectedProfile?.name || "服务器 profile"}？`}
        description="服务器会先备份 config.toml，再写入刚刚预览的路由配置。Mac 不会发送明文 API key。"
        confirmLabel="应用路由"
        busy={action === "route-apply"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void applyRemoteRoute()}
      />
      <SensitiveActionConfirmDialog
        open={confirmAction === "restore-route"}
        title={`恢复 ${selectedProfile?.name || "服务器 profile"} 的官方路由？`}
        description="将移除第三方路由字段，并保留基础模型、推理等级与 WebSocket 配置。"
        confirmLabel="恢复官方"
        busy={action === "route-restore"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void restoreRemoteRoute()}
      />
    </>
  );
}

function StatusItem({ label, ok, pending }: { label: string; ok: boolean; pending: boolean }) {
  return <Box className={`server-health-item ${pending ? "pending" : ok ? "ok" : "error"}`}>{pending ? <CircularProgress size={17} /> : ok ? <CheckCircleOutlineRoundedIcon /> : <CloudOffRoundedIcon />}<span>{label}</span></Box>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <Box className="server-node-fact"><Typography variant="caption">{label}</Typography><Typography variant="body2" title={value}>{value}</Typography></Box>;
}
