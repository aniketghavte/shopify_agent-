# Architecture

A walkthrough of how a message travels from the browser, through the
FastAPI server and the LangGraph agent, into Shopify's Admin REST API,
and back to the user as an insight, table, or chart.

## 1. High-level flow

```
+----------------------+    POST /chat     +--------------------------+
|  React client (Vite) | ----------------> |  FastAPI server          |
|  client/             | <---------------- |  server/app/             |
+----------------------+   ChatResponse    +----------+---------------+
                                                      |
                                                      v
                                   +-----------------------------------+
                                   |  ChatService (services/)          |
                                   |   - session history               |
                                   |   - timing / metrics              |
                                   +--------------+--------------------+
                                                  v
                                   +-----------------------------------+
                                   |  AgentRunner (agent/builder.py)   |
                                   |   LangGraph ReAct agent           |
                                   |   + Gemini / OpenAI LLM           |
                                   +------+--------------+-------------+
                                          |              |
                            Shopify tools |              | Python REPL tool
                                          v              v
                        +----------------------+   +------------------------+
                        | ShopifyClient        |   | PythonAstREPLTool      |
                        |  (httpx + retry)     |   |  pandas / matplotlib   |
                        +---------+------------+   |  save_chart() helper   |
                                  |                +------------------------+
                                  v
                      Shopify Admin REST API (GET only)
```

## 2. Repository layout

```
Shopify_agent/
  .env                        secrets (not committed, provided by assignment)
  .env.example                template for contributors
  .gitignore
  Architecture.md             this file
  Readme.md                   top-level setup + usage
  PRESETS.md                  (provided) API links + sample questions
  Shopify_agent_assignment.md (provided) original brief

  server/                     Python / FastAPI backend
    requirements.txt
    .env.example
    README.md
    app/
      main.py                 FastAPI factory + lifespan
      config.py               Pydantic settings
      core/
        logging.py
        exceptions.py
      api/
        routes.py             /health, /chat, /chat/reset
        schemas.py            Pydantic request/response models
      services/
        chat_service.py
      agent/
        builder.py            assembles the LangGraph ReAct agent
        prompts.py            system prompt
        memory.py             in-process session store
      tools/
        shopify_client.py     httpx client, retries, pagination
        shopify_tools.py      LangChain @tool wrappers
        python_repl.py        PythonAstREPLTool + chart capture

  client/                     React / TypeScript frontend
    package.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      api/client.ts
      hooks/useChat.ts
      components/
        StoreBar.tsx
        MessageList.tsx
        MessageBubble.tsx
        Markdown.tsx
        ChartImage.tsx
        MessageInput.tsx
        TypingIndicator.tsx
      types/index.ts
      utils/storage.ts
      styles/globals.css
```

## 3. Backend

### 3.1 Configuration (`app/config.py`)

`pydantic-settings` loads values from, in priority order:

1. Process environment variables.
2. `server/.env`.
3. Repository-root `.env` (where the assignment ships credentials).

The `Settings` class:

- Normalises `SHOPIFY_SHOP_NAME` to a full `.myshopify.com` domain.
- Exposes `shopify_base_url` and `cors_origin_list` as derived properties.
- Wraps the access token and Gemini key in `SecretStr` so Pydantic never
  prints them in `repr()` or logs.

### 3.2 Shopify client (`app/tools/shopify_client.py`)

A narrow wrapper around `httpx.Client`:

- **GET only.** The class only exposes `.get()` and `.get_all()`.
- **Path whitelist.** Only paths under `orders`, `products`, `customers`,
  `shop`, `inventory_*`, `locations`, `collects`, `*_collections`,
  `price_rules`, `discount_codes` are allowed. Anything else raises
  `UnsafeOperationError`.
- **No absolute URLs.** Paths like `https://evil.com/...` or `//foo` get
  rejected, so the agent can't be tricked into hitting another host.
- **Retry with backoff.** On 429 it honours `Retry-After`; on 5xx it
  uses exponential backoff capped at 16s; on timeouts it retries too.
- **Cursor-based pagination.** Parses the `Link: <...>; rel="next"`
  header and supplies `page_info` on the next request, stopping at
  `SHOPIFY_MAX_PAGES`.
- **Safe error surfacing.** `_safe_error_detail` extracts the textual
  error body but never echoes headers, so the access token can't leak
  even if Shopify includes it in diagnostics.
- **Payload truncation.** Huge responses are truncated before the tool
  hands them to the LLM (context-window and cost protection).

### 3.3 LangChain tools (`app/tools/shopify_tools.py`)

