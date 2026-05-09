"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCopy,
  ClipboardList,
  FileText,
  FilePlus,
  GraduationCap,
  Loader2,
  MessageCircle,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";

import MarkdownContent from "@/components/content/MarkdownContent";
import type {
  StaffKnowledgeDocument,
} from "@/lib/staff-knowledge-base-types";

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
    document.source,
    document.tags.join(" "),
  ].join(" ")).includes(normalizedQuery);
}

type NoteEditorMode = "create" | "copy" | "edit";

interface NoteEditorState {
  mode: NoteEditorMode;
  noteId?: string;
  title: string;
  category: string;
  sensitivity: StaffKnowledgeDocument["sensitivity"];
  contentMd: string;
}

function emptyNoteEditor(category = "姑娘新增 Note"): NoteEditorState {
  return {
    mode: "create",
    title: "",
    category,
    sensitivity: "internal",
    contentMd: "",
  };
}

function copyFromDocument(document: StaffKnowledgeDocument): NoteEditorState {
  return {
    mode: "copy",
    title: `${document.title} - 補充`,
    category: document.category,
    sensitivity: document.sensitivity,
    contentMd: document.contentMd.slice(0, 50000),
  };
}

function editDocument(document: StaffKnowledgeDocument): NoteEditorState {
  return {
    mode: "edit",
    noteId: document.noteId,
    title: document.title,
    category: document.category,
    sensitivity: document.sensitivity,
    contentMd: document.contentMd,
  };
}

function editorTitle(mode: NoteEditorMode) {
  if (mode === "edit") return "編輯 Note";
  if (mode === "copy") return "建立可編輯副本";
  return "新增 Note";
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
  const [editor, setEditor] = useState<NoteEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const noteCategoryOptions = useMemo(
    () => Array.from(new Set(["姑娘新增 Note", ...documents.map((item) => item.category)])),
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

  function openCreateEditor() {
    setSaveError(null);
    setEditor(emptyNoteEditor(category === "all" ? "姑娘新增 Note" : category));
  }

  function openDocumentEditor(document: StaffKnowledgeDocument) {
    setSaveError(null);
    setEditor(document.editable && document.noteId ? editDocument(document) : copyFromDocument(document));
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      const endpoint = editor.mode === "edit" && editor.noteId
        ? `/api/staff/knowledge/${encodeURIComponent(editor.noteId)}`
        : "/api/staff/knowledge";
      const response = await fetch(endpoint, {
        method: editor.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editor.title,
          category: editor.category,
          sensitivity: editor.sensitivity,
          contentMd: editor.contentMd,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const item = payload.item as StaffKnowledgeDocument | undefined;
      if (!item?.id) throw new Error("儲存後未收到 Note");

      setDocuments((current) => {
        const withoutOld = current.filter((document) => document.id !== item.id);
        return [item, ...withoutOld];
      });
      setSelectedId(item.id);
      setEditor(null);
      setCopied("saved");
      window.setTimeout(() => setCopied(null), 1800);
      void fetchDocuments();
    } catch (saveErrorValue) {
      setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : "未能儲存 Note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">姑娘內部手冊</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">知識庫</h1>
            <p className="mt-2 text-sm text-slate-500">
              內容直接來自 Google Doc「分類頁面手冊」，先放姑娘已填入的實際話術和流程。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Plus className="h-4 w-4" />
              新增 Note
            </button>
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

      <section className="grid gap-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-md border border-emerald-100 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <GraduationCap className="h-4 w-4" />
            新手訓練
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            兼職姑娘先看片，再做 Level Test
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            這段 90 秒影片示範：遇到病人問題、搜尋知識庫、用 AI 問答、檢查來源、升級主管、再補 Note。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/staff-training/staff-knowledge-onboarding.mp4"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <PlayCircle className="h-4 w-4" />
              開啟訓練影片
            </a>
            <Link
              href="/nurse/knowledge/training"
              className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <ClipboardList className="h-4 w-4" />
              做 Level Test
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-emerald-100 bg-slate-950">
          <video
            className="aspect-video h-full w-full bg-slate-950"
            controls
            preload="metadata"
            poster="/staff-training/staff-knowledge-onboarding-frame.png"
          >
            <source src="/staff-training/staff-knowledge-onboarding.mp4" type="video/mp4" />
            你的瀏覽器未能播放此影片。
          </video>
        </div>
      </section>

      {editor ? (
        <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
          <form onSubmit={saveNote} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">{editorTitle(editor.mode)}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {editor.mode === "edit" ? editor.title || "未命名 Note" : "姑娘可以即時補資料"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setSaveError(null);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                關閉
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">標題</span>
                <input
                  value={editor.title}
                  onChange={(event) => setEditor((current) => current ? { ...current, title: event.target.value } : current)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                  placeholder="例如：佐敦店電話飛線補充"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">分類</span>
                <input
                  value={editor.category}
                  list="staff-knowledge-categories"
                  onChange={(event) => setEditor((current) => current ? { ...current, category: event.target.value } : current)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                  placeholder="姑娘新增 Note"
                />
                <datalist id="staff-knowledge-categories">
                  {noteCategoryOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">敏感度</span>
                <select
                  value={editor.sensitivity}
                  onChange={(event) => setEditor((current) => current ? {
                    ...current,
                    sensitivity: event.target.value as StaffKnowledgeDocument["sensitivity"],
                  } : current)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="internal">internal</option>
                  <option value="restricted">restricted</option>
                  <option value="public">public</option>
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">內容</span>
              <textarea
                value={editor.contentMd}
                onChange={(event) => setEditor((current) => current ? { ...current, contentMd: event.target.value } : current)}
                rows={16}
                className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm leading-6 text-slate-900 outline-none focus:border-emerald-400"
                placeholder={"可直接打字。支援 Markdown，例如：\\n## 病人可見回覆\\n...\\n\\n## 姑娘內部做法\\n..."}
              />
            </label>

            {saveError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {saveError}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setSaveError(null);
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                儲存 Note
              </button>
            </div>
          </form>
        </section>
      ) : null}

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
              <div className="p-4 text-sm text-rose-700">{error}</div>
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
                  <p className="text-sm font-medium text-emerald-700">{selectedDocument.category}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedDocument.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    來源：{selectedDocument.source}
                    {selectedDocument.editable ? " · 可編輯 Note" : " · 匯入底稿"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openDocumentEditor(selectedDocument)}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    {selectedDocument.editable ? <Pencil className="h-4 w-4" /> : <FilePlus className="h-4 w-4" />}
                    {selectedDocument.editable ? "編輯 Note" : "建立可編輯副本"}
                  </button>
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
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  已複製
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
