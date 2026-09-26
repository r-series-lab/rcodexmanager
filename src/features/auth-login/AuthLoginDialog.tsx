import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useEffect, useRef, useState } from "react";
import {
  cancelAuthLoginSession,
  openAuthLoginUrl,
  readAuthLoginSession,
  startLocalProfileLogin,
} from "../../lib/api";
import type { AuthLoginSessionReport, AuthLoginTargetKind } from "../../lib/types";
import { StatusBadge } from "../../components/manager";
import { useI18n } from "../../i18n";

export interface AuthLoginTarget {
  kind: AuthLoginTargetKind;
  profileName: string;
  profileLabel: string;
  hasAccount?: boolean;
}

export function AuthLoginDialog({
  open,
  target,
  onClose,
  onCompleted,
  onAutoRefresh,
}: {
  open: boolean;
  target: AuthLoginTarget | null;
  onClose: () => void;
  onCompleted: (target: AuthLoginTarget) => Promise<void> | void;
  onAutoRefresh: (target: AuthLoginTarget) => Promise<boolean> | boolean;
}) {
  const { t } = useI18n();
  const [session, setSession] = useState<AuthLoginSessionReport | null>(null);
  const [starting, setStarting] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "code" | null>(null);
  const completedSessionRef = useRef("");

  useEffect(() => {
    if (!open) {
      setSession(null);
      setStarting(false);
      setAutoRefreshing(false);
      setError(null);
      setCopied(null);
      completedSessionRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open || !target || session?.status !== "waiting") return;
    let disposed = false;
    const poll = window.setInterval(() => {
      void readAuthLoginSession(session.sessionId)
        .then(async (next) => {
          if (disposed) return;
          setSession(next);
          if (
            next.status === "completed"
            && completedSessionRef.current !== next.sessionId
          ) {
            completedSessionRef.current = next.sessionId;
            await onCompleted(target);
          }
        })
        .catch((pollError) => {
          if (!disposed) {
            setError(messageOf(pollError, t("读取登录状态失败")));
          }
        });
    }, 1200);
    return () => {
      disposed = true;
      window.clearInterval(poll);
    };
  }, [open, onCompleted, session?.sessionId, session?.status, target]);

  async function startLogin() {
    if (!target) return;
    setStarting(true);
    setError(null);
    setCopied(null);
    try {
      const next = await startLocalProfileLogin(target.profileName);
      setSession(next);
    } catch (startError) {
      setError(messageOf(startError, t("生成授权信息失败")));
    } finally {
      setStarting(false);
    }
  }

  async function refreshWithCodex() {
    if (!target) return;
    setAutoRefreshing(true);
    setError(null);
    try {
      const refreshed = await onAutoRefresh(target);
      if (refreshed) {
        onClose();
      } else {
        setError(t("Codex 自动刷新未完成，可以改用浏览器重新登录。"));
      }
    } catch (refreshError) {
      setError(messageOf(refreshError, t("Codex 自动刷新失败，可以改用浏览器重新登录。")));
    } finally {
      setAutoRefreshing(false);
    }
  }

  async function copyValue(kind: "url" | "code", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1600);
    } catch (copyError) {
      setError(messageOf(copyError, t("复制失败")));
    }
  }

  async function closeDialog() {
    if (session?.status === "waiting") {
      try {
        await cancelAuthLoginSession(session.sessionId);
      } catch {
        // Closing the dialog still clears the ephemeral challenge locally.
      }
    }
    onClose();
  }

  const waiting = session?.status === "waiting";
  const completed = session?.status === "completed";
  const failed = session && ["failed", "cancelled", "expired"].includes(session.status);

  return (
    <Dialog
      open={open}
      onClose={() => void closeDialog()}
      fullWidth
      maxWidth="sm"
      className="auth-login-dialog"
      aria-labelledby="auth-login-dialog-title"
    >
      <DialogTitle id="auth-login-dialog-title" className="auth-login-dialog-title">
        <Box className="auth-login-heading">
          <Box className="auth-login-icon"><LoginRoundedIcon /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" className="auth-login-title-text">
              {target?.hasAccount ? t("刷新认证") : t("登录 Profile")}
            </Typography>
            <Typography component="span" className="auth-login-subtitle">
              {target?.profileLabel || target?.profileName || "Codex"}
            </Typography>
          </Box>
        </Box>
        <IconButton aria-label={t("关闭认证向导")} onClick={() => void closeDialog()}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent className={`auth-login-dialog-content ${target?.hasAccount ? "is-refresh" : "is-login"}`}>
        {!session && !starting ? (
          <Box className={`auth-login-intro ${target?.hasAccount ? "is-refresh" : "is-login"}`}>
            <Box className="auth-login-mode-row">
              <StatusBadge
                label={target?.hasAccount ? t("自动刷新优先") : t("浏览器授权")}
                tone={target?.hasAccount ? "success" : "info"}
              />
              {target?.hasAccount ? (
                <Typography variant="caption" className="auth-login-mode-note">
                  {t("保留当前 Profile 和会话")}
                </Typography>
              ) : null}
            </Box>
            <Box className="auth-login-explainer">
              <Typography variant="body2">
                {target?.hasAccount
                  ? t("如果 access token 已过期且 refresh token 仍有效，启动 Codex 会自动刷新认证。")
                  : t("生成当前 Profile 的 OpenAI 授权链接，完成后认证会保存到对应 CODEX_HOME。")}
              </Typography>
            </Box>
            <Alert severity="info">
              {target?.hasAccount
                ? t("自动刷新会在后台启动 Codex，完成后本窗口会自动关闭。")
                : t("授权期间请保持本弹窗打开，以便 Codex 接收 localhost 回调。")}
            </Alert>
            {target?.hasAccount ? (
              <Box className="auth-login-refresh-card">
                <Typography className="auth-login-refresh-card-title">
                  {t("推荐：启动 Codex 自动刷新")}
                </Typography>
                <Typography variant="body2">
                  {t("不会替换当前 Profile，也不会清除会话。")}
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  className="auth-login-auto-button"
                  startIcon={autoRefreshing ? <CircularProgress size={16} /> : <LoginRoundedIcon />}
                  disabled={autoRefreshing}
                  onClick={() => void refreshWithCodex()}
                >
                  {autoRefreshing ? t("正在启动 Codex 自动刷新…") : t("启动 Codex 自动刷新")}
                </Button>
              </Box>
            ) : null}
          </Box>
        ) : null}

        {starting ? (
          <Box className="auth-login-loading">
            <CircularProgress size={24} />
            <Typography variant="body2">
              {t("正在启动 Codex 登录会话…")}
            </Typography>
          </Box>
        ) : null}

        {waiting && session ? (
          <Stack className="auth-login-waiting" spacing={1}>
            <Box className="auth-login-status-row">
              <Box>
                <Typography variant="subtitle2">{t("等待授权")}</Typography>
                <Typography variant="caption" color="text.secondary">{session.message}</Typography>
              </Box>
              <StatusBadge label={t("进行中")} tone="warning" />
            </Box>
            <LinearProgress />

            {session.userCode ? (
              <Box className="auth-login-code-block">
                <Typography variant="caption">{t("一次性代码")}</Typography>
                <Typography className="auth-login-user-code" translate="no">
                  {session.userCode}
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => void copyValue("code", session.userCode || "")}
                >
                  {copied === "code" ? t("已复制") : t("复制代码")}
                </Button>
              </Box>
            ) : null}

            {session.verificationUrl ? (
              <Box className="auth-login-url-block">
                <Box className="auth-login-url-copy">
                  <LinkRoundedIcon fontSize="small" />
                  <Typography title={session.verificationUrl} translate="no">
                    {compactAuthorizationUrl(session.verificationUrl)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75}>
                  <Button
                    size="small"
                    startIcon={<ContentCopyRoundedIcon />}
                    onClick={() => void copyValue("url", session.verificationUrl || "")}
                  >
                    {copied === "url" ? t("已复制") : t("复制链接")}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<OpenInNewRoundedIcon />}
                    onClick={() => {
                      if (session.verificationUrl) {
                        void openAuthLoginUrl(session.verificationUrl).catch((openError) => {
                          setError(messageOf(openError, t("打开授权页失败")));
                        });
                      }
                    }}
                  >
                    {t("打开授权页")}
                  </Button>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        ) : null}

        {completed ? (
          <Box className="auth-login-result">
            <CheckCircleRoundedIcon color="success" />
            <Typography variant="subtitle1">{t("认证完成")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("Profile 认证状态已刷新，可以关闭此窗口。")}
            </Typography>
          </Box>
        ) : null}

        {failed ? (
          <Alert severity={session.status === "cancelled" ? "info" : "warning"}>
            {session.message}
          </Alert>
        ) : null}

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      </DialogContent>

      <DialogActions className="auth-login-dialog-actions">
        {waiting ? (
          <Button
            color="inherit"
            startIcon={<CancelRoundedIcon />}
            onClick={() => void closeDialog()}
          >
            {t("取消登录")}
          </Button>
        ) : (
          <Button onClick={() => void closeDialog()}>{completed ? t("完成") : t("关闭")}</Button>
        )}
        {!session || failed ? (
          <Button
            variant="contained"
            startIcon={<LoginRoundedIcon />}
            disabled={!target || starting || autoRefreshing}
            onClick={() => void startLogin()}
          >
            {failed ? t("重新生成") : target?.hasAccount ? t("浏览器重新登录") : t("生成授权链接")}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function compactAuthorizationUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "OpenAI 授权地址";
  }
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  const message = String(error || "").trim();
  return message || fallback;
}
