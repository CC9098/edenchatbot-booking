"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

type ChatInputV2Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInputV2({
  onSend,
  disabled = false,
  placeholder = "輸入訊息...",
}: ChatInputV2Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setText("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div
      className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 pt-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-primary/20 bg-[#f5f7f3] px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.currentTarget.style.transform = "";
          handleSend();
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.transform = "scale(0.95)";
        }}
        onTouchCancel={(e) => {
          e.currentTarget.style.transform = "";
        }}
        disabled={!canSend}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
          canSend
            ? "bg-primary text-white shadow-md hover:bg-primary-hover active:scale-95"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        aria-label="送出訊息"
        type="button"
        style={{
          touchAction: "manipulation",
          minHeight: "44px",
          minWidth: "44px",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
