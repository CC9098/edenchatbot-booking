"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { ModeIndicator, type ChatMode } from "./ModeSelector";
import { MessageList, type ChatMessage } from "./MessageList";
import { ChatInputV2 } from "./ChatInputV2";
import { useAuth } from "@/components/auth/AuthProvider";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useChatShell } from "./ChatShellContext";

const WELCOME_MESSAGE =
  "你好！我是醫天圓 AI 體質顧問。我會根據你嘅體質及照護資料，提供個人化嘅飲食、作息及調養建議。有什麼想了解的嗎？";

const STREAMING_ENABLED =
  process.env.NEXT_PUBLIC_CHAT_STREAMING_ENABLED === "true";
const HISTORY_FETCH_LIMIT = 300;
const HISTORY_MESSAGE_LIMIT = 400;

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

type HistoryRow = {
  session_id: string | null;
  content_text: string | null;
  created_at: string | null;
};

type ConversationRow = {
  role: string | null;
  content_text: string | null;
  mode: string | null;
  created_at: string | null;
};

type HistoryItem = {
  sessionId: string;
  title: string;
  preview: string;
  updatedAt: string;
};

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeMessage(): ChatMessage {
  return {
    role: "assistant",
    content: WELCOME_MESSAGE,
    mode: "G1",
    createdAt: new Date().toISOString(),
  };
}

function toPreviewText(content: string | null | undefined): string {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "（未命名對話）";
  if (normalized.length <= 88) return normalized;
  return `${normalized.slice(0, 88)}…`;
}

function toTitleText(preview: string): string {
  if (!preview || preview === "（未命名對話）") return "未命名對話";
  if (preview.length <= 16) return preview;
  return `${preview.slice(0, 16)}…`;
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "剛剛";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;

  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function resolveMode(raw: string | null): ChatMode | undefined {
  if (raw === "G1" || raw === "G2" || raw === "G3" || raw === "B") return raw;
  return undefined;
}

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
      return;
    }
    onPayload(payload);
  }
}

