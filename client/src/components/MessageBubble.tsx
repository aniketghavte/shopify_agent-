import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";
import { ChartImage } from "./ChartImage";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const roleClass =
    message.role === "user"
      ? "bubble bubble--user"
      : message.role === "error"
        ? "bubble bubble--error"
        : "bubble bubble--assistant";

  return (
    <div className={`row row--${message.role}`}>
      <div className={roleClass}>
        {message.role === "user" ? (
          <div className="plain">{message.content}</div>
        ) : (
          <Markdown content={message.content} />
        )}

        {message.charts && message.charts.length > 0 && (
          <div className="charts">
            {message.charts.map((c) => (
              <ChartImage key={c.id} chart={c} />
            ))}
          </div>
        )}

        {message.meta && (
          <div className="meta">
            <span title="Tool calls made">{message.meta.tool_calls} calls</span>
            <span title="Model used">{message.meta.model}</span>
            <span title="End-to-end latency">
              {(message.meta.latency_ms / 1000).toFixed(1)}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
