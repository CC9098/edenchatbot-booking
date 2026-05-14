"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type QuizOption = {
  id: string;
  text: string;
  note: string;
};

type QuizScene = {
  id: string;
  title: string;
  area: string;
  riskLabel: string;
  quoteFrom: string;
  quote: string;
  goal: string;
  options: QuizOption[];
  correctOptionId: string;
  why: string;
  safeScript: string;
  supervisorRule: string;
};

type StoredResult = {
  score: number;
  total: number;
  completedAt: string;
};

type AssessmentStatus = {
  label: string;
  note: string;
  badgeClassName: string;
};

const STORAGE_KEY = "eden-nurse-quiz-result-v1";
const PASS_SCORE = 5;
const OPTION_LABELS = ["A", "B", "C"];

const SCENES: QuizScene[] = [
  {
    id: "safe-close",
    title: "收費未確認",
    area: "接待櫃位",
    riskLabel: "承諾風險",
    quoteFrom: "病人",
    quote: "我上次好似有折，今次應該都係同一個價？你幫我答實得唔得？",
    goal: "未確認收費或優惠時，先守住診所承諾。",
    options: [
      {
        id: "soft-promise",
        text: "我估今次應該都差唔多；如果有不同，我再通知你。",
        note: "聽起來客氣，但已經給了病人價格預期。",
      },
      {
        id: "delay",
        text: "我先幫你查清楚今次收費和優惠，確認後再 WhatsApp 回覆你。",
        note: "先查核、後回覆，不即場估價。",
      },
      {
        id: "ai",
        text: "我先問 AI，如果 AI 說可以，我就照它答你。",
        note: "AI 不能代替收費規則和主管確認。",
      },
    ],
    correctOptionId: "delay",
    why: "收費、優惠、保險或醫師安排都屬於承諾風險，新人不應即場估。",
    safeScript: "「我先查清楚紀錄和今次安排，確認後再 WhatsApp 回覆你。」",
    supervisorRule: "涉及收費差異、優惠、退款、醫師安排，未確定就交當值同事確認。",
  },
  {
    id: "identity",
    title: "身份未核實",
    area: "電話查詢",
    riskLabel: "私隱風險",
    quoteFrom: "來電者",
    quote: "我唔記得預約時間，只記得電話尾數 8899，你幫我睇下。",
    goal: "查預約前先做基本身份核對。",
    options: [
      {
        id: "tail",
        text: "電話尾數應該夠用，我先讀出最近一個預約時間。",
        note: "電話尾數不足以確認身份，容易洩露預約資料。",
      },
      {
        id: "verify",
        text: "我先核對姓名和完整電話；資料對上後，只講相關預約資料。",
        note: "先核對，再提供最少需要的資料。",
      },
      {
        id: "refuse",
        text: "只有電話尾數一定查不到，請你自己找回完整資料再打來。",
        note: "太快拒絕，沒有先提供合理核對路徑。",
      },
    ],
    correctOptionId: "verify",
    why: "姑娘要幫到病人，但同時要避免把預約資料講給錯人。",
    safeScript: "「我先同你核對姓名同完整電話，資料對上後再幫你確認預約時間。」",
    supervisorRule: "多人共用電話、資料對不上、對方代家人查詢，要問主管或當值同事。",
  },
  {
    id: "today-slot",
    title: "即日加位要求",
    area: "預約表",
    riskLabel: "排程風險",
    quoteFrom: "病人",
    quote: "我今日一定要睇，你幫我 WhatsApp 醫師問下可唔可以加個位。",
    goal: "分清可約時段、加位權限和醫療急切度。",
    options: [
      {
        id: "message-doctor",
        text: "病人話急，我先私訊醫師；醫師得閒應該可以加一個位。",
        note: "新人不應自行打亂醫師排程或承諾加位。",
      },
      {
        id: "system",
        text: "我先查系統可約時段；如已滿，提供最近可約時間，急症狀況交當值同事。",
        note: "先用系統時間，特殊情況才升級。",
      },
      {
        id: "diagnose",
        text: "我先問清楚症狀，再替你判斷今日是否一定要看醫師。",
        note: "姑娘可以收集資料，不應替病人做醫療判斷。",
      },
    ],
    correctOptionId: "system",
    why: "即日加位同時牽涉排程、公平性和醫療風險，不能由新人自行決定。",
    safeScript: "「我先幫你查系統可約時間；如果今日滿了，我給你最近可約選擇。」",
    supervisorRule: "病人描述高風險症狀、強烈要求加位、指定醫師破例安排，一律升級。",
  },
  {
    id: "receipt-insurance",
    title: "保險收據",
    area: "收據處理",
    riskLabel: "第三方承諾",
    quoteFrom: "病人",
    quote: "我保險要 claim，你張收據寫咗就一定 claim 到啦？",
    goal: "可以講診所流程，不承諾第三方審批結果。",
    options: [
      {
        id: "guarantee",
        text: "診所收據通常都可以 claim，我估你應該沒有問題。",
        note: "即使語氣保守，仍然是在替保險公司作承諾。",
      },
      {
        id: "safe",
        text: "我可以按診所紀錄處理收據；能否索償要由保險公司審批。",
        note: "清楚分開診所能做的事和第三方決定。",
      },
      {
        id: "doctor-sign",
        text: "如果保險要文件，我可以答應醫師今日一定簽好。",
        note: "醫師簽署時限不可由新人承諾。",
      },
    ],
    correctOptionId: "safe",
    why: "診所可以處理文件，但保險是否批核不是診所可保證的結果。",
    safeScript: "「我可以按診所紀錄幫你處理收據；保險是否批核，要以保險公司為準。」",
    supervisorRule: "退款、補發收費、醫師信、保險特別格式或簽署時限，要先問主管。",
  },
  {
    id: "delivery",
    title: "寄藥資料",
    area: "藥袋枱",
    riskLabel: "送遞風險",
    quoteFrom: "病人",
    quote: "我想寄藥，你幫我照舊地址寄啦，應該無變。",
    goal: "寄送前收齊最新資料，不靠舊紀錄估。",
    options: [
      {
        id: "old-address",
        text: "如果系統有舊地址，我可以直接照舊寄，這樣最快。",
        note: "舊地址可能已改，寄藥不可靠估。",
      },
      {
        id: "complete",
        text: "我先重新確認收件人、電話、完整地址和收件時段，再確認運費和送遞方式。",
        note: "把寄送需要的核心資料一次收齊。",
      },
      {
        id: "promise-today",
        text: "我先答應今日送到，再叫司機盡量安排。",
        note: "未確認物流前，不可承諾送達時間。",
      },
    ],
    correctOptionId: "complete",
    why: "寄藥最常出錯的是地址、電話、收件時間和運費未確認。",
    safeScript: "「我需要重新同你確認收件人、電話、完整地址、收件時間同運費安排。」",
    supervisorRule: "海外、貴重藥物、投訴、即日送達承諾或地址不清，要升級處理。",
  },
  {
    id: "restricted",
    title: "密碼與 OTP",
    area: "員工後場",
    riskLabel: "帳號安全",
    quoteFrom: "同事",
    quote: "我部機登入唔到，你 WhatsApp 個 OTP 或後台密碼俾我先啦。",
    goal: "守住 restricted 資料，不在普通對話轉發。",
    options: [
      {
        id: "share",
        text: "對方是同事，我可以先傳 OTP 或密碼，之後再提醒他改密碼。",
        note: "同事身份不代表可以用普通 WhatsApp 傳 restricted 資料。",
      },
      {
        id: "restricted",
        text: "OTP、密碼和後台權限不能在 WhatsApp 傳；請用正式登入流程或交主管處理。",
        note: "守住權限邊界，也保護同事和診所。",
      },
      {
        id: "ai",
        text: "我可以先問 AI 有沒有記錄，再把找到的資料轉發給同事。",
        note: "restricted 資料不可交給 AI 查，也不可轉發。",
      },
    ],
    correctOptionId: "restricted",
    why: "密碼、OTP、銀行、後台權限都屬 restricted 資料，不可用普通對話傳遞。",
    safeScript: "「呢類資料不能在 WhatsApp 傳，我幫你按正式登入或主管流程處理。」",
    supervisorRule: "任何人要求密碼、OTP、銀行資料、後台權限或病人敏感資料，都要立即升級。",
  },
];

