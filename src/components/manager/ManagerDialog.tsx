import type { ReactElement, ReactNode } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useI18n } from "../../i18n";

export type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

export function ManagerDialogShell({
  open,
  title,
  subtitle,
  icon,
  status,
  refreshing = false,
  onRefresh,
  onClose,
  children,
  actions,
  className = "",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  status?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      className={`manager-shell-dialog ${className}`.trim()}
      slotProps={{ paper: { className: "manager-shell-paper" } }}
    >
      <DialogTitle className="manager-shell-title">
        <Stack direction="row" spacing={1} className="manager-shell-title-main">
          <Box className="manager-shell-icon">{icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" className="manager-shell-heading">{t(title)}</Typography>
            {subtitle ? <Typography className="manager-shell-subtitle">{t(subtitle)}</Typography> : null}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} className="manager-shell-title-actions">
          {status}
          {onRefresh ? (
            <Tooltip title={t("刷新")}>
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={refreshing} aria-label={t("刷新")}>
                  {refreshing ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          <Tooltip title={t("关闭")}>
            <IconButton size="small" onClick={onClose} aria-label={t("关闭")}>
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>
      <DialogContent className="manager-shell-content">{children}</DialogContent>
      {actions ? <DialogActionBar>{actions}</DialogActionBar> : null}
    </Dialog>
  );
}

export function DialogToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Box className={`manager-toolbar ${className}`.trim()}>{children}</Box>;
}

export function MasterDetailLayout({
  list,
  detail,
  detailOpen,
  onBack,
}: {
  list: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Box className={`manager-master-detail ${detailOpen ? "detail-open" : ""}`}>
      <Box className="manager-master-panel">{list}</Box>
      <Box className="manager-detail-panel">
        {onBack ? (
          <Button className="manager-detail-back" size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
            {t("返回列表")}
          </Button>
        ) : null}
        {detail}
      </Box>
    </Box>
  );
}

export function DialogTabs({
  value,
  onChange,
  tabs,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: Array<{ value: string; label: string; disabled?: boolean }>;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <Tabs
      value={value}
      onChange={(_, next: string) => onChange(next)}
      className="manager-tabs"
      aria-label={t(label)}
      variant="scrollable"
      scrollButtons={false}
    >
      {tabs.map((tab) => <Tab key={tab.value} value={tab.value} label={t(tab.label)} disabled={tab.disabled} />)}
    </Tabs>
  );
}

export function DialogActionBar({ children }: { children: ReactNode }) {
  return <DialogActions className="manager-action-bar">{children}</DialogActions>;
}

export function ManagerPagination({
  page,
  pageCount,
  pageSize,
  pageSizeOptions = [10, 50, 100],
  total,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useI18n();
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <Stack direction="row" spacing={0.75} className="manager-pagination">
      <Tooltip title={t("上一页")}>
        <span>
          <IconButton size="small" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}>
            <KeyboardArrowLeftRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption">
        {t("{range} · 第 {page} 页", { range: total ? `${start}-${end}` : t("0 条"), page })}
      </Typography>
      <Tooltip title={t("下一页")}>
        <span>
          <IconButton size="small" onClick={() => onPageChange(page + 1)} disabled={loading || page >= pageCount}>
            <KeyboardArrowRightRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
      <TextField
        select
        size="small"
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="manager-pagination-size"
        aria-label={t("每页数量")}
      >
        {pageSizeOptions.map((size) => (
          <MenuItem key={size} value={size}>{t("{count} / 页", { count: size })}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

export function StatusBadge({ label, tone = "neutral", icon }: { label: string; tone?: StatusTone; icon?: ReactElement }) {
  const { t } = useI18n();
  return <Chip size="small" label={t(label)} icon={icon} className={`manager-status-badge ${tone}`} />;
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  const { t } = useI18n();
  return (
    <Box className="manager-empty-state">
      <Box className="manager-empty-icon">{icon}</Box>
      <Typography variant="subtitle2">{t(title)}</Typography>
      {description ? <Typography variant="body2">{t(description)}</Typography> : null}
    </Box>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Box className="manager-error-state">
      <Alert severity="error" action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>{t("重试")}</Button> : null}>
        {message}
      </Alert>
    </Box>
  );
}

export function SensitiveActionConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  tone = "warning",
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "warning" | "error";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs" className="manager-confirm-dialog">
      <DialogTitle>{t(title)}</DialogTitle>
      <DialogContent>
        <Alert severity={tone}>{description}</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>{t("取消")}</Button>
        <Button color={tone === "error" ? "error" : "primary"} variant="contained" onClick={onConfirm} disabled={busy}>
          {busy ? <CircularProgress size={18} color="inherit" /> : t(confirmLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
