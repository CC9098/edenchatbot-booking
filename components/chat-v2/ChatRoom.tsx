"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ModeIndicator, type ChatMode } from "./ModeSelector";
import { MessageList, type ChatMessage } from "./MessageList";
import { ChatInputV2 } from "./ChatInputV2";
import { useAuth } from "@/components/auth/AuthProvider";
import { getChatSessionKey, getChatStorageKey } from "@/lib/chat-storage";

const WELCOME_MESSAGE =
  "你好！我是醫天圓 AI 體質顧問。我會根據你嘅體質及照護資料，提供個人化嘅飲食、作息及調養建議。有什麼想了解的嗎？";

const STREAMING_ENABLED =
  process.env.NEXT_PUBLIC_CHAT_STREAMING_ENABLED === "true";

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

type ChatApiJsonResponse = {
  reply?: string;
  message?: string;
  mode?: ChatMode;
};

type StreamPayload = {
  type?: string;
  text?: string;
  reply?: string;
  mode?: ChatMode;
  error?: string;
};

async function consumeNdjsonStream(
  response: Response,
  onPayload: (payload: StreamPayload) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Missing response stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let payload: StreamPayload;
      try {
        payload = JSON.parse(trimmed) as StreamPayload;
      } catch {
        // Ignore malformed stream chunk
        continue;
      }
      onPayload(payload);
    }
  }

  const final = buffer.trim();
  if (final) {
    let payload: StreamPayload;
    try {
      payload = JSON.parse(final) as StreamPayload;
    } catch {
      // Ignore trailing malformed chunk
      return;
    }
    onPayload(payload);
  }
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

  const sendJsonRequest = useCallback(
    async (updatedMessages: ChatMessage[]) => {
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

      const data = (await response.json()) as ChatApiJsonResponse;
      const detectedMode: ChatMode = data.mode ?? "G1";
      const reply =
        data.reply ?? data.message ?? "抱歉，暫時無法回應，請稍後再試。";

      return { detectedMode, reply };
    },
    [sessionId],
  );

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

      const appendErrorMessage = () => {
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "抱歉，發生了錯誤。請檢查網路連線後再試一次。",
          mode,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      };

      const appendJsonReply = async () => {
        const { detectedMode, reply } = await sendJsonRequest(updatedMessages);
        setMode(detectedMode);

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: reply,
          mode: detectedMode,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      };

      let draftTimestamp: string | null = null;
      let removeDraft = () => {};

      try {
        if (!STREAMING_ENABLED) {
          await appendJsonReply();
          return;
        }

        const currentDraftTimestamp = new Date().toISOString();
        draftTimestamp = currentDraftTimestamp;
        const updateDraft = (content: string, draftMode: ChatMode) => {
          setMessages((prev) => {
            const idx = prev.findIndex(
              (item) =>
                item.role === "assistant" &&
                item.createdAt === currentDraftTimestamp,
            );
            if (idx < 0) return prev;

            const next = [...prev];
            next[idx] = {
              ...next[idx],
              content,
              mode: draftMode,
            };
            return next;
          });
        };

        removeDraft = () => {
          setMessages((prev) =>
            prev.filter(
              (item) =>
                !(
                  item.role === "assistant" &&
                  item.createdAt === currentDraftTimestamp
                ),
            ),
          );
        };

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            mode,
            createdAt: currentDraftTimestamp,
          },
        ]);

        const response = await fetch("/api/chat/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            stream: true,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/x-ndjson")) {
          removeDraft();
          const data = (await response.json()) as ChatApiJsonResponse;
          const detectedMode: ChatMode = data.mode ?? "G1";
          const reply =
            data.reply ?? data.message ?? "抱歉，暫時無法回應，請稍後再試。";

          setMode(detectedMode);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: reply,
              mode: detectedMode,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }

        let streamedReply = "";
        let detectedMode: ChatMode = mode;
        let streamDone = false;

        await consumeNdjsonStream(response, (payload) => {
          if (payload.type === "meta" && payload.mode) {
            detectedMode = payload.mode;
            setMode(payload.mode);
            return;
          }

          if (payload.type === "delta" && typeof payload.text === "string") {
            streamedReply += payload.text;
            updateDraft(streamedReply, detectedMode);
            return;
          }

          if (payload.type === "done") {
            if (payload.mode) {
              detectedMode = payload.mode;
              setMode(payload.mode);
            }
            const finalReply =
              typeof payload.reply === "string" && payload.reply.length > 0
                ? payload.reply
                : streamedReply;
            streamedReply = finalReply;
            streamDone = true;
            updateDraft(
              finalReply || "抱歉，暫時無法回應，請稍後再試。",
              detectedMode,
            );
            return;
          }

          if (payload.type === "error") {
            throw new Error(payload.error || "Streaming failed");
          }
        });

        if (!streamDone && streamedReply) {
          updateDraft(streamedReply, detectedMode);
          setMode(detectedMode);
        }

        if (!streamDone && !streamedReply) {
          removeDraft();
          await appendJsonReply();
        }
      } catch {
        if (draftTimestamp) {
          removeDraft();
        }
        try {
          await appendJsonReply();
        } catch {
          appendErrorMessage();
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, mode, sendJsonRequest, sessionId],
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
      <div className="border-b border-primary/10 bg-white/95 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <ModeIndicator currentMode={mode} />
          <button
            onClick={handleClearChat}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          >
            清除對話
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-hidden bg-[rgba(246,248,244,0.85)]">
        <MessageList messages={messages} loading={loading} sessionId={sessionId} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-primary/10 bg-white/95">
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
