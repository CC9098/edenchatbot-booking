"use client";

import { bookingText, type BookingLocale } from '@/shared/booking-locale';

import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientProfile } from "@/app/api/patient-profiles/route";

const RELATIONSHIP_OPTIONS = ["自己", "配偶", "子女", "長輩", "其他"] as const;

type PatientProfileSelectorProps = {
  locale?: BookingLocale;
  selectedProfileId: string | null;
  onSelect: (profile: PatientProfile) => void;
  /** Optional: called the first time profiles are loaded so the parent can auto-select. */
  onInitialLoad?: (profiles: PatientProfile[]) => void;
};

export function PatientProfileSelector({ locale = 'zh', 
  selectedProfileId,
  onSelect,
  onInitialLoad,
}: PatientProfileSelectorProps) {
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const initialCallbackFiredRef = useRef(false);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/patient-profiles");
      if (res.status === 401) {
        setIsLoggedIn(false);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { profiles: PatientProfile[] };
      const list = data.profiles ?? [];
      setProfiles(list);
      setIsLoggedIn(true);
      if (!initialCallbackFiredRef.current) {
        initialCallbackFiredRef.current = true;
        onInitialLoad?.(list);
      }
    } catch {
      // Non-critical
    } finally {
      setIsLoading(false);
    }
  }, [onInitialLoad]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function handleAdded(profile: PatientProfile) {
    setProfiles((prev) => [...prev, profile]);
    setShowAddForm(false);
    onSelect(profile);
  }

  // Hide entirely for anonymous users or zero-profile users — anonymous booking flow unchanged.
  if (isLoading) return null;
  if (isLoggedIn === false) return null;
  if (profiles.length === 0 && !showAddForm) return null;

  return (
    <section className="rounded-2xl border border-primary/15 bg-primary-pale/60 p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{bookingText("這次預約係為邊位？", locale)}</h3>

      <div className="space-y-2">
        {profiles.map((profile) => {
          const isSelected = profile.id === selectedProfileId;
          const relationshipLabel =
            profile.relationship || (profile.is_default ? bookingText("自己", locale) : null);
          return (
            <label
              key={profile.id}
              className={[
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                isSelected
                  ? "border-primary bg-white shadow-sm"
                  : "border-primary/15 bg-white/70 hover:border-primary/30 hover:bg-white",
              ].join(" ")}
            >
              <input
                type="radio"
                name="patientProfile"
                value={profile.id}
                checked={isSelected}
                onChange={() => onSelect(profile)}
                className="h-4 w-4 accent-primary"
              />
              <span className="flex-1 text-sm text-slate-800">
                <span className="font-semibold">{profile.display_name}</span>
                {relationshipLabel ? (
                  <span className="ml-1 text-slate-500">（{bookingText(relationshipLabel, locale)}）</span>
                ) : null}
              </span>
            </label>
          );
        })}

        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/30 bg-white px-3 py-2.5 text-sm font-semibold text-primary/70 transition hover:border-primary/50 hover:text-primary"
          >
            <span aria-hidden>＋</span> {bookingText("加入新家庭成員", locale)}</button>
        ) : (
          <AddMemberInlineForm
            onAdded={handleAdded}
            onCancel={() => setShowAddForm(false)} locale={locale}
          />
        )}
      </div>
    </section>
  );
}

type AddMemberInlineFormProps = {
  locale?: BookingLocale;
  onAdded: (profile: PatientProfile) => void;
  onCancel: () => void;
};

function AddMemberInlineForm({ locale = 'zh',  onAdded, onCancel }: AddMemberInlineFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/patient-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmed,
          relationship: relationship || undefined,
          dateOfBirth: dateOfBirth || undefined,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? bookingText("加入失敗，請稍後再試", locale));
      }
      const payload = (await res.json()) as { profile: PatientProfile };
      onAdded(payload.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : bookingText("加入失敗，請稍後再試", locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-white p-3">
      <p className="mb-3 text-sm font-semibold text-slate-800">{bookingText("加入家庭成員", locale)}</p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">
            {bookingText("姓名", locale)}<span className="text-red-500">*</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={bookingText("例：梁小姐", locale)}
            className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{bookingText("與您關係", locale)}</span>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none"
          >
            <option value="">{bookingText("（請選擇）", locale)}</option>
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={bookingText(opt, locale)} value={bookingText(opt, locale)}>
                {bookingText(opt, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{bookingText("出生日期（選填）", locale)}</span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{bookingText(error, locale)}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={(e) => void handleSubmit(e)}
          disabled={pending || !displayName.trim()}
          className="inline-flex min-h-9 items-center rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? bookingText("加入中...", locale) : bookingText("加入", locale)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {bookingText("取消", locale)}</button>
      </div>
    </div>
  );
}

/** Split a free-text HK display_name into (lastName, firstName) to prefill the booking form. */
export function splitHkDisplayName(displayName: string, locale: BookingLocale = 'zh'): { lastName: string; firstName: string } {
  const trimmed = displayName.trim();
  if (!trimmed) return { lastName: "", firstName: "" };
  // English / romanized name with a space: surname first by HK convention.
  if (/\s/.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return { lastName: parts[0] ?? "", firstName: parts.slice(1).join(" ") };
  }
  // Chinese: first char = surname, remainder = given name.
  if (trimmed.length === 1) return { lastName: trimmed, firstName: "" };
  return { lastName: trimmed[0]!, firstName: trimmed.slice(1) };
}
