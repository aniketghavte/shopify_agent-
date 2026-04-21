# Frontend

Vite + React + TypeScript chat UI for the [Shopify Insight Agent](../server).

## Run

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api/*` to
`http://127.0.0.1:8000` (override with `VITE_API_PROXY_TARGET`).

## Scripts

| Command             | What it does                                |
|---------------------|---------------------------------------------|
| `npm run dev`       | Start Vite dev server on :5173              |
| `npm run build`     | Typecheck + production bundle into `dist/`  |
| `npm run preview`   | Preview the production bundle locally       |
| `npm run typecheck` | Type-check only                             |

## Structure

```
src/
  api/client.ts          fetch wrapper (health/chat/reset)
  components/
    StoreBar.tsx         top bar: shop, model, status
    MessageList.tsx      scrollable message area
    MessageBubble.tsx    one message (user | assistant | error)
    Markdown.tsx         sanitised GFM markdown
    ChartImage.tsx       renders a base64 PNG chart
    MessageInput.tsx     composer + suggestion chips
    TypingIndicator.tsx  "thinking" dots
  hooks/useChat.ts       state + actions: send, cancel, reset
  styles/globals.css     design tokens + layout
  types/index.ts         shared types (mirror backend schema)
  utils/storage.ts       localStorage session helper
  App.tsx
  main.tsx
```

## Notes

- Session id is persisted in `localStorage` so a page refresh keeps
  your chat history with the agent.
- Markdown is sanitised with `rehype-sanitize`, so the model can't
  inject scripts into the page.
- Charts come back as base64 PNGs on the `/chat` response (matplotlib
  generates them inside the Python REPL tool on the server).
