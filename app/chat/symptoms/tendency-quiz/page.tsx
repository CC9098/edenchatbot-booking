"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TendencyQuizPanel } from "@/components/patient/TendencyQuizPanel";

type CareContextResponse = {
  userId?: string;
  error?: string;
};

export default function TendencyQuizPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/me/care-context");
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("請先登入，先可以使用問卷。");
        }
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "無法載入問卷");
      }
      const payload = (await response.json()) as CareContextResponse;
      setUserId(payload.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入問卷");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  return (
    <div className="mx-auto h-full w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">我的狀態問卷</h1>
            <p className="mt-1 text-xs text-gray-500">先建立初型，再每日 1 題微調傾向分佈。</p>
          </div>
          <Link
            href="/chat/symptoms"
            className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
          >
            返回我的
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-primary/10 bg-white px-4 py-8 text-sm text-slate-500">載入中...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadContext()}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
            >
              重新載入
            </button>
          </div>
        ) : (
          <section className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5">
            <p className="mb-3 text-sm text-slate-600">此分析只作生活傾向參考，並非醫療診斷。</p>
            <TendencyQuizPanel userId={userId} />
          </section>
        )}
      </div>
    </div>
  );
}