function readStoredResult(): StoredResult | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      parsed &&
      typeof parsed.score === "number" &&
      typeof parsed.total === "number" &&
      typeof parsed.completedAt === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function formatStoredDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssessmentStatus(score: number, total: number): AssessmentStatus {
  if (score === total) {
    return {
      label: "可獨立處理低風險前台任務",
      note: "高風險、收費、保險、加位和 restricted 資料仍要升級。",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  if (score >= PASS_SCORE) {
    return {
      label: "可處理低風險任務，錯題需主管覆核",
      note: "先重溫錯題情境，再由主管確認是否可放行。",
      badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-900",
    };
  }

  return {
    label: "暫時需要主管旁聽",
    note: "先重溫上手棋盤和錯題句式，不建議獨立處理前台查詢。",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

export function NurseQuizClient() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lockedSceneIds, setLockedSceneIds] = useState<string[]>([]);
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null);

  useEffect(() => {
    setStoredResult(readStoredResult());
  }, []);

  const currentScene = SCENES[currentIndex];
  const currentAnswer = answers[currentScene.id];
  const currentLocked = lockedSceneIds.includes(currentScene.id);

  const score = useMemo(
    () => SCENES.filter((scene) => answers[scene.id] === scene.correctOptionId).length,
    [answers],
  );
  const finished = lockedSceneIds.length === SCENES.length;
  const progressPercent = Math.round((lockedSceneIds.length / SCENES.length) * 100);
  const currentCorrect = currentAnswer === currentScene.correctOptionId;
  const resultStatus = getAssessmentStatus(score, SCENES.length);

  function chooseAnswer(optionId: string) {
    if (currentLocked) return;

    const nextAnswers = { ...answers, [currentScene.id]: optionId };
    const nextLocked = [...lockedSceneIds, currentScene.id];
    setAnswers(nextAnswers);
    setLockedSceneIds(nextLocked);

    if (nextLocked.length === SCENES.length) {
      const finalScore = SCENES.filter((scene) => nextAnswers[scene.id] === scene.correctOptionId).length;
      const nextResult = {
        score: finalScore,
        total: SCENES.length,
        completedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResult));
      setStoredResult(nextResult);
    }
  }

  function goNext() {
    setCurrentIndex((index) => Math.min(index + 1, SCENES.length - 1));
  }

  function resetAssessment() {
    setCurrentIndex(0);
    setAnswers({});
    setLockedSceneIds([]);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px_300px] lg:items-center">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
              前台安全放行測驗
            </h1>
          </div>

          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-emerald-100 bg-slate-100 shadow-sm">
            <Image
              src="/images/nurse-quiz-consultation-photo.jpg"
              alt="姑娘在診所前台與病人溝通"
              fill
              priority
              sizes="(min-width: 1024px) 360px, 100vw"
              className="object-cover"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
              <span>進度</span>
              <span>{lockedSceneIds.length}/{SCENES.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-500">目前分數</span>
              <span className="text-xl font-semibold text-slate-950">{score}/{SCENES.length}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {storedResult
                ? `上次：${storedResult.score}/${storedResult.total} · ${formatStoredDate(storedResult.completedAt)}`
                : "未有完成紀錄"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-emerald-50 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-1 text-emerald-800">
                  第 {currentIndex + 1} 關
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                  {currentScene.riskLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  {currentScene.area}
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
                {currentScene.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{currentScene.goal}</p>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="text-xs font-semibold text-emerald-200">{currentScene.quoteFrom}</div>
                <p className="mt-3 text-base leading-8">{currentScene.quote}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  判斷重點
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  選擇一個最穩陣、最可被主管接受的前台回應。
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            {currentScene.options.map((option, index) => {
              const selected = currentAnswer === option.id;
              const correct = option.id === currentScene.correctOptionId;
              const showCorrect = currentLocked && correct;
              const showWrong = currentLocked && selected && !correct;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseAnswer(option.id)}
                  disabled={currentLocked}
                  className={`group rounded-lg border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-default ${
                    showCorrect
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : showWrong
                        ? "border-amber-300 bg-amber-50 text-amber-950"
                        : selected
                          ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                          : "border-slate-200 bg-white text-slate-900 hover:border-emerald-200 hover:bg-emerald-50/40"
                  }`}
                >
                  <span className="flex gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                      showCorrect
                        ? "border-emerald-300 bg-white text-emerald-800"
                        : showWrong
                          ? "border-amber-300 bg-white text-amber-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}>
                      {OPTION_LABELS[index]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-6">{option.text}</span>
                      {currentLocked ? (
                        <span className="mt-2 block text-xs leading-5 text-slate-500">{option.note}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {currentLocked ? (
            <section
              role="status"
              className={`rounded-lg border p-5 shadow-sm ${
                currentCorrect
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {currentCorrect ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                {currentCorrect ? "判斷穩陣" : "需要重溫"}
              </div>
              <p className="mt-3 text-sm leading-6">{currentScene.why}</p>
              <div className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-3">
                <div className="rounded-lg border border-current/20 bg-white/70 p-3">
                  <div className="text-xs font-semibold text-current/70">可照讀句子</div>
                  <p className="mt-2">{currentScene.safeScript}</p>
                </div>
                <div className="rounded-lg border border-current/20 bg-white/70 p-3 md:col-span-2">
                  <div className="text-xs font-semibold text-current/70">何時問主管</div>
                  <p className="mt-2">{currentScene.supervisorRule}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              6 個判斷點
            </div>
            <div className="mt-4 space-y-2">
              {SCENES.map((scene, index) => {
                const done = lockedSceneIds.includes(scene.id);
                const active = index === currentIndex;
                const correct = answers[scene.id] === scene.correctOptionId;

                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                      active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : done && correct
                          ? "border-emerald-100 bg-white text-slate-700"
                          : done
                            ? "border-amber-200 bg-amber-50 text-amber-950"
                            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-100"
                    }`}
                    aria-label={`前往第 ${index + 1} 關：${scene.title}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                      {done ? (correct ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />) : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{scene.title}</span>
                      <span className="block text-xs text-current/60">{scene.riskLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-emerald-700" />
              放行標準
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {PASS_SCORE}/{SCENES.length} 或以上才可進入低風險前台任務；錯題仍需主管覆核。
            </p>
          </section>
        </aside>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {finished ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${resultStatus.badgeClassName}`}>
                {score >= PASS_SCORE ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {resultStatus.label}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                {score}/{SCENES.length}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{resultStatus.note}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetAssessment}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              >
                <RotateCcw className="h-4 w-4" />
                重新測驗
              </button>
              <Link
                href="/nurse/onboarding"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              >
                返回上手棋盤
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ClipboardCheck className="h-4 w-4" />
                {currentLocked ? "本題已完成" : "揀一個最穩陣回應"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                第 {currentIndex + 1} 關：{currentScene.title}
              </p>
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={!currentLocked || currentIndex === SCENES.length - 1}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              下一關
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
