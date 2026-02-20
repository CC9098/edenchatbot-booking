"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMode } from "./ModeSelector";
import { Check, Copy, Loader2, Share2, ThumbsDown, ThumbsUp } from "lucide-react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: ChatMode;
  createdAt: string;
};

type MessageListProps = {
  messages: ChatMessage[];
  loading?: boolean;
  sessionId?: string;
};

const MODE_BADGES: Record<ChatMode, { label: string; color: string }> = {
  G1: { label: "簡答", color: "bg-primary-light text-primary" },
  G2: { label: "詳答", color: "bg-primary-light/60 text-primary/80" },
  G3: { label: "教練", color: "bg-primary-light/40 text-primary/70" },
  B: { label: "預約", color: "bg-amber-100 text-amber-700" },
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-HK", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderMessageContent(content: string, isUser: boolean) {
  return content.split(URL_REGEX).map((part, index) => {
    if (!part.match(URL_REGEX)) return part;

    return (
      <a
        key={`${part}-${index}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline decoration-1 underline-offset-2 ${
          isUser ? "text-white/95" : "text-primary hover:text-primary-hover"
        }`}
      >
        {part}
      </a>
    );
  });
}

export function MessageList({ messages, loading, sessionId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, "up" | "down">>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessage?.content, loading]);

  const postFeedback = useCallback(
    async (
      message: ChatMessage,
      messageIndex: number,
      feedbackType: "up" | "down",
      sessionId?: string
    ) => {
      const contextMessages = messages
        .slice(Math.max(0, messageIndex - 9), messageIndex + 1)
        .map((item) => ({
          role: item.role,
          content: item.content,
        }));

      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedbackType,
            source: "chat_v2",
            messageText: message.content,
            messageIndex,
            messageMode: message.mode ?? null,
            contextMessages,
            sessionId,
          }),
        });
      } catch (error) {
        console.error("Feedback submit failed (chat_v2):", error);
      }
    },
    [messages]
  );

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }, []);

  const handleShare = useCallback(
    async (messageId: string, content: string) => {
      try {
        if (navigator.share) {
          await navigator.share({ text: content });
          return;
        }
        await handleCopy(messageId, content);
      } catch (error) {
        console.error("Share failed:", error);
      }
    },
    [handleCopy]
  );

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const messageId = `${msg.createdAt}-${i}`;
          const selectedFeedback = feedbackByMessage[messageId];
          const canShowActions = !isUser && msg.content.trim().length > 0;

          return (
            <div
              key={messageId}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] ${
                  isUser ? "order-1" : "order-1"
                }`}
              >
                {/* Mode badge for assistant messages */}
                {!isUser && msg.mode && (
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-block rounded px-2 py-1 text-[11px] font-semibold ${
                        MODE_BADGES[msg.mode].color
                      }`}
                    >
                      {MODE_BADGES[msg.mode].label}
                    </span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`rounded-[22px] px-4 py-3 text-base leading-relaxed shadow-sm ${
                    isUser
                      ? "rounded-br-lg bg-primary text-white"
                      : "rounded-bl-lg border border-primary/10 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.content, isUser)}
                  </p>
                </div>

                {canShowActions && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackByMessage((prev) => {
                          const current = prev[messageId];
                          const next = current === "up" ? undefined : "up";
                          const updated = { ...prev };

                          if (next) {
                            updated[messageId] = next;
                            void postFeedback(msg, i, next, sessionId);
                          } else {
                            delete updated[messageId];
                          }

                          return updated;
                        });
                      }}
                      className={`rounded-md px-2 py-1 transition ${
                        selectedFeedback === "up"
                          ? "bg-primary-light text-primary"
                          : "hover:bg-primary-light/60"
                      }`}
                      aria-label="讚好此回覆"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackByMessage((prev) => {
                          const current = prev[messageId];
                          const next = current === "down" ? undefined : "down";
                          const updated = { ...prev };

                          if (next) {
                            updated[messageId] = next;
                            void postFeedback(msg, i, next, sessionId);
                          } else {
                            delete updated[messageId];
                          }

                          return updated;
                        });
                      }}
                      className={`rounded-md px-2 py-1 transition ${
                        selectedFeedback === "down"
                          ? "bg-red-100 text-red-700"
                          : "hover:bg-primary-light/60"
                      }`}
                      aria-label="對此回覆提出負評"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(messageId, msg.content)}
                      className="rounded-md px-2 py-1 transition hover:bg-primary-light/60"
                      aria-label="複製訊息"
                    >
                      {copiedMessageId === messageId ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(messageId, msg.content)}
                      className="rounded-md px-2 py-1 transition hover:bg-primary-light/60"
                      aria-label="分享訊息"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`mt-1 text-[11px] text-gray-400 ${
                    isUser ? "text-right" : "text-left"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-gray-400">正在思考...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
