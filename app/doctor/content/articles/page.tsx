"use client";

import { useCallback, useEffect, useState } from "react";

interface ArticleAdminItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMd: string;
  coverImageUrl: string | null;
  tags: string[];
  isActive: boolean;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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

function isPublished(item: ArticleAdminItem): boolean {
  if (!item.isActive || !item.publishedAt) return false;
  const date = new Date(item.publishedAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

function articleStatusLabel(item: ArticleAdminItem): string {
  if (!item.isActive) return "已停用";
  if (!item.publishedAt) return "草稿";
  const date = new Date(item.publishedAt);
  if (Number.isNaN(date.getTime())) return "草稿";
  if (date.getTime() > Date.now()) return "排程中";
  return "已發佈";
}

function articleStatusColor(item: ArticleAdminItem): string {
  const label = articleStatusLabel(item);
  if (label === "已發佈") return "bg-emerald-100 text-emerald-800";
  if (label === "排程中") return "bg-blue-100 text-blue-800";
  if (label === "已停用") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-800";
}

export default function DoctorContentArticlesPage() {
  const [items, setItems] = useState<ArticleAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [isActive, setIsActive] = useState(true);
  const currentEditingItem = editingId ? items.find((item) => item.id === editingId) || null : null;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("status", status);
      params.set("limit", "200");

      const res = await fetch(`/api/doctor/content/articles?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setItems(data.items ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setTagsInput("");
    setCoverImageUrl("");
    setContentMd("");
    setIsActive(true);
  }

  function startEdit(item: ArticleAdminItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setSlug(item.slug);
    setExcerpt(item.excerpt || "");
    setTagsInput(item.tags.join(", "));
    setCoverImageUrl(item.coverImageUrl || "");
    setContentMd(item.contentMd);
    setIsActive(item.isActive);
    setMessage(null);
    setError(null);
  }

  async function submitForm(publishNow: boolean) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        title,
        slug,
        excerpt,
        tags: tagsInput,
        coverImageUrl,
        contentMd,
        isActive,
        publishNow,
      };

      const isEditing = Boolean(editingId);
      const endpoint = isEditing ? `/api/doctor/content/articles/${editingId}` : "/api/doctor/content/articles";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setMessage(publishNow ? "文章已發佈" : isEditing ? "文章已更新" : "草稿已建立");
      if (!isEditing) {
        resetForm();
      } else if (data.item) {
        startEdit(data.item);
      }
      await fetchArticles();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function unpublishCurrent() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/doctor/content/articles/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unpublish: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setMessage("文章已下架");
      if (data.item) {
        startEdit(data.item);
      }
      await fetchArticles();
    } catch (unpublishError) {
      setError(unpublishError instanceof Error ? unpublishError.message : "下架失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle(articleId: string) {
    const confirmed = window.confirm("確認刪除這篇文章？此動作不可還原。");
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/doctor/content/articles/${articleId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (editingId === articleId) {
        resetForm();
      }
      setMessage("文章已刪除");
      await fetchArticles();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-gray-900">內容管理：文章</h1>
        <p className="text-sm text-gray-500">
          直接在此建立、編輯、發佈文章到 Supabase，前台會即時讀取最新內容。
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
              placeholder="搜尋標題 / slug"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto sm:flex-1"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | "draft" | "published")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">全部</option>
              <option value="draft">草稿/未發佈</option>
              <option value="published">已發佈</option>
            </select>
            <button
              onClick={fetchArticles}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              刷新
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">載入中...</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              尚未有文章
            </div>
          ) : (
            <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-3 transition ${
                    editingId === item.id ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-primary/40"
                  }`}
                >
                  <button onClick={() => startEdit(item)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="line-clamp-1 text-sm font-semibold text-gray-900">{item.title}</h2>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${articleStatusColor(item)}`}
                      >
                        {articleStatusLabel(item)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">/{item.slug}</p>
                    <p className="mt-1 text-xs text-gray-500">更新：{formatDateTime(item.updatedAt)}</p>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => deleteArticle(item.id)}
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

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">{editingId ? "編輯文章" : "新增文章"}</h2>
            <button
              onClick={resetForm}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              新文章
            </button>
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitForm(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-700">標題 *</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-700">Slug（留空可自動產生）</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-700">摘要</span>
              <textarea
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-700">Tags（逗號分隔）</span>
                <input
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="調理, 養生, 失眠"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-700">封面圖片 URL</span>
                <input
                  value={coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-700">Markdown 內容 *</span>
              <textarea
                value={contentMd}
                onChange={(event) => setContentMd(event.target.value)}
                rows={16}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-6 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              此文章處於啟用狀態
            </label>

            {editingId ? (
              <p className="text-xs text-gray-500">當前狀態：{currentEditingItem ? articleStatusLabel(currentEditingItem) : "草稿"}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "儲存中..." : "儲存草稿"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={(event) => {
                  event.preventDefault();
                  submitForm(true);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "處理中..." : editingId ? "更新並發佈" : "建立並發佈"}
              </button>
              {currentEditingItem && isPublished(currentEditingItem) ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={unpublishCurrent}
                  className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  下架
                </button>
              ) : null}
            </div>

            {editingId ? (
              <p className="text-xs text-gray-500">
                已發佈時間：{formatDateTime(currentEditingItem?.publishedAt || null)}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
