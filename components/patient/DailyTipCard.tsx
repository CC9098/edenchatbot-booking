"use client";

import { useMemo } from "react";
import { getConstitutionDietTips } from "@/lib/constitution-diet-tips";
import { getLocalDateKey } from "@/lib/constitution-tendency";
import { NARRATIVE } from "@/lib/narrative-copy";

type DailyTipCardProps = {
  constitution: string | null | undefined;
  accentBg?: string;
};

/**
 * A quiet card that shows one diet / wellness tip per day, drawn from the
 * constitution-specific tip pool.  No buttons, no tracking — it just sits
 * there like a small note left on the kitchen table.
 */
export function DailyTipCard({ constitution, accentBg = "bg-primary-light/30" }: DailyTipCardProps) {
  const tip = useMemo(() => {
    const tips = getConstitutionDietTips(constitution);
    if (!tips.length) return null;

    // Pick one tip per day using a simple date-based hash.
    const dateKey = getLocalDateKey();
    const [year, month, day] = dateKey.split("-").map((v) => Number.parseInt(v, 10));
    const dayNumber = (year ?? 0) * 366 + (month ?? 0) * 31 + (day ?? 0);
    return tips[Math.abs(dayNumber) % tips.length];
  }, [constitution]);

  if (!tip) return null;

  return (
    <div className={`rounded-2xl ${accentBg} px-5 py-6`}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        「{tip}」
      </p>
      <p className="mt-3 text-right text-xs text-slate-400">
        {NARRATIVE.dailyTipLabel}
      </p>
    </div>
  );
}
