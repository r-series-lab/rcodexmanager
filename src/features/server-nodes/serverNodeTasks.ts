import type {
  ServerNodeOperation,
  ServerNodeOperationReport,
} from "../../lib/types";

export const SERVER_NODE_TASK_LIMIT = 10;

export type ServerNodeTaskStatus = "success" | "failed";

export interface ServerNodeTaskEntry {
  nodeId: string;
  operationId: string;
  startedAt: string;
  generatedAt: string;
  status: ServerNodeTaskStatus;
  label: string;
  command: string;
  durationMs: number;
  timeoutSeconds: number | null;
  outputTruncated: boolean;
  error: string | null;
  retryOperation: ServerNodeOperation | null;
}

export interface ServerNodeErrorGuide {
  code:
    | "busy"
    | "ssh-auth"
    | "unreachable"
    | "timeout"
    | "node-cli"
    | "codex-cli"
    | "tmux"
    | "incompatible"
    | "output-limit"
    | "protected"
    | "unknown";
  title: string;
  description: string;
}

const SAFE_RETRY_KINDS = new Set<ServerNodeOperation["kind"]>([
  "doctor",
  "list-profiles",
  "list-sessions",
  "read-session",
  "auth-status",
  "wechat-status",
  "feishu-status",
  "model-route-status",
  "model-route-preview",
  "model-route-check",
]);

export function serverNodeOperationLabel(operation: ServerNodeOperation): string {
  switch (operation.kind) {
    case "doctor": return "运行服务器诊断";
    case "list-profiles": return "读取服务器 Profiles";
    case "list-sessions": return "读取服务器会话";
    case "read-session": return "读取会话详情";
    case "auth-status": return "读取服务器认证库";
    case "check-profile-auth": return "验证 Profile 认证";
    case "create-auth-backup": return "创建认证备份";
    case "apply-auth-backup": return "应用认证备份";
    case "wechat-status": return "读取微信桥接";
    case "wechat-start": return "启动微信桥接";
    case "wechat-stop": return "停止微信桥接";
    case "wechat-restart": return "重启微信桥接";
    case "feishu-status": return "读取飞书渠道";
    case "feishu-start": return "启动飞书渠道";
    case "feishu-stop": return "停止飞书渠道";
    case "feishu-restart": return "重启飞书渠道";
    case "model-route-status": return "读取模型路由";
    case "model-route-preview": return "预览模型路由";
    case "model-route-check": return "检查模型路由";
    case "model-route-apply": return "应用模型路由";
    case "model-route-restore": return "恢复模型路由";
    case "create-profile": return "创建服务器 Profile";
    case "launch-profile": return "启动服务器 Profile";
    case "terminate-profile": return "停止服务器 Profile";
    case "update-profile-model": return "更新服务器模型";
  }
}

export function safeRetryOperation(
  operation: ServerNodeOperation,
): ServerNodeOperation | null {
  return SAFE_RETRY_KINDS.has(operation.kind) ? operation : null;
}

export function taskFromServerNodeReport(
  operation: ServerNodeOperation,
  report: ServerNodeOperationReport,
): ServerNodeTaskEntry {
  return {
    nodeId: report.nodeId,
    operationId: report.operationId,
    startedAt: report.startedAt,
    generatedAt: report.generatedAt,
    status: report.ok ? "success" : "failed",
    label: serverNodeOperationLabel(operation),
    command: report.command,
    durationMs: report.durationMs,
    timeoutSeconds: report.timeoutSeconds,
    outputTruncated: report.outputTruncated,
    error: report.error?.message ? redactServerNodeText(report.error.message) : null,
    retryOperation: safeRetryOperation(operation),
  };
}

export function failedServerNodeTask(
  nodeId: string,
  operation: ServerNodeOperation,
  message: string,
  startedAt: string,
  durationMs: number,
): ServerNodeTaskEntry {
  const operationId = message.match(/node-op-\d+-\d+/)?.[0]
    || `node-local-${Date.now()}`;
  return {
    nodeId,
    operationId,
    startedAt,
    generatedAt: new Date().toISOString(),
    status: "failed",
    label: serverNodeOperationLabel(operation),
    command: operation.kind,
    durationMs,
    timeoutSeconds: null,
    outputTruncated: false,
    error: redactServerNodeText(message),
    retryOperation: safeRetryOperation(operation),
  };
}

export function appendServerNodeTask(
  history: ServerNodeTaskEntry[],
  entry: ServerNodeTaskEntry,
): ServerNodeTaskEntry[] {
  const nodeTasks = [
    entry,
    ...history.filter((task) => (
      task.nodeId === entry.nodeId && task.operationId !== entry.operationId
    )),
  ].slice(0, SERVER_NODE_TASK_LIMIT);
  const otherTasks = history.filter((task) => task.nodeId !== entry.nodeId);
  return [...nodeTasks, ...otherTasks];
}

