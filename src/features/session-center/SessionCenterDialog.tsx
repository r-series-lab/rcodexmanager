import { useEffect, useMemo, useRef, useState } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import {
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
  StatusBadge,
} from "../../components/manager";
import type {
  CodexSessionSummary,
  ProfileInfo,
  ProfileSessionReport,
  ReadProfileSessionDetailInput,
} from "../../lib/types";
import { useI18n } from "../../i18n";
import "../manager-dialogs.css";

type SessionSourceProfile = Pick<ProfileInfo, "name" | "alias" | "category" | "isDefault">;

export interface SessionCenterItem {
  profile: SessionSourceProfile;
  session: CodexSessionSummary;
}

function profileLabel(profile: SessionSourceProfile): string {
  return profile.alias?.trim() || profile.name;
}

function formatTime(value: string | null | undefined, locale: string, unknownLabel: string): string {
  if (!value) return unknownLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sessionKey(item: SessionCenterItem): string {
  return `${item.profile.name}:${item.session.id}:${item.session.updatedAt ?? ""}`;
}

export function SessionCenterDialog({
  open,
  items,
  profiles,
  report,
  activeProfileName,
  loading,
  error,
  query,
  profileName,
  category,
  page,
  pageSize,
  onClose,
  onRefresh,
  onQueryChange,
  onProfileChange,
  onCategoryChange,
  onPageChange,
  onPageSizeChange,
  onLoadDetail,
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
  error?: string | null;
  query: string;
  profileName: string;
  category: string;
  page: number;
  pageSize: number;
  onClose: () => void;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onLoadDetail: (input: ReadProfileSessionDetailInput) => Promise<CodexSessionSummary>;
  onOpen: (session: CodexSessionSummary) => void;
  onCopySummary: (item: SessionCenterItem) => void;
  onCopyReference: (item: SessionCenterItem) => void;
}) {
  const { language, t } = useI18n();
  const [selectedKey, setSelectedKey] = useState("");
  const [tab, setTab] = useState("summary");
  const [detailByKey, setDetailByKey] = useState<Record<string, CodexSessionSummary>>({});
  const [detailLoadingKey, setDetailLoadingKey] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const suppressAutoSelectRef = useRef(false);

  const selectedItem = selectedKey ? items.find((item) => sessionKey(item) === selectedKey) ?? null : null;
  const selectedItemKey = selectedItem ? sessionKey(selectedItem) : "";
  const detail = selectedItem ? detailByKey[selectedItemKey] ?? selectedItem.session : null;
  const categories = useMemo(
    () => Array.from(new Set(profiles.map((profile) => profile.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [profiles],
  );
  const profileOptions = useMemo(
    () => [...profiles].sort((a, b) => profileLabel(a).localeCompare(profileLabel(b), "zh-CN")),
    [profiles],
  );

  async function loadSelectedDetail(force = false) {
    if (!selectedItem) return;
    const key = sessionKey(selectedItem);
    if (!force && detailByKey[key]) return;
    const requestId = ++requestIdRef.current;
    setDetailLoadingKey(key);
    setDetailError(null);
    try {
      const next = await onLoadDetail({
        profileName: selectedItem.profile.name,
        sessionId: selectedItem.session.id,
        updatedAt: selectedItem.session.updatedAt,
      });
      if (requestId !== requestIdRef.current) return;
      setDetailByKey((current) => ({ ...current, [key]: next }));
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setDetailError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (requestId === requestIdRef.current) setDetailLoadingKey("");
    }
  }

  useEffect(() => {
    if (!open) {
      requestIdRef.current += 1;
      suppressAutoSelectRef.current = false;
      setSelectedKey("");
      setDetailError(null);
      setTab("summary");
      return;
    }
    if (selectedItemKey) void loadSelectedDetail();
  }, [open, selectedItemKey]);

  useEffect(() => {
    if (!open || loading) return;
    if (suppressAutoSelectRef.current) {
      suppressAutoSelectRef.current = false;
      return;
    }
    if (selectedItemKey || items.length === 0) return;
    setSelectedKey(sessionKey(items[0]));
  }, [items, loading, open, selectedItemKey]);

  const lastRefresh = report?.generatedAt ? formatTime(report.generatedAt, language, t("时间未知")) : t("尚未刷新");
  const detailLoading = Boolean(selectedItemKey && detailLoadingKey === selectedItemKey);
  const list = (
    <Box className="feature-list-panel">
      {loading && items.length === 0 ? (
        <Stack className="feature-skeleton-list" spacing={1}>
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} variant="rounded" height={72} />)}
        </Stack>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={onRefresh} />
      ) : items.length === 0 ? (
        <EmptyState icon={<ChatBubbleOutlineRoundedIcon />} title="没有匹配的会话" description="调整搜索或筛选条件后再试。" />
      ) : (
        <Box className="feature-list-items">
          {items.map((item) => {
            const key = sessionKey(item);
            const active = key === selectedItemKey;
            return (
              <button
                type="button"
                key={key}
                className={`feature-list-item ${active ? "active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setSelectedKey(key)}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <TerminalRoundedIcon className="feature-list-leading-icon" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography className="feature-list-title">{item.session.title || t("未命名会话")}</Typography>
                    <Typography className="feature-list-meta">
                      {profileLabel(item.profile)} · {formatTime(item.session.updatedAt, language, t("时间未知"))}
                    </Typography>
                    <Typography className="feature-list-preview">
                      {item.session.summary || t("暂无摘要")}
                    </Typography>
                  </Box>
                </Stack>
              </button>
            );
          })}
        </Box>
      )}
    </Box>
  );

  const detailPanel = selectedItem && detail ? (
    <Box className="feature-detail">
      <Box className="feature-detail-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography className="feature-detail-title">{detail.title || t("未命名会话")}</Typography>
          <Typography className="feature-detail-subtitle">
            {profileLabel(selectedItem.profile)} · {t("更新于 {time}", { time: formatTime(detail.updatedAt, language, t("时间未知")) })}
          </Typography>
        </Box>
        <StatusBadge label={selectedItem.profile.category || "未分类"} />
      </Box>
      <DialogTabs
        value={tab}
        onChange={setTab}
        label="会话详情"
        tabs={[{ value: "summary", label: "摘要" }, { value: "source", label: "来源" }]}
      />
      <Box className="feature-detail-body">
        {detailLoading ? (
          <Stack spacing={1}><Skeleton width="48%" /><Skeleton /><Skeleton /><Skeleton width="76%" /></Stack>
        ) : detailError ? (
          <ErrorState message={detailError} onRetry={() => void loadSelectedDetail(true)} />
        ) : tab === "summary" ? (
          <Stack spacing={1.25}>
            <section className="feature-section">
              <Typography className="feature-section-label">{t("会话摘要")}</Typography>
              <Typography className="feature-section-copy">{detail.summary || t("这条会话还没有可用摘要。")}</Typography>
            </section>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <SourceRow label="Profile" value={selectedItem.profile.name} />
            <SourceRow label="分类" value={selectedItem.profile.category || "未分类"} />
            <SourceRow label="会话 ID" value={detail.id} mono />
            <SourceRow label="工作目录" value={detail.cwd || "未知"} mono />
            <SourceRow label="索引文件" value={detail.path || "未知"} mono />
            <SourceRow label="更新时间" value={detail.updatedAt || "未知"} />
          </Stack>
        )}
      </Box>
    </Box>
  ) : (
    <EmptyState icon={<ChatBubbleOutlineRoundedIcon />} title="选择一条会话" description="详情会在选中后按需读取。" />
  );

  return (
    <ManagerDialogShell
      open={open}
      title="会话中心"
      subtitle={t("{count} 条当前结果 · {time}", { count: report?.sessionCount ?? 0, time: lastRefresh })}
      icon={<ChatBubbleOutlineRoundedIcon />}
      status={<StatusBadge label={loading ? "刷新中" : "索引分页"} tone={loading ? "info" : "neutral"} icon={<FormatListBulletedRoundedIcon />} />}
      refreshing={loading}
      onRefresh={onRefresh}
      onClose={onClose}
      className="session-center-v2"
      actions={
        <Box className="manager-action-layout">
          <ManagerPagination
            page={page}
            pageCount={report?.hasMore ? page + 1 : page}
            pageSize={pageSize}
            total={report?.sessionCount ?? items.length}
            loading={loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
          <Stack direction="row" spacing={0.75}>
            <Button size="small" startIcon={<FolderOpenRoundedIcon />} disabled={!detail?.path} onClick={() => detail && onOpen(detail)}>{t("在文件夹中显示")}</Button>
            <Button size="small" startIcon={<ContentCopyRoundedIcon />} disabled={!selectedItem} onClick={() => selectedItem && onCopySummary(selectedItem)}>{t("复制摘要")}</Button>
            <Button size="small" variant="contained" disabled={!selectedItem} onClick={() => selectedItem && onCopyReference(selectedItem)}>{t("引用到当前")}</Button>
          </Stack>
        </Box>
      }
    >
      <DialogToolbar>
        <TextField
          size="small"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("搜索会话标题或摘要")}
          sx={{ minWidth: 200, flex: 1 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" value={profileName} onChange={(event) => onProfileChange(event.target.value)} sx={{ width: 170 }}>
          <MenuItem value="">{t("全部源")}</MenuItem>
          {profileOptions.map((profile) => <MenuItem key={profile.name} value={profile.name}>{profileLabel(profile)}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={category} onChange={(event) => onCategoryChange(event.target.value)} sx={{ width: 120 }}>
          <MenuItem value="">{t("全部标签")}</MenuItem>
          {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <Button className="manager-filter-toggle" size="small" variant={profileName === activeProfileName ? "contained" : "outlined"} disabled={!activeProfileName} onClick={() => onProfileChange(activeProfileName)}>{t("当前")}</Button>
      </DialogToolbar>
      <MasterDetailLayout
        list={list}
        detail={detailPanel}
        detailOpen={Boolean(selectedItem)}
        onBack={() => {
          suppressAutoSelectRef.current = true;
          setSelectedKey("");
        }}
      />
    </ManagerDialogShell>
  );
}

function SourceRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const { t } = useI18n();
  return (
    <Box className="feature-source-row">
      <Typography variant="caption">{t(label)}</Typography>
      <Typography className={mono ? "mono" : ""}>{value}</Typography>
    </Box>
  );
}
