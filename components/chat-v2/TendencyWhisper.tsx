"use client";

import { useEffect, useMemo, useState } from "react";
import { Wind, Droplet, Zap } from "lucide-react";
import {
  type TendencyKey,
  blendTendencyScores,
  createEmptyScore,
  getLocalDateKey,
  isBaseQuizComplete,
  normalizeToPercentages,
  rankTendency,
} from "@/lib/constitution-tendency";
import { FORCE_NARRATIVE } from "@/lib/narrative-copy";

type TendencyWhisperProps = {
  userId?: string;
};

/**
 * A single quiet line at the top of the chat room showing the user's
 * current primary force tendency.
 *
 * - If the user hasn't done the base quiz → renders nothing (no nagging).
 * - Otherwise shows one line like: 🌬 風勢偏高 · 留意回氣
 * - No interactivity, no expansion, just a gentle ambient presence.
 */
export function TendencyWhisper({ userId }: TendencyWhisperProps) {
  const [primaryKey, setPrimaryKey] = useState<TendencyKey | null>(null);

  const storageKey = useMemo(() => `eden:tendency:v1:${userId || "guest"}`, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        version?: number;
        baseAnswers?: Record<string, string>;
        baseScore?: Record<string, number>;
        liveScore?: Record<string, number>;
      };

      if (parsed.version !== 1) return;
      if (!isBaseQuizComplete(parsed.baseAnswers || {})) return;

      const baseScore = {
        J: Number(parsed.baseScore?.J || 0),
        K: Number(parsed.baseScore?.K || 0),
        L: Number(parsed.baseScore?.L || 0),
      };
      const liveScore = {
        J: Number(parsed.liveScore?.J || 0),
        K: Number(parsed.liveScore?.K || 0),
        L: Number(parsed.liveScore?.L || 0),
      };

      const blended = blendTendencyScores(baseScore, liveScore);
      const percentages = normalizeToPercentages(blended);
      const ranked = rankTendency(percentages);

      if (ranked[0]) {
        setPrimaryKey(ranked[0]);
      }
    } catch {
      // Silently ignore — this is ambient, not critical.
    }
  }, [storageKey]);

  if (!primaryKey) return null;

  const narrative = FORCE_NARRATIVE[primaryKey];

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5">
      {primaryKey === "J" ? (
        <Wind className="h-3 w-3 text-slate-400" strokeWidth={1.8} />
      ) : primaryKey === "K" ? (
        <Droplet className="h-3 w-3 text-slate-400" strokeWidth={1.8} />
      ) : (
        <Zap className="h-3 w-3 text-slate-400" strokeWidth={1.8} />
      )}
      <span className="text-xs text-slate-400">{narrative.whisperLine}</span>
    </div>
  );
}
