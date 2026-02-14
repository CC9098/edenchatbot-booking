"use client";

export type ChatMode = "G1" | "G2" | "G3" | "B";

const MODE_LABELS: Record<ChatMode, { label: string; desc: string; color: string }> = {
  G1: { label: "簡答模式", desc: "簡短回覆 + 引導問題", color: "bg-emerald-100 text-emerald-700" },
  G2: { label: "詳答模式", desc: "理論原理說明", color: "bg-blue-100 text-blue-700" },
  G3: { label: "教練模式", desc: "深入引導式對話", color: "bg-purple-100 text-purple-700" },
  B: { label: "預約模式", desc: "查詢及安排診所預約", color: "bg-amber-100 text-amber-700" },
};

type ModeIndicatorProps = {
  currentMode: ChatMode;
};

/**
 * Displays the current AI-determined mode (read-only indicator).
 * Mode is NOT user-selectable — it's auto-detected by AI
 * based on conversation context and user intent.
 */
export function ModeIndicator({ currentMode }: ModeIndicatorProps) {
  const meta = MODE_LABELS[currentMode];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}
      >
        {currentMode === "B" ? "📅" : "💬"} {meta.label}
      </span>
      <span className="text-[11px] text-gray-400">{meta.desc}</span>
    </div>
  );
}
