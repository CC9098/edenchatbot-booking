"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CardStatus = "inbox" | "drafting" | "ready" | "published" | "archived";
type CardSource = "manual" | "article_sync" | "ai_assist";

interface LinkedArticle {
  id: string;
  title: string;
  slug: string;
  relationType: "seed" | "draft" | "published";
  isActive: boolean;
  publishedAt: string | null;
}

interface KnowledgeCardItem {
  id: string;
  title: string;
  bodyMd: string;
  status: CardStatus;
  source: CardSource;
  tags: string[];
  sourceArticleId: string | null;
  sourceHash: string | null;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  linkedArticles: LinkedArticle[];
  linkedCount: number;
  hasPublishedArticle: boolean;
}

interface SuggestionItem extends KnowledgeCardItem {
  score: number;
}

interface ComposeResult {
  draft: {
    title: string;
    excerpt: string;
    contentMd: string;
    tags: string[];
  };
  usedFallback: boolean;
  sourceCardIds: string[];
  savedArticle?: {
    id: string;
    slug: string;
    title: string;
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: CardStatus): string {
  if (status === "inbox") return "Inbox";
  if (status === "drafting") return "撰寫中";
  if (status === "ready") return "可成文";
  if (status === "published") return "已發佈";
  return "封存";
}

function statusColor(status: CardStatus): string {
  if (status === "inbox") return "bg-amber-100 text-amber-800";
  if (status === "drafting") return "bg-blue-100 text-blue-800";
  if (status === "ready") return "bg-emerald-100 text-emerald-800";
  if (status === "published") return "bg-violet-100 text-violet-800";
  return "bg-slate-200 text-slate-700";
}

function sourceLabel(source: CardSource): string {
  if (source === "article_sync") return "文章同步";
  if (source === "ai_assist") return "AI 輔助";
  return "手動";
}

export default function DoctorKnowledgeCardsPage() {
  const [items, setItems] = useState<KnowledgeCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CardStatus>("all");
  const [source, setSource] = useState<"all" | CardSource>("all");
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [editStatus, setEditStatus] = useState<CardStatus>("inbox");
  const [editSource, setEditSource] = useState<CardSource>("manual");
  const [isActive, setIsActive] = useState(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [composeResult, setComposeResult] = useState<ComposeResult | null>(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const currentEditingItem = useMemo(
    () => (editingId ? items.find((item) => item.id === editingId) || null : null),
    [editingId, items]
  );

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("status", status);
      params.set("source", source);
      params.set("onlyUnlinked", onlyUnlinked ? "1" : "0");
      params.set("limit", "200");

      const res = await fetch(`/api/doctor/content/cards?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setItems(data.items || []);
      setSelectedIds((prev) => prev.filter((id) => (data.items || []).some((item: KnowledgeCardItem) => item.id === id)));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "載入知識卡失敗");
    } finally {
      setLoading(false);
    }
  }, [query, source, status, onlyUnlinked]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBodyMd("");
    setTagsInput("");
    setEditStatus("inbox");
    setEditSource("manual");
    setIsActive(true);
  }

  function startEdit(item: KnowledgeCardItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setBodyMd(item.bodyMd);
    setTagsInput(item.tags.join(", "));
    setEditStatus(item.status);
    setEditSource(item.source);
    setIsActive(item.isActive);
    setError(null);
    setMessage(null);
  }

  async function saveCard() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title,
        bodyMd,
        tags: tagsInput,
        status: editStatus,
        source: editSource,
        isActive,
      };

      const endpoint = editingId ? `/api/doctor/content/cards/${editingId}` : "/api/doctor/content/cards";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setMessage(editingId ? "知識卡已更新" : "知識卡已建立");
      if (!editingId) resetForm();
      await fetchCards();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(cardId: string) {
    const confirmed = window.confirm("確認刪除這張知識卡？此動作不可還原。");
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/doctor/content/cards/${cardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (editingId === cardId) resetForm();
      setSelectedIds((prev) => prev.filter((id) => id !== cardId));
      setMessage("知識卡已刪除");
      await fetchCards();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  async function runSyncFromArticles() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/doctor/content/cards/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const summary = data.summary || {};
      setMessage(
        `文章同步完成：scanned=${summary.scanned ?? 0}, inserted=${summary.inserted ?? 0}, updated=${summary.updated ?? 0}, skipped=${summary.skipped ?? 0}`
      );
      await fetchCards();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  }

  async function fetchSuggestions() {
    setSuggestionsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/content/cards/suggestions?limit=12");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuggestions(data.items || []);
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "載入建議失敗");
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function composeFromSelected() {
    if (selectedIds.length === 0) {
      setError("請先選擇最少一張卡片");
      return;
    }
    setComposeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/doctor/content/cards/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIds: selectedIds,
          saveAsDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setComposeResult(data as ComposeResult);
      if (data.savedArticle) {
        setMessage(`已建立文章草稿：${data.savedArticle.title}`);
      } else {
        setMessage("已生成文章草稿");
      }
      await fetchCards();
    } catch (composeError) {
      setError(composeError instanceof Error ? composeError.message : "合稿失敗");
    } finally {
      setComposeLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-gray-900">內容管理：知識卡工作台</h1>
        <p className="text-sm text-gray-500">
          先收集點子卡，再由 AI 合併成文章草稿。這層是工作區，不會直接把所有卡片餵給 chatbot。
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋標題 / 內容"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto sm:flex-1"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | CardStatus)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">全部狀態</option>
              <option value="inbox">Inbox</option>
              <option value="drafting">撰寫中</option>
              <option value="ready">可成文</option>
              <option value="published">已發佈</option>
              <option value="archived">封存</option>
            </select>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as "all" | CardSource)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">全部來源</option>
              <option value="manual">手動</option>
              <option value="article_sync">文章同步</option>
              <option value="ai_assist">AI 輔助</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={onlyUnlinked}
                onChange={(event) => setOnlyUnlinked(event.target.checked)}
              />
              只看「未有已發佈文章」卡片
            </label>
            <button
              onClick={fetchCards}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              刷新
            </button>
            <button
              onClick={runSyncFromArticles}
              disabled={syncing}
              className="rounded-md border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {syncing ? "同步中..." : "從文章同步卡片"}
            </button>
            <button
              onClick={fetchSuggestions}
              disabled={suggestionsLoading}
              className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {suggestionsLoading ? "計算中..." : "找未寫作建議"}
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">載入中...</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              尚未有知識卡
            </div>
          ) : (
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-3 transition ${
                    editingId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 bg-white hover:border-primary/40"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-start gap-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="mt-1"
                      />
                      <button onClick={() => startEdit(item)} className="text-left">
                        <h2 className="line-clamp-1 text-sm font-semibold text-gray-900">{item.title}</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          更新：{formatDateTime(item.updatedAt)} · 來源：{sourceLabel(item.source)}
                        </p>
                      </button>
                    </label>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs text-gray-600">{item.bodyMd || "（無內容）"}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.length === 0 ? (
                      <span className="text-[11px] text-gray-400">無標籤</span>
                    ) : (
                      item.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          #{tag}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => deleteCard(item.id)}
                      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      刪除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">{editingId ? "編輯知識卡" : "新增知識卡"}</h2>
            <button
              onClick={resetForm}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              清空
            </button>
          </div>

          <div className="grid gap-3">
            <label className="space-y-1 text-sm text-gray-700">
              <span className="font-medium">標題</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：濕重體質與晚睡的惡性循環"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="space-y-1 text-sm text-gray-700">
              <span className="font-medium">卡片內容</span>
              <textarea
                value={bodyMd}
                onChange={(event) => setBodyMd(event.target.value)}
                rows={8}
                placeholder="把點子、臨床觀察、對話精華寫入這裡..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="space-y-1 text-sm text-gray-700">
              <span className="font-medium">標籤（逗號分隔）</span>
              <input
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="例：失眠, 壓力, 屯積型"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">狀態</span>
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as CardStatus)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="inbox">Inbox</option>
                  <option value="drafting">撰寫中</option>
                  <option value="ready">可成文</option>
                  <option value="published">已發佈</option>
                  <option value="archived">封存</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">來源</span>
                <select
                  value={editSource}
                  onChange={(event) => setEditSource(event.target.value as CardSource)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="manual">手動</option>
                  <option value="article_sync">文章同步</option>
                  <option value="ai_assist">AI 輔助</option>
                </select>
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              啟用此卡
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveCard}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "儲存中..." : editingId ? "更新知識卡" : "建立知識卡"}
              </button>
            </div>
          </div>

          {currentEditingItem ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-800">已關聯文章</p>
              {currentEditingItem.linkedArticles.length === 0 ? (
                <p className="mt-1">未關聯</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {currentEditingItem.linkedArticles.map((article) => (
                    <li key={`${currentEditingItem.id}-${article.id}-${article.relationType}`}>
                      <span className="font-medium">{article.title}</span>（{article.relationType}）{" "}
                      <Link className="text-primary hover:underline" href={`/articles/${article.slug}`} target="_blank">
                        /{article.slug}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-primary">AI 合稿（由選中卡片生成）</h3>
              <span className="text-xs text-primary/80">已選 {selectedIds.length} 張</span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-primary/90">
              <input
                type="checkbox"
                checked={saveAsDraft}
                onChange={(event) => setSaveAsDraft(event.target.checked)}
              />
              直接存成文章草稿（需要 admin）
            </label>
            <button
              onClick={composeFromSelected}
              disabled={composeLoading || selectedIds.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {composeLoading ? "生成中..." : "開始合稿"}
            </button>
          </div>

          {composeResult ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                <span className="font-semibold">AI 草稿已生成</span>
                {composeResult.usedFallback ? <span>（使用 fallback）</span> : <span>（AI JSON）</span>}
                {composeResult.savedArticle ? (
                  <Link
                    href={`/doctor/content/articles`}
                    className="rounded border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-100"
                  >
                    去文章管理查看
                  </Link>
                ) : null}
              </div>
              <input
                value={composeResult.draft.title}
                readOnly
                className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <textarea
                value={composeResult.draft.contentMd}
                readOnly
                rows={10}
                className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-sm font-semibold text-gray-800">未寫作建議</h3>
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-500">按「找未寫作建議」可拉取建議清單。</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((item) => (
                  <li key={`s-${item.id}`} className="rounded border border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button className="text-left text-xs font-medium text-gray-800 hover:text-primary" onClick={() => startEdit(item)}>
                        {item.title}
                      </button>
                      <span className="text-[11px] text-gray-500">score {item.score}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{item.bodyMd}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
