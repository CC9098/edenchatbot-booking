"use client";

import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PatientProfile } from "@/app/api/patient-profiles/route";

// ─── Context & Hook ────────────────────────────────────────────────────────────

type PatientProfileContextValue = {
  profiles: PatientProfile[];
  activeProfile: PatientProfile | null;
  activeProfileId: string | null;
  isLoading: boolean;
};

const PatientProfileContext = createContext<PatientProfileContextValue>({
  profiles: [],
  activeProfile: null,
  activeProfileId: null,
  isLoading: true,
});

export function usePatientProfile() {
  return useContext(PatientProfileContext);
}

// ─── Relationship options ──────────────────────────────────────────────────────

const RELATIONSHIP_OPTIONS = ["自己", "配偶", "子女", "長輩", "其他"] as const;

// ─── Add-member inline form ────────────────────────────────────────────────────

type AddMemberFormProps = {
  onAdded: (profile: PatientProfile) => void;
  onCancel: () => void;
};

function AddMemberForm({ onAdded, onCancel }: AddMemberFormProps) {
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
    if (!displayName.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/patient-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          relationship: relationship || undefined,
          dateOfBirth: dateOfBirth || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "加入失敗，請稍後再試");
      }
      const payload = await res.json() as { profile: PatientProfile };
      onAdded(payload.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失敗，請稍後再試");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-3 rounded-2xl border border-primary/15 bg-primary-pale/60 p-4"
    >
      <p className="mb-3 text-sm font-semibold text-slate-800">加入家庭成員</p>

      {/* Display name */}
      <label className="block">
        <span className="text-xs font-medium text-slate-600">
          姓名 <span className="text-red-500">*</span>
        </span>
        <input
          ref={inputRef}
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例：梁小姐"
          className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      {/* Relationship */}
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600">與您關係</span>
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">（請選擇）</option>
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>

      {/* Date of birth */}
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600">出生日期（選填）</span>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="mt-1 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending || !displayName.trim()}
          className="inline-flex min-h-9 items-center rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "加入中..." : "加入"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          取消
        </button>
      </div>
    </form>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FamilyMemberSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeProfileIdFromUrl = searchParams.get("patient");

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/patient-profiles");
      if (!res.ok) return;
      const data = await res.json() as { profiles: PatientProfile[] };
      setProfiles(data.profiles ?? []);
    } catch {
      // Non-critical — silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // Resolve active profile: URL param → default → first
  const activeProfile = (() => {
    if (profiles.length === 0) return null;
    if (activeProfileIdFromUrl) {
      return profiles.find((p) => p.id === activeProfileIdFromUrl) ?? profiles[0];
    }
    return profiles.find((p) => p.is_default) ?? profiles[0];
  })();

  const activeProfileId = activeProfile?.id ?? null;

  function handleChipClick(profileId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("patient", profileId);
    router.push(`?${params.toString()}`);
  }

  function handleAdded(profile: PatientProfile) {
    setProfiles((prev) => [...prev, profile]);
    setShowAddForm(false);
    // Navigate to the new profile
    const params = new URLSearchParams(searchParams.toString());
    params.set("patient", profile.id);
    router.push(`?${params.toString()}`);
  }

  // Context value to expose to children via hook
  const contextValue: PatientProfileContextValue = {
    profiles,
    activeProfile,
    activeProfileId,
    isLoading,
  };

  // Render null while loading or if only one profile (no clutter)
  if (isLoading) return null;
  if (profiles.length <= 1 && !showAddForm) return null;

  return (
    <PatientProfileContext.Provider value={contextValue}>
      <section className="animate-eden-enter rounded-[24px] border border-primary/10 bg-primary-pale/70 p-4 shadow-sm sm:p-5">
        {/* Chip row */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleChipClick(profile.id)}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "border border-primary/25 bg-white text-primary hover:bg-primary-light",
                ].join(" ")}
              >
                {profile.display_name}
                {profile.is_default && (
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
                    ].join(" ")}
                  >
                    自己
                  </span>
                )}
                {isActive && (
                  <span className="text-white/80" aria-hidden>✓</span>
                )}
              </button>
            );
          })}

          {/* Add button */}
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              aria-label="加入家庭成員"
              className="inline-flex shrink-0 items-center rounded-full border border-dashed border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary/60 transition hover:border-primary/50 hover:text-primary"
            >
              +
            </button>
          )}
        </div>

        {/* Inline add-member form */}
        {showAddForm && (
          <AddMemberForm
            onAdded={handleAdded}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </section>
    </PatientProfileContext.Provider>
  );
}
