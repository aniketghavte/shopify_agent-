import type { HealthResponse } from "../types";

interface Props {
  health: HealthResponse | null;
  healthError: string | null;
  onReset: () => void;
}

export function StoreBar({ health, healthError, onReset }: Props) {
  const shop = health?.shop ?? "connecting…";
  const model = health?.model ?? "";
  const isDown = !!healthError;

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="brand-mark" aria-hidden>
          A
        </span>
        <div className="brand-text">
          <div className="brand-title">Shopify Insight Agent</div>
          <div className="brand-sub">
            {isDown ? (
              <span className="pill pill--down">Offline</span>
            ) : (
              <>
                <span className="pill pill--ok">Online</span>
                <span className="shop">{shop}</span>
                {model && (
                  <>
                    <span className="dot" aria-hidden />
                    <span className="model">{model}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onReset}
          title="Start a fresh conversation"
        >
          New chat
        </button>
      </div>
    </header>
  );
}
