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
    <div className={`relative overflow-hidden rounded-[20px] ${accentBg} px-6 py-8`}>
      <div className="absolute left-1/2 top-4 h-px w-10 -translate-x-1/2 bg-primary/12" />
      <p
        className="whitespace-pre-wrap text-center text-[15px] leading-[1.9] text-slate-600"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        「{tip}」
      </p>
      <p className="mt-5 text-center text-xs tracking-[0.12em] text-slate-400">
        {NARRATIVE.dailyTipLabel}
      </p>
      <div className="absolute bottom-4 left-1/2 h-px w-10 -translate-x-1/2 bg-primary/12" />
    </div>
  );
}
