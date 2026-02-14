"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ModeIndicator, type ChatMode } from "./ModeSelector";
import { MessageList, type ChatMessage } from "./MessageList";
import { ChatInputV2 } from "./ChatInputV2";

type ConstitutionType = "depleting" | "crossing" | "hoarding";

const WELCOME_MESSAGES: Record<ConstitutionType, string> = {
  depleting:
    "你好！我是醫天圓 AI 體質顧問。你屬於「虛損型」體質，代表身體的氣血津液可能有不足的傾向。我可以為你提供飲食、作息及調養建議。有什麼想了解的嗎？",
  crossing:
    "你好！我是醫天圓 AI 體質顧問。你屬於「交叉型」體質，代表身體可能同時存在寒熱或虛實交雜的情況。我可以幫助你了解如何平衡調理。有什麼想問的嗎？",
  hoarding:
    "你好！我是醫天圓 AI 體質顧問。你屬於「積滯型」體質，代表身體可能有痰濕、瘀血或食積等停滯的傾向。我可以為你提供疏通調理的建議。有什麼想了解的嗎？",
};

function getStorageKey(type: ConstitutionType) {
  return `eden.chat.${type}.v1`;
}

function getSessionKey(type: ConstitutionType) {
  return `eden.chat.session.${type}.v1`;
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadMessages(type: ConstitutionType): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(type));
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted data, start fresh
  }
  return [];
}

function loadOrCreateSession(type: ConstitutionType): string {
  if (typeof window === "undefined") return generateSessionId();
  try {
    const existing = localStorage.getItem(getSessionKey(type));
    if (existing) return existing;
  } catch {
    // Ignore
  }
  const id = generateSessionId();
  localStorage.setItem(getSessionKey(type), id);
  return id;
}

export function ChatRoom({ type }: { type: ConstitutionType }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>("G1");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const stored = loadMessages(type);
    const sid = loadOrCreateSession(type);
    setSessionId(sid);

    if (stored.length > 0) {
      setMessages(stored);
    } else {
      // Add welcome message
      const welcome: ChatMessage = {
        role: "assistant",
        content: WELCOME_MESSAGES[type],
        mode: "G1",
        createdAt: new Date().toISOString(),
      };
      setMessages([welcome]);
    }
  }, [type]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!initialized.current) return;
    if (messages.length === 0) return;
    try {
      localStorage.setItem(getStorageKey(type), JSON.stringify(messages));
    } catch {
      // Storage full or unavailable
    }
  }, [messages, type]);

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
            type,
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
        // Mode is AI-determined from API response
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
      } catch (error) {
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
    [messages, sessionId, type]
  );

  const handleClearChat = useCallback(() => {
    const welcome: ChatMessage = {
      role: "assistant",
      content: WELCOME_MESSAGES[type],
      mode: "G1",
      createdAt: new Date().toISOString(),
    };
    setMessages([welcome]);
    // Reset session
    const newSid = generateSessionId();
    setSessionId(newSid);
    localStorage.setItem(getSessionKey(type), newSid);
  }, [type]);

  return (
    <div className="flex h-full flex-col">
      {/* Mode selector bar */}
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
