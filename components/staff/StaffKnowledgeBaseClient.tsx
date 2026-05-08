"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Loader2,
  MessageCircle,
  Search,
  ShieldAlert,
} from "lucide-react";

import MarkdownContent from "@/components/content/MarkdownContent";
import type {
  StaffKnowledgeDocument,
  StaffKnowledgeSensitivity,
  StaffKnowledgeStatus,
} from "@/lib/staff-knowledge-base-types";

function statusLabel(status: StaffKnowledgeStatus) {
  if (status === "seed") return "已整理";
  if (status === "placeholder") return "待補";
  if (status === "reviewed") return "已覆核";
  return "草稿";
}

function statusClass(status: StaffKnowledgeStatus) {
  if (status === "placeholder") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "seed") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function sensitivityLabel(sensitivity: StaffKnowledgeSensitivity) {
  if (sensitivity === "restricted") return "Restricted";
  if (sensitivity === "public") return "Public";
  return "Internal";
}

function sensitivityClass(sensitivity: StaffKnowledgeSensitivity) {
  if (sensitivity === "restricted") return "border-rose-200 bg-rose-50 text-rose-800";
  if (sensitivity === "public") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-white text-slate-700";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function documentMatches(document: StaffKnowledgeDocument, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return normalizeText([
    document.title,
    document.category,
    document.excerpt,
    document.contentMd,
    document.tags.join(" "),
  ].join(" ")).includes(normalizedQuery);
}

export function StaffKnowledgeBaseClient() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get("doc");

  const [documents, setDocuments] = useState<StaffKnowledgeDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialDocId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/knowledge", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const items = Array.isArray(payload.items) ? payload.items : [];
      setDocuments(items);
      setSelectedId((current) => {
        if (current && items.some((item: StaffKnowledgeDocument) => item.id === current)) return current;
        return items[0]?.id ?? null;
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "未能載入知識庫");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(documents.map((item) => item.category)))],
    [documents],
  );

  const filteredDocuments = useMemo(
    () => documents.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      return documentMatches(item, query);
    }),
    [category, documents, query],
  );

  const selectedDocument = useMemo(() => {
    if (!selectedId) return filteredDocuments[0] ?? null;
    return documents.find((item) => item.id === selectedId) ?? filteredDocuments[0] ?? null;
  }, [documents, filteredDocuments, selectedId]);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">姑娘內部手冊</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">知識庫</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/nurse/knowledge/chat"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" />
              AI 問答
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋上門、講座、減重..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <div className="space-y-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${
                    category === item
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <span>{item === "all" ? "全部分類" : item}</span>
                  <span className="text-xs text-slate-400">
                    {item === "all"
                      ? documents.length
                      : documents.filter((document) => document.category === item).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                載入中
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 p-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">未找到相關內容</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto p-2">
                {filteredDocuments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mb-2 w-full rounded-md border p-3 text-left ${
                      selectedDocument?.id === item.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedDocument ? (
            <div className="py-16 text-center text-sm text-slate-500">未選擇文件</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(selectedDocument.status)}`}>
                      {statusLabel(selectedDocument.status)}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sensitivityClass(selectedDocument.sensitivity)}`}>
                      {sensitivityLabel(selectedDocument.sensitivity)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">{selectedDocument.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedDocument.category} · {selectedDocument.updatedAt} · {selectedDocument.sourcePath}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.patientReplyMd ? (
                    <button
                      type="button"
                      onClick={() => void copyText("patient", selectedDocument.patientReplyMd || "")}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      複製病人回覆
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void copyText("full", selectedDocument.contentMd)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    複製全文
                  </button>
                </div>
              </div>

              {copied ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  已複製
                </div>
              ) : null}

              {selectedDocument.sensitivity === "restricted" ? (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Restricted 內容不可複製到公開頁、病人 chatbot 或非受控文件。
                </div>
              ) : null}

              <MarkdownContent
                content={selectedDocument.contentMd}
                className="max-w-none"
              />
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
