"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Flag, LockKeyhole, RotateCcw } from "lucide-react";

type ReleaseLevel = "green" | "yellow" | "red";
type SupervisorNeed = "no" | "yes" | "always";

const STORAGE_KEY = "eden-nurse-onboarding-completed-v1";
const PROGRESS_EVENT = "eden-nurse-onboarding-progress";
const DAY_ONE_STEPS = [
  { code: "D1-01", label: "唔肯定先問" },
  { code: "D1-02", label: "記低問題" },
  { code: "D1-03", label: "開診檢查" },
  { code: "D1-04", label: "病人到診" },
];
const DAY_ONE_CODES = DAY_ONE_STEPS.map((step) => step.code);

function readCompleted(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeCompleted(codes: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

function statusClasses(status: "done" | "next" | "locked" | "blocked" | "todo") {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "next") return "border-emerald-300 bg-white text-emerald-800";
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "locked") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-slate-200 bg-white text-slate-500";
}

export function NurseOnboardingProgress({
  cardCode,
  day,
  release,
  supervisor,
}: {
  cardCode: string;
  day: number;
  release: ReleaseLevel;
  supervisor: SupervisorNeed;
}) {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    function sync() {
      setCompleted(readCompleted());
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(PROGRESS_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(PROGRESS_EVENT, sync);
    };
  }, []);

  const nextCode = useMemo(
    () => DAY_ONE_CODES.find((code) => !completed.includes(code)) ?? DAY_ONE_CODES[DAY_ONE_CODES.length - 1],
    [completed],
  );
  const isComplete = completed.includes(cardCode);
  const isBlocked = release === "red" || supervisor === "always";
  const isDayOne = day === 1;
  const canToggle = isDayOne && !isBlocked;
  const status = isComplete
    ? "done"
    : isBlocked
      ? "blocked"
      : !isDayOne
        ? "locked"
        : cardCode === nextCode
          ? "next"
          : "todo";

  const label = status === "done"
    ? "完成"
    : status === "next"
      ? "下一步"
      : status === "blocked"
        ? "先問"
        : status === "locked"
          ? "稍後"
          : "待做";
  const Icon = status === "done"
    ? CheckCircle2
    : status === "next"
      ? Flag
      : status === "blocked"
        ? LockKeyhole
        : Circle;

  function toggleComplete() {
    if (!canToggle) return;

    const next = isComplete
      ? completed.filter((code) => code !== cardCode)
      : [...completed, cardCode];
    writeCompleted(next);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${statusClasses(status)}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {canToggle ? (
        <button
          type="button"
          onClick={toggleComplete}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
            isComplete
              ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              : "border-emerald-200 bg-emerald-700 text-white hover:bg-emerald-800"
          }`}
        >
          {isComplete ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {isComplete ? "重做" : "完成"}
        </button>
      ) : null}
    </div>
  );
}

export function NurseOnboardingSummary() {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    function sync() {
      setCompleted(readCompleted());
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(PROGRESS_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(PROGRESS_EVENT, sync);
    };
  }, []);

  const completedDayOneCount = DAY_ONE_CODES.filter((code) => completed.includes(code)).length;
  const nextCode = DAY_ONE_CODES.find((code) => !completed.includes(code));
  const nextStep = DAY_ONE_STEPS.find((step) => step.code === nextCode);

  return (
    <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-500">Day 1</div>
        <div className="text-xs font-semibold text-emerald-700">
          {completedDayOneCount}/{DAY_ONE_CODES.length}
        </div>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">
        {nextStep ? `下一步：${nextStep.label}` : "今日完成"}
      </div>
    </div>
  );
}
