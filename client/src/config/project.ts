export const PROJECT = {
  name: "Shopify Insight Agent",
  tagline:
    "An LLM agent that reads a Shopify store (orders, products, customers) over read-only Admin REST calls, then answers business questions with tables, metrics and optional charts.",
  githubUrl: "https://github.com/aniketghavte/shopify_agent-",
  assignmentName: "AI Agent for Shopify Store Analysis",
} as const;

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "/api";

export interface ApiEndpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  body?: string;
  responseShape?: string;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/health",
    summary:
      "Liveness probe. Returns the connected shop, active model and server version.",
    responseShape: `{ status: "ok", shop: string, model: string, version: string }`,
  },
  {
    method: "POST",
    path: "/chat",
    summary:
      "Ask the agent a question. Runs the LangGraph ReAct loop with Shopify + Python tools and returns the final answer, any generated charts (base64 PNG) and run metadata.",
    body: `{ message: string, session_id?: string }`,
    responseShape: `{ session_id: string, answer: string, charts: Chart[], meta: { tool_calls, iterations, latency_ms, model, shop } }`,
  },
  {
    method: "POST",
    path: "/chat/reset",
    summary:
      "Clear a session's conversation memory (history is kept in-memory per session_id).",
    body: `{ session_id: string }`,
    responseShape: `{ ok: true }`,
  },
];

export interface AgentTool {
  name: string;
  kind: "Shopify (GET)" | "Python";
  purpose: string;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "get_shopify_data",
    kind: "Shopify (GET)",
    purpose:
      "Generic escape hatch: GETs any Shopify Admin REST path with query params and Link-header pagination. Used when no specialised tool fits.",
  },
  {
    name: "list_orders",
    kind: "Shopify (GET)",
    purpose:
      "Orders with common filters pre-wired (status, date range, financial/fulfilment status, fields).",
  },
  {
    name: "list_products",
    kind: "Shopify (GET)",
    purpose:
      "Products with vendor / type / created / updated filters and a compact `fields` selector.",
  },
  {
    name: "list_customers",
    kind: "Shopify (GET)",
    purpose:
      "Customers with date filters; emits lifetime spend / orders_count fields for repeat-customer queries.",
  },
  {
    name: "count_resource",
    kind: "Shopify (GET)",
    purpose:
      "Cheap `/count` lookup for orders, products or customers when only a total is needed.",
  },
  {
    name: "get_shop_info",
    kind: "Shopify (GET)",
    purpose: "Shop metadata (name, domain, currency, timezone, plan).",
  },
  {
    name: "python_repl_ast",
    kind: "Python",
    purpose:
      "Sandboxed PythonAstREPLTool for aggregation, grouping and matplotlib charts. Charts captured as base64 PNGs and returned on /chat.",
  },
];

export const TECH_STACK = {
  backend: [
    "Python 3.11",
    "FastAPI (ASGI)",
    "LangChain + LangGraph (create_react_agent)",
    "langchain-google-genai (Gemini)",
    "langchain_experimental PythonAstREPLTool",
    "httpx (Shopify HTTP client)",
    "Pydantic v2 + pydantic-settings",
  ],
  frontend: [
    "React 18 + TypeScript",
    "Vite 5",
    "react-router-dom v6",
    "react-markdown + remark-gfm + rehype-sanitize",
  ],
  integrations: [
    "Shopify Admin REST API (2025-07) - GET only",
    "Gemini API (AI Studio)",
  ],
  ops: [
    "CORS-aware FastAPI setup",
    "In-memory conversation store (session_id keyed)",
    "Rate-limit / 429 retry with exponential back-off",
    "Response payload truncation to protect the model context window",
  ],
};

export const SAMPLE_QUESTIONS: string[] = [
  "How many orders were placed in the last 7 days?",
  "Which products sold the most last month?",
  "Show a table of revenue by city.",
  "Who are my repeat customers (> 3 orders)?",
  "What is the AOV (Average Order Value) trend this month?",
  "Which product should I promote next, based on recent sales?",
  "Plot order volume over the past 4 weeks.",
];

export interface SafetyRule {
  title: string;
  detail: string;
}

export const SAFETY_RULES: SafetyRule[] = [
  {
    title: "GET-only Shopify access",
    detail:
      "The HTTP client rejects any non-GET verb at the transport layer, so even if the model attempts a write it cannot reach Shopify.",
  },
  {
    title: "Refusal for unsafe intents",
    detail:
      "If the user asks for POST/PUT/DELETE-style operations, the agent replies exactly: \u201cThis operation is not permitted.\u201d",
  },
  {
    title: "No raw code in final answers",
    detail:
      "The prompt forbids emitting raw Python/JSON; the REPL is a reasoning tool, not an output channel.",
  },
  {
    title: "No hallucinated metrics",
    detail:
      "Every number must come from a tool call; if the data isn't available the agent says so.",
  },
  {
    title: "Sanitised markdown on the client",
    detail:
      "react-markdown is wrapped with rehype-sanitize, blocking script/style injection in rendered answers.",
  },
];
