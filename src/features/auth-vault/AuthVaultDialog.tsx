import { useEffect, useMemo, useRef, useState } from "react";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
} from "../../components/manager";
import { previewAuthBackupPackage } from "../../lib/api";
import type {
  AuthApplicationEntry,
  AuthBackupEntry,
  AuthBackupImportPreview,
  AuthProfileSlot,
  AuthVaultReport,
} from "../../lib/types";
import { useI18n, type Translate } from "../../i18n";
import "../manager-dialogs.css";

type ConfirmAction =
  | { kind: "apply"; backup: AuthBackupEntry; target: AuthProfileSlot }
  | { kind: "rollback"; application: AuthApplicationEntry }
  | { kind: "delete"; backup: AuthBackupEntry }
  | { kind: "cleanup"; accountKey: string; accountLabel: string; count: number }
  | { kind: "import"; file: File };

function profileLabel(profile: AuthProfileSlot): string {
  return profile.profileAlias?.trim() || profile.profileName;
}

function accountLabel(profile: { account: AuthBackupEntry["account"] }, unknownLabel = "未识别账号"): string {
  return profile.account?.email || profile.account?.name || profile.account?.accountId || unknownLabel;
}

function accountKey(backup: AuthBackupEntry): string {
  return backup.account?.accountId || backup.account?.userId || backup.account?.email || backup.account?.name || "";
}

function formatTime(value: string | null | undefined, locale: string, unknownLabel: string): string {
  if (!value) return unknownLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { hour12: false });
}

