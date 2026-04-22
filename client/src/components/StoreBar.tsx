import { NavLink } from "react-router-dom";

import { PROJECT } from "../config/project";
import type { HealthResponse } from "../types";

interface Props {
  /** Optional live health payload from /health. Omit on non-chat pages. */
  health?: HealthResponse | null;
  /** Optional error string from the health probe. */
  healthError?: string | null;
  /** Optional reset handler (only rendered when provided). */
  onReset?: () => void;
}

export function StoreBar({ health, healthError, onReset }: Props) {
  const showStatus = health !== undefined || healthError !== undefined;
  const shop = health?.shop ?? "connecting…";
  const model = health?.model ?? "";
  const isDown = !!healthError;

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <NavLink to="/" className="brand-link" aria-label="Go to chat">
          <span className="brand-mark" aria-hidden>
            A
          </span>
          <div className="brand-text">
            <div className="brand-title">Shopify Insight Agent</div>
            <div className="brand-sub">
              {showStatus ? (
                isDown ? (
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
                )
              ) : (
                <span className="brand-tagline">
                  Read-only Shopify analytics agent
                </span>
              )}
            </div>
          </div>
        </NavLink>
      </div>

      <nav className="topbar__nav" aria-label="Primary">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-link${isActive ? " nav-link--active" : ""}`
          }
        >
          Chat
        </NavLink>
        <NavLink
          to="/overview"
          className={({ isActive }) =>
            `nav-link${isActive ? " nav-link--active" : ""}`
          }
        >
          Overview
        </NavLink>
      </nav>

      <div className="topbar__actions">
        {onReset && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onReset}
            title="Start a fresh conversation"
          >
            New chat
          </button>
        )}
        <a
          className="btn btn--ghost topbar__github"
          href={PROJECT.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View source on GitHub"
        >
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 .5C5.73.5.67 5.57.67 11.83c0 5 3.24 9.23 7.74 10.73.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.15.68-3.81-1.34-3.81-1.34-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.51-.29-5.15-1.26-5.15-5.6 0-1.24.44-2.24 1.17-3.03-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.57.23 2.73.11 3.02.73.79 1.17 1.79 1.17 3.03 0 4.35-2.65 5.31-5.17 5.59.41.35.78 1.03.78 2.09 0 1.51-.01 2.73-.01 3.1 0 .3.2.66.79.55 4.5-1.5 7.73-5.73 7.73-10.73C23.33 5.57 18.27.5 12 .5Z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