The agent sees six tools:

| Tool                | Purpose                                                    |
|---------------------|------------------------------------------------------------|
| `get_shopify_data`  | General GET for any allowed path (`params`, `paginate`).   |
| `list_orders`       | Orders with pre-wired filters (status, date range, fields).|
| `list_products`     | Products by vendor, product_type, dates, fields.           |
| `list_customers`    | Customers by dates and fields.                             |
| `count_resource`    | Fast totals for orders / products / customers.             |
| `get_shop_info`     | Shop metadata (currency, timezone, plan).                  |

Narrow, well-typed tools are easier for the LLM's tool-calling than one
kitchen-sink tool - the model picks the right one faster and fills
arguments more accurately.

Each tool catches `AppError` and returns a JSON error payload as the
observation, so the agent can reason about the failure and retry with
a smaller query instead of crashing the whole run.

### 3.4 Python REPL tool (`app/tools/python_repl.py`)

Wraps `PythonAstREPLTool` from `langchain_experimental` with:

- `pd` (pandas), `np` (numpy), `plt` (matplotlib, Agg backend).
- A `save_chart(title)` helper that captures the current matplotlib
  figure, encodes it as a base64 PNG, and appends it to a per-request
  `captured` list.

The system prompt tells the agent to call `save_chart(...)` after
plotting. We read the list after the run and attach it to the API
response, so charts appear in the UI without the model ever needing
to output image bytes directly.

Caveat (also noted in the file): `PythonAstREPLTool` is not a full
sandbox. It runs in-process. The tool-boundary + import whitelist
is enough for the assignment, but in production you'd want
`restrictedpython`, a subprocess jail, or a managed code-execution
service.

### 3.5 The agent (`app/agent/builder.py`)

Uses `langgraph.prebuilt.create_react_agent`:

- Native tool calling (not text parsing), which is more reliable than
  the classic string-based ReAct format.
- Handles the plan -> act -> observe -> respond loop automatically.
- Supports multi-turn conversations via a simple list of messages.

A fresh graph is built per request (`AgentRunner.run`) because:

1. Each request gets its own `ShopifyClient` (independent connection
   pool, clean close on completion).
2. Each request gets its own `captured` chart list - concurrent
   requests never cross-contaminate visuals.

Temperature defaults to 0.2 (deterministic enough for analytics,
still flexible for narrative). Retries are bounded for transient errors.

**Prompt (`agent/prompts.py`)** enforces:

- GET-only. Refuse mutations with the exact phrase
  `"This operation is not permitted."`
- No fabricated metrics - every number must come from a tool call.
- No raw code / JSON / tool traces in the final answer.
- A consistent procedure: Plan -> Fetch -> Analyze -> Visualise -> Respond.
- Style guide for money, tables, and headline-first writing.

### 3.6 Session memory (`app/agent/memory.py`)

- Thread-safe in-memory dict keyed by session id.
- Bounded per-session deque (`_MAX_TURNS = 20` user/AI pairs) so a
  long-running chat doesn't consume unbounded RAM.
- `session_id` is an opaque `uuid4().hex` that the server mints and the
  client echoes back on each call.

Production path: swap `ConversationStore` for a Redis or Postgres-backed
implementation with the same interface. Nothing else in the codebase
has to change.

### 3.7 HTTP surface (`app/api/routes.py`, `app/main.py`)

| Method | Path          | Description                                  |
|--------|---------------|----------------------------------------------|
| `GET`  | `/health`     | Reports shop, model, version for the UI.     |
| `POST` | `/chat`       | Body `{ message, session_id? }`. Returns `{ session_id, answer, charts[], meta }`. |
| `POST` | `/chat/reset` | Body `{ session_id }`. Drops that session's history. |

Notes:

- CORS is scoped to origins listed in `CORS_ORIGINS` and only allows
  `GET / POST / OPTIONS` + JSON headers.
- `AppError` is handled globally - clients see `{ error, detail }` with
  the right HTTP code (401/429/502/500) but never a stack trace.
- FastAPI's automatic `/docs` gives you an interactive Swagger UI.

## 4. Frontend

### 4.1 Data flow

```
App
  useChat() hook
    messages: ChatMessage[]     (state)
    send(text)                  POST /chat, append response
    cancel()                    AbortController on inflight request
    reset()                     POST /chat/reset, clear localStorage
```

- Session id is persisted in `localStorage` under `shopify-agent.session_id`
  so a page refresh keeps the conversation.
- In-flight requests are cancellable via `AbortController`, so the Stop
  button actually stops.

