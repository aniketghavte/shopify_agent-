import { useChat } from "./hooks/useChat";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { StoreBar } from "./components/StoreBar";

export default function App() {
  const { messages, sending, health, healthError, send, reset, cancel } =
    useChat();

  return (
    <div className="app">
      <StoreBar health={health} healthError={healthError} onReset={reset} />
      <main className="chat">
        <MessageList messages={messages} sending={sending} />
        <MessageInput
          onSend={send}
          onCancel={cancel}
          disabled={sending || !!healthError}
          sending={sending}
        />
      </main>
      <footer className="footer">
        Read-only. GET requests only. Every metric sourced from the Shopify Admin API.
      </footer>
    </div>
  );
}
