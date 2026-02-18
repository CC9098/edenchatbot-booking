"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMode } from "./ModeSelector";
import { Loader2, ThumbsUp, ThumbsDown, Copy, Share2, Check } from "lucide-react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: ChatMode;
  createdAt: string;
};

type MessageListProps = {
  messages: ChatMessage[];
  loading?: boolean;
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

type FeedbackState = Record<number, "up" | "down" | null>;

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessage?.content, loading]);

  const handleFeedback = useCallback((idx: number, type: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [idx]: prev[idx] === type ? null : type }));
  }, []);

  const handleCopy = useCallback(async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const handleShare = useCallback(async (text: string) => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] sm:max-w-[75%]`}>
                {/* Mode badge for assistant messages */}
                {!isUser && msg.mode && (
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        MODE_BADGES[msg.mode].color
                      }`}
                    >
                      {MODE_BADGES[msg.mode].label}
                    </span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? "rounded-br-md bg-primary text-white"
                      : "rounded-bl-md bg-white text-gray-800 shadow-sm ring-1 ring-black/5"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.content, isUser)}
                  </p>
                </div>

                {/* Timestamp */}
                <div
                  className={`mt-1 text-[10px] text-gray-400 ${
                    isUser ? "text-right" : "text-left"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </div>

                {/* Action buttons — assistant messages only */}
                {!isUser && (
                  <div className="mt-1 flex items-center gap-0.5">
                    <button
                      onClick={() => handleFeedback(i, "up")}
                      title="有用"
                      type="button"
                      className={`rounded-lg p-1.5 transition-colors ${
                        feedback[i] === "up"
                          ? "text-green-600"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => handleFeedback(i, "down")}
                      title="唔係幾幫到我"
                      type="button"
                      className={`rounded-lg p-1.5 transition-colors ${
                        feedback[i] === "down"
                          ? "text-red-500"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                    >
                      <ThumbsDown size={13} />
                    </button>
                    <button
                      onClick={() => handleCopy(i, msg.content)}
                      title="複製"
                      type="button"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      {copiedIdx === i ? (
                        <Check size={13} className="text-green-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => handleShare(msg.content)}
                      title="分享"
                      type="button"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Share2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-gray-400">正在思考...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