function formatListTime(value: string | null | undefined, locale: string, unknownLabel: string): string {
  if (!value) return unknownLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const showYear = date.getFullYear() !== now.getFullYear();
  return date.toLocaleString(locale, {
    ...(showYear ? { year: "2-digit" as const } : {}),
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatBytes(value: number | null, unknownLabel: string): string {
  if (value === null) return unknownLabel;
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

export function AuthVaultDialog({
  open,
  report,
  loading,
  busy,
  error,
  activeProfileName,
  selectedProfileName,
  selectedBackupId,
  onClose,
  onRefresh,
  onProfileChange,
  onBackupSelect,
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
  error?: string | null;
  activeProfileName: string;
  selectedProfileName: string;
  selectedBackupId: string;
  onClose: () => void;
  onRefresh: () => void;
  onProfileChange: (value: string) => void;
  onBackupSelect: (value: string) => void;
  onCreateBackups: (profileNames: string[], label: string) => Promise<void> | void;
  onImportPackage: (file: File) => Promise<void> | void;
  onApplyBackup: (backupId: string, targetProfileName: string) => Promise<void> | void;
  onRollbackApplication: (applicationId: string) => Promise<void> | void;
  onUpdateBackup: (backupId: string, label: string, note: string, pinned: boolean) => Promise<void> | void;
  onExportBackup: (backupId: string) => Promise<void> | void;
  onCleanupBackups: (accountKey: string, accountLabel: string, count: number) => Promise<void> | void;
  onDeleteBackup: (backupId: string) => Promise<void> | void;
  onReveal: (path: string) => void;
}) {
  const { language, t } = useI18n();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("detail");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskProfiles, setTaskProfiles] = useState<string[]>([]);
  const [taskLabel, setTaskLabel] = useState("");
  const [importPreview, setImportPreview] = useState<AuthBackupImportPreview | null>(null);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [edit, setEdit] = useState({ label: "", note: "", pinned: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const importRef = useRef<HTMLInputElement | null>(null);

  const profiles = report?.profiles ?? [];
  const backups = report?.backups ?? [];
  const applications = report?.recentApplications ?? [];
  const selectedBackup = selectedBackupId ? backups.find((backup) => backup.id === selectedBackupId) ?? null : null;
  const selectedTarget = selectedProfileName ? profiles.find((profile) => profile.profileName === selectedProfileName) ?? null : null;
  const duplicateCount = selectedBackup ? backups.filter((backup) => accountKey(backup) && accountKey(backup) === accountKey(selectedBackup)).length : 0;
  const filteredBackups = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return backups;
    return backups.filter((backup) => [backup.label, backup.note, backup.sourceProfileName, accountLabel(backup, t("未识别账号"))].join(" ").toLowerCase().includes(value));
  }, [backups, query, t]);
  const pageCount = Math.max(1, Math.ceil(filteredBackups.length / pageSize));
  const paginatedBackups = useMemo(
    () => filteredBackups.slice((page - 1) * pageSize, page * pageSize),
    [filteredBackups, page, pageSize],
  );

  useEffect(() => {
    if (!selectedBackup) return;
    setEdit({ label: selectedBackup.label, note: selectedBackup.note ?? "", pinned: selectedBackup.pinned });
  }, [selectedBackup?.id]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("detail");
      setTaskOpen(false);
      setConfirmAction(null);
      setImportPreview(null);
      setImportPreviewError(null);
    }
  }, [open]);

  async function handleImportFile(file: File) {
    setImportPreviewLoading(true);
    setImportPreviewError(null);
    try {
      const packageJson = await file.text();
      const preview = await previewAuthBackupPackage({ packageJson });
      setImportPreview(preview);
      setConfirmAction({ kind: "import", file });
    } catch (previewError) {
      setImportPreviewError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setImportPreviewLoading(false);
    }
  }

  async function executeConfirmedAction() {
    const action = confirmAction;
    if (!action) return;
    if (action.kind === "apply") await onApplyBackup(action.backup.id, action.target.profileName);
    if (action.kind === "rollback") await onRollbackApplication(action.application.id);
    if (action.kind === "delete") await onDeleteBackup(action.backup.id);
    if (action.kind === "cleanup") await onCleanupBackups(action.accountKey, action.accountLabel, action.count);
    if (action.kind === "import") await onImportPackage(action.file);
    setConfirmAction(null);
    setImportPreview(null);
  }

  const canApply = Boolean(selectedBackup?.valid && selectedTarget && !selectedTarget.isDefault && !selectedTarget.isRunning && !busy);

  const list = loading && backups.length === 0 ? (
    <Stack className="feature-skeleton-list" spacing={1}>{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} variant="rounded" height={70} />)}</Stack>
  ) : error && backups.length === 0 ? (
    <ErrorState message={error} onRetry={onRefresh} />
  ) : filteredBackups.length === 0 ? (
    <EmptyState icon={<ArchiveRoundedIcon />} title="没有认证备份" description="从一个已登录 profile 创建首份备份。" />
  ) : (
    <Box className="feature-list-items">
      {paginatedBackups.map((backup) => (
        <button key={backup.id} type="button" className={`feature-list-item auth-backup-list-item ${backup.id === selectedBackup?.id ? "active" : ""}`} aria-current={backup.id === selectedBackup?.id ? "true" : undefined} onClick={() => onBackupSelect(backup.id)}>
          <Stack direction="row" spacing={1} className="auth-backup-list-layout">
            <SecurityRoundedIcon className="feature-list-leading-icon" />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={0.5} className="auth-backup-list-heading">
                <Typography className="feature-list-title" sx={{ flex: 1 }}>{backup.label}</Typography>
                {backup.pinned ? <PushPinRoundedIcon sx={{ fontSize: 14, color: "var(--accent)" }} /> : null}
              </Stack>
              <Typography className="feature-list-meta">{accountLabel(backup, t("未识别账号"))}</Typography>
              <Stack direction="row" spacing={0.75} className="auth-backup-list-footer">
                <StatusBadge label={backup.valid ? "有效" : backup.exists ? "已损坏" : "文件缺失"} tone={backup.valid ? "success" : "error"} />
                <Typography component="span" className="auth-backup-list-time">
                  {formatListTime(backup.modifiedAt ?? backup.updatedAt ?? backup.createdAt, language, t("时间未知"))}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </button>
      ))}
    </Box>
  );

  const detail = selectedBackup ? (
    <Box className="feature-detail">
      <Box className="feature-detail-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography className="feature-detail-title">{selectedBackup.label}</Typography>
          <Typography className="feature-detail-subtitle">{accountLabel(selectedBackup, t("未识别账号"))} · {formatBytes(selectedBackup.fileSizeBytes, t("未知"))}</Typography>
        </Box>
        <StatusBadge label={selectedBackup.valid ? "可应用" : "不可应用"} tone={selectedBackup.valid ? "success" : "error"} />
      </Box>
      <DialogTabs
        value={tab}
        onChange={setTab}
        label="认证库详情"
        tabs={[{ value: "detail", label: "备份详情" }, { value: "history", label: t("应用记录 {count}", { count: applications.length }) }]}
      />
      <Box className="feature-detail-body">
        {tab === "detail" ? (
          <Stack spacing={1}>
            {!selectedBackup.valid ? <Alert severity="error">{selectedBackup.validationMessage || t("备份不可用")}</Alert> : null}
            <Box className="feature-grid">
              <TextField size="small" label={t("备份名称")} value={edit.label} onChange={(event) => setEdit((current) => ({ ...current, label: event.target.value }))} />
              <FormControlLabel control={<Checkbox checked={edit.pinned} onChange={(event) => setEdit((current) => ({ ...current, pinned: event.target.checked }))} />} label={t("置顶")} />
            </Box>
            <TextField size="small" label={t("备注")} value={edit.note} onChange={(event) => setEdit((current) => ({ ...current, note: event.target.value }))} multiline minRows={2} />
            <Box className="feature-inline-actions">
              <Button size="small" startIcon={<SaveRoundedIcon />} disabled={busy || !edit.label.trim()} onClick={() => onUpdateBackup(selectedBackup.id, edit.label.trim(), edit.note.trim(), edit.pinned)}>{t("保存信息")}</Button>
              <Button size="small" startIcon={<FileDownloadRoundedIcon />} disabled={busy || !selectedBackup.valid} onClick={() => onExportBackup(selectedBackup.id)}>{t("导出")}</Button>
              <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => onReveal(selectedBackup.path)}>{t("定位文件")}</Button>
              {duplicateCount > 1 ? <Button size="small" color="warning" onClick={() => setConfirmAction({ kind: "cleanup", accountKey: accountKey(selectedBackup), accountLabel: accountLabel(selectedBackup, t("未识别账号")), count: duplicateCount })}>{t("清理重复 {count}", { count: duplicateCount })}</Button> : null}
            </Box>
            <Box className="feature-grid">
              <SourceCard label="来源 profile" value={selectedBackup.sourceProfileLabel || selectedBackup.sourceProfileName || t("未知")} />
              <SourceCard label="Refresh token" value={selectedBackup.hasRefreshToken ? t("包含") : t("缺失")} warning={!selectedBackup.hasRefreshToken} />
              <SourceCard label="创建时间" value={formatTime(selectedBackup.createdAt, language, t("未知"))} />
              <SourceCard label="更新时间" value={formatTime(selectedBackup.modifiedAt ?? selectedBackup.updatedAt, language, t("未知"))} />
            </Box>
          </Stack>
        ) : applications.length === 0 ? (
          <EmptyState icon={<ContentCopyRoundedIcon />} title="还没有应用记录" />
        ) : (
          <Stack spacing={1}>
            {applications.map((application) => (
              <Box key={application.id} className="feature-fieldset">
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography className="feature-fieldset-title" sx={{ mb: "2px !important" }}>{application.backupLabel} → {application.targetProfileLabel || application.targetProfileName}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatTime(application.appliedAt, language, t("未知"))}</Typography>
                  </Box>
                  {application.rolledBackAt ? <StatusBadge label="已回滚" /> : <Button size="small" color="warning" disabled={busy || !application.previousAuthExists} onClick={() => setConfirmAction({ kind: "rollback", application })}>{t("回滚")}</Button>}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  ) : (
    <EmptyState icon={<SecurityRoundedIcon />} title="选择一份认证备份" />
  );

  const confirmCopy = confirmAction ? confirmDescription(confirmAction, importPreview, t) : null;

  return (
    <>
      <ManagerDialogShell
        open={open}
        title="认证库"
        subtitle={t("{backups} 个备份 · {profiles} 个 profile", { backups: report?.backupCount ?? 0, profiles: report?.profileCount ?? 0 })}
        icon={<SecurityRoundedIcon />}
        status={<StatusBadge label={loading ? "刷新中" : "本地加密边界"} tone={loading ? "info" : "neutral"} />}
        refreshing={loading}
        onRefresh={onRefresh}
        onClose={onClose}
        className="auth-vault-v2"
        actions={
          <Box className="manager-action-layout">
            <ManagerPagination page={page} pageCount={pageCount} pageSize={pageSize} total={filteredBackups.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
            <Stack direction="row" spacing={0.75}>
              <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} disabled={!selectedBackup || busy} onClick={() => selectedBackup && setConfirmAction({ kind: "delete", backup: selectedBackup })}>{t("删除备份")}</Button>
              <TextField select size="small" value={selectedTarget?.profileName ?? ""} onChange={(event) => onProfileChange(event.target.value)} sx={{ width: 190 }}>
                {profiles.map((profile) => <MenuItem key={profile.profileName} value={profile.profileName}>{profileLabel(profile)}{profile.profileName === activeProfileName ? ` · ${t("当前")}` : ""}</MenuItem>)}
              </TextField>
              <Button size="small" variant="contained" disabled={!canApply} onClick={() => selectedBackup && selectedTarget && setConfirmAction({ kind: "apply", backup: selectedBackup, target: selectedTarget })}>{t("应用到 profile")}</Button>
            </Stack>
          </Box>
        }
      >
        <DialogToolbar>
          <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索备份、账号或来源")} sx={{ flex: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }} />
          <input ref={importRef} type="file" accept=".json,.rcodex-auth.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImportFile(file); event.target.value = ""; }} />
          <Button size="small" startIcon={importPreviewLoading ? <CircularProgress size={16} /> : <FileUploadRoundedIcon />} disabled={busy || importPreviewLoading} onClick={() => importRef.current?.click()}>{t("导入认证包")}</Button>
          <Button size="small" variant="contained" startIcon={<ArchiveRoundedIcon />} disabled={busy} onClick={() => { setTaskProfiles(activeProfileName ? [activeProfileName] : []); setTaskLabel(""); setTaskOpen(true); }}>{t("新建备份")}</Button>
        </DialogToolbar>
        {importPreviewError ? <Alert severity="error" onClose={() => setImportPreviewError(null)} sx={{ borderRadius: 0 }}>{importPreviewError}</Alert> : null}
        <MasterDetailLayout list={list} detail={detail} detailOpen={Boolean(selectedBackup)} onBack={() => onBackupSelect("")} />
      </ManagerDialogShell>

      <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} fullWidth maxWidth="xs" className="manager-confirm-dialog">
        <DialogTitle>{t("新建认证备份")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 0.25 }}>
            <TextField size="small" label={t("统一名称（可选）")} value={taskLabel} onChange={(event) => setTaskLabel(event.target.value)} helperText={t("多选时会自动附加 profile 名称")} />
            <Typography variant="subtitle2">{t("选择来源 profile")}</Typography>
            <Box className="auth-backup-profile-picker">
              {profiles.map((profile) => (
                <FormControlLabel key={profile.profileName} control={<Checkbox checked={taskProfiles.includes(profile.profileName)} disabled={!profile.authExists} onChange={(event) => setTaskProfiles((current) => event.target.checked ? [...current, profile.profileName] : current.filter((name) => name !== profile.profileName))} />} label={`${profileLabel(profile)}${profile.authExists ? "" : ` · ${t("未登录")}`}`} />
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskOpen(false)}>{t("取消")}</Button>
          <Button variant="contained" disabled={busy || taskProfiles.length === 0} onClick={async () => { await onCreateBackups(taskProfiles, taskLabel.trim()); setTaskOpen(false); }}>{t("创建 {count} 个备份", { count: taskProfiles.length || "" })}</Button>
        </DialogActions>
      </Dialog>

      <SensitiveActionConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmCopy?.title ?? t("确认操作")}
        description={confirmCopy?.description ?? t("请确认本次操作。")}
        confirmLabel={confirmCopy?.label ?? "确认"}
        tone={confirmCopy?.tone ?? "warning"}
        busy={busy}
        onCancel={() => { setConfirmAction(null); setImportPreview(null); }}
        onConfirm={() => void executeConfirmedAction()}
      />
    </>
  );
}

function SourceCard({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  const { t } = useI18n();
  return <Box className="feature-source-row"><Typography variant="caption">{t(label)}</Typography><Typography className={warning ? "feature-warning-text" : ""}>{value}</Typography></Box>;
}

function confirmDescription(action: ConfirmAction, preview: AuthBackupImportPreview | null, t: Translate): { title: string; description: string; label: string; tone: "warning" | "error" } {
  if (action.kind === "apply") return { title: t("应用认证备份"), description: t("将“{backup}”应用到 {profile}。现有 auth.json 会先自动备份。", { backup: action.backup.label, profile: profileLabel(action.target) }), label: t("确认应用"), tone: "warning" };
  if (action.kind === "rollback") return { title: t("回滚认证"), description: t("将 {profile} 恢复到应用“{backup}”之前的状态。", { profile: action.application.targetProfileLabel || action.application.targetProfileName, backup: action.application.backupLabel }), label: t("确认回滚"), tone: "warning" };
  if (action.kind === "delete") return { title: t("删除认证备份"), description: t("删除“{backup}”及其本地备份文件。该操作不可撤销。", { backup: action.backup.label }), label: t("删除"), tone: "error" };
  if (action.kind === "cleanup") return { title: t("清理重复备份"), description: t("账号 {account} 有 {count} 份备份，将保留最新或置顶的一份。", { account: action.accountLabel, count: action.count }), label: t("清理重复"), tone: "error" };
  return { title: t("导入认证包"), description: preview ? t("将“{backup}”导入本地认证库。账号：{account}；refresh_token：{token}。这不会覆盖任何 profile。", { backup: preview.label, account: preview.account?.email || preview.account?.name || t("未识别"), token: preview.hasRefreshToken ? t("包含") : t("缺失") }) : t("导入“{file}”到本地认证库。", { file: action.file.name }), label: t("确认导入"), tone: "warning" };
}
