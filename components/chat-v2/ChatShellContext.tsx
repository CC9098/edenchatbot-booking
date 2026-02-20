"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ChatShellContextValue = {
  historyOpen: boolean;
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
};

const ChatShellContext = createContext<ChatShellContextValue | null>(null);

export function ChatShellProvider({ children }: { children: ReactNode }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      historyOpen,
      openHistory,
      closeHistory,
      toggleHistory,
    }),
    [historyOpen, openHistory, closeHistory, toggleHistory],
  );

  return <ChatShellContext.Provider value={value}>{children}</ChatShellContext.Provider>;
}

export function useChatShell() {
  const ctx = useContext(ChatShellContext);
  if (!ctx) {
    throw new Error("useChatShell must be used within ChatShellProvider");
  }
  return ctx;
}
