const SESSION_KEY = "shopify-agent.session_id";

export const sessionStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set(id: string): void {
    try {
      window.localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* ignore quota / privacy mode */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

// Not for security - just message-key uniqueness.
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