export function ChatRoom() {
  const { user, loading: authLoading } = useAuth();
  const { historyOpen, closeHistory } = useChatShell();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>("G1");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historySwitching, setHistorySwitching] = useState(false);

  const initialized = useRef(false);

  const startNewChat = useCallback(() => {
    if (loading || historySwitching) return;

    setMode("G1");
    setMessages([createWelcomeMessage()]);
    setSessionId(generateSessionId());
    closeHistory();
  }, [closeHistory, historySwitching, loading]);

  useEffect(() => {
    if (initialized.current) return;
    if (authLoading) return;

    initialized.current = true;
    setMode("G1");
    setMessages([createWelcomeMessage()]);
    setSessionId(generateSessionId());
  }, [authLoading]);

  const loadHistoryList = useCallback(async () => {
    if (!user?.id) {
      setHistoryItems([]);
      return;
    }

    const supabase = createBrowserClient();
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("session_id, content_text, created_at")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(HISTORY_FETCH_LIMIT);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data || []) as HistoryRow[];
      const sessions = new Map<
        string,
        {
          sessionId: string;
          updatedAt: string;
          latestPreview: string;
          firstPreview: string;
        }
      >();

      for (const row of rows) {
        const sid = row.session_id?.trim();
        if (!sid) continue;

        const preview = toPreviewText(row.content_text);
        const createdAt = row.created_at || new Date().toISOString();
        const existing = sessions.get(sid);

        if (!existing) {
          sessions.set(sid, {
            sessionId: sid,
            updatedAt: createdAt,
            latestPreview: preview,
            firstPreview: preview,
          });
          continue;
        }

        // Rows are sorted newest -> oldest, so keep replacing to land on first user message.
        existing.firstPreview = preview;
      }

      const items: HistoryItem[] = Array.from(sessions.values()).map((session) => ({
        sessionId: session.sessionId,
        title: toTitleText(session.firstPreview),
        preview: session.latestPreview,
        updatedAt: session.updatedAt,
      }));

      setHistoryItems(items);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "無法載入歷史對話");
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!historyOpen) return;
    if (authLoading) return;

    void loadHistoryList();
  }, [authLoading, historyOpen, loadHistoryList]);

  useEffect(() => {
    if (!historyOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHistory();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeHistory, historyOpen]);

  const openHistoryConversation = useCallback(
    async (targetSessionId: string) => {
      if (loading || historySwitching) return;

      const supabase = createBrowserClient();
      setHistorySwitching(true);
      setHistoryError("");

      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("role, content_text, mode, created_at")
          .eq("session_id", targetSessionId)
          .order("created_at", { ascending: true })
          .limit(HISTORY_MESSAGE_LIMIT);

        if (error) {
          throw new Error(error.message);
        }

        const rows = (data || []) as ConversationRow[];
        const nextMessages: ChatMessage[] = rows
          .filter((row) => row.role === "user" || row.role === "assistant")
          .map((row) => ({
            role: row.role as "user" | "assistant",
            content: row.content_text || "",
            mode: resolveMode(row.mode),
            createdAt: row.created_at || new Date().toISOString(),
          }));

        const fallbackMessages = nextMessages.length > 0 ? nextMessages : [createWelcomeMessage()];
        const lastAssistant = [...fallbackMessages]
          .reverse()
          .find((msg) => msg.role === "assistant" && msg.mode);

        setMessages(fallbackMessages);
        setMode(lastAssistant?.mode || "G1");
        setSessionId(targetSessionId);
        closeHistory();
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : "無法開啟歷史對話");
      } finally {
        setHistorySwitching(false);
      }
    },
    [closeHistory, historySwitching, loading],
  );

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
      if (!sessionId) return;

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

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="border-b border-primary/10 bg-white/95 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <ModeIndicator currentMode={mode} />
            <button
              type="button"
              onClick={startNewChat}
              disabled={loading || historySwitching}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-3.5 w-3.5" />
              新對話
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-[rgba(246,248,244,0.85)]">
          <MessageList messages={messages} loading={loading} sessionId={sessionId} />
        </div>

        <div className="shrink-0 border-t border-primary/10 bg-white/95">
          <ChatInputV2
            onSend={handleSend}
            disabled={loading || historySwitching}
            placeholder={
              mode === "B"
                ? "請輸入預約相關問題..."
                : "輸入你的健康問題..."
            }
          />
        </div>
      </div>

      <div
        className={`chat-history-backdrop ${historyOpen ? "chat-history-backdrop--open" : ""}`}
        onClick={closeHistory}
        aria-hidden={!historyOpen}
      >
        <aside
          className={`chat-history-drawer ${historyOpen ? "chat-history-drawer--open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="歷史對話"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="chat-history-drawer__header">
            <h2>對話</h2>
            <button
              type="button"
              onClick={startNewChat}
              disabled={loading || historySwitching}
              className="chat-history-drawer__new"
            >
              <Plus className="h-4 w-4" />
              新對話
            </button>
          </div>

          <div className="chat-history-drawer__content">
            {historyLoading ? (
              <div className="chat-history-drawer__state">
                <Loader2 className="h-4 w-4 animate-spin" />
                載入對話中...
              </div>
            ) : null}

            {!historyLoading && historyError ? (
              <div className="chat-history-drawer__state chat-history-drawer__state--error">
                {historyError}
              </div>
            ) : null}

            {!historyLoading && !historyError && historyItems.length === 0 ? (
              <div className="chat-history-drawer__state">暫時未有歷史對話</div>
            ) : null}

            {!historyLoading && !historyError && historyItems.length > 0
              ? historyItems.map((item) => {
                  const isActive = item.sessionId === sessionId;
                  return (
                    <button
                      type="button"
                      key={item.sessionId}
                      onClick={() => void openHistoryConversation(item.sessionId)}
                      disabled={historySwitching || loading}
                      className={`chat-history-card ${isActive ? "chat-history-card--active" : ""}`}
                    >
                      <p className="chat-history-card__title">{item.title}</p>
                      <p className="chat-history-card__preview">{item.preview}</p>
                      <p className="chat-history-card__time">{formatRelativeTime(item.updatedAt)}</p>
                    </button>
                  );
                })
              : null}
          </div>
        </aside>
      </div>
    </>
  );
}
