import { useEffect, useMemo, useState } from "react";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Alert,
  Box,
  Button,
  Collapse,
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
  MasterDetailLayout,
  SensitiveActionConfirmDialog,
  StatusBadge,
  type StatusTone,
} from "../../components/manager";
import { MODEL_ROUTE_PROVIDER_TEMPLATES } from "../../lib/model-route-templates";
import type {
  ApplyModelRouteInput,
  ModelRoutePreset,
  ModelRoutePreview,
  ModelRouteProxyCheckResult,
  ModelRouteReport,
  PreviewModelRouteInput,
  ProfileModelRouteState,
  RestoreModelRouteInput,
} from "../../lib/types";
import { useI18n } from "../../i18n";
import "../manager-dialogs.css";

function routeTone(profile: ProfileModelRouteState): StatusTone {
  if (!profile.canApply && !profile.routed) return "neutral";
  if (profile.needsAttention) return "warning";
  if (profile.routed) return "success";
  return "info";
}

function proxyTone(status: string): StatusTone {
  if (status === "managed" || status === "external") return "success";
  if (status === "unreachable" || status === "error") return "error";
  return "warning";
}

export function ModelRouteDialog({
  open,
  report,
  loading,
  busy,
  error,
  activeProfileName,
  selectedProfileName,
  onClose,
  onRefresh,
  onProfileChange,
  onPreview,
  onCheckDraft,
  onApply,
  onRestore,
  onStartProxy,
  onStopProxy,
  onOpenCcSwitch,
  onCheckProxy,
  onReveal,
}: {
  open: boolean;
  report: ModelRouteReport | null;
  loading: boolean;
  busy: boolean;
  error?: string | null;
  activeProfileName: string;
  selectedProfileName: string;
  onClose: () => void;
  onRefresh: () => void;
  onProfileChange: (value: string) => void;
  onPreview: (input: PreviewModelRouteInput) => Promise<ModelRoutePreview>;
  onCheckDraft: (input: PreviewModelRouteInput) => Promise<ModelRouteProxyCheckResult>;
  onApply: (input: ApplyModelRouteInput) => Promise<void> | void;
  onRestore: (input: RestoreModelRouteInput) => Promise<void> | void;
  onStartProxy: () => Promise<void> | void;
  onStopProxy: () => Promise<void> | void;
  onOpenCcSwitch: () => Promise<void> | void;
  onCheckProxy: (profileName: string) => Promise<ModelRouteProxyCheckResult>;
  onReveal: (path: string) => void;
}) {
  const { t } = useI18n();
  const profiles = report?.profiles ?? [];
  const presets = report?.presets ?? [];
  const selected = selectedProfileName ? profiles.find((profile) => profile.profileName === selectedProfileName) ?? null : null;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const [preset, setPreset] = useState<ModelRoutePreset>("aliyun-qwen");
  const [model, setModel] = useState("qwen3-coder-plus");
  const [reasoningEffort, setReasoningEffort] = useState("xhigh");
  const [proxyBaseUrl, setProxyBaseUrl] = useState("http://127.0.0.1:15721/v1");
  const [upstreamBaseUrl, setUpstreamBaseUrl] = useState("https://dashscope.aliyuncs.com/compatible-mode/v1");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<ModelRoutePreview | null>(null);
  const [draftCheck, setDraftCheck] = useState<ModelRouteProxyCheckResult | null>(null);
  const [liveCheck, setLiveCheck] = useState<ModelRouteProxyCheckResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localAction, setLocalAction] = useState<"preview" | "draft" | "live" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"apply" | "restore" | null>(null);

  const selectedPreset = presets.find((item) => item.id === preset) ?? null;
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return profiles;
    return profiles.filter((profile) => [profile.profileName, profile.profileLabel, profile.profileCategory, profile.model, profile.baseUrl, profile.routeStatusLabel].join(" ").toLowerCase().includes(value));
  }, [profiles, query]);

  function invalidatePreview() {
    setPreview(null);
    setDraftCheck(null);
    setLocalError(null);
  }

  function draftInput(): PreviewModelRouteInput | null {
    if (!selected) return null;
    return {
      profileName: selected.profileName,
      preset,
      model: model.trim(),
      reasoningEffort: reasoningEffort.trim() || null,
      proxyBaseUrl: proxyBaseUrl.trim() || null,
      upstreamBaseUrl: upstreamBaseUrl.trim() || null,
      apiKey: apiKey.trim() || null,
      apiKeyEnv: apiKeyEnv.trim() || null,
    };
  }

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("overview");
      setPreview(null);
      setDraftCheck(null);
      setLiveCheck(null);
      setApiKey("");
      setConfirmAction(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    setModel(selected.model || selectedPreset?.defaultModel || "");
    setReasoningEffort(selected.reasoningEffort || "xhigh");
    setPreview(null);
    setDraftCheck(null);
    setLiveCheck(null);
  }, [selected?.profileName]);

  useEffect(() => {
    if (!selectedPreset) return;
    if (!model.trim()) setModel(selectedPreset.defaultModel);
    if (!selectedPreset.chatOnly && selectedPreset.defaultBaseUrl && !upstreamBaseUrl.trim()) setUpstreamBaseUrl(selectedPreset.defaultBaseUrl);
  }, [selectedPreset?.id]);

  async function runPreview() {
    const input = draftInput();
    if (!input) return;
    setLocalAction("preview");
    setLocalError(null);
    try {
      setPreview(await onPreview(input));
    } catch (previewError) {
      setLocalError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setLocalAction(null);
    }
  }

  async function runDraftCheck() {
    const input = draftInput();
    if (!input) return;
    setLocalAction("draft");
    setLocalError(null);
    try {
      setDraftCheck(await onCheckDraft(input));
    } catch (checkError) {
      setLocalError(checkError instanceof Error ? checkError.message : String(checkError));
    } finally {
      setLocalAction(null);
    }
  }

  async function runLiveCheck() {
    if (!selected) return;
    setLocalAction("live");
    setLocalError(null);
    try {
      setLiveCheck(await onCheckProxy(selected.profileName));
    } catch (checkError) {
      setLocalError(checkError instanceof Error ? checkError.message : String(checkError));
    } finally {
      setLocalAction(null);
    }
  }

  async function applyConfirmed() {
    const input = draftInput();
    if (!input || !preview) return;
    await onApply({ ...input, confirmSensitive: true });
    setApiKey("");
    setConfirmAction(null);
    setPreview(null);
    setTab("diagnostics");
    try {
      setLiveCheck(await onCheckProxy(input.profileName));
    } catch (checkError) {
      setLocalError(t("配置已应用，但自动自检失败：{error}", { error: checkError instanceof Error ? checkError.message : String(checkError) }));
    }
  }

  async function restoreConfirmed() {
    if (!selected) return;
    await onRestore({ profileName: selected.profileName, confirmSensitive: true });
    setConfirmAction(null);
    setPreview(null);
    setApiKey("");
  }

  function applyTemplate(nextId: string) {
    setTemplateId(nextId);
    const template = MODEL_ROUTE_PROVIDER_TEMPLATES.find((item) => item.id === nextId);
    if (!template) return;
    setPreset(template.preset);
    setModel(template.model);
    setProxyBaseUrl(template.proxyBaseUrl || "http://127.0.0.1:15721/v1");
    setUpstreamBaseUrl(template.upstreamBaseUrl || "");
    setApiKeyEnv(template.apiKeyEnv || "");
    invalidatePreview();
  }

  const list = loading && profiles.length === 0 ? (
    <Stack className="feature-skeleton-list" spacing={1}>{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} variant="rounded" height={72} />)}</Stack>
  ) : error && profiles.length === 0 ? (
    <ErrorState message={error} onRetry={onRefresh} />
  ) : filtered.length === 0 ? (
    <EmptyState icon={<AltRouteRoundedIcon />} title="没有匹配的 profile" />
  ) : (
    <Box className="feature-list-items">
      {filtered.map((profile) => (
        <button key={profile.profileName} type="button" className={`feature-list-item ${profile.profileName === selected?.profileName ? "active" : ""}`} onClick={() => onProfileChange(profile.profileName)}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <AltRouteRoundedIcon className="feature-list-leading-icon" />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography className="feature-list-title">{profile.profileLabel}</Typography>
              <Typography className="feature-list-meta">{profile.model || t("默认模型")}{profile.profileName === activeProfileName ? ` · ${t("当前")}` : ""}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}><StatusBadge label={profile.routeStatusLabel} tone={routeTone(profile)} /></Stack>
            </Box>
          </Stack>
        </button>
      ))}
    </Box>
  );

  const detail = selected ? (
    <Box className="feature-detail">
      <Box className="feature-detail-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography className="feature-detail-title">{selected.profileLabel}</Typography>
          <Typography className="feature-detail-subtitle">{selected.profileName} · {selected.model || t("未配置模型")}</Typography>
        </Box>
        <StatusBadge label={selected.routeStatusLabel} tone={routeTone(selected)} />
      </Box>
      <DialogTabs value={tab} onChange={setTab} label="模型路由详情" tabs={[{ value: "overview", label: "概览" }, { value: "config", label: "配置" }, { value: "diagnostics", label: "诊断" }]} />
      <Box className="feature-detail-body">
        {localError ? <Alert severity="error" onClose={() => setLocalError(null)} sx={{ mb: 1.5 }}>{localError}</Alert> : null}
        {tab === "overview" ? (
          <Stack spacing={1}>
            {selected.readOnlyReason ? <Alert severity="warning">{selected.readOnlyReason}</Alert> : null}
            <Box className="feature-grid">
              <SourceCard label="当前模型" value={selected.model || t("官方默认")} />
              <SourceCard label="Provider" value={selected.modelProvider || t("OpenAI 官方")} />
              <SourceCard label="Wire API" value={selected.wireApi || t("默认")} />
              <SourceCard label="写入状态" value={selected.canApply ? t("可修改") : t("只读")} warning={!selected.canApply} />
              <SourceCard label="Base URL" value={selected.baseUrl || t("官方默认")} mono />
              <SourceCard label="API Key" value={selected.hasApiKey ? t("已配置") : t("未配置")} />
            </Box>
            <Box className="feature-fieldset">
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography className="feature-fieldset-title" sx={{ mb: "2px !important" }}>{t("全局转换代理")}</Typography>
                  <Typography variant="caption" color="text.secondary">{report?.proxy.message || t("未读取代理状态")}</Typography>
                </Box>
                <StatusBadge label={report?.proxy.statusLabel || "未知"} tone={proxyTone(report?.proxy.status || "")} />
              </Stack>
              <Box className="feature-inline-actions" sx={{ mt: 1.25 }}>
                {report?.proxy.canStart ? <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={busy} onClick={onStartProxy}>{t("启动内置代理")}</Button> : null}
                {report?.proxy.canStop ? <Button size="small" startIcon={<StopCircleRoundedIcon />} disabled={busy} onClick={onStopProxy}>{t("停止代理")}</Button> : null}
                <Button size="small" onClick={onOpenCcSwitch}>{t("打开 cc-switch")}</Button>
              </Box>
            </Box>
          </Stack>
        ) : tab === "config" ? (
          <Stack spacing={1}>
            <TextField select size="small" label={t("cc-switch / Provider 模板")} value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <MenuItem value="">{t("自定义配置")}</MenuItem>
              {MODEL_ROUTE_PROVIDER_TEMPLATES.map((template) => <MenuItem key={template.id} value={template.id}>{template.label}</MenuItem>)}
            </TextField>
            <Box className="feature-grid">
              <TextField select size="small" label={t("Provider 预设")} value={preset} onChange={(event) => { setPreset(event.target.value as ModelRoutePreset); invalidatePreview(); }}>
                {presets.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
              </TextField>
              <TextField size="small" label={t("模型")} value={model} onChange={(event) => { setModel(event.target.value); invalidatePreview(); }} />
            </Box>
            <TextField size="small" label={t(selectedPreset?.chatOnly ? "上游 Chat Base URL" : "Responses Base URL")} value={upstreamBaseUrl} onChange={(event) => { setUpstreamBaseUrl(event.target.value); invalidatePreview(); }} placeholder="https://.../v1" />
            {selectedPreset?.chatOnly ? <TextField size="small" label={t("Responses 代理 URL")} value={proxyBaseUrl} onChange={(event) => { setProxyBaseUrl(event.target.value); invalidatePreview(); }} placeholder="http://127.0.0.1:15721/v1" /> : null}
            <TextField size="small" label={t("API key 环境变量")} value={apiKeyEnv} onChange={(event) => { setApiKeyEnv(event.target.value); invalidatePreview(); }} placeholder={t("例如 ZAI_API_KEY")} />
            <TextField size="small" type="password" label={t("API key（仅本次弹窗）")} value={apiKey} onChange={(event) => { setApiKey(event.target.value); invalidatePreview(); }} autoComplete="off" helperText={t("关闭弹窗或应用后立即清空，不进入 localStorage 与应用元数据。")} />
            <Button size="small" endIcon={<ExpandMoreRoundedIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => setAdvanced((value) => !value)}>{t("高级字段")}</Button>
            <Collapse in={advanced}>
              <TextField fullWidth size="small" label={t("推理强度")} value={reasoningEffort} onChange={(event) => { setReasoningEffort(event.target.value); invalidatePreview(); }} />
            </Collapse>
            <Box className="feature-inline-actions">
              <Button size="small" startIcon={<CheckCircleOutlineRoundedIcon />} disabled={busy || localAction !== null || !model.trim()} onClick={() => void runDraftCheck()}>{t(localAction === "draft" ? "测试中…" : "测试草稿配置")}</Button>
              <Button size="small" variant="contained" startIcon={<TuneRoundedIcon />} disabled={busy || localAction !== null || !model.trim()} onClick={() => void runPreview()}>{t(localAction === "preview" ? "生成中…" : "预览配置")}</Button>
            </Box>
            {draftCheck ? <Alert severity={draftCheck.ok ? "success" : "error"}>{draftCheck.statusLabel} · {draftCheck.message}（{draftCheck.latencyMs} ms）</Alert> : null}
            {preview ? <><Alert severity="info">{t("预览已生成。修改任一字段后需重新预览。")}</Alert><pre className="feature-code-block">{preview.configPreview}</pre>{preview.warnings.length ? <Alert severity="warning">{preview.warnings.join(" ")}</Alert> : null}</> : <EmptyState icon={<TuneRoundedIcon />} title="尚未生成配置预览" description="预览不会写入 config.toml。" />}
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Box className="feature-fieldset">
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Box><Typography className="feature-fieldset-title" sx={{ mb: "2px !important" }}>{t("当前配置自检")}</Typography><Typography variant="caption" color="text.secondary">{t("使用 profile 已写入的配置发起最小请求。")}</Typography></Box>
                <Button size="small" variant="contained" disabled={busy || localAction !== null || !selected.routed} onClick={() => void runLiveCheck()}>{t(localAction === "live" ? "自检中…" : "开始自检")}</Button>
              </Stack>
              {liveCheck ? <Alert severity={liveCheck.ok ? "success" : "error"} sx={{ mt: 1.25 }}>{liveCheck.statusLabel} · {liveCheck.message}（{liveCheck.latencyMs} ms）</Alert> : null}
            </Box>
            {report?.proxy.diagnostics.length ? <Stack spacing={1}>{report.proxy.diagnostics.map((item) => <Alert key={`${item.generatedAt}-${item.code}`} severity={item.level === "error" ? "error" : item.level === "warning" ? "warning" : "info"}>{item.label} · {item.message}</Alert>)}</Stack> : null}
            <Box className="feature-fieldset">
              <Typography className="feature-fieldset-title">{t("最近请求")}</Typography>
              {report?.proxy.recentLogs.length ? <Stack spacing={0.75}>{report.proxy.recentLogs.map((entry, index) => <Box key={`${entry.generatedAt}-${index}`} className="model-route-log-row"><StatusBadge label={entry.statusLabel} tone={entry.ok ? "success" : "error"} /><Typography variant="caption">{entry.profileName || t("代理")} · {entry.model || t("未知模型")} · {entry.latencyMs} ms</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">{t("还没有请求记录。")}</Typography>}
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  ) : (
    <EmptyState icon={<AltRouteRoundedIcon />} title="选择一个 profile" />
  );

  return (
    <>
      <ManagerDialogShell
        open={open}
        title="模型路由"
        subtitle={t("{routed} 已路由 · {attention} 需处理", { routed: report?.routedCount ?? 0, attention: report?.needsAttentionCount ?? 0 })}
        icon={<AltRouteRoundedIcon />}
        status={<StatusBadge label={report?.proxy.statusLabel || (loading ? "刷新中" : "代理未知")} tone={loading ? "info" : proxyTone(report?.proxy.status || "")} />}
        refreshing={loading}
        onRefresh={onRefresh}
        onClose={onClose}
        className="model-route-v2"
        actions={selected ? (
          <>
            <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => onReveal(selected.configPath)}>{t("定位 config")}</Button>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" startIcon={<RestartAltRoundedIcon />} disabled={busy || !selected.canRestore} onClick={() => setConfirmAction("restore")}>{t("恢复官方配置")}</Button>
              <Button size="small" variant="contained" disabled={busy || !selected.canApply || !preview} onClick={() => setConfirmAction("apply")}>{t("应用预览")}</Button>
            </Stack>
          </>
        ) : undefined}
      >
        <DialogToolbar>
          <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索 profile、模型或路由状态")} sx={{ flex: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }} />
          <StatusBadge label={t("{count} 个 profile", { count: profiles.length })} />
        </DialogToolbar>
        <MasterDetailLayout list={list} detail={detail} detailOpen={Boolean(selected)} onBack={() => onProfileChange("")} />
      </ManagerDialogShell>
      <SensitiveActionConfirmDialog open={confirmAction === "apply"} title={t("应用模型路由")} description={t("将先备份 {profile} 的 config.toml，再写入当前预览。应用后会自动执行一次自检。", { profile: selected?.profileName ?? t("目标 profile") })} confirmLabel={t("确认应用")} busy={busy} onCancel={() => setConfirmAction(null)} onConfirm={() => void applyConfirmed()} />
      <SensitiveActionConfirmDialog open={confirmAction === "restore"} title={t("恢复官方配置")} description={t("移除 {profile} 的模型路由字段，保留基础模型、推理强度和其他配置。", { profile: selected?.profileName ?? t("目标 profile") })} confirmLabel={t("确认恢复")} busy={busy} onCancel={() => setConfirmAction(null)} onConfirm={() => void restoreConfirmed()} />
    </>
  );
}

function SourceCard({ label, value, mono = false, warning = false }: { label: string; value: string; mono?: boolean; warning?: boolean }) {
  const { t } = useI18n();
  return <Box className="feature-source-row"><Typography variant="caption">{t(label)}</Typography><Typography className={`${mono ? "mono" : ""} ${warning ? "feature-warning-text" : ""}`.trim()}>{value}</Typography></Box>;
}
