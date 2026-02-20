"use client";

export type ChatMode = "G1" | "G2" | "G3" | "B";

const MODE_LABELS: Record<ChatMode, { label: string; desc: string; color: string }> = {
  G1: { label: "簡答模式", desc: "快速回覆 + 引導問題", color: "bg-primary-light text-primary" },
  G2: { label: "詳答模式", desc: "進一步原理解釋", color: "bg-primary-light/80 text-primary" },
  G3: { label: "教練模式", desc: "深入引導式對話", color: "bg-primary-light/60 text-primary" },
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
  const icon = currentMode === "B" ? "預約" : "對話";

  return (
    <div className="flex items-center gap-2 text-primary">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${meta.color}`}
      >
        {icon} · {meta.label}
      </span>
      <span className="hidden text-xs text-slate-500 sm:inline">{meta.desc}</span>
    </div>
  );
}
