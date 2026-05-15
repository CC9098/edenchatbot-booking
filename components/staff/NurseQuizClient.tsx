"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  PlayCircle,
  RotateCcw,
  Video,
  XCircle,
} from "lucide-react";

type OptionId = "A" | "B" | "C" | "D";

type TrainingVideo = {
  id: string;
  title: string;
  driveId: string;
};

type QuizOption = {
  id: OptionId;
  text: string;
};

type QuizQuestion = {
  id: string;
  videoTitle: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: OptionId;
  critical: boolean;
  why: string;
};

type TrainingModule = {
  id: string;
  title: string;
  shortTitle: string;
  audience: string;
  videos: TrainingVideo[];
  questions: QuizQuestion[];
};

type StoredResults = Record<
  string,
  {
    score: number;
    total: number;
    criticalErrors: number;
    completedAt: string;
  }
>;

const STORAGE_KEY = "eden-nurse-training-platform-v1";
const PASS_RATIO = 0.8;

const MODULES: TrainingModule[] = [
  {
    id: "front-desk",
    title: "前台與服務標準",
    shortTitle: "前台",
    audience: "前台 / 接待 / 姑娘",
    videos: [
      {
        id: "front-desk-manners",
        title: "前台儀態要求",
        driveId: "13w1stGKerWohcT1AfI7y122OnH2-PL0U",
      },
    ],
    questions: [
      {
        id: "front-q1",
        videoTitle: "前台儀態要求",
        prompt: "病人入到前台時，姑娘最先應保持哪一類表現？",
        options: [
          { id: "A", text: "只處理電腦，不望病人" },
          { id: "B", text: "清楚、有禮、主動確認需要" },
          { id: "C", text: "等病人重複問多次先回應" },
          { id: "D", text: "只用內部術語回答" },
        ],
        correctOptionId: "B",
        critical: false,
        why: "前台第一反應會直接影響病人信任，先讓病人知道有人接住佢。",
      },
      {
        id: "front-q2",
        videoTitle: "前台儀態要求",
        prompt: "如病人問題涉及私隱或個人資料，最合適做法是？",
        options: [
          { id: "A", text: "在大堂大聲確認資料" },
          { id: "B", text: "按診所私隱流程處理，避免公開講出敏感資料" },
          { id: "C", text: "叫其他病人一齊聽" },
          { id: "D", text: "直接忽略問題" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "病人資料不可在公共位置暴露，私隱題錯誤需要主管覆核。",
      },
      {
        id: "front-q3",
        videoTitle: "前台儀態要求",
        prompt: "如病人情緒急或不滿，姑娘應優先做到？",
        options: [
          { id: "A", text: "即時反駁" },
          { id: "B", text: "保持冷靜，先聽清楚，再按流程處理或交給負責人" },
          { id: "C", text: "叫病人之後再來" },
          { id: "D", text: "在群組討論病人資料" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "投訴或急切情況要先降溫，再按權限處理，不可即場升級衝突。",
      },
      {
        id: "front-q4",
        videoTitle: "前台儀態要求",
        prompt: "以下哪一項最不應該出現在前台服務？",
        options: [
          { id: "A", text: "清楚確認預約/資料" },
          { id: "B", text: "有禮貌回應" },
          { id: "C", text: "在病人面前講內部抱怨或責備同事" },
          { id: "D", text: "需要時請 senior 跟進" },
        ],
        correctOptionId: "C",
        critical: false,
        why: "前台是病人接觸診所的第一個場景，內部問題不應在病人面前處理。",
      },
      {
        id: "front-q5",
        videoTitle: "前台儀態要求",
        prompt: "如果自己不肯定答案，較安全做法是？",
        options: [
          { id: "A", text: "估一個答案給病人" },
          { id: "B", text: "查清楚或請負責人確認後再回答" },
          { id: "C", text: "叫病人自己上網查" },
          { id: "D", text: "不回應" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "不確定就查核或升級，比即場估更保護病人和診所。",
      },
    ],
  },
  {
    id: "treatment-room",
    title: "治療室安全操作",
    shortTitle: "治療室",
    audience: "治療室 / 姑娘",
    videos: [
      {
        id: "heat-lamp",
        title: "治療室熱燈使用操作",
        driveId: "1tNdb5ln-o9p0329eNhmIOKVXSE6Gqjhw",
      },
    ],
    questions: [
      {
        id: "room-q1",
        videoTitle: "治療室熱燈使用操作",
        prompt: "使用熱燈前，最重要先確認的是？",
        options: [
          { id: "A", text: "房間是否最靚" },
          { id: "B", text: "病人/治療位置及是否按診所或醫師指示使用" },
          { id: "C", text: "是否有人影相" },
          { id: "D", text: "是否可以離開房間" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "熱燈屬安全操作，位置、距離和指示未確認就不應開始。",
      },
      {
        id: "room-q2",
        videoTitle: "治療室熱燈使用操作",
        prompt: "熱燈照射期間，姑娘應留意甚麼？",
        options: [
          { id: "A", text: "只要開著就不用理會" },
          { id: "B", text: "病人舒適度、距離、時間及異常反應" },
          { id: "C", text: "只看手機時間" },
          { id: "D", text: "只確保房門關上" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "治療室設備要有人留意反應，異常要及早處理。",
      },
      {
        id: "room-q3",
        videoTitle: "治療室熱燈使用操作",
        prompt: "如病人表示太熱或不舒服，應該？",
        options: [
          { id: "A", text: "叫病人忍耐" },
          { id: "B", text: "立即按安全流程調整/停止，並通知負責人" },
          { id: "C", text: "加大熱度" },
          { id: "D", text: "離開治療室" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "不適反應不可拖延，先停止風險再通知負責人。",
      },
      {
        id: "room-q4",
        videoTitle: "治療室熱燈使用操作",
        prompt: "完成使用後，以下哪項應做？",
        options: [
          { id: "A", text: "確認關機/移開設備/整理治療室" },
          { id: "B", text: "直接走開" },
          { id: "C", text: "交給下一位病人自行處理" },
          { id: "D", text: "不用記錄任何異常" },
        ],
        correctOptionId: "A",
        critical: true,
        why: "設備收尾是安全流程一部分，避免下一位病人或同事接手出錯。",
      },
    ],
  },
  {
    id: "medicine-machine",
    title: "藥機操作及保養",
    shortTitle: "藥機",
    audience: "藥房 / 姑娘",
    videos: [
      {
        id: "machine-start",
        title: "藥機開機方法",
        driveId: "1ssfbCkiXVBR8z4sIqvgLBBT35NquQ-Rq",
      },
      {
        id: "machine-care",
        title: "藥機操作保養教學",
        driveId: "1Y-pMyVrIq_LMYkrawyT-DyrRl5z-Hb38",
      },
      {
        id: "machine-pack",
        title: "藥機pack藥準則",
        driveId: "1lrJsv14F2Uf00SjSpgEEJUNLR5OnCqDH",
      },
    ],
    questions: [
      {
        id: "machine-q1",
        videoTitle: "藥機開機方法",
        prompt: "藥機開機前較合理的第一步是？",
        options: [
          { id: "A", text: "直接開始 pack 藥" },
          { id: "B", text: "按影片示範檢查機器狀態及必要準備" },
          { id: "C", text: "跳過所有檢查" },
          { id: "D", text: "只看藥袋顏色" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "機器未準備好就開始，會增加錯藥、卡機或污染風險。",
      },
      {
        id: "machine-q2",
        videoTitle: "藥機開機方法",
        prompt: "如果開機時出現異常聲響或錯誤提示，應該？",
        options: [
          { id: "A", text: "繼續使用直到完成" },
          { id: "B", text: "停止並按流程通知負責人/檢查問題" },
          { id: "C", text: "拍片放群組但繼續 pack" },
          { id: "D", text: "自行拆機維修" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "異常提示不可照常運作，先停機和升級處理。",
      },
      {
        id: "machine-q3",
        videoTitle: "藥機操作保養教學",
        prompt: "保養清潔的目的主要是？",
        options: [
          { id: "A", text: "令機器看起來新" },
          { id: "B", text: "保持機器運作穩定，減少污染/錯誤風險" },
          { id: "C", text: "節省所有覆核步驟" },
          { id: "D", text: "代替醫師處方" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥機保養是穩定和衛生要求，不是外觀整理。",
      },
      {
        id: "machine-q4",
        videoTitle: "藥機pack藥準則",
        prompt: "Pack 藥時最核心的核對原則是？",
        options: [
          { id: "A", text: "快過所有同事" },
          { id: "B", text: "按處方/藥袋/影片流程核對，避免錯藥錯量錯袋" },
          { id: "C", text: "藥粉顏色相似就可以" },
          { id: "D", text: "病人催就省略覆核" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥房流程最重要是準確，不是速度。",
      },
      {
        id: "machine-q5",
        videoTitle: "藥機pack藥準則",
        prompt: "如發現藥袋或資料與處方不一致，應該？",
        options: [
          { id: "A", text: "照 pack 再算" },
          { id: "B", text: "停止流程並請負責人核對" },
          { id: "C", text: "自行改資料" },
          { id: "D", text: "交給病人自己判斷" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "資料不一致就是錯誤攔截點，不可自行跳過。",
      },
    ],
  },
  {
    id: "medicine-bag",
    title: "裝藥與藥袋流程",
    shortTitle: "裝藥",
    audience: "藥房 / 姑娘",
    videos: [
      {
        id: "dispense",
        title: "盛藥方法",
        driveId: "1zV1Ze0p3iEHxpC4S9cqIu97GCslrsgAA",
      },
      {
        id: "powder-bag",
        title: "藥粉袋裝藥準則",
        driveId: "1eEf9xrfUZRisKH3mw_oqgNW3dQ_sDzo5",
      },
      {
        id: "seal-bag",
        title: "藥袋封口方法",
        driveId: "1NhdqJklWNjtDFCBJMzVDmmqnN-3xiDce",
      },
    ],
    questions: [
      {
        id: "bag-q1",
        videoTitle: "盛藥方法",
        prompt: "盛藥時最應避免的是？",
        options: [
          { id: "A", text: "按流程核對藥物" },
          { id: "B", text: "保持容器/工具清潔" },
          { id: "C", text: "不同病人或不同處方混淆" },
          { id: "D", text: "完成後覆核" },
        ],
        correctOptionId: "C",
        critical: true,
        why: "混藥或混處方屬高風險錯誤。",
      },
      {
        id: "bag-q2",
        videoTitle: "盛藥方法",
        prompt: "盛藥完成後，下一步應該？",
        options: [
          { id: "A", text: "直接放低不標示" },
          { id: "B", text: "按影片流程核對/標示/交下一工序" },
          { id: "C", text: "叫病人自己取" },
          { id: "D", text: "把多餘藥物混回其他藥" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "交接前要有清楚標示和核對，避免下一工序接錯。",
      },
      {
        id: "bag-q3",
        videoTitle: "藥粉袋裝藥準則",
        prompt: "藥粉入袋時，最重要確認的是？",
        options: [
          { id: "A", text: "袋口是否最美觀" },
          { id: "B", text: "藥袋、份量、病人/處方資料是否吻合" },
          { id: "C", text: "誰最快完成" },
          { id: "D", text: "是否可一次處理多個病人而不分開" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "裝袋前後都要確認身份、份量和處方，避免錯袋。",
      },
      {
        id: "bag-q4",
        videoTitle: "藥袋封口方法",
        prompt: "封口完成後，較安全的檢查是？",
        options: [
          { id: "A", text: "封口是否完整，藥粉是否容易漏出" },
          { id: "B", text: "只看顏色" },
          { id: "C", text: "不需檢查" },
          { id: "D", text: "把破損袋照用" },
        ],
        correctOptionId: "A",
        critical: true,
        why: "封口不完整會直接影響藥物保存和交付安全。",
      },
      {
        id: "bag-q5",
        videoTitle: "藥袋封口方法",
        prompt: "如發現封口不完整，應該？",
        options: [
          { id: "A", text: "照樣交出" },
          { id: "B", text: "按流程重做/更換並重新核對" },
          { id: "C", text: "用手按一下就算" },
          { id: "D", text: "交給病人提醒小心" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "品質問題要在交付前攔截和重做。",
      },
    ],
  },
  {
    id: "medicine-rack",
    title: "藥架整理與出藥準則",
    shortTitle: "藥架",
    audience: "藥房 / 姑娘",
    videos: [
      {
        id: "rack-pack",
        title: "藥架包藥準則",
        driveId: "1ZpQDOl28DKgN5jh6Nrc4jA03g7MzBhJQ",
      },
      {
        id: "rack-insert",
        title: "藥架插藥袋方法",
        driveId: "1ry0BE2smXJXaLku5BVzaXpr-Stf_sozE",
      },
    ],
    questions: [
      {
        id: "rack-q1",
        videoTitle: "藥架包藥準則",
        prompt: "使用藥架包藥時，最核心目標是？",
        options: [
          { id: "A", text: "把藥袋放得好看" },
          { id: "B", text: "確保每位病人/每張處方的藥袋不混亂、不錯位" },
          { id: "C", text: "節省所有標示" },
          { id: "D", text: "讓多人同時亂放" },
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥架是防止錯袋錯位的工具，不只是收納。",
      },
      {
        id: "rack-q2",
        videoTitle: "藥架插藥袋方法",
        prompt: "插藥袋時應優先跟隨甚麼？",
        options: [
          { id: "A", text: "影片示範的位置/次序/標示規則" },
          { id: "B", text: "自己習慣" },
          { id: "C", text: "任何空位都可以" },
          { id: "D", text: "按袋大小隨便排" },
        ],
        correctOptionId: "A",
        critical: true,
        why: "藥架位置和次序要一致，否則交接時容易出錯。",
      },
      {
        id: "rack-q3",
        videoTitle: "藥架插藥袋方法",
        prompt: "出藥或交接前，應該做甚麼？",
        options: [
          { id: "A", text: "按流程最後核對病人/處方/藥袋/數量" },
          { id: "B", text: "只數總袋數" },
          { id: "C", text: "直接交給下一位同事不用講" },
          { id: "D", text: "等病人自己核對" },
        ],
        correctOptionId: "A",
        critical: true,
        why: "最後交接是出錯前最後一道防線。",
      },
    ],
  },
];

function readStoredResults(): StoredResults {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("zh-HK", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPassScore(total: number) {
  return Math.ceil(total * PASS_RATIO);
}

export function NurseQuizClient() {
  const [selectedModuleId, setSelectedModuleId] = useState(MODULES[0].id);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, OptionId>>>({});
  const [storedResults, setStoredResults] = useState<StoredResults>({});

  useEffect(() => {
    setStoredResults(readStoredResults());
  }, []);

  const selectedModule = MODULES.find((module) => module.id === selectedModuleId) ?? MODULES[0];
  const selectedVideoId = selectedVideoIds[selectedModule.id] ?? selectedModule.videos[0].id;
  const selectedVideo =
    selectedModule.videos.find((video) => video.id === selectedVideoId) ?? selectedModule.videos[0];
  const moduleAnswers = useMemo(
    () => answers[selectedModule.id] ?? {},
    [answers, selectedModule.id],
  );
  const answeredCount = Object.keys(moduleAnswers).length;

  const score = useMemo(
    () =>
      selectedModule.questions.filter(
        (question) => moduleAnswers[question.id] === question.correctOptionId,
      ).length,
    [moduleAnswers, selectedModule.questions],
  );

  const criticalErrors = useMemo(
    () =>
      selectedModule.questions.filter(
        (question) =>
          question.critical &&
          moduleAnswers[question.id] &&
          moduleAnswers[question.id] !== question.correctOptionId,
      ).length,
    [moduleAnswers, selectedModule.questions],
  );

  const passScore = getPassScore(selectedModule.questions.length);
  const finished = answeredCount === selectedModule.questions.length;
  const passed = finished && score >= passScore && criticalErrors === 0;
  const progressPercent = Math.round((answeredCount / selectedModule.questions.length) * 100);
  const completedModules = MODULES.filter((module) => storedResults[module.id]).length;

  function selectModule(moduleId: string) {
    setSelectedModuleId(moduleId);
  }

  function chooseAnswer(questionId: string, optionId: OptionId) {
    if (moduleAnswers[questionId]) return;

    const nextModuleAnswers = {
      ...moduleAnswers,
      [questionId]: optionId,
    };
    const nextAnswers = {
      ...answers,
      [selectedModule.id]: nextModuleAnswers,
    };

    setAnswers(nextAnswers);

    if (Object.keys(nextModuleAnswers).length === selectedModule.questions.length) {
      const finalScore = selectedModule.questions.filter(
        (question) => nextModuleAnswers[question.id] === question.correctOptionId,
      ).length;
      const finalCriticalErrors = selectedModule.questions.filter(
        (question) =>
          question.critical && nextModuleAnswers[question.id] !== question.correctOptionId,
      ).length;
      const nextResults = {
        ...storedResults,
        [selectedModule.id]: {
          score: finalScore,
          total: selectedModule.questions.length,
          criticalErrors: finalCriticalErrors,
          completedAt: new Date().toISOString(),
        },
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResults));
      setStoredResults(nextResults);
    }
  }

  function resetModule() {
    const nextAnswers = { ...answers };
    delete nextAnswers[selectedModule.id];
    setAnswers(nextAnswers);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
              <GraduationCap className="h-4 w-4" />
              Staff training
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">
              姑娘培訓平台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              播放影片，完成同組測驗；安全題錯誤需要重溫。
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
              <span>已完成模組</span>
              <span>{completedModules}/{MODULES.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${Math.round((completedModules / MODULES.length) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              第一版紀錄儲存在此裝置；正式總覽可再接資料庫。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {MODULES.map((module) => {
          const result = storedResults[module.id];
          const active = module.id === selectedModule.id;
          const modulePassed =
            result && result.score >= getPassScore(result.total) && result.criticalErrors === 0;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => selectModule(module.id)}
              className={`rounded-lg border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{module.shortTitle}</span>
                {result ? (
                  modulePassed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )
                ) : null}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/65">{module.videos.length} 影片</div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
                  {selectedModule.audience}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  {selectedModule.questions.length} 題
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                  {passScore}/{selectedModule.questions.length} 合格
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
                {selectedModule.title}
              </h2>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                <iframe
                  title={`播放影片：${selectedVideo.title}`}
                  src={`https://drive.google.com/file/d/${selectedVideo.driveId}/preview`}
                  className="aspect-video w-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Video className="h-4 w-4 text-emerald-700" />
                  影片
                </div>
                <div className="mt-4 space-y-2">
                  {selectedModule.videos.map((video, index) => (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() =>
                        setSelectedVideoIds((current) => ({
                          ...current,
                          [selectedModule.id]: video.id,
                        }))
                      }
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                        video.id === selectedVideo.id
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="min-w-0 font-semibold">{video.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {selectedModule.questions.map((question, questionIndex) => {
              const selectedAnswer = moduleAnswers[question.id];
              const answered = Boolean(selectedAnswer);
              const correct = selectedAnswer === question.correctOptionId;

              return (
                <article
                  key={question.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                        第 {questionIndex + 1} 題
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                        {question.videoTitle}
                      </span>
                      {question.critical ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                          安全題
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950">
                      {question.prompt}
                    </h3>
                  </div>

                  <div className="grid gap-3 p-5 md:grid-cols-2">
                    {question.options.map((option) => {
                      const selected = selectedAnswer === option.id;
                      const isCorrectOption = option.id === question.correctOptionId;
                      const showCorrect = answered && isCorrectOption;
                      const showWrong = answered && selected && !isCorrectOption;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => chooseAnswer(question.id, option.id)}
                          disabled={answered}
                          className={`rounded-lg border p-4 text-left text-sm shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-default ${
                            showCorrect
                              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                              : showWrong
                                ? "border-amber-300 bg-amber-50 text-amber-950"
                                : selected
                                  ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                                  : "border-slate-200 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50/40"
                          }`}
                        >
                          <span className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                              {option.id}
                            </span>
                            <span className="min-w-0 font-semibold leading-6">{option.text}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {answered ? (
                    <div
                      role="status"
                      className={`border-t px-5 py-4 text-sm leading-6 ${
                        correct
                          ? "border-emerald-100 bg-emerald-50 text-emerald-950"
                          : "border-amber-100 bg-amber-50 text-amber-950"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {correct ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        {correct ? "答對" : "需要重溫"}
                      </div>
                      <p className="mt-2">{question.why}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              本組進度
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-500">已完成</span>
              <span className="text-xl font-semibold text-slate-950">
                {answeredCount}/{selectedModule.questions.length}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">分數</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {score}/{selectedModule.questions.length}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">安全錯題</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{criticalErrors}</div>
              </div>
            </div>

            {finished ? (
              <div
                className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${
                  passed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {passed ? "本組合格" : "需要主管覆核"}
                </div>
                <p className="mt-2">
                  {passed
                    ? "可進入下一組影片。"
                    : `${passScore}/${selectedModule.questions.length} 或以上且安全題無錯才合格。`}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={resetModule}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
            >
              <RotateCcw className="h-4 w-4" />
              重做本組
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PlayCircle className="h-4 w-4 text-emerald-700" />
              上次紀錄
            </div>
            <div className="mt-4 space-y-2">
              {MODULES.map((module) => {
                const result = storedResults[module.id];

                return (
                  <div
                    key={module.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-slate-700">{module.shortTitle}</span>
                    <span className="text-xs text-slate-500">
                      {result
                        ? `${result.score}/${result.total} · ${formatDate(result.completedAt)}`
                        : "未完成"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
