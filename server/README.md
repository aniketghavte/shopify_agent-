# Backend

FastAPI + LangGraph ReAct agent that answers analytical questions about
a Shopify store using **read-only** Admin REST calls.

## Run

```bash
cd server

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Credentials - copy from the repo-root .env (provided by the
# assignment) or fill in server/.env
cp ../.env.example ../.env   # if you haven't already
# ...then edit .env with real values. Pick one provider:
#   LLM_PROVIDER=gemini  -> requires GOOGLE_API_KEY
#   LLM_PROVIDER=openai  -> requires OPENAI_API_KEY

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The server reads `.env` from the repo root first, then `server/.env`.
Process-level env vars always win.

## Endpoints

| Method | Path          | Body                              | Description                     |
|--------|---------------|-----------------------------------|---------------------------------|
| GET    | `/health`     | -                                 | Liveness + configured shop/model|
| POST   | `/chat`       | `{message, session_id?}`          | Ask the agent a question        |
| POST   | `/chat/reset` | `{session_id}`                    | Forget a session's history      |

Interactive docs at `http://127.0.0.1:8000/docs`.

## Layout (1-pager)

```
HTTP --> app/api/routes.py --> services/chat_service.py --> agent/builder.py
                                          |                         |
                                          v                         v
                                  agent/memory.py           tools/shopify_tools.py
                                                                    |
                                                                    v
                                                           tools/shopify_client.py
```

See [`Architecture.md`](../Architecture.md) at the repo root for more detail.

## Safety rails

- GET only - `ShopifyClient` rejects any path that isn't in its whitelist
  and only exposes `.get()`.
- No secret leakage - access token is a `SecretStr` and is never logged.
- Rate-limit aware - retry with exponential backoff + `Retry-After`.
- Payload caps - big Shopify responses are truncated before they reach
  the LLM.
- No raw code in answers - enforced in the system prompt + final-message
  parser.
