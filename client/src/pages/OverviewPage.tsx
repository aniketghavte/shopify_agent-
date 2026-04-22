import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StoreBar } from "../components/StoreBar";
import {
  AGENT_TOOLS,
  API_BASE_URL,
  API_ENDPOINTS,
  PROJECT,
  SAFETY_RULES,
  SAMPLE_QUESTIONS,
  TECH_STACK,
} from "../config/project";

export default function OverviewPage() {
  const absoluteBase = useMemo(() => {
    if (/^https?:/i.test(API_BASE_URL)) return API_BASE_URL;
    if (typeof window === "undefined") return API_BASE_URL;
    return `${window.location.origin}${API_BASE_URL}`;
  }, []);

  return (
    <>
      <StoreBar />
      <main className="overview">
        <Hero />

        <Section id="what" title="What this project is" eyebrow="Overview">
          <p className="doc-lead">
            <strong>{PROJECT.name}</strong> is a fullstack take-home for
            the assignment <em>{PROJECT.assignmentName}</em>. It exposes
            a chat UI that talks to a FastAPI backend, which drives a
            LangGraph ReAct agent. The agent can only <em>read</em> a
            Shopify store (GET-only Admin REST), run light Python for
            analysis, and return a natural-language answer plus
            optional tables and matplotlib charts.
          </p>
          <ul className="doc-highlights">
            <li>
              <span className="doc-highlight-dot" /> LangGraph ReAct
              agent with six Shopify tools + a Python analysis tool.
            </li>
            <li>
              <span className="doc-highlight-dot" /> Enforces GET-only
              at the HTTP client, not just at the prompt.
            </li>
            <li>
              <span className="doc-highlight-dot" /> Pagination
              (<code>Link</code> header), retry on 429, and payload
              truncation built into the Shopify client.
            </li>
            <li>
              <span className="doc-highlight-dot" /> Sanitised markdown
              rendering on the client; charts arrive as base64 PNGs.
            </li>
          </ul>
        </Section>

        <Section id="architecture" title="Architecture" eyebrow="How it fits together">
          <p className="doc-p">
            Two processes, one repo. The browser talks to FastAPI over
            JSON; FastAPI owns the agent. Each <code>/chat</code>{" "}
            request rebuilds the agent graph so that per-request tool
            state (the Shopify HTTP client and the Python REPL locals)
            is isolated and safe under concurrency.
          </p>

          <ArchitectureDiagram />

          <div className="doc-grid doc-grid--2">
            <InfoCard title="Per-request agent build">
              A fresh <code>ShopifyClient</code> and{" "}
              <code>PythonAstREPLTool</code> are constructed for every
              request, then closed in <code>finally:</code>. Charts
              captured during the run are attached to the response and
              never leak across requests.
            </InfoCard>
            <InfoCard title="Session memory">
              <code>ConversationStore</code> is an in-memory dict keyed
              by <code>session_id</code>. The client persists{" "}
              <code>session_id</code> in <code>localStorage</code>, so a
              refresh keeps context until the user clicks{" "}
              <em>New chat</em>.
            </InfoCard>
            <InfoCard title="Safety boundary">
              The Shopify HTTP client refuses any non-GET verb. The
              prompt additionally instructs the agent to reply{" "}
              <em>"This operation is not permitted."</em> if the user
              asks for a write.
            </InfoCard>
            <InfoCard title="Resilience">
              Pagination follows <code>Link: rel="next"</code> up to{" "}
              <code>SHOPIFY_MAX_PAGES</code>. HTTP 429 triggers
              exponential back-off. JSON responses over{" "}
              <code>~120k</code> chars are truncated before being
              handed to the model.
            </InfoCard>
          </div>
        </Section>

        <Section id="project" title="Project structure" eyebrow="Layout">
          <pre className="doc-tree">{`Shopify_agent/
├── server/                       FastAPI backend
│   └── app/
│       ├── main.py               ASGI app, CORS, lifespan
│       ├── config.py             Pydantic settings (.env loader)
│       ├── api/
│       │   ├── routes.py         /health, /chat, /chat/reset
│       │   └── schemas.py        request/response models
│       ├── services/
│       │   └── chat_service.py   orchestrates memory + agent run
│       ├── agent/
│       │   ├── builder.py        LangGraph create_react_agent wiring
│       │   ├── prompts.py        system prompt (role, rules, style)
│       │   └── memory.py         in-memory ConversationStore
│       ├── tools/
│       │   ├── shopify_client.py GET-only httpx client, paging, retry
│       │   ├── shopify_tools.py  6 LangChain tools (orders/products/…)
│       │   └── python_repl.py    PythonAstREPLTool + chart capture
│       └── core/
│           ├── exceptions.py     typed domain errors
│           └── logging.py        structured logging helper
└── client/                       React + Vite chat UI
    └── src/
        ├── pages/                ChatPage, OverviewPage
        ├── components/           StoreBar, MessageList, Markdown, …
        ├── hooks/useChat.ts      send / cancel / reset / health
        ├── api/client.ts         typed fetch wrapper
        ├── config/project.ts     overview metadata (this page)
        └── styles/globals.css    design tokens + layout
`}</pre>
        </Section>

        <Section id="agent" title="Agent tools" eyebrow="Capabilities">
          <p className="doc-p">
            The agent is a LangGraph ReAct graph. Every tool below is
            read-only. The Python tool is the only non-Shopify tool and
            it is used strictly for analysis / plotting — never to
            return raw code to the user.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Kind</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {AGENT_TOOLS.map((t) => (
                  <tr key={t.name}>
                    <td>
                      <code>{t.name}</code>
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          t.kind === "Python" ? "tag--python" : "tag--shopify"
                        }`}
                      >
                        {t.kind}
                      </span>
                    </td>
                    <td>{t.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="api" title="Backend API" eyebrow="HTTP endpoints">
          <p className="doc-p">
            The frontend talks to the backend through three JSON
            endpoints. The effective base URL for this browser session
            is shown below.
          </p>
          <CopyableRow label="Base URL" value={absoluteBase} />

          <div className="doc-endpoints">
            {API_ENDPOINTS.map((ep) => (
              <EndpointCard
                key={`${ep.method}-${ep.path}`}
                method={ep.method}
                path={ep.path}
                fullUrl={`${absoluteBase}${ep.path}`}
                summary={ep.summary}
                body={ep.body}
                responseShape={ep.responseShape}
              />
            ))}
          </div>
        </Section>

        <Section id="stack" title="Tech stack" eyebrow="Dependencies">
          <div className="doc-grid doc-grid--4">
            <StackCard title="Backend" items={TECH_STACK.backend} />
            <StackCard title="Frontend" items={TECH_STACK.frontend} />
            <StackCard
              title="Integrations"
              items={TECH_STACK.integrations}
            />
            <StackCard title="Ops / hardening" items={TECH_STACK.ops} />
          </div>
        </Section>

        <Section id="safety" title="Safety & guard-rails" eyebrow="Constraints">
          <ul className="doc-list">
            {SAFETY_RULES.map((rule) => (
              <li key={rule.title} className="doc-list__item">
                <div className="doc-list__title">{rule.title}</div>
                <div className="doc-list__detail">{rule.detail}</div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="questions" title="Sample questions" eyebrow="Try the agent">
          <p className="doc-p">
            Representative prompts from the assignment spec that the
            agent is designed to handle.
          </p>
          <ol className="doc-questions">
            {SAMPLE_QUESTIONS.map((q, i) => (
              <li key={i}>
                <span className="doc-questions__num">{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
          <div className="doc-cta">
            <Link to="/" className="btn btn--warm">
              Open chat →
            </Link>
          </div>
        </Section>

        <Section id="repo" title="Repository" eyebrow="Source code">
          <div className="doc-repo">
            <div className="doc-repo__meta">
              <div className="doc-repo__title">
                {PROJECT.name} — GitHub
              </div>
              <div className="doc-repo__sub">
                Full source, frontend + backend, in a single repository.
              </div>
            </div>
            <a
              className="btn btn--primary"
              href={PROJECT.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on GitHub
            </a>
          </div>
          <CopyableRow label="Clone" value={`${PROJECT.githubUrl}.git`} />
        </Section>

        <footer className="footer">
          Built for the <em>{PROJECT.assignmentName}</em> assignment.
          GET-only. No writes are ever issued to Shopify.
        </footer>
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="doc-hero">
      <div className="doc-hero__eyebrow">Project overview</div>
      <h1 className="doc-hero__title">{PROJECT.name}</h1>
      <p className="doc-hero__lead">{PROJECT.tagline}</p>
      <div className="doc-hero__actions">
        <Link to="/" className="btn btn--primary">
          Try the agent
        </Link>
        <a
          className="btn btn--ghost"
          href={PROJECT.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <nav className="doc-toc" aria-label="On this page">
        {[
          ["what", "What it is"],
          ["architecture", "Architecture"],
          ["project", "Structure"],
          ["agent", "Agent tools"],
          ["api", "Backend API"],
          ["stack", "Tech stack"],
          ["safety", "Safety"],
          ["questions", "Sample questions"],
          ["repo", "Repository"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="doc-toc__link">
            {label}
          </a>
        ))}
      </nav>
    </section>
  );
}

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="doc-section">
      {eyebrow && <div className="doc-section__eyebrow">{eyebrow}</div>}
      <h2 className="doc-section__title">{title}</h2>
      <div className="doc-section__body">{children}</div>
    </section>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="doc-card">
      <div className="doc-card__title">{title}</div>
      <div className="doc-card__body">{children}</div>
    </div>
  );
}

function StackCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="doc-card">
      <div className="doc-card__title">{title}</div>
      <ul className="doc-card__list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  fullUrl,
  summary,
  body,
  responseShape,
}: {
  method: "GET" | "POST";
  path: string;
  fullUrl: string;
  summary: string;
  body?: string;
  responseShape?: string;
}) {
  return (
    <article className="doc-endpoint">
      <header className="doc-endpoint__header">
        <span className={`method method--${method.toLowerCase()}`}>
          {method}
        </span>
        <code className="doc-endpoint__path">{path}</code>
      </header>
      <p className="doc-endpoint__summary">{summary}</p>
      <CopyableRow label="URL" value={fullUrl} compact />
      {body && (
        <div className="doc-endpoint__block">
          <div className="doc-endpoint__label">Request body</div>
          <pre className="doc-endpoint__code">{body}</pre>
        </div>
      )}
      {responseShape && (
        <div className="doc-endpoint__block">
          <div className="doc-endpoint__label">Response shape</div>
          <pre className="doc-endpoint__code">{responseShape}</pre>
        </div>
      )}
    </article>
  );
}

function CopyableRow({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard permissions blocked — silently ignore */
    }
  };

  return (
    <div className={`copy-row${compact ? " copy-row--compact" : ""}`}>
      <span className="copy-row__label">{label}</span>
      <code className="copy-row__value">{value}</code>
      <button
        type="button"
        className="copy-row__btn"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="arch">
      <div className="arch__row">
        <div className="arch__node arch__node--client">
          <div className="arch__kicker">Browser</div>
          <div className="arch__title">React + Vite client</div>
          <div className="arch__sub">
            ChatPage · OverviewPage · react-router v6 · sanitised
            markdown
          </div>
        </div>
        <div className="arch__arrow" aria-hidden>
          <span>JSON / HTTPS</span>
          <span className="arch__arrow-line" />
        </div>
        <div className="arch__node arch__node--server">
          <div className="arch__kicker">Server</div>
          <div className="arch__title">FastAPI</div>
          <div className="arch__sub">
            /health · /chat · /chat/reset · CORS
          </div>
        </div>
      </div>

      <div className="arch__row arch__row--down">
        <div className="arch__down" aria-hidden />
      </div>

      <div className="arch__row">
        <div className="arch__node arch__node--service">
          <div className="arch__kicker">Orchestration</div>
          <div className="arch__title">ChatService</div>
          <div className="arch__sub">
            ConversationStore (per-session) · latency + metadata
          </div>
        </div>
      </div>

      <div className="arch__row arch__row--down">
        <div className="arch__down" aria-hidden />
      </div>

      <div className="arch__row">
        <div className="arch__node arch__node--agent">
          <div className="arch__kicker">Agent</div>
          <div className="arch__title">LangGraph ReAct</div>
          <div className="arch__sub">
            Gemini 2.5 Flash · system prompt · tool loop
          </div>
        </div>
      </div>

      <div className="arch__row arch__row--down">
        <div className="arch__down arch__down--split" aria-hidden />
      </div>

      <div className="arch__row arch__row--tools">
        <div className="arch__node arch__node--tool">
          <div className="arch__kicker">Tool</div>
          <div className="arch__title">Shopify tools</div>
          <div className="arch__sub">
            GET-only httpx · pagination · 429 retry
          </div>
        </div>
        <div className="arch__node arch__node--tool">
          <div className="arch__kicker">Tool</div>
          <div className="arch__title">PythonAstREPLTool</div>
          <div className="arch__sub">
            Aggregation · matplotlib → base64 PNG
          </div>
        </div>
      </div>

      <div className="arch__row arch__row--down">
        <div className="arch__down" aria-hidden />
      </div>

      <div className="arch__row">
        <div className="arch__node arch__node--external">
          <div className="arch__kicker">External</div>
          <div className="arch__title">Shopify Admin REST (2025-07)</div>
          <div className="arch__sub">
            orders · products · customers · shop · *_/count
          </div>
        </div>
      </div>
    </div>
  );
}
