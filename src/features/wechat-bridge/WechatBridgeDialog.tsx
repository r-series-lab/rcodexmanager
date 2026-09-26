import { useEffect, useMemo, useState } from "react";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DialogTabs,
  DialogToolbar,
  EmptyState,
  ErrorState,
  ManagerDialogShell,
  ManagerPagination,
  MasterDetailLayout,
  SensitiveActionConfirmDialog,
  StatusBadge,
  type StatusTone,
} from "../../components/manager";
import type {
  FeishuRemotePage,
  FeishuRemoteReport,
  WechatBridgeEntry,
  WechatBridgeReport,
} from "../../lib/types";
import { useI18n } from "../../i18n";
import "../manager-dialogs.css";

type RemoteChannel = "wechat" | "feishu";

function connectionPresentation(bridge: WechatBridgeEntry): { label: string; tone: StatusTone } {
  if (bridge.connectionState === "error") return { label: "异常", tone: "error" };
  if (bridge.connectionState === "awaiting-scan") return { label: "等待扫码", tone: "warning" };
  if (bridge.connectionState === "running") return { label: "运行中", tone: "success" };
  if (bridge.connectionState === "bound") return { label: "已绑定未运行", tone: "info" };
  return { label: "未绑定", tone: "neutral" };
}

function feishuPresentation(report: FeishuRemoteReport | null): { label: string; tone: StatusTone } {
  if (!report || report.connectionState === "not-installed") return { label: "未安装", tone: "neutral" };
  if (report.connectionState === "error") return { label: "异常", tone: "error" };
  if (report.connectionState === "connected") return { label: "已连接", tone: "success" };
  if (report.connectionState === "starting") return { label: "连接中", tone: "warning" };
  if (report.connectionState === "stopped") return { label: "已配置未运行", tone: "info" };
  if (report.running) return { label: "待配置", tone: "warning" };
  return { label: "未配置", tone: "neutral" };
}

function accountLabel(bridge: WechatBridgeEntry, signedOutLabel = "未登录"): string {
  return bridge.account?.email || bridge.account?.name || bridge.account?.accountId || signedOutLabel;
}

function formatTime(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) return emptyLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { hour12: false });
}

