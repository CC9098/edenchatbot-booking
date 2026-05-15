"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  History,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";

type OptionId = "A" | "B" | "C" | "D";

type QuizOption = {
  id: OptionId;
  text: string;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: OptionId;
  critical: boolean;
  why: string;
};

type TrainingItem = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  audience: string;
  driveId: string;
  questions: QuizQuestion[];
};

type StoredResult = {
  score: number;
  total: number;
  criticalErrors: number;
  passed: boolean;
  completedAt: string;
  synced?: boolean;
};

type StoredResults = Record<string, StoredResult>;

type ApiResult = StoredResult & {
  id?: string;
  staffEmail?: string | null;
  moduleId: string;
  moduleTitle: string;
  videoTitle: string;
};

const STORAGE_KEY = "eden-nurse-training-platform-v2";
const PASS_RATIO = 0.8;

function option(id: OptionId, text: string): QuizOption {
  return { id, text };
}

const TRAINING_ITEMS: TrainingItem[] = [
  {
    id: "front-desk-manners",
    order: 1,
    title: "前台儀態要求",
    shortTitle: "前台儀態",
    audience: "前台 / 接待 / 姑娘",
    driveId: "13w1stGKerWohcT1AfI7y122OnH2-PL0U",
    questions: [
      {
        id: "front-q1",
        prompt: "病人入到前台時，姑娘最先應保持哪一類表現？",
        options: [
          option("A", "只處理電腦，不望病人"),
          option("B", "清楚、有禮、主動確認需要"),
          option("C", "等病人重複問多次先回應"),
          option("D", "只用內部術語回答"),
        ],
        correctOptionId: "B",
        critical: false,
        why: "前台第一反應會直接影響病人信任，先讓病人知道有人接住佢。",
      },
      {
        id: "front-q2",
        prompt: "如病人問題涉及私隱或個人資料，最合適做法是？",
        options: [
          option("A", "在大堂大聲確認資料"),
          option("B", "按診所私隱流程處理，避免公開講出敏感資料"),
          option("C", "叫其他病人一齊聽"),
          option("D", "直接忽略問題"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "病人資料不可在公共位置暴露，私隱題錯誤需要主管覆核。",
      },
      {
        id: "front-q3",
        prompt: "如病人情緒急或不滿，姑娘應優先做到？",
        options: [
          option("A", "即時反駁"),
          option("B", "保持冷靜，先聽清楚，再按流程處理或交給負責人"),
          option("C", "叫病人之後再來"),
          option("D", "在群組討論病人資料"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "投訴或急切情況要先降溫，再按權限處理，不可即場升級衝突。",
      },
    ],
  },
  {
    id: "heat-lamp",
    order: 2,
    title: "治療室熱燈使用操作",
    shortTitle: "熱燈操作",
    audience: "治療室 / 姑娘",
    driveId: "1tNdb5ln-o9p0329eNhmIOKVXSE6Gqjhw",
    questions: [
      {
        id: "lamp-q1",
        prompt: "使用熱燈前，最重要先確認的是？",
        options: [
          option("A", "房間是否最靚"),
          option("B", "病人/治療位置及是否按診所或醫師指示使用"),
          option("C", "是否有人影相"),
          option("D", "是否可以離開房間"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "熱燈屬安全操作，位置、距離和指示未確認就不應開始。",
      },
      {
        id: "lamp-q2",
        prompt: "熱燈照射期間，姑娘應留意甚麼？",
        options: [
          option("A", "只要開著就不用理會"),
          option("B", "病人舒適度、距離、時間及異常反應"),
          option("C", "只看手機時間"),
          option("D", "只確保房門關上"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "治療室設備要有人留意反應，異常要及早處理。",
      },
      {
        id: "lamp-q3",
        prompt: "如病人表示太熱或不舒服，應該？",
        options: [
          option("A", "叫病人忍耐"),
          option("B", "立即按安全流程調整/停止，並通知負責人"),
          option("C", "加大熱度"),
          option("D", "離開治療室"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "不適反應不可拖延，先停止風險再通知負責人。",
      },
    ],
  },
  {
    id: "machine-start",
    order: 3,
    title: "藥機開機方法",
    shortTitle: "藥機開機",
    audience: "藥房 / 姑娘",
    driveId: "1ssfbCkiXVBR8z4sIqvgLBBT35NquQ-Rq",
    questions: [
      {
        id: "start-q1",
        prompt: "藥機開機前較合理的第一步是？",
        options: [
          option("A", "直接開始 pack 藥"),
          option("B", "按影片示範檢查機器狀態及必要準備"),
          option("C", "跳過所有檢查"),
          option("D", "只看藥袋顏色"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "機器未準備好就開始，會增加錯藥、卡機或污染風險。",
      },
      {
        id: "start-q2",
        prompt: "如果開機時出現異常聲響或錯誤提示，應該？",
        options: [
          option("A", "繼續使用直到完成"),
          option("B", "停止並按流程通知負責人/檢查問題"),
          option("C", "拍片放群組但繼續 pack"),
          option("D", "自行拆機維修"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "異常提示不可照常運作，先停機和升級處理。",
      },
    ],
  },
  {
    id: "machine-care",
    order: 4,
    title: "藥機操作保養教學",
    shortTitle: "藥機保養",
    audience: "藥房 / 姑娘",
    driveId: "1Y-pMyVrIq_LMYkrawyT-DyrRl5z-Hb38",
    questions: [
      {
        id: "care-q1",
        prompt: "保養清潔的目的主要是？",
        options: [
          option("A", "令機器看起來新"),
          option("B", "保持機器運作穩定，減少污染/錯誤風險"),
          option("C", "節省所有覆核步驟"),
          option("D", "代替醫師處方"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥機保養是穩定和衛生要求，不是外觀整理。",
      },
      {
        id: "care-q2",
        prompt: "保養完成後，姑娘應該如何處理？",
        options: [
          option("A", "不需檢查即可使用"),
          option("B", "確認機器狀態、清潔位置及是否可安全使用"),
          option("C", "只關燈"),
          option("D", "把工具留在機器內"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "保養後仍要確認狀態，工具或污物留在機內會造成風險。",
      },
    ],
  },
  {
    id: "machine-pack",
    order: 5,
    title: "藥機pack藥準則",
    shortTitle: "藥機 Pack 藥",
    audience: "藥房 / 姑娘",
    driveId: "1lrJsv14F2Uf00SjSpgEEJUNLR5OnCqDH",
    questions: [
      {
        id: "pack-q1",
        prompt: "Pack 藥時最核心的核對原則是？",
        options: [
          option("A", "快過所有同事"),
          option("B", "按處方/藥袋/影片流程核對，避免錯藥錯量錯袋"),
          option("C", "藥粉顏色相似就可以"),
          option("D", "病人催就省略覆核"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥房流程最重要是準確，不是速度。",
      },
      {
        id: "pack-q2",
        prompt: "如發現藥袋或資料與處方不一致，應該？",
        options: [
          option("A", "照 pack 再算"),
          option("B", "停止流程並請負責人核對"),
          option("C", "自行改資料"),
          option("D", "交給病人自己判斷"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "資料不一致就是錯誤攔截點，不可自行跳過。",
      },
    ],
  },
  {
    id: "dispense",
    order: 6,
    title: "盛藥方法",
    shortTitle: "盛藥",
    audience: "藥房 / 姑娘",
    driveId: "1zV1Ze0p3iEHxpC4S9cqIu97GCslrsgAA",
    questions: [
      {
        id: "dispense-q1",
        prompt: "盛藥時最應避免的是？",
        options: [
          option("A", "按流程核對藥物"),
          option("B", "保持容器/工具清潔"),
          option("C", "不同病人或不同處方混淆"),
          option("D", "完成後覆核"),
        ],
        correctOptionId: "C",
        critical: true,
        why: "混藥或混處方屬高風險錯誤。",
      },
      {
        id: "dispense-q2",
        prompt: "盛藥完成後，下一步應該？",
        options: [
          option("A", "直接放低不標示"),
          option("B", "按影片流程核對/標示/交下一工序"),
          option("C", "叫病人自己取"),
          option("D", "把多餘藥物混回其他藥"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "交接前要有清楚標示和核對，避免下一工序接錯。",
      },
    ],
  },
  {
    id: "powder-bag",
    order: 7,
    title: "藥粉袋裝藥準則",
    shortTitle: "藥粉入袋",
    audience: "藥房 / 姑娘",
    driveId: "1eEf9xrfUZRisKH3mw_oqgNW3dQ_sDzo5",
    questions: [
      {
        id: "powder-q1",
        prompt: "藥粉入袋時，最重要確認的是？",
        options: [
          option("A", "袋口是否最美觀"),
          option("B", "藥袋、份量、病人/處方資料是否吻合"),
          option("C", "誰最快完成"),
          option("D", "是否可一次處理多個病人而不分開"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "裝袋前後都要確認身份、份量和處方，避免錯袋。",
      },
      {
        id: "powder-q2",
        prompt: "處理多位病人藥粉時，較安全的做法是？",
        options: [
          option("A", "全部藥袋放在一起，最後才分"),
          option("B", "按病人/處方分開處理，完成一份才進入下一份"),
          option("C", "只靠記憶分辨"),
          option("D", "先倒入相似藥粉再慢慢核對"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "分開處理可以減少混袋和錯量風險。",
      },
    ],
  },
  {
    id: "seal-bag",
    order: 8,
    title: "藥袋封口方法",
    shortTitle: "藥袋封口",
    audience: "藥房 / 姑娘",
    driveId: "1NhdqJklWNjtDFCBJMzVDmmqnN-3xiDce",
    questions: [
      {
        id: "seal-q1",
        prompt: "封口完成後，較安全的檢查是？",
        options: [
          option("A", "封口是否完整，藥粉是否容易漏出"),
          option("B", "只看顏色"),
          option("C", "不需檢查"),
          option("D", "把破損袋照用"),
        ],
        correctOptionId: "A",
        critical: true,
        why: "封口不完整會直接影響藥物保存和交付安全。",
      },
      {
        id: "seal-q2",
        prompt: "如發現封口不完整，應該？",
        options: [
          option("A", "照樣交出"),
          option("B", "按流程重做/更換並重新核對"),
          option("C", "用手按一下就算"),
          option("D", "交給病人提醒小心"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "品質問題要在交付前攔截和重做。",
      },
    ],
  },
  {
    id: "rack-pack",
    order: 9,
    title: "藥架包藥準則",
    shortTitle: "藥架包藥",
    audience: "藥房 / 姑娘",
    driveId: "1ZpQDOl28DKgN5jh6Nrc4jA03g7MzBhJQ",
    questions: [
      {
        id: "rack-pack-q1",
        prompt: "使用藥架包藥時，最核心目標是？",
        options: [
          option("A", "把藥袋放得好看"),
          option("B", "確保每位病人/每張處方的藥袋不混亂、不錯位"),
          option("C", "節省所有標示"),
          option("D", "讓多人同時亂放"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "藥架是防止錯袋錯位的工具，不只是收納。",
      },
      {
        id: "rack-pack-q2",
        prompt: "藥架上見到位置不清或資料不一致，應該？",
        options: [
          option("A", "照放入最近空位"),
          option("B", "停低核對，必要時請負責人確認"),
          option("C", "等下一位同事估"),
          option("D", "先包好再算"),
        ],
        correctOptionId: "B",
        critical: true,
        why: "位置不清就是錯袋前兆，要即時攔截。",
      },
    ],
  },
  {
    id: "rack-insert",
    order: 10,
    title: "藥架插藥袋方法",
    shortTitle: "插藥袋",
    audience: "藥房 / 姑娘",
    driveId: "1ry0BE2smXJXaLku5BVzaXpr-Stf_sozE",
    questions: [
      {
        id: "rack-insert-q1",
        prompt: "插藥袋時應優先跟隨甚麼？",
        options: [
          option("A", "影片示範的位置/次序/標示規則"),
          option("B", "自己習慣"),
          option("C", "任何空位都可以"),
          option("D", "按袋大小隨便排"),
        ],
        correctOptionId: "A",
        critical: true,
        why: "藥架位置和次序要一致，否則交接時容易出錯。",
      },
      {
        id: "rack-insert-q2",
        prompt: "出藥或交接前，應該做甚麼？",
        options: [
          option("A", "按流程最後核對病人/處方/藥袋/數量"),
          option("B", "只數總袋數"),
          option("C", "直接交給下一位同事不用講"),
          option("D", "等病人自己核對"),
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

function mapLatestResults(items: ApiResult[]): StoredResults {
  return items.reduce<StoredResults>((acc, item) => {
    if (!acc[item.moduleId]) {
      acc[item.moduleId] = {
        score: item.score,
        total: item.total,
        criticalErrors: item.criticalErrors,
        passed: item.passed,
        completedAt: item.completedAt,
        synced: true,
      };
    }
    return acc;
  }, {});
}

export function NurseQuizClient() {
  const [selectedItemId, setSelectedItemId] = useState(TRAINING_ITEMS[0].id);
  const [answers, setAnswers] = useState<Record<string, Record<string, OptionId>>>({});
  const [storedResults, setStoredResults] = useState<StoredResults>({});
  const [managerResults, setManagerResults] = useState<ApiResult[]>([]);
  const [syncMessage, setSyncMessage] = useState("記錄會在完成每條影片後保存");

  const selectedItem = TRAINING_ITEMS.find((item) => item.id === selectedItemId) ?? TRAINING_ITEMS[0];
  const itemAnswers = useMemo(
    () => answers[selectedItem.id] ?? {},
    [answers, selectedItem.id],
  );
  const answeredCount = Object.keys(itemAnswers).length;

  const score = useMemo(
    () =>
      selectedItem.questions.filter(
        (question) => itemAnswers[question.id] === question.correctOptionId,
      ).length,
    [itemAnswers, selectedItem.questions],
  );

  const criticalErrors = useMemo(
    () =>
      selectedItem.questions.filter(
        (question) =>
          question.critical &&
          itemAnswers[question.id] &&
          itemAnswers[question.id] !== question.correctOptionId,
      ).length,
    [itemAnswers, selectedItem.questions],
  );

  const passScore = getPassScore(selectedItem.questions.length);
  const finished = answeredCount === selectedItem.questions.length;
  const passed = finished && score >= passScore && criticalErrors === 0;
  const completedItems = TRAINING_ITEMS.filter((item) => storedResults[item.id]).length;
  const progressPercent = Math.round((answeredCount / selectedItem.questions.length) * 100);

  useEffect(() => {
    const localResults = readStoredResults();
    setStoredResults(localResults);

    let cancelled = false;

    async function loadResults() {
      try {
        const ownResponse = await fetch("/api/staff/training-results", { cache: "no-store" });
        if (ownResponse.ok) {
          const data = (await ownResponse.json()) as { items?: ApiResult[] };
          if (!cancelled && data.items?.length) {
            setStoredResults((current) => ({
              ...current,
              ...mapLatestResults(data.items || []),
            }));
          }
        }

        const managerResponse = await fetch("/api/staff/training-results?scope=all", {
          cache: "no-store",
        });
        if (managerResponse.ok) {
          const data = (await managerResponse.json()) as { items?: ApiResult[] };
          if (!cancelled) setManagerResults(data.items || []);
        }
      } catch {
        if (!cancelled) setSyncMessage("暫時只儲存在此裝置");
      }
    }

    loadResults();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveResult(
    item: TrainingItem,
    nextItemAnswers: Record<string, OptionId>,
    nextResult: StoredResult,
  ) {
    setSyncMessage("正在保存記錄...");

    try {
      const response = await fetch("/api/staff/training-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: item.id,
          moduleTitle: item.title,
          videoId: item.driveId,
          videoTitle: item.title,
          score: nextResult.score,
          total: nextResult.total,
          criticalErrors: nextResult.criticalErrors,
          passed: nextResult.passed,
          answers: nextItemAnswers,
        }),
      });

      if (!response.ok) throw new Error("Failed to save result");

      const data = (await response.json()) as { item?: ApiResult; degraded?: boolean };
      if (data.degraded || !data.item) throw new Error("Training results table is not ready");

      setStoredResults((current) => {
        const syncedResults = {
          ...current,
          [item.id]: { ...nextResult, synced: true },
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedResults));
        return syncedResults;
      });

      setManagerResults((current) => [data.item!, ...current].slice(0, 20));
      setSyncMessage("已保存到記錄");
    } catch {
      setSyncMessage("已存在此裝置；雲端記錄稍後再試");
    }
  }

  function chooseAnswer(questionId: string, optionId: OptionId) {
    if (itemAnswers[questionId]) return;

    const nextItemAnswers = {
      ...itemAnswers,
      [questionId]: optionId,
    };
    const nextAnswers = {
      ...answers,
      [selectedItem.id]: nextItemAnswers,
    };

    setAnswers(nextAnswers);

    if (Object.keys(nextItemAnswers).length === selectedItem.questions.length) {
      const finalScore = selectedItem.questions.filter(
        (question) => nextItemAnswers[question.id] === question.correctOptionId,
      ).length;
      const finalCriticalErrors = selectedItem.questions.filter(
        (question) =>
          question.critical && nextItemAnswers[question.id] !== question.correctOptionId,
      ).length;
      const nextResult: StoredResult = {
        score: finalScore,
        total: selectedItem.questions.length,
        criticalErrors: finalCriticalErrors,
        passed: finalScore >= passScore && finalCriticalErrors === 0,
        completedAt: new Date().toISOString(),
        synced: false,
      };
      const nextResults = {
        ...storedResults,
        [selectedItem.id]: nextResult,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResults));
      setStoredResults(nextResults);
      void saveResult(selectedItem, nextItemAnswers, nextResult);
    }
  }

  function resetItem() {
    const nextAnswers = { ...answers };
    delete nextAnswers[selectedItem.id];
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
              每條影片各自記分；安全題錯誤需要重溫。
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
              <span>已完成影片</span>
              <span>{completedItems}/{TRAINING_ITEMS.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${Math.round((completedItems / TRAINING_ITEMS.length) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{syncMessage}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TRAINING_ITEMS.map((item) => {
          const result = storedResults[item.id];
          const active = item.id === selectedItem.id;
          const itemPassed =
            result && result.score >= getPassScore(result.total) && result.criticalErrors === 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItemId(item.id)}
              className={`rounded-lg border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">第 {item.order} 條</span>
                {result ? (
                  itemPassed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )
                ) : null}
              </div>
              <div className="mt-2 text-sm font-semibold leading-5">{item.shortTitle}</div>
              <div className="mt-1 text-xs leading-5 text-current/65">
                {result ? `${result.score}/${result.total}` : `${item.questions.length} 題`}
              </div>
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
                  {selectedItem.audience}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  第 {selectedItem.order} 條
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
                  {passScore}/{selectedItem.questions.length} 合格
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
                {selectedItem.title}
              </h2>
            </div>

            <div className="p-5">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                <iframe
                  title={`播放影片：${selectedItem.title}`}
                  src={`https://drive.google.com/file/d/${selectedItem.driveId}/preview`}
                  className="aspect-video w-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {selectedItem.questions.map((question, questionIndex) => {
              const selectedAnswer = itemAnswers[question.id];
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
                    {question.options.map((answerOption) => {
                      const selected = selectedAnswer === answerOption.id;
                      const isCorrectOption = answerOption.id === question.correctOptionId;
                      const showCorrect = answered && isCorrectOption;
                      const showWrong = answered && selected && !isCorrectOption;

                      return (
                        <button
                          key={answerOption.id}
                          type="button"
                          onClick={() => chooseAnswer(question.id, answerOption.id)}
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
                              {answerOption.id}
                            </span>
                            <span className="min-w-0 font-semibold leading-6">
                              {answerOption.text}
                            </span>
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
              本條進度
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-500">已完成</span>
              <span className="text-xl font-semibold text-slate-950">
                {answeredCount}/{selectedItem.questions.length}
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
                  {score}/{selectedItem.questions.length}
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
                  {passed ? "本條合格" : "需要主管覆核"}
                </div>
                <p className="mt-2">
                  {passed
                    ? "分數已記錄。"
                    : `${passScore}/${selectedItem.questions.length} 或以上且安全題無錯才合格。`}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={resetItem}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
            >
              <RotateCcw className="h-4 w-4" />
              重做本條
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PlayCircle className="h-4 w-4 text-emerald-700" />
              我的記分
            </div>
            <div className="mt-4 space-y-2">
              {TRAINING_ITEMS.map((item) => {
                const result = storedResults[item.id];

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-slate-700">
                      {item.order}. {item.shortTitle}
                    </span>
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

          {managerResults.length > 0 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <History className="h-4 w-4 text-emerald-700" />
                最近員工記錄
              </div>
              <div className="mt-4 space-y-2">
                {managerResults.slice(0, 8).map((result, index) => (
                  <div
                    key={result.id || `${result.staffEmail}-${result.moduleId}-${index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-semibold text-slate-800">
                        {result.staffEmail || "staff"}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {result.score}/{result.total}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="min-w-0 truncate">{result.moduleTitle}</span>
                      <span className="shrink-0">{formatDate(result.completedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
