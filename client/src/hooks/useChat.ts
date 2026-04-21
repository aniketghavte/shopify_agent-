import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { sessionStore, uid } from "../utils/storage";
import type { ChatMessage, HealthResponse } from "../types";

interface UseChatResult {
  messages: ChatMessage[];
  sending: boolean;
  health: HealthResponse | null;
  healthError: string | null;
  send: (text: string) => Promise<void>;
  reset: () => Promise<void>;
  cancel: () => void;
}

const INITIAL_GREETING: ChatMessage = {
  id: "intro",
  role: "assistant",
  content:
    "Hi! Ask me anything about your Shopify store's orders, products, " +
    "customers, or revenue. I can pull data, build tables, and plot charts.\n\n" +
    "Some things to try:\n\n" +
    "- Orders in the last 7 days\n" +
    "- Top-selling products last month\n" +
    "- Revenue by city, as a table\n" +
    "- Plot order volume over the past 4 weeks",
  createdAt: Date.now(),
};

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(sessionStore.get());
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch((e: Error) => {
        if (!cancelled) setHealthError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setSending(true);

    const controller = new AbortController();
    inflightRef.current = controller;

    try {
      const resp = await api.chat(
        {
          message: trimmed,
          session_id: sessionIdRef.current ?? undefined,
        },
        { signal: controller.signal },
      );
      sessionIdRef.current = resp.session_id;
      sessionStore.set(resp.session_id);

      const aiMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: resp.answer,
        charts: resp.charts,
        meta: resp.meta,
        createdAt: Date.now(),
      };
      // console.log("chat response", resp.meta);
      setMessages((m) => [...m, aiMsg]);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return;
      }
      const errMsg: ChatMessage = {
        id: uid(),
        role: "error",
        content: `**Error:** ${(e as Error).message}`,
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setSending(false);
      inflightRef.current = null;
    }
  }, []);

  const reset = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await api.reset(sid);
      } catch {
        // best-effort reset; ignore network errors
      }
    }
    sessionIdRef.current = null;
    sessionStore.clear();
    setMessages([{ ...INITIAL_GREETING, createdAt: Date.now() }]);
  }, []);

  const cancel = useCallback(() => {
    inflightRef.current?.abort();
    inflightRef.current = null;
    setSending(false);
  }, []);

  return { messages, sending, health, healthError, send, reset, cancel };
}