### 4.2 Rendering

- `Markdown.tsx` uses `react-markdown` + `remark-gfm` (tables, task
  lists, strikethrough) + `rehype-sanitize`. The model cannot inject
  HTML or scripts even if it tries.
- Tables wrap inside a horizontally-scrollable container so wide
  revenue-by-city tables don't break layout.
- Charts are rendered as `<img src="data:image/png;base64,...">`. They
  come on the JSON response and are never loaded from a third-party
  origin, so there's no CSP / CORS story to worry about.

### 4.3 Styling

- Tokenised CSS variables in `styles/globals.css`.
- Hand-rolled styles (no UI framework dependency), ~11 kB gzipped.

## 5. Request lifecycle - concrete example

User types:

> "Which products sold the most last month?"

1. **Client.** `useChat.send()` adds a user bubble locally, then
   `POST /api/chat { message, session_id }` (Vite proxies to the server).
2. **Server.** `ChatService.ask()` loads prior history for the session.
3. **Agent builds.** `AgentRunner.run()` constructs a fresh ReAct graph
   with Gemini + Shopify tools + Python REPL.
4. **Planning turn.** The LLM sees the system prompt + history + question
   and emits a tool call: `get_shop_info()` (to learn currency / TZ).
5. **Fetch turn.** Next call is something like
   `list_orders(created_at_min=..., fields="id,line_items,total_price", paginate=True)`.
   `ShopifyClient.get_all` walks `Link: rel=next` pages, respecting rate
   limits, up to `SHOPIFY_MAX_PAGES`.
6. **Analyze turn.** The LLM calls `python_repl_ast` with pandas code
   that explodes `line_items`, groups by `product_id`, sums `quantity`,
   sorts descending, and `print`s the top 10.
7. **Visualise turn.** Optionally plot a bar chart and call
   `save_chart("Top products by units - April 2026")`.
8. **Respond.** Final AIMessage in markdown: a headline, a table, and
   a bulleted insight, referencing the chart.
9. **Server.** `ChatService` attaches the captured chart list + meta
   (tool_calls, latency_ms, iterations, model) and returns.
10. **Client.** `useChat` appends an assistant bubble that renders the
    markdown + chart images inline.

## 6. Rules of thumb

- Don't raise `SHOPIFY_MAX_PAGES` blindly. Each page is 100-250 items;
  10 x 250 = ~2.5k records. The LLM can summarise that much after
  pandas aggregation, but raw JSON that size in context is wasteful.
- Prefer `fields=` on list calls. Orders in particular carry huge
  `line_items`, `shipping_lines`, and `note_attributes` payloads.
- Use date windowing. For "last 7 days" questions, pass
  `created_at_min=<now - 7d>` so we don't scan the whole order history.
- 429 handling is automatic, but if you see them often, reduce
  `SHOPIFY_DEFAULT_PAGE_SIZE` or narrow the date range.

## 7. Security posture

| Risk                               | Mitigation                                   |
|------------------------------------|----------------------------------------------|
| Access token leakage               | `SecretStr`, never logged, never in errors   |
| Agent issues a mutation            | Client has no POST/PUT/DELETE method at all  |
| Agent hits an unrelated endpoint   | Path whitelist in `ShopifyClient`            |
| Prompt injection -> XSS            | `rehype-sanitize` on all markdown            |
| Runaway agent loop                 | `recursion_limit = AGENT_MAX_ITERATIONS*2`   |
| Huge payload blowing context       | `_safe_serialize` caps at 120k chars         |
| Concurrent chart cross-contam      | Fresh REPL locals per request                |
| Session-id spoofing                | Sessions only hold chat text, no secrets     |
| CORS abuse                         | Allow-list + narrow method/header set        |

## 8. Known limitations / future work

- **Single-tenant backend.** Shop credentials are server-side env vars,
  and the frontend can't switch stores at runtime. Multi-tenant would
  mean per-session credentials (encrypted at rest).
- **In-memory session store.** Restarting the server loses history.
  Redis or Postgres with the same `ConversationStore` interface would
  fix it.
- **Python REPL is not a true sandbox.** For hostile environments, run
  the tool in a subprocess with `seccomp` or move to a managed
  code-execution service (E2B, Pyodide in a worker).
- **No streaming responses.** Gemini supports streaming; the client
  would need a small refactor to `EventSource` / fetch-streaming.
- **No tests shipped.** `ShopifyClient` pagination/retry unit tests and
  `/chat` integration tests would be first additions for real deployment.
