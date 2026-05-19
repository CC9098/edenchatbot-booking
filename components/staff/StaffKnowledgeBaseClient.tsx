"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ClipboardCheck,
  ClipboardCopy,
  FileText,
  Loader2,
  MessageCircle,
  PackageCheck,
  Pencil,
  Pill,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  WalletCards,
  X,
  type LucideIcon,
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

type NoteEditorMode = "create" | "edit";

interface NoteEditorState {
  mode: NoteEditorMode;
  noteId?: string;
  sourceDocumentId?: string;
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

function editDocument(document: StaffKnowledgeDocument): NoteEditorState {
  return {
    mode: "edit",
    noteId: document.noteId,
    sourceDocumentId: document.imported ? document.id : undefined,
    title: document.title,
    category: document.category,
    sensitivity: document.sensitivity,
    contentMd: document.contentMd,
  };
}

function editorTitle(mode: NoteEditorMode) {
  if (mode === "edit") return "編輯 Note";
  return "新增 Note";
}

const KNOWLEDGE_FONT_OPTIONS = [
  {
    id: "system",
    label: "系統字",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    id: "ming",
    label: "明體",
    fontFamily: "'Songti TC', 'Noto Serif TC', 'PMingLiU', Georgia, serif",
  },
  {
    id: "rounded",
    label: "圓體",
    fontFamily: "'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Microsoft JhengHei', sans-serif",
  },
  {
    id: "mono",
    label: "等寬",
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  },
] as const;

type KnowledgeFontId = typeof KNOWLEDGE_FONT_OPTIONS[number]["id"];

const KNOWLEDGE_ACCENT_OPTIONS = [
  { id: "emerald", label: "綠", color: "#047857", soft: "#ecfdf5", ring: "#a7f3d0" },
  { id: "cyan", label: "藍", color: "#0e7490", soft: "#ecfeff", ring: "#a5f3fc" },
  { id: "amber", label: "琥珀", color: "#b45309", soft: "#fffbeb", ring: "#fde68a" },
  { id: "rose", label: "紅", color: "#be123c", soft: "#fff1f2", ring: "#fecdd3" },
] as const;

type KnowledgeAccentId = typeof KNOWLEDGE_ACCENT_OPTIONS[number]["id"];

function isKnowledgeFontId(value: string | null): value is KnowledgeFontId {
  return KNOWLEDGE_FONT_OPTIONS.some((item) => item.id === value);
}

function isKnowledgeAccentId(value: string | null): value is KnowledgeAccentId {
  return KNOWLEDGE_ACCENT_OPTIONS.some((item) => item.id === value);
}

const QUICK_START_TASKS = [
  {
    label: "分單 / 補收據",
    query: "收據 分單 病假紙",
    icon: ClipboardCheck,
    cardClassName: "border-emerald-200 bg-emerald-50/90 hover:border-emerald-300 hover:bg-emerald-100/70",
    iconClassName: "border-emerald-200 bg-white text-emerald-700",
  },
  {
    label: "食藥方法",
    query: "食藥 藥袋 西藥",
    icon: Pill,
    cardClassName: "border-cyan-200 bg-cyan-50/90 hover:border-cyan-300 hover:bg-cyan-100/70",
    iconClassName: "border-cyan-200 bg-white text-cyan-700",
  },
  {
    label: "寄藥安排",
    query: "寄藥 Lalamove 順豐",
    icon: PackageCheck,
    cardClassName: "border-amber-200 bg-amber-50/90 hover:border-amber-300 hover:bg-amber-100/70",
    iconClassName: "border-amber-200 bg-white text-amber-700",
  },
  {
    label: "醫療券",
    query: "醫療券 使用步驟",
    icon: WalletCards,
    cardClassName: "border-teal-200 bg-teal-50/90 hover:border-teal-300 hover:bg-teal-100/70",
    iconClassName: "border-teal-200 bg-white text-teal-700",
  },
] satisfies Array<{
  label: string;
  query: string;
  icon: LucideIcon;
  cardClassName: string;
  iconClassName: string;
}>;

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
  const [fontChoice, setFontChoice] = useState<KnowledgeFontId>("system");
  const [accentChoice, setAccentChoice] = useState<KnowledgeAccentId>("emerald");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        return null;
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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("eden.staffKnowledge.display") || "{}") as {
        font?: string;
        accent?: string;
      };
      const savedFont = saved.font ?? null;
      const savedAccent = saved.accent ?? null;
      if (isKnowledgeFontId(savedFont)) setFontChoice(savedFont);
      if (isKnowledgeAccentId(savedAccent)) setAccentChoice(savedAccent);
    } catch {
      // Ignore broken local display preferences.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "eden.staffKnowledge.display",
      JSON.stringify({ font: fontChoice, accent: accentChoice }),
    );
  }, [accentChoice, fontChoice]);

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
    if (!selectedId) return null;
    return documents.find((item) => item.id === selectedId) ?? null;
  }, [documents, selectedId]);

  const selectedFont = useMemo(
    () => KNOWLEDGE_FONT_OPTIONS.find((item) => item.id === fontChoice) ?? KNOWLEDGE_FONT_OPTIONS[0],
    [fontChoice],
  );

  const selectedAccent = useMemo(
    () => KNOWLEDGE_ACCENT_OPTIONS.find((item) => item.id === accentChoice) ?? KNOWLEDGE_ACCENT_OPTIONS[0],
    [accentChoice],
  );

  const documentStyle = useMemo(() => ({
    "--staff-knowledge-accent": selectedAccent.color,
    "--staff-knowledge-accent-soft": selectedAccent.soft,
    "--staff-knowledge-accent-ring": selectedAccent.ring,
    fontFamily: selectedFont.fontFamily,
  }) as CSSProperties, [selectedAccent, selectedFont]);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function openCreateEditor() {
    setSaveError(null);
    setDeleteError(null);
    setEditor(emptyNoteEditor(category === "all" ? "姑娘新增 Note" : category));
  }

  function openDocumentEditor(document: StaffKnowledgeDocument) {
    setSaveError(null);
    setDeleteError(null);
    setEditor(editDocument(document));
  }

  function focusTask(nextQuery: string) {
    setCategory("all");
    setQuery(nextQuery);
    const matchedDocument = documents.find((document) => documentMatches(document, nextQuery));
    if (matchedDocument) {
      setSelectedId(matchedDocument.id);
    }
    window.setTimeout(() => {
      document.getElementById("staff-knowledge-browser")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (editor.mode === "edit" && !editor.noteId && !editor.sourceDocumentId) {
        throw new Error("找不到可編輯項目");
      }
      const endpoint = editor.sourceDocumentId
        ? "/api/staff/knowledge"
        : editor.mode === "edit" && editor.noteId
          ? `/api/staff/knowledge/${encodeURIComponent(editor.noteId)}`
          : "/api/staff/knowledge";
      const method = editor.sourceDocumentId
        ? "PUT"
        : editor.mode === "edit" ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: editor.sourceDocumentId,
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

  async function deleteDocument(document: StaffKnowledgeDocument) {
    if (deleting) return;
    const confirmed = window.confirm(`刪除「${document.title}」？`);
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      if (!document.imported && !document.noteId) {
        throw new Error("找不到可刪除 Note");
      }
      const response = await fetch(
        document.imported ? "/api/staff/knowledge" : `/api/staff/knowledge/${encodeURIComponent(document.noteId || "")}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: document.imported ? JSON.stringify({ documentId: document.id }) : undefined,
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setSelectedId(null);
      setEditor(null);
      setCopied("deleted");
      window.setTimeout(() => setCopied(null), 1800);
      void fetchDocuments();
    } catch (deleteErrorValue) {
      setDeleteError(deleteErrorValue instanceof Error ? deleteErrorValue.message : "未能刪除");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">姑娘知識庫</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => focusTask("收據 分單 病假紙")}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              <Search className="h-4 w-4" />
              分單 / 補收據
            </button>
            <Link
              href="/nurse/knowledge/chat"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <MessageCircle className="h-4 w-4" />
              AI 問答
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_START_TASKS.map((task) => {
            const TaskIcon = task.icon;

            return (
              <button
                key={task.label}
                type="button"
                onClick={() => focusTask(task.query)}
                className={`group flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${task.cardClassName}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ${task.iconClassName}`}>
                  <TaskIcon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-slate-950">{task.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {editor ? (
        <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
          <form onSubmit={saveNote} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  {editor.sourceDocumentId ? "編輯匯入檔" : editorTitle(editor.mode)}
                </p>
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
                style={{ fontFamily: selectedFont.fontFamily, caretColor: selectedAccent.color }}
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
                儲存
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section id="staff-knowledge-browser" className="scroll-mt-24 space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            <Plus className="h-4 w-4" />
            新增 Note
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-3">
            <div className="rounded-[20px] border border-cyan-100 bg-cyan-50/80 p-3 shadow-sm">
              <label className="flex items-center gap-2 rounded-[14px] border border-cyan-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-cyan-700" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedId(null);
                  }}
                  placeholder="搜尋上門、講座、減重..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>

          <div className="rounded-[20px] border border-emerald-100 bg-white p-2 shadow-sm">
            <div className="space-y-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCategory(item);
                    setSelectedId(null);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${
                    category === item
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                      : "text-slate-600 hover:bg-emerald-50/60 hover:text-emerald-900"
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

          <div className="rounded-[20px] border border-amber-100 bg-white shadow-sm">
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
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</p>
                        <span className="mt-2 inline-flex max-w-full items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          <span className="truncate">{item.category}</span>
                        </span>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </aside>

          <article className="min-w-0 rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
          {!selectedDocument ? (
            <div className="py-16 text-center text-sm leading-6 text-slate-500">
              先按上方任務，或在左邊搜尋後選擇一篇。
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-700">{selectedDocument.category}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedDocument.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    來源：{selectedDocument.source}
                    {selectedDocument.imported ? " · 匯入檔" : " · 可編輯 Note"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Type className="h-4 w-4 text-slate-500" />
                      <select
                        value={fontChoice}
                        onChange={(event) => setFontChoice(event.target.value as KnowledgeFontId)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
                      >
                        {KNOWLEDGE_FONT_OPTIONS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1" aria-label="顏色">
                      {KNOWLEDGE_ACCENT_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAccentChoice(item.id)}
                          className={`h-7 w-7 rounded-full border-2 transition ${
                            accentChoice === item.id ? "border-slate-950" : "border-white ring-1 ring-slate-200"
                          }`}
                          style={{ backgroundColor: item.color }}
                          aria-label={item.label}
                          title={item.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openDocumentEditor(selectedDocument)}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      <Pencil className="h-4 w-4" />
                      編輯
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
                    <button
                      type="button"
                      onClick={() => void deleteDocument(selectedDocument)}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      刪除
                    </button>
                  </div>
                </div>
              </div>

              {copied ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  {copied === "saved" ? "已儲存" : copied === "deleted" ? "已刪除" : "已複製"}
                </div>
              ) : null}

              {deleteError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {deleteError}
                </div>
              ) : null}

              <div
                style={documentStyle}
                className="rounded-xl border border-[var(--staff-knowledge-accent-ring)] bg-white px-4 py-1"
              >
                <MarkdownContent
                  content={selectedDocument.contentMd}
                  className="max-w-none [&_a]:text-[var(--staff-knowledge-accent)] [&_blockquote]:border-[var(--staff-knowledge-accent)] [&_blockquote]:bg-[var(--staff-knowledge-accent-soft)] [&_code]:text-[var(--staff-knowledge-accent)] [&_h1]:text-[var(--staff-knowledge-accent)] [&_h2]:text-[var(--staff-knowledge-accent)] [&_h3]:text-[var(--staff-knowledge-accent)] [&_li]:text-slate-700 [&_p]:text-slate-700"
                />
              </div>
            </div>
          )}
          </article>
        </div>
      </section>
    </div>
  );
}
