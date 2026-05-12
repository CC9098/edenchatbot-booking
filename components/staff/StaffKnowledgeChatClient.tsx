"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCopy,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";

import type { StaffKnowledgeChatAnswer } from "@/lib/staff-knowledge-base-types";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  answer?: StaffKnowledgeChatAnswer;
};

const SUGGESTIONS = [
  "上門出診",
  "講座查詢",
  "減重治療",
  "寄藥安排",
];

function confidenceLabel(confidence: StaffKnowledgeChatAnswer["confidence"]) {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  if (confidence === "blocked") return "受限";
  return "低";
}

function confidenceClass(confidence: StaffKnowledgeChatAnswer["confidence"]) {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (confidence === "blocked") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function StaffKnowledgeChatClient() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content: "問 SOP。",
    },
  ]);
  const [question, setQuestion] = useState(prompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (prompt) setQuestion(prompt);
  }, [prompt]);

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [loading, question]);

  async function askKnowledgeBase(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const answer = payload as StaffKnowledgeChatAnswer;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer.answer,
          answer,
        },
      ]);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "問答失敗");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askKnowledgeBase(question);
  }

  async function copyAnswer(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <Link
          href="/nurse/knowledge"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回知識庫
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">AI 問答</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[58vh] min-h-[420px] overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[860px] rounded-lg border px-4 py-3 ${
                      message.role === "user"
                        ? "border-emerald-200 bg-emerald-700 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>

                    {message.answer ? (
                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(message.answer.confidence)}`}>
                            信心：{confidenceLabel(message.answer.confidence)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyAnswer(message)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                            {copiedId === message.id ? "已複製" : "複製"}
                          </button>
                        </div>

                        {message.answer.sources.length > 0 ? (
                          <div className="space-y-2">
                            {message.answer.sources.map((source) => (
                              <Link
                                key={source.id}
                                href={`/nurse/knowledge?doc=${encodeURIComponent(source.id)}`}
                                className="block rounded-md border border-slate-200 bg-white p-3 text-sm hover:border-emerald-200 hover:bg-emerald-50"
                              >
                                <div className="font-semibold text-slate-900">
                                  {source.title}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{source.category}</div>
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    查緊知識庫
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="問 SOP"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="送出"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageCircle className="h-4 w-4 text-emerald-700" />
              常用問題
            </div>
            <div className="mt-3 space-y-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void askKnowledgeBase(item)}
                  disabled={loading}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
