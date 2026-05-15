"use client";

import { MailPlus, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { STAFF_ACCESS_PRESET_OPTIONS, type StaffAccessPreset } from "@/lib/staff-access";

type StaffAccessItem = {
  email: string;
  role: string;
  staffKind: string | null;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SaveState = "idle" | "saving" | "loading";

function roleTone(item: StaffAccessItem): string {
  if (!item.isActive) return "bg-slate-100 text-slate-500";
  if (item.staffKind === "part_time_assistant") return "bg-amber-100 text-amber-800";
  if (item.role === "admin") return "bg-primary-light text-primary";
  if (item.role === "doctor") return "bg-sky-100 text-sky-800";
  return "bg-green-100 text-green-800";
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function StaffAccessManagerClient() {
  const [items, setItems] = useState<StaffAccessItem[]>([]);
  const [email, setEmail] = useState("");
  const [preset, setPreset] = useState<StaffAccessPreset>("part_time_assistant");
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);
  const partTimeCount = useMemo(
    () => items.filter((item) => item.isActive && item.staffKind === "part_time_assistant").length,
    [items],
  );

  async function loadItems() {
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/staff/access", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "載入權限失敗");
      }
      setItems(payload.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "載入權限失敗");
    } finally {
      setState("idle");
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/staff/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, preset }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "儲存權限失敗");
      }

      const item = payload.item as StaffAccessItem;
      setItems((current) => [item, ...current.filter((entry) => entry.email !== item.email)]);
      setEmail("");
      setMessage(`${item.email} 已加入 ${item.label}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存權限失敗");
    } finally {
      setState("idle");
    }
  }

  async function updateAccess(emailToUpdate: string, update: { preset?: StaffAccessPreset; isActive?: boolean }) {
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/staff/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUpdate, ...update }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "更新權限失敗");
      }

      const item = payload.item as StaffAccessItem;
      setItems((current) => current.map((entry) => (entry.email === item.email ? item : entry)));
      setMessage(`${item.email} 已更新`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新權限失敗");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              Staff 權限
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">姑娘登入權限</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-primary-light px-4 py-3 text-primary">
              <div className="text-2xl font-semibold">{activeCount}</div>
              <div>啟用</div>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">
              <div className="text-2xl font-semibold">{partTimeCount}</div>
              <div>兼職</div>
            </div>
          </div>
        </div>

        <form onSubmit={saveAccess} className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="sr-only" htmlFor="staff-email">
            Email
          </label>
          <div className="relative">
            <MailPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              required
            />
          </div>
          <label className="sr-only" htmlFor="staff-preset">
            權限
          </label>
          <select
            id="staff-preset"
            value={preset}
            onChange={(event) => setPreset(event.target.value as StaffAccessPreset)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {STAFF_ACCESS_PRESET_OPTIONS.map((option) => (
              <option key={option.preset} value={option.preset}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={state === "saving"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "saving" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            加入
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">已加入 Email</h2>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {state === "loading" && items.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">載入中...</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">未有 email 權限。</div>
          ) : (
            items.map((item) => (
              <div key={item.email} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_180px_120px_auto] md:items-center">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950">{item.email}</div>
                  <div className="text-xs text-slate-500">更新：{formatDate(item.updatedAt)}</div>
                </div>
                <select
                  value={(item.staffKind || item.role) as StaffAccessPreset}
                  onChange={(event) =>
                    void updateAccess(item.email, { preset: event.target.value as StaffAccessPreset })
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {STAFF_ACCESS_PRESET_OPTIONS.map((option) => (
                    <option key={option.preset} value={option.preset}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${roleTone(item)}`}
                >
                  {item.isActive ? item.label : "已停用"}
                </span>
                <button
                  type="button"
                  onClick={() => void updateAccess(item.email, { isActive: !item.isActive })}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {item.isActive ? "停用" : "啟用"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
