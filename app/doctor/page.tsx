"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ---------- Types ---------- */
interface PatientItem {
  patientUserId: string;
  displayName: string | null;
  constitution: string;
  nextFollowUpDate: string | null;
}

/* ---------- Constants ---------- */
const CONSTITUTION_LABELS: Record<string, string> = {
  depleting: "虛損",
  crossing: "鬱結",
  hoarding: "痰濕",
  mixed: "混合",
  unknown: "未評估",
};

const CONSTITUTION_COLORS: Record<string, string> = {
  depleting: "bg-emerald-100 text-emerald-800",
  crossing: "bg-blue-100 text-blue-800",
  hoarding: "bg-purple-100 text-purple-800",
  mixed: "bg-orange-100 text-orange-800",
  unknown: "bg-gray-100 text-gray-600",
};

/* ---------- Component ---------- */
export default function DoctorPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPatients = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "50");

      const res = await fetch(`/api/doctor/patients?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPatients(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients(debouncedQuery);
  }, [debouncedQuery, fetchPatients]);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">病人列表</h1>
        <p className="mt-1 text-sm text-gray-500">管理您的病人護理記錄</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋病人姓名..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2d5016] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => fetchPatients(debouncedQuery)}
            className="mt-3 rounded-md bg-red-100 px-4 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-200"
          >
            重試
          </button>
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">暫無病人記錄</p>
          <p className="mt-1 text-xs text-gray-500">
            {query ? "找不到符合的病人" : "目前沒有分配的病人"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">姓名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">體質分型</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">下次覆診</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr
                    key={p.patientUserId}
                    onClick={() => router.push(`/doctor/patients/${p.patientUserId}`)}
                    className="cursor-pointer transition-colors hover:bg-[#2d5016]/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.displayName || "未設定姓名"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          CONSTITUTION_COLORS[p.constitution] || CONSTITUTION_COLORS.unknown
                        }`}
                      >
                        {CONSTITUTION_LABELS[p.constitution] || "未評估"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(p.nextFollowUpDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {patients.map((p) => (
              <button
                key={p.patientUserId}
                onClick={() => router.push(`/doctor/patients/${p.patientUserId}`)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.displayName || "未設定姓名"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        CONSTITUTION_COLORS[p.constitution] || CONSTITUTION_COLORS.unknown
                      }`}
                    >
                      {CONSTITUTION_LABELS[p.constitution] || "未評估"}
                    </span>
                    <span className="text-xs text-gray-500">
                      覆診: {formatDate(p.nextFollowUpDate)}
                    </span>
                  </div>
                </div>
                <svg className="ml-2 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