export function WechatBridgeDialog({
  open,
  report,
  feishuReport,
  loading,
  feishuLoading,
  busy,
  error,
  feishuError,
  activeProfileName,
  selectedProfileName,
  feishuProfileName,
  onClose,
  onRefresh,
  onProfileChange,
  onFeishuProfileChange,
  onStart,
  onStop,
  onRestart,
  onUnbind,
  onRefreshLog,
  onConfigureFeishu,
  onStartFeishu,
  onStopFeishu,
  onRestartFeishu,
  onRefreshFeishuLog,
  onOpenFeishuPage,
  onReveal,
}: {
  open: boolean;
  report: WechatBridgeReport | null;
  feishuReport: FeishuRemoteReport | null;
  loading: boolean;
  feishuLoading: boolean;
  busy: boolean;
  error?: string | null;
  feishuError?: string | null;
  activeProfileName: string;
  selectedProfileName: string;
  feishuProfileName: string;
  onClose: () => void;
  onRefresh: () => void;
  onProfileChange: (value: string) => void;
  onFeishuProfileChange: (value: string) => void;
  onStart: (profileName: string) => Promise<void> | void;
  onStop: (profileName: string) => Promise<void> | void;
  onRestart: (profileName: string) => Promise<void> | void;
  onUnbind: (profileName: string) => Promise<void> | void;
  onRefreshLog: (profileName: string) => Promise<void> | void;
  onConfigureFeishu: (profileName: string, binaryPath: string) => Promise<void> | void;
  onStartFeishu: (profileName: string, binaryPath: string) => Promise<void> | void;
  onStopFeishu: () => Promise<void> | void;
  onRestartFeishu: () => Promise<void> | void;
  onRefreshFeishuLog: () => Promise<void> | void;
  onOpenFeishuPage: (page: FeishuRemotePage) => Promise<void> | void;
  onReveal: (path: string) => void;
}) {
  const { language, t } = useI18n();
  const [channel, setChannel] = useState<RemoteChannel>("wechat");
  const [query, setQuery] = useState("");
  const [wechatTab, setWechatTab] = useState("overview");
  const [feishuTab, setFeishuTab] = useState("overview");
  const [binaryPath, setBinaryPath] = useState("");
  const [confirmUnbind, setConfirmUnbind] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const bridges = report?.bridges ?? [];
  const profiles = bridges.map((bridge) => ({ name: bridge.profileName, label: bridge.profileLabel, authExists: bridge.authExists }));
  const selected = selectedProfileName ? bridges.find((bridge) => bridge.profileName === selectedProfileName) ?? null : null;
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return bridges;
    return bridges.filter((bridge) => [bridge.profileName, bridge.profileLabel, bridge.profileCategory, bridge.instance, accountLabel(bridge, t("未登录"))].join(" ").toLowerCase().includes(value));
  }, [bridges, query, t]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedBridges = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setWechatTab("overview");
      setFeishuTab("overview");
      setConfirmUnbind(false);
    }
  }, [open]);

  useEffect(() => {
    setPage(1);
  }, [query, channel]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (feishuReport?.binaryPath) setBinaryPath(feishuReport.binaryPath);
  }, [feishuReport?.binaryPath]);

  useEffect(() => {
    if (selected?.connectionState === "awaiting-scan") setWechatTab("logs");
  }, [selected?.connectionState]);

  const wechatList = loading && bridges.length === 0 ? (
    <Stack className="feature-skeleton-list" spacing={1}>{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} variant="rounded" height={70} />)}</Stack>
  ) : error && bridges.length === 0 ? (
    <ErrorState message={error} onRetry={onRefresh} />
  ) : filtered.length === 0 ? (
    <EmptyState icon={<QrCodeScannerRoundedIcon />} title="没有匹配的实例" />
  ) : (
    <Box className="feature-list-items">
      {paginatedBridges.map((bridge) => {
        const status = connectionPresentation(bridge);
        return (
          <button key={bridge.profileName} type="button" className={`feature-list-item ${bridge.profileName === selected?.profileName ? "active" : ""}`} aria-current={bridge.profileName === selected?.profileName ? "true" : undefined} onClick={() => onProfileChange(bridge.profileName)}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
              <QrCodeScannerRoundedIcon className="feature-list-leading-icon" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography className="feature-list-title">{bridge.profileLabel}</Typography>
                <Typography className="feature-list-meta">{bridge.profileName}{bridge.profileName === activeProfileName ? ` · ${t("当前")}` : ""}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <StatusBadge label={status.label} tone={status.tone} />
                  <StatusBadge label={bridge.profileCategory || "未分类"} />
                </Stack>
              </Box>
            </Stack>
          </button>
        );
      })}
    </Box>
  );

  const selectedStatus = selected ? connectionPresentation(selected) : null;
  const selectedIsExternal = Boolean(
    selected
    && selected.managedByApp === false
    && (selected.tokenExists || selected.running),
  );
  const wechatDetail = selected ? (
    <Box className="feature-detail">
      <Box className="feature-detail-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography className="feature-detail-title">{selected.profileLabel}</Typography>
          <Typography className="feature-detail-subtitle">{t("实例 {instance}", { instance: selected.instance })} · {accountLabel(selected, t("未登录"))}{selectedIsExternal ? ` · ${t("外部服务")}` : ""}</Typography>
        </Box>
        {selectedStatus ? <StatusBadge label={selectedStatus.label} tone={selectedStatus.tone} /> : null}
      </Box>
      <DialogTabs value={wechatTab} onChange={setWechatTab} label="微信桥接详情" tabs={[{ value: "overview", label: "概览" }, { value: "logs", label: "扫码与日志" }]} />
      <Box className="feature-detail-body">
        {wechatTab === "overview" ? (
          <Stack spacing={1}>
            {selected.lastError ? <Alert severity="error">{selected.lastError}</Alert> : null}
            {selectedIsExternal ? <Alert severity="info">{t("检测到现有微信实例。rCodexManager 仅展示状态，不会停止、重启或解绑这个外部服务。")}</Alert> : null}
            {!selected.authExists ? <Alert severity="warning">{t("该 profile 没有 auth.json，先在认证库应用认证后才能启动桥接。")}</Alert> : null}
            <Box className="feature-grid">
              <SourceCard label="Profile" value={selected.profileName} />
              <SourceCard label="实例" value={selected.instance} />
              <SourceCard label="管理方式" value={selectedIsExternal ? t("外部服务 · 只读") : t("rCodexManager 管理")} />
              <SourceCard label="绑定状态" value={selected.tokenExists ? t("已绑定") : t("未绑定")} />
              <SourceCard label="运行状态" value={selected.running ? t("运行中 · PID {pid}", { pid: selected.runningPids.join(", ") }) : t("已停止")} />
              <SourceCard label="最近启动" value={formatTime(selected.lastStartedAt, language, t("暂无"))} />
              <SourceCard label="最近停止" value={formatTime(selected.lastStoppedAt, language, t("暂无"))} />
            </Box>
            <Box className="feature-fieldset">
              <Typography className="feature-fieldset-title">{t("本地路径")}</Typography>
              <Stack spacing={0.75}>
                <PathRow label="实例数据" value={selected.storageDir} onOpen={() => onReveal(selected.storageDir)} />
                <PathRow label="收件箱" value={selected.inboxDir} onOpen={() => onReveal(selected.inboxDir)} />
                <PathRow label="应用日志" value={selected.appLogPath} onOpen={() => onReveal(selected.appLogPath)} />
              </Stack>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {selected.connectionState === "awaiting-scan" ? <Alert severity="info">{t("桥接正在等待扫码。完成绑定后状态会自动更新。")}</Alert> : null}
            <Stack direction="row" spacing={0.75} sx={{ justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => onRefreshLog(selected.profileName)}>{t("刷新日志")}</Button>
              <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => onReveal(selected.appLogPath || selected.defaultLogPath)}>{t("定位")}</Button>
            </Stack>
            {selected.logTail.length > 0 ? <pre className="feature-code-block wechat-log-v2">{selected.logTail.join("\n")}</pre> : <EmptyState icon={<TerminalRoundedIcon />} title="还没有日志" description="启动扫码后，这里会显示脱敏后的桥接输出。" />}
          </Stack>
        )}
      </Box>
    </Box>
  ) : (
    <EmptyState icon={<QrCodeScannerRoundedIcon />} title="选择一个 profile" />
  );

  const feishuStatus = feishuPresentation(feishuReport);
  const feishuList = feishuLoading && !feishuReport ? (
    <Stack className="feature-skeleton-list" spacing={1}><Skeleton variant="rounded" height={88} /></Stack>
  ) : feishuError && !feishuReport ? (
    <ErrorState message={feishuError} onRetry={onRefresh} />
  ) : (
    <Box className="feature-list-items remote-runtime-list">
      <button type="button" className="feature-list-item active">
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <ForumRoundedIcon className="feature-list-leading-icon" />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography className="feature-list-title">{t("飞书 Bot")}</Typography>
            <Typography className="feature-list-meta">{feishuReport?.profileLabel || t("等待绑定 profile")}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
              <StatusBadge label={feishuStatus.label} tone={feishuStatus.tone} />
              {feishuReport?.version ? <StatusBadge label={feishuReport.version.replace("codex-remote ", "v")} /> : null}
            </Stack>
          </Box>
        </Stack>
      </button>
    </Box>
  );

  const feishuDetail = (
    <Box className="feature-detail">
      <Box className="feature-detail-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography className="feature-detail-title">{t("飞书远程渠道")}</Typography>
          <Typography className="feature-detail-subtitle">{t("codex-remote · 独立本地运行时")}</Typography>
        </Box>
        <StatusBadge label={feishuStatus.label} tone={feishuStatus.tone} />
      </Box>
      <DialogTabs value={feishuTab} onChange={setFeishuTab} label="飞书渠道详情" tabs={[{ value: "overview", label: "概览" }, { value: "config", label: "配置" }, { value: "diagnostics", label: "诊断" }]} />
      <Box className="feature-detail-body">
        {feishuTab === "overview" ? (
          <Stack spacing={1}>
            {feishuReport?.lastError ? <Alert severity="error">{feishuReport.lastError}</Alert> : null}
            {!feishuReport?.installed ? <Alert severity="info">{t("飞书渠道依赖用户安装的 codex-remote。rCodexManager 只负责绑定 profile 和管理运行状态。")}</Alert> : null}
            {feishuReport?.running && !feishuReport.configured ? <Alert severity="warning">{t("服务已启动，但还没有可用的飞书 Bot。打开 WebSetup 完成企业自建应用配置。")}</Alert> : null}
            <Box className="feature-grid">
              <SourceCard label="运行时" value={feishuReport?.installed ? feishuReport.version || t("已安装") : t("未安装")} />
              <SourceCard label="绑定 Profile" value={feishuReport?.profileLabel || t("未绑定")} />
              <SourceCard label="进程状态" value={feishuReport?.running ? t("运行中 · PID {pid}", { pid: feishuReport.pid ?? "-" }) : t("已停止")} />
              <SourceCard label="服务健康" value={feishuReport?.healthy ? t("正常") : t("未就绪")} />
              <SourceCard label="Bot 连接" value={`${feishuReport?.connectedGatewayCount ?? 0}/${feishuReport?.gatewayCount ?? 0}`} />
              <SourceCard label="管理端口" value={String(feishuReport?.adminPort ?? "-")} />
            </Box>
            <Box className="feature-fieldset">
              <Typography className="feature-fieldset-title">{t("运行说明")}</Typography>
              <Typography className="feature-help-text">{t("一个飞书应用只由这个受管实例维持长连接；密钥保存在 codex-remote 的本地配置中，不进入 rCodexManager 元数据。")}</Typography>
            </Box>
          </Stack>
        ) : null}

        {feishuTab === "config" ? (
          <Stack spacing={1} className="feishu-config-panel">
            <TextField select size="small" label={t("绑定 profile")} value={feishuProfileName} onChange={(event) => onFeishuProfileChange(event.target.value)}>
              {profiles.map((profile) => <MenuItem key={profile.name} value={profile.name}>{profile.label}{profile.authExists ? "" : ` · ${t("未认证")}`}</MenuItem>)}
            </TextField>
            <TextField size="small" label={t("codex-remote 可执行文件")} value={binaryPath} onChange={(event) => setBinaryPath(event.target.value)} placeholder={t("自动检测，或填写绝对路径")} helperText={t("支持 PATH、~/.local/bin、Homebrew；不会自动下载或替换外部程序。")} />
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
              <Button size="small" startIcon={<SaveRoundedIcon />} disabled={busy || !feishuProfileName} onClick={() => onConfigureFeishu(feishuProfileName, binaryPath)}>{t("保存绑定")}</Button>
              <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={busy || !feishuProfileName} onClick={async () => { await onStartFeishu(feishuProfileName, binaryPath); setFeishuTab("overview"); }}>{t("启动服务")}</Button>
              <Button size="small" startIcon={<OpenInNewRoundedIcon />} disabled={!feishuReport?.running} onClick={() => onOpenFeishuPage("setup")}>{t("打开 WebSetup")}</Button>
            </Stack>
            <Alert severity="info">{t("App ID 和 App Secret 请在 WebSetup 中填写。rCodexManager 不读取、不展示也不持久化这些凭据。")}</Alert>
          </Stack>
        ) : null}

        {feishuTab === "diagnostics" ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={0.75} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button size="small" onClick={onRefreshFeishuLog}>{t("刷新日志")}</Button>
              <Button size="small" startIcon={<OpenInNewRoundedIcon />} disabled={!feishuReport?.running} onClick={() => onOpenFeishuPage("admin")}>{t("管理后台")}</Button>
              <Button size="small" startIcon={<FolderOpenRoundedIcon />} disabled={!feishuReport?.logPath} onClick={() => feishuReport?.logPath && onReveal(feishuReport.logPath)}>{t("定位")}</Button>
            </Stack>
            {feishuReport?.logTail.length ? <pre className="feature-code-block wechat-log-v2">{feishuReport.logTail.join("\n")}</pre> : <EmptyState icon={<TerminalRoundedIcon />} title="还没有运行日志" description="启动飞书渠道后，这里会显示脱敏后的最近日志。" />}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );

  const shellActions = channel === "wechat" && selectedIsExternal ? (
    <Box className="manager-action-layout"><ManagerPagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /><StatusBadge label="外部服务 · 只读" tone="info" /></Box>
  ) : channel === "wechat" && selected ? (
    <Box className="manager-action-layout">
      <ManagerPagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <Stack direction="row" spacing={0.75}>
        <Button size="small" color="error" startIcon={<LinkOffRoundedIcon />} disabled={busy || (!selected.tokenExists && !selected.running)} onClick={() => setConfirmUnbind(true)}>{t("解除绑定")}</Button>
        {selected.running ? <Button size="small" startIcon={<StopCircleRoundedIcon />} disabled={busy} onClick={() => onStop(selected.profileName)}>{t("停止")}</Button> : null}
        {selected.tokenExists ? <Button size="small" startIcon={<RestartAltRoundedIcon />} disabled={busy || !selected.authExists} onClick={async () => { await onRestart(selected.profileName); setWechatTab("logs"); }}>{t("重启桥接")}</Button> : null}
        {!selected.running ? <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={busy || !selected.authExists} onClick={async () => { setWechatTab("logs"); await onStart(selected.profileName); }}>{t("启动扫码")}</Button> : null}
      </Stack>
    </Box>
  ) : channel === "feishu" ? (
    <Box className="manager-action-layout">
      <ManagerPagination page={page} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <Stack direction="row" spacing={0.75}>
      {!feishuReport?.installed ? <Button size="small" startIcon={<OpenInNewRoundedIcon />} onClick={() => onOpenFeishuPage("project")}>{t("安装说明")}</Button> : null}
      {feishuReport?.running ? <Button size="small" startIcon={<StopCircleRoundedIcon />} disabled={busy} onClick={onStopFeishu}>{t("停止")}</Button> : null}
      {feishuReport?.running ? <Button size="small" startIcon={<RestartAltRoundedIcon />} disabled={busy} onClick={onRestartFeishu}>{t("重启")}</Button> : null}
      {feishuReport?.installed && !feishuReport.running ? <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={busy || !feishuProfileName} onClick={() => onStartFeishu(feishuProfileName, binaryPath)}>{t("启动")}</Button> : null}
      </Stack>
    </Box>
  ) : undefined;

  const runningCount = (report?.runningCount ?? 0) + (feishuReport?.running ? 1 : 0);
  const configuredCount = bridges.filter((bridge) => bridge.tokenExists).length + (feishuReport?.configured ? 1 : 0);

  return (
    <>
      <ManagerDialogShell
        open={open}
        title="远程渠道"
        subtitle={t("{running} 运行中 · {configured} 已配置", { running: runningCount, configured: configuredCount })}
        icon={<HubRoundedIcon />}
        status={<StatusBadge label={loading || feishuLoading ? "刷新中" : channel === "wechat" ? "微信" : "飞书"} tone={loading || feishuLoading ? "info" : "neutral"} />}
        refreshing={loading || feishuLoading}
        onRefresh={onRefresh}
        onClose={onClose}
        className="wechat-bridge-v2 remote-channels-v1"
        actions={shellActions}
      >
        <Box className="remote-channel-tabs">
          <DialogTabs value={channel} onChange={(value) => setChannel(value as RemoteChannel)} label="远程渠道" tabs={[{ value: "wechat", label: "微信" }, { value: "feishu", label: "飞书" }]} />
        </Box>
        {channel === "wechat" ? (
          <>
            <DialogToolbar>
              <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索 profile、实例或账号")} sx={{ flex: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }} />
              <StatusBadge label={t("{count} 个实例", { count: bridges.length })} />
            </DialogToolbar>
            <MasterDetailLayout list={wechatList} detail={wechatDetail} detailOpen={Boolean(selected)} onBack={() => onProfileChange("")} />
          </>
        ) : (
          <MasterDetailLayout list={feishuList} detail={feishuDetail} detailOpen />
        )}
      </ManagerDialogShell>
      <SensitiveActionConfirmDialog
        open={confirmUnbind}
        title={t("解除微信绑定")}
        description={t("将先停止 {profile} 的桥接，再把 token 移入带时间戳的本地备份目录。之后可以重新扫码绑定。", { profile: selected?.profileLabel ?? t("当前实例") })}
        confirmLabel="解除绑定"
        tone="warning"
        busy={busy}
        onCancel={() => setConfirmUnbind(false)}
        onConfirm={async () => { if (selected) await onUnbind(selected.profileName); setConfirmUnbind(false); }}
      />
    </>
  );
}

function SourceCard({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return <Box className="feature-source-row"><Typography variant="caption">{t(label)}</Typography><Typography>{value}</Typography></Box>;
}

function PathRow({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="caption" sx={{ width: 58, color: "var(--muted)" }}>{t(label)}</Typography>
      <Typography className="mono" sx={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5 }}>{value}</Typography>
      <Button size="small" onClick={onOpen}>{t("打开")}</Button>
    </Stack>
  );
}
