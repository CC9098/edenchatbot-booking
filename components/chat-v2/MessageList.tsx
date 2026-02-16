"use client";

import { useEffect, useRef } from "react";
import type { ChatMode } from "./ModeSelector";
import { Loader2 } from "lucide-react";

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

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessage?.content, loading]);

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
              <div
                className={`max-w-[85%] sm:max-w-[75%] ${
                  isUser ? "order-1" : "order-1"
                }`}
              >
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
                    {msg.content}
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
