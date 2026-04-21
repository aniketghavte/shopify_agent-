import { useCallback, useRef, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
  sending: boolean;
}

const SUGGESTIONS = [
  "Orders in the last 7 days",
  "Top products last month",
  "Revenue by city",
  "Repeat customers",
  "AOV trend this month",
  "Plot order volume, past 4 weeks",
];

export function MessageInput({ onSend, onCancel, disabled, sending }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  return (
    <div className="composer">
      {value.length === 0 && (
        <div className="suggestions" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion"
              onClick={() => onSend(s)}
              disabled={disabled}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="composer__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder="Ask about orders, products, customers, revenue…"
          value={value}
          rows={1}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e.currentTarget);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled && !sending}
          aria-label="Ask a question"
        />
        {sending ? (
          <button
            type="button"
            className="btn btn--stop"
            onClick={onCancel}
            aria-label="Stop generating"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn--primary"
            disabled={disabled || !value.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        )}
      </form>
      <div className="composer__hint">
        <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
      </div>
    </div>
  );
}
