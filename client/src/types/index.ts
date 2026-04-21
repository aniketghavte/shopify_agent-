export interface Chart {
  id: string;
  title: string;
  mime: string;
  data_base64: string;
}

export interface ChatMeta {
  tool_calls: number;
  iterations: number;
  latency_ms: number;
  model: string;
  shop: string;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  charts: Chart[];
  meta: ChatMeta;
}

export interface HealthResponse {
  status: "ok" | string;
  shop: string;
  model: string;
  version: string;
}

export type MessageRole = "user" | "assistant" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  charts?: Chart[];
  meta?: ChatMeta;
  createdAt: number;
}
