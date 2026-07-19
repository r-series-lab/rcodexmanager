import type { ModelRoutePreset } from "./types";

export type ModelRouteTemplateApiFormat = "openai-responses" | "openai-chat";

export interface ModelRouteProviderTemplate {
  id: string;
  label: string;
  provider: string;
  source: string;
  preset: ModelRoutePreset;
  apiFormat: ModelRouteTemplateApiFormat;
  model: string;
  upstreamBaseUrl: string;
  proxyBaseUrl: string | null;
  apiKeyEnv: string;
  description: string;
}

const LOCAL_RESPONSES_PROXY = "http://127.0.0.1:15721/v1";

export const MODEL_ROUTE_PROVIDER_TEMPLATES: ModelRouteProviderTemplate[] = [
  {
    id: "ccswitch-bailian-qwen",
    label: "百炼 Qwen3 Coder",
    provider: "Bailian",
    source: "cc-switch",
    preset: "aliyun-qwen",
    apiFormat: "openai-responses",
    model: "qwen3-coder-plus",
    upstreamBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    proxyBaseUrl: null,
    apiKeyEnv: "DASHSCOPE_API_KEY",
    description: "DashScope 原生 Responses，可直连，不需要代理转换。",
  },
  {
    id: "ccswitch-zhipu-glm-cn",
    label: "智谱 GLM 5.2",
    provider: "Zhipu GLM",
    source: "cc-switch",
    preset: "glm",
    apiFormat: "openai-chat",
    model: "glm-5.2",
    upstreamBaseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    proxyBaseUrl: LOCAL_RESPONSES_PROXY,
    apiKeyEnv: "ZAI_API_KEY",
    description: "Chat-compatible，需要 cc-switch 或内置代理转换为 Responses。",
  },
  {
    id: "ccswitch-zhipu-glm-global",
    label: "Z.ai GLM 5.2",
    provider: "Zhipu GLM en",
    source: "cc-switch",
    preset: "glm",
    apiFormat: "openai-chat",
    model: "glm-5.2",
    upstreamBaseUrl: "https://api.z.ai/api/coding/paas/v4",
    proxyBaseUrl: LOCAL_RESPONSES_PROXY,
    apiKeyEnv: "ZAI_API_KEY",
    description: "Z.ai 国际站 Chat-compatible，需要代理转换。",
  },
  {
    id: "ccswitch-deepseek",
    label: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    source: "cc-switch",
    preset: "openai-chat",
    apiFormat: "openai-chat",
    model: "deepseek-v4-flash",
    upstreamBaseUrl: "https://api.deepseek.com",
    proxyBaseUrl: LOCAL_RESPONSES_PROXY,
    apiKeyEnv: "DEEPSEEK_API_KEY",
    description: "DeepSeek Chat-compatible，需要代理转换。",
  },
  {
    id: "ccswitch-kimi-coding",
    label: "Kimi For Coding",
    provider: "Kimi",
    source: "cc-switch",
    preset: "openai-chat",
    apiFormat: "openai-chat",
    model: "kimi-for-coding",
    upstreamBaseUrl: "https://api.kimi.com/coding/v1",
    proxyBaseUrl: LOCAL_RESPONSES_PROXY,
    apiKeyEnv: "KIMI_API_KEY",
    description: "Kimi coding endpoint，Chat-compatible，需要代理转换。",
  },
  {
    id: "ccswitch-doubao-seed",
    label: "Doubao Seed 2.1 Pro",
    provider: "DouBaoSeed",
    source: "cc-switch",
    preset: "custom-responses",
    apiFormat: "openai-responses",
    model: "doubao-seed-2-1-pro-260628",
    upstreamBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    proxyBaseUrl: null,
    apiKeyEnv: "ARK_API_KEY",
    description: "火山方舟原生 Responses，可直连。",
  },
  {
    id: "ccswitch-minimax-m3",
    label: "MiniMax M3",
    provider: "MiniMax",
    source: "cc-switch",
    preset: "custom-responses",
    apiFormat: "openai-responses",
    model: "MiniMax-M3",
    upstreamBaseUrl: "https://api.minimaxi.com/v1",
    proxyBaseUrl: null,
    apiKeyEnv: "MINIMAX_API_KEY",
    description: "MiniMax 原生 Responses，可直连。",
  },
];