export function classifyServerNodeError(message: string): ServerNodeErrorGuide {
  const value = message.toLowerCase();
  if (value.includes("another write operation") || value.includes("write operation is already")) {
    return {
      code: "busy",
      title: "节点正在处理另一项修改",
      description: "等待当前任务结束后刷新状态。为避免重复写入，这类操作不会自动重试。",
    };
  }
  if (/permission denied|publickey|host key verification|authentication failed/.test(value)) {
    return {
      code: "ssh-auth",
      title: "SSH 身份验证失败",
      description: "请先确认 Mac 终端能通过该 SSH Host 免交互连接，再重新检查节点。",
    };
  }
  if (/ssh-tls|self signed certificate verify|self signed certificate|ssh transport ended|remote command did not finish/.test(value)) {
    return {
      code: "timeout",
      title: "SSH-over-TLS 通道未完成",
      description: "服务器通道可用但本次握手或远程输出没有完整结束。只读任务可以安全重试。",
    };
  }
  if (/could not resolve|name or service not known|no route to host|connection refused|connection reset|ssh connection failed/.test(value)) {
    return {
      code: "unreachable",
      title: "服务器暂时不可达",
      description: "检查服务器网络、SSH Host 和 SSH 服务后，再重新检查连接。",
    };
  }
  if (/timed out|timeout/.test(value)) {
    return {
      code: "timeout",
      title: "远程任务等待超时",
      description: "服务器可能繁忙或网络不稳定。只读任务可以安全重试，写入任务请先刷新状态。",
    };
  }
  if (/output exceeded|narrow the request/.test(value)) {
    return {
      code: "output-limit",
      title: "返回内容超过安全上限",
      description: "缩小会话范围或增加筛选条件后重试，应用不会使用被截断的数据。",
    };
  }
  if (/rcodexmanager.*not found|remote binary|node cli|节点 cli|no such file/.test(value)) {
    return {
      code: "node-cli",
      title: "服务器节点 CLI 不可用",
      description: "确认服务器已手动安装无界面 CLI，并在节点设置中填写可执行文件的绝对路径。",
    };
  }
  if (/codex.*not (found|installed)|codex cli.*missing/.test(value)) {
    return {
      code: "codex-cli",
      title: "服务器尚未安装 Codex CLI",
      description: "先在服务器完成 Codex CLI 安装与登录，再重新检查节点。",
    };
  }
  if (value.includes("tmux")) {
    return {
      code: "tmux",
      title: "服务器缺少 tmux",
      description: "查看和配置仍可使用；如需持续启动服务器 Profile，请先手动安装 tmux。",
    };
  }
  if (/invalid json|unknown (command|subcommand)|capabilit|version/.test(value)) {
    return {
      code: "incompatible",
      title: "Mac 与节点 CLI 可能不兼容",
      description: "对比两端 info/capabilities 输出，并手动更新服务器节点 CLI。",
    };
  }
  if (/default profile|running profile|is running|protected/.test(value)) {
    return {
      code: "protected",
      title: "目标 Profile 当前不可修改",
      description: "默认 Profile 受保护；其他 Profile 需停止后才能执行认证或路由写入。",
    };
  }
  return {
    code: "unknown",
    title: "远程任务未完成",
    description: "可以复制诊断信息交给 AI 排查；只读任务可直接重试，写入任务请先刷新状态。",
  };
}

export function redactServerNodeText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/((?:api[_ -]?key|authorization|password|secret|token)\s*[:=]\s*)\S+/gi, "$1[redacted]");
}

export function formatServerNodeDiagnostic(
  nodeName: string,
  sshTarget: string,
  task: ServerNodeTaskEntry | null,
  fallbackError: string | null,
): string {
  const lines = [
    "rCodexManager server-node diagnostic",
    `Node: ${nodeName}`,
    `SSH target: ${sshTarget}`,
  ];
  if (task) {
    lines.push(
      `Operation: ${task.label}`,
      `Operation ID: ${task.operationId}`,
      `Command: ${task.command}`,
      `Started: ${task.startedAt}`,
      `Duration: ${task.durationMs} ms`,
      `Timeout: ${task.timeoutSeconds == null ? "unknown" : `${task.timeoutSeconds} s`}`,
      `Result: ${task.status}`,
      `Output truncated: ${task.outputTruncated}`,
    );
  }
  const error = task?.error || fallbackError;
  if (error) lines.push(`Error: ${error}`);
  return redactServerNodeText(lines.join("\n"));
}
