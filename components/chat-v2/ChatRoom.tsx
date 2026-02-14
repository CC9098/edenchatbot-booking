"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ModeIndicator, type ChatMode } from "./ModeSelector";
import { MessageList, type ChatMessage } from "./MessageList";
import { ChatInputV2 } from "./ChatInputV2";
import { useAuth } from "@/components/auth/AuthProvider";
import { getChatSessionKey, getChatStorageKey } from "@/lib/chat-storage";

const WELCOME_MESSAGE =
  "你好！我是醫天圓 AI 體質顧問。我會根據你嘅體質及照護資料，提供個人化嘅飲食、作息及調養建議。有什麼想了解的嗎？";

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadMessages(storageKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted data, start fresh
  }
  return [];
}

function loadOrCreateSession(sessionKey: string): string {
  if (typeof window === "undefined") return generateSessionId();
  try {
    const existing = localStorage.getItem(sessionKey);
    if (existing) return existing;
  } catch {
    // Ignore
  }
  const id = generateSessionId();
  localStorage.setItem(sessionKey, id);
  return id;
}

export function ChatRoom() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>("G1");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);
  const storageKey = getChatStorageKey(user?.id);
  const sessionKey = getChatSessionKey(user?.id);

  // Initialize from localStorage once auth state is known.
  useEffect(() => {
    if (initialized.current) return;
    if (authLoading) return;
    initialized.current = true;

    const stored = loadMessages(storageKey);
    const sid = loadOrCreateSession(sessionKey);
    setSessionId(sid);

    if (stored.length > 0) {
      setMessages(stored);
    } else {
      const welcome: ChatMessage = {
        role: "assistant",
        content: WELCOME_MESSAGE,
        mode: "G1",
        createdAt: new Date().toISOString(),
      };
      setMessages([welcome]);
    }
  }, [authLoading, storageKey, sessionKey]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!initialized.current) return;
    if (messages.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // Storage full or unavailable
    }
  }, [messages, storageKey]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setLoading(true);

      try {
        const response = await fetch("/api/chat/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const detectedMode: ChatMode = data.mode ?? "G1";
        setMode(detectedMode);

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content:
            data.reply ?? data.message ?? "抱歉，暫時無法回應，請稍後再試。",
          mode: detectedMode,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "抱歉，發生了錯誤。請檢查網路連線後再試一次。",
          mode,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [messages, sessionId, mode]
  );

  const handleClearChat = useCallback(() => {
    const welcome: ChatMessage = {
      role: "assistant",
      content: WELCOME_MESSAGE,
      mode: "G1",
      createdAt: new Date().toISOString(),
    };
    setMessages([welcome]);
    const newSid = generateSessionId();
    setSessionId(newSid);
    localStorage.setItem(sessionKey, newSid);
  }, [sessionKey]);

  return (
    <div className="flex h-full flex-col">
      {/* Mode indicator bar */}
      <div className="flex items-center justify-between border-b border-[#2d5016]/10 bg-white px-4 py-2">
        <ModeIndicator currentMode={mode} />
        <button
          onClick={handleClearChat}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500"
        >
          清除對話
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} loading={loading} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#2d5016]/10 bg-white">
        <ChatInputV2
          onSend={handleSend}
          disabled={loading}
          placeholder={
            mode === "B"
              ? "請輸入預約相關問題..."
              : "輸入你的健康問題..."
          }
        />
      </div>
    </div>
  );
}
