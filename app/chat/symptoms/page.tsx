"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SymptomItem = {
  id: string;
  category: string | null;
  description: string | null;
  createdAt: string | null;
};

type SymptomApiResponse = {
  symptoms?: SymptomItem[];
  error?: string;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function toSymptomContent(item: SymptomItem): string {
  const category = item.category?.trim() || "";
  const description = item.description?.trim() || "";

  if (category && description) return `${category}：${description}`;
  if (description) return description;
  if (category) return category;
  return "（未提供症狀內容）";
}

export default function MySymptomsPage() {
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSymptoms() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/me/symptoms?limit=100", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("無法載入症狀紀錄");
        }

        const data = (await response.json()) as SymptomApiResponse;
        setSymptoms(data.symptoms || []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "無法載入症狀紀錄");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSymptoms();
    return () => controller.abort();
  }, []);

  const rows = useMemo(
    () =>
      [...symptoms]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .map((item) => ({
          id: item.id,
          createdAtLabel: formatDateTime(item.createdAt),
          content: toSymptomContent(item),
        })),
    [symptoms],
  );

  return (
    <div className="mx-auto h-full w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">我的症狀紀錄</h1>
        <Link
          href="/chat"
          className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
        >
          返回 AI 諮詢
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
        <div className="grid grid-cols-[170px,1fr] border-b border-primary/10 bg-primary-light/40 px-4 py-3 text-xs font-semibold text-gray-600 sm:grid-cols-[220px,1fr]">
          <p>日期時間</p>
          <p>症狀內容</p>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-sm text-gray-500">載入中...</div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">暫時未有症狀紀錄</div>
        ) : (
          <div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[170px,1fr] gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[220px,1fr]"
              >
                <p className="text-gray-600">{row.createdAtLabel}</p>
                <p className="text-gray-900">{row.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
