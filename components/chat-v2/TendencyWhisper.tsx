"use client";

import { useEffect, useState } from "react";
import { Wind, Droplet, Zap } from "lucide-react";
import { type TendencyKey } from "@/lib/constitution-tendency";
import { constitutionToTendencyKey, FORCE_NARRATIVE } from "@/lib/narrative-copy";

type TendencyWhisperProps = {
  userId?: string;
};

type CareContextResponse = {
  constitution?: string | null;
};

/**
 * A single quiet line at the top of the chat room showing the
 * authoritative constitution stored in Supabase.
 */
export function TendencyWhisper({ userId }: TendencyWhisperProps) {
  const [primaryKey, setPrimaryKey] = useState<TendencyKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    setPrimaryKey(null);

    if (!userId) {
      return () => {
        cancelled = true;
      };
    }

    async function loadCareContext() {
      try {
        const response = await fetch("/api/me/care-context", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as CareContextResponse;
        const nextPrimaryKey = constitutionToTendencyKey(payload.constitution);

        if (!cancelled) {
          setPrimaryKey(nextPrimaryKey);
        }
      } catch {
        if (!cancelled) {
          setPrimaryKey(null);
        }
      }
    }

    void loadCareContext();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!primaryKey) return null;

  const narrative = FORCE_NARRATIVE[primaryKey];

  return (
    <div className="flex items-center justify-center gap-2 border-b border-primary/5 px-3 py-2.5">
      {primaryKey === "J" ? (
        <Wind className="h-3.5 w-3.5 text-slate-400/70" strokeWidth={1.6} />
      ) : primaryKey === "K" ? (
        <Droplet className="h-3.5 w-3.5 text-slate-400/70" strokeWidth={1.6} />
      ) : (
        <Zap className="h-3.5 w-3.5 text-slate-400/70" strokeWidth={1.6} />
      )}
      <span
        className="text-[13px] tracking-[0.03em] text-slate-400/80"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {narrative.whisperLine}
      </span>
    </div>
  );
}
