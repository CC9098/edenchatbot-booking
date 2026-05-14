"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type QuizOption = {
  id: string;
  text: string;
};

type QuizScene = {
  id: string;
  title: string;
  place: string;
  npcName: string;
  npcLine: string;
  goal: string;
  options: QuizOption[];
  correctOptionId: string;
  reply: string;
  nextStep: string;
  supervisorRule: string;
};

type StoredResult = {
  score: number;
  total: number;
  completedAt: string;
};

const STORAGE_KEY = "eden-nurse-quiz-result-v1";
const PASS_SCORE = 5;

const SCENES: QuizScene[] = [
  {
    id: "safe-close",
    title: "前台第一句",
    place: "接待櫃位",
    npcName: "病人",
    npcLine: "我上次好似有折，今次應該都係同一個價？你幫我答實得唔得？",
    goal: "未肯定收費時，先保護診所承諾。",
    options: [
      { id: "guess", text: "應該差唔多，我估今次都係同一個價。" },
      { id: "delay", text: "我先幫您確認清楚，再 WhatsApp 回覆您。" },
      { id: "ai", text: "我即刻問 AI，AI 話得我就照講。" },
    ],
    correctOptionId: "delay",
    reply: "答得穩。新人最重要是不估價、不估規則。",
    nextStep: "記低姓名、電話、問題和回覆渠道，再交當值同事確認。",
    supervisorRule: "涉及收費、保險、醫師安排，未確定就先收口。",
  },
  {
    id: "identity",
    title: "只記得電話尾數",
    place: "電話查詢",
    npcName: "來電者",
    npcLine: "我唔記得預約時間，只記得電話尾數 8899，你幫我睇下。",
    goal: "查預約前先做基本身份核對。",
    options: [
      { id: "tail", text: "有電話尾數就夠，直接讀出預約資料。" },
      { id: "verify", text: "先核對姓名、完整電話或其他資料，再查紀錄。" },
      { id: "refuse", text: "只記得電話尾數就一定幫唔到，叫佢自己搵返。" },
    ],
    correctOptionId: "verify",
    reply: "方向正確。既要幫病人，又要守住私隱。",
    nextStep: "核對身份後，只講與該病人相關的預約資料。",
    supervisorRule: "身份不清、多人共用電話、資料對不上，要問同事或主管。",
  },
  {
    id: "today-slot",
    title: "想今日插位",
    place: "預約表",
    npcName: "病人",
    npcLine: "我今日一定要睇，你幫我 WhatsApp 醫師問下可唔可以加個位。",
    goal: "分清楚可約時段、加位、醫療急切度。",
    options: [
      { id: "message-doctor", text: "即刻私訊醫師，病人話急就應該幫佢插位。" },
      { id: "system", text: "先查系統可約時段，滿咗就提供最近可約時間。" },
      { id: "diagnose", text: "問清楚症狀，再替病人判斷今日一定要睇。" },
    ],
    correctOptionId: "system",
    reply: "穩陣。姑娘不自行插位，也不替病人做醫療判斷。",
    nextStep: "如病人描述高風險或非常急，先交當值同事或主管處理。",
    supervisorRule: "加位、即日特殊安排、醫療急切度，一律不由新人自行決定。",
  },
  {
    id: "receipt-insurance",
    title: "保險收據",
    place: "收據櫃桶",
    npcName: "病人",
    npcLine: "我保險要 claim，你張收據寫咗就一定 claim 到啦？",
    goal: "不要承諾第三方結果。",
    options: [
      { id: "guarantee", text: "診所收據通常得，我答你一定 claim 到。" },
      { id: "safe", text: "我可以按診所紀錄處理收據，但保險結果要由保險公司審批。" },
      { id: "doctor-sign", text: "我答醫師一定即日簽好所有文件。" },
    ],
    correctOptionId: "safe",
    reply: "正確。可以講流程，不可以保證 claim 到。",
    nextStep: "先查紀錄、收據類型、補發是否收費，再按流程處理。",
    supervisorRule: "保險保證、退款、醫師簽文件時限，要問主管。",
  },
  {
    id: "delivery",
    title: "寄藥任務",
    place: "藥袋枱",
    npcName: "病人",
    npcLine: "我想寄藥，你幫我照舊地址寄啦，應該無變。",
    goal: "寄送前收齊最新資料，不靠估。",
    options: [
      { id: "old-address", text: "用舊地址最快，唔需要再問。" },
      { id: "complete", text: "重新確認姓名、電話、完整地址、方便收件時間。" },
      { id: "promise-today", text: "先答應一定今日送到，之後再睇司機。" },
    ],
    correctOptionId: "complete",
    reply: "做得好。寄藥最怕地址、電話、時間不清楚。",
    nextStep: "再確認運費、送遞方式；海外、貴重藥物或投訴要升級。",
    supervisorRule: "不可承諾一定今日送到，不可用模糊地址出件。",
  },
  {
    id: "restricted",
    title: "密碼寶箱",
    place: "員工後場",
    npcName: "同事",
    npcLine: "我部機登入唔到，你 WhatsApp 個 OTP 或後台密碼俾我先啦。",
    goal: "守住 restricted 資料。",
    options: [
      { id: "share", text: "對方係同事，可以直接傳密碼或 OTP。" },
      { id: "restricted", text: "這類資料不可在一般對話傳，按指定流程交主管。" },
      { id: "ai", text: "問 AI 有無記錄，再將 AI 找到的資料轉發。" },
    ],
    correctOptionId: "restricted",
    reply: "守住底線。密碼、OTP、銀行資料不可由新人自行轉發。",
    nextStep: "請對方用正式帳號流程，或由主管處理權限。",
    supervisorRule: "restricted 資料不放入 AI，不在病人或普通群組對話公開。",
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

function PixelNurse() {
  return (
    <div className="relative h-24 w-20" aria-hidden="true">
      <div className="absolute left-6 top-0 h-4 w-8 bg-emerald-900" />
      <div className="absolute left-4 top-4 h-8 w-12 bg-[#ffd8b5]" />
      <div className="absolute left-6 top-6 h-2 w-2 bg-slate-900" />
      <div className="absolute right-6 top-6 h-2 w-2 bg-slate-900" />
      <div className="absolute left-8 top-10 h-2 w-4 bg-rose-500" />
      <div className="absolute left-4 top-12 h-8 w-12 bg-emerald-600" />
      <div className="absolute left-0 top-14 h-6 w-4 bg-[#ffd8b5]" />
      <div className="absolute right-0 top-14 h-6 w-4 bg-[#ffd8b5]" />
      <div className="absolute left-5 top-20 h-4 w-4 bg-slate-800" />
      <div className="absolute right-5 top-20 h-4 w-4 bg-slate-800" />
    </div>
  );
}

function PixelNpc({ tone }: { tone: "patient" | "staff" }) {
  const shirt = tone === "staff" ? "bg-cyan-700" : "bg-amber-600";

  return (
    <div className="relative h-24 w-20" aria-hidden="true">
      <div className="absolute left-5 top-0 h-5 w-10 bg-slate-800" />
      <div className="absolute left-4 top-5 h-8 w-12 bg-[#f1c19b]" />
      <div className="absolute left-6 top-7 h-2 w-2 bg-slate-950" />
      <div className="absolute right-6 top-7 h-2 w-2 bg-slate-950" />
      <div className="absolute left-8 top-12 h-2 w-4 bg-slate-700" />
      <div className={`absolute left-4 top-14 h-8 w-12 ${shirt}`} />
      <div className="absolute left-0 top-16 h-6 w-4 bg-[#f1c19b]" />
      <div className="absolute right-0 top-16 h-6 w-4 bg-[#f1c19b]" />
      <div className="absolute left-5 top-[88px] h-2 w-4 bg-slate-800" />
      <div className="absolute right-5 top-[88px] h-2 w-4 bg-slate-800" />
    </div>
  );
}

function PixelClinicScene({ scene }: { scene: QuizScene }) {
  const npcTone = scene.id === "restricted" ? "staff" : "patient";

  return (
    <section className="overflow-hidden rounded-none border-4 border-slate-950 bg-[#ecfeff] shadow-[8px_8px_0_rgba(15,23,42,1)]">
      <div className="flex items-center justify-between border-b-4 border-slate-950 bg-cyan-700 px-4 py-2 text-white">
        <div className="font-mono text-sm font-bold tracking-normal">{scene.place}</div>
        <div className="font-mono text-sm font-bold tracking-normal">LV {SCENES.findIndex((item) => item.id === scene.id) + 1}</div>
      </div>

      <div
        className="relative min-h-[260px] overflow-hidden bg-[#e0f2fe]"
        style={{
          imageRendering: "pixelated",
          backgroundImage:
            "linear-gradient(#bae6fd 2px, transparent 2px), linear-gradient(90deg, #bae6fd 2px, transparent 2px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="absolute inset-x-0 bottom-0 h-24 border-t-4 border-slate-950 bg-[#fef3c7]" />
        <div className="absolute left-6 top-10 h-16 w-32 border-4 border-slate-950 bg-white shadow-[4px_4px_0_rgba(15,23,42,1)]">
          <div className="h-6 border-b-4 border-slate-950 bg-emerald-600" />
          <div className="grid grid-cols-4 gap-1 p-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <span key={index} className="h-2 bg-cyan-200" />
            ))}
          </div>
        </div>
        <div className="absolute right-7 top-10 h-20 w-24 border-4 border-slate-950 bg-emerald-100 shadow-[4px_4px_0_rgba(15,23,42,1)]">
          <div className="h-6 border-b-4 border-slate-950 bg-amber-500" />
          <div className="mx-auto mt-3 h-8 w-12 bg-white" />
        </div>

        <div className="absolute bottom-12 left-8 sm:left-20">
          <PixelNurse />
          <div className="mt-1 border-2 border-slate-950 bg-white px-2 py-1 text-center font-mono text-xs font-bold">
            姑娘
          </div>
        </div>
        <div className="absolute bottom-12 right-8 sm:right-24">
          <PixelNpc tone={npcTone} />
          <div className="mt-1 border-2 border-slate-950 bg-white px-2 py-1 text-center font-mono text-xs font-bold">
            {scene.npcName}
          </div>
        </div>

        <div className="absolute bottom-8 left-[45%] hidden h-6 w-6 border-4 border-slate-950 bg-rose-500 sm:block" />
        <div className="absolute bottom-8 left-[52%] hidden h-6 w-6 border-4 border-slate-950 bg-emerald-500 sm:block" />
      </div>

      <div className="border-t-4 border-slate-950 bg-slate-950 p-3">
        <div className="border-4 border-white bg-slate-900 p-4 text-white">
          <div className="font-mono text-xs font-bold text-cyan-200">{scene.npcName}</div>
          <p className="mt-2 text-base leading-7 text-white">{scene.npcLine}</p>
        </div>
      </div>

      <div className="bg-[#f8fafc] p-4">
        <div className="border-4 border-slate-950 bg-white p-3 shadow-[4px_4px_0_rgba(15,23,42,1)]">
          <div className="font-mono text-xs font-bold uppercase text-slate-500">Quest</div>
          <p className="mt-2 text-sm leading-6 text-slate-800">{scene.goal}</p>
        </div>
      </div>
    </section>
  );
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
  const passed = score >= PASS_SCORE;
  const finished = lockedSceneIds.length === SCENES.length;
  const progressPercent = Math.round((lockedSceneIds.length / SCENES.length) * 100);

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

  function resetGame() {
    setCurrentIndex(0);
    setAnswers({});
    setLockedSceneIds([]);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-none border-4 border-slate-950 bg-[#f0fdfa] p-4 shadow-[8px_8px_0_rgba(15,23,42,1)] sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-sm font-bold uppercase tracking-normal text-emerald-800">Nurse Quest</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              前台 RPG 小測驗
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              做姑娘角色，逐關處理病人和同事問題。每次只揀一個最穩陣回應。
            </p>
          </div>

          <div className="grid min-w-[240px] gap-2 border-4 border-slate-950 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between gap-3 font-mono text-xs font-bold text-slate-700">
              <span>進度</span>
              <span>{lockedSceneIds.length}/{SCENES.length}</span>
            </div>
            <div className="h-4 border-2 border-slate-950 bg-slate-100">
              <div className="h-full bg-emerald-600" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="font-mono text-sm font-bold text-slate-950">分數 {score}/{SCENES.length}</div>
            {storedResult ? (
              <div className="text-xs leading-5 text-slate-600">
                上次：{storedResult.score}/{storedResult.total} · {formatStoredDate(storedResult.completedAt)}
              </div>
            ) : (
              <div className="text-xs leading-5 text-slate-600">未有通關紀錄</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <PixelClinicScene
            scene={currentScene}
          />

          <div className="mt-4 grid gap-2">
            {currentScene.options.map((option) => {
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
                  className={`min-h-14 border-4 px-4 py-3 text-left text-sm font-semibold leading-6 shadow-[4px_4px_0_rgba(15,23,42,1)] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 disabled:cursor-default ${
                    showCorrect
                      ? "border-emerald-900 bg-emerald-100 text-emerald-950"
                      : showWrong
                        ? "border-rose-900 bg-rose-100 text-rose-950"
                        : selected
                          ? "border-cyan-900 bg-cyan-100 text-cyan-950"
                          : "border-slate-950 bg-white text-slate-900 hover:-translate-y-0.5 hover:bg-cyan-50"
                  }`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>

          {currentLocked ? (
            <div
              role="status"
              className={`mt-4 border-4 p-4 shadow-[4px_4px_0_rgba(15,23,42,1)] ${
                currentAnswer === currentScene.correctOptionId
                  ? "border-emerald-950 bg-emerald-50 text-emerald-950"
                  : "border-amber-950 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {currentAnswer === currentScene.correctOptionId ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                {currentAnswer === currentScene.correctOptionId ? "Clear" : "Need Review"}
              </div>
              <p className="mt-2 text-sm leading-6">{currentScene.reply}</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 md:grid-cols-2">
                <div className="border-2 border-current bg-white/70 p-3">
                  <div className="font-mono text-xs font-bold">NEXT</div>
                  <p className="mt-1">{currentScene.nextStep}</p>
                </div>
                <div className="border-2 border-current bg-white/70 p-3">
                  <div className="font-mono text-xs font-bold">主管線</div>
                  <p className="mt-1">{currentScene.supervisorRule}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="border-4 border-slate-950 bg-white p-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
            <div className="font-mono text-xs font-bold uppercase text-slate-500">Map</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SCENES.map((scene, index) => {
                const done = lockedSceneIds.includes(scene.id);
                const active = index === currentIndex;
                const correct = answers[scene.id] === scene.correctOptionId;

                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`aspect-square border-4 text-center font-mono text-xs font-bold shadow-[3px_3px_0_rgba(15,23,42,1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${
                      active
                        ? "border-cyan-950 bg-cyan-100 text-cyan-950"
                        : done && correct
                          ? "border-emerald-950 bg-emerald-100 text-emerald-950"
                          : done
                            ? "border-amber-950 bg-amber-100 text-amber-950"
                            : "border-slate-950 bg-slate-100 text-slate-500"
                    }`}
                    aria-label={`前往第 ${index + 1} 關：${scene.title}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-4 border-slate-950 bg-white p-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
            <div className="font-mono text-xs font-bold uppercase text-slate-500">Goal</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              過關分數 {PASS_SCORE}/{SCENES.length}。但高風險情況永遠要問主管。
            </p>
          </div>
        </aside>
      </section>

      <section className="border-4 border-slate-950 bg-white p-4 shadow-[8px_8px_0_rgba(15,23,42,1)]">
        {finished ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={`inline-flex items-center gap-2 border-4 px-3 py-1 text-sm font-semibold ${
                passed
                  ? "border-emerald-950 bg-emerald-100 text-emerald-950"
                  : "border-amber-950 bg-amber-100 text-amber-950"
              }`}>
                {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {passed ? "通關" : "未通關"}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                {score}/{SCENES.length}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {passed
                  ? "可以做 Day 1 低風險前台任務；高風險情況仍然要問主管。"
                  : "先重玩錯關，再跟住上手棋盤練一次安全收口。"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetGame}
                className="inline-flex min-h-11 items-center gap-2 border-4 border-slate-950 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                重玩
              </button>
              <Link
                href="/nurse/onboarding"
                className="inline-flex min-h-11 items-center gap-2 border-4 border-emerald-950 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-emerald-50"
              >
                上手棋盤
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ClipboardCheck className="h-4 w-4" />
                {currentLocked ? "今關已完成" : "揀一個回應"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                第 {currentIndex + 1} 關：{currentScene.title}
              </p>
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={!currentLocked || currentIndex === SCENES.length - 1}
              className="inline-flex min-h-11 items-center justify-center gap-2 border-4 border-slate-950 bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-950 shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-cyan-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
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
