import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  getCurrentUser,
  requirePatientAccess,
  requireStaffRole,
} from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ALLOWED_ANSWER_TYPES = ["yes_no", "scale_0_10", "trend", "frequency", "free_text"] as const;

type SuggestionAnswerType = (typeof ALLOWED_ANSWER_TYPES)[number];

interface PatientQuestionContext {
  patientIdentity: {
    displayName: string | null;
    phone: string | null;
  };
  careProfile: {
    constitution: string;
    constitutionNote: string | null;
    doctorAssessmentLevel: string | null;
    doctorAssessmentConstitution: string | null;
  } | null;
  activeInstructions: Array<{
    title: string;
    instructionType: string;
    contentMd: string;
  }>;
  pendingFollowUps: Array<{
    suggestedDate: string;
    reason: string | null;
  }>;
  recentSymptoms: Array<{
    category: string;
    description: string | null;
    severity: number | null;
    status: string;
    startedAt: string;
  }>;
}

interface SuggestionCard {
  id: string;
  question: string;
  answerType: SuggestionAnswerType;
  symptomKey: string;
  reason: string;
  note: string;
}

interface SuggestionPayload {
  summary: string;
  suggestions: SuggestionCard[];
}

function sanitizeText(value: unknown, maxLength = 280): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeAnswerType(value: unknown): SuggestionAnswerType {
  return ALLOWED_ANSWER_TYPES.find((type) => type === value) || "free_text";
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "follow-up";
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  const candidates: string[] = [trimmed];

  if (trimmed.startsWith("```")) {
    candidates.push(
      trimmed
        .replace(/^```[a-zA-Z]*\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    );
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep trying
    }
  }

  return null;
}

function normalizeSuggestionCard(raw: unknown, index: number): SuggestionCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const card = raw as Record<string, unknown>;
  const question = sanitizeText(card.question, 180);
  if (!question) return null;

  const symptomKey = sanitizeText(card.symptomKey, 80) || `suggestion-${index + 1}`;
  return {
    id: `${slugify(symptomKey)}-${index + 1}`,
    question,
    answerType: sanitizeAnswerType(card.answerType),
    symptomKey,
    reason: sanitizeText(card.reason, 160),
    note: sanitizeText(card.note, 160),
  };
}

function normalizeSuggestionPayload(rawText: string): SuggestionPayload | null {
  const parsed = parseJsonObject(rawText);
  if (!parsed) return null;

  const summary = sanitizeText(parsed.summary, 220);
  const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const suggestions = rawSuggestions
    .map((item, index) => normalizeSuggestionCard(item, index))
    .filter((item): item is SuggestionCard => Boolean(item))
    .slice(0, 6);

  if (suggestions.length === 0) return null;

  return {
    summary,
    suggestions,
  };
}

function symptomStatusLabel(status: string): string {
  if (status === "active") return "進行中";
  if (status === "resolved") return "已好返";
  if (status === "recurring") return "反覆出現";
  return status || "未標示";
}

function buildSymptomQuestion(symptom: PatientQuestionContext["recentSymptoms"][number]): SuggestionCard {
  const symptomName = sanitizeText(symptom.category, 80) || "症狀";
  const answerType: SuggestionAnswerType = symptom.severity ? "scale_0_10" : "trend";
  const question =
    answerType === "scale_0_10"
      ? `你而家仲有${symptomName}嗎？如果 10 分最嚴重，依家大概幾多分？`
      : `${symptomName}比上次係好咗、無變，定惡化咗？`;

  return {
    id: `${slugify(symptomName)}-symptom`,
    question,
    answerType,
    symptomKey: symptomName,
    reason: `最近症狀記錄：${symptomName}，${symptomStatusLabel(symptom.status)}。`,
    note: "可再追問持續時間、誘因、緩解因素。",
  };
}

function constitutionFallbackQuestions(constitution: string | null | undefined): SuggestionCard[] {
  if (constitution === "depleting") {
    return [
      {
        id: "sleep-energy",
        question: "最近睡眠同精神點樣？朝早起身有冇特別攰？",
        answerType: "trend",
        symptomKey: "sleep-energy",
        reason: "體質偏虛耗型，先跟進睡眠與體力變化。",
        note: "若病人話攰，可再問氣短、心悸、出汗。",
      },
    ];
  }

  if (constitution === "crossing") {
    return [
      {
        id: "stress-head",
        question: "近排頭脹、胸悶或者情緒繃緊有冇再出現？",
        answerType: "trend",
        symptomKey: "stress-head",
        reason: "體質偏交錯型，宜先追問氣機不舒相關症狀。",
        note: "可再問與壓力、經期、睡眠有無關係。",
      },
    ];
  }

  if (constitution === "hoarding") {
    return [
      {
        id: "appetite-bowel",
        question: "胃口、大便同身體困重感而家點樣？",
        answerType: "trend",
        symptomKey: "appetite-bowel",
        reason: "體質偏屯積型，宜先問消化與痰濕表現。",
        note: "可再問腹脹、口黏、痰多、便黏。",
      },
    ];
  }

  return [
    {
      id: "main-concern",
      question: "今日最困擾你嘅症狀，和上次相比係好咗定差咗？",
      answerType: "trend",
      symptomKey: "main-concern",
      reason: "病歷脈絡未夠完整，先問主訴變化。",
      note: "之後再補問分數、時間、誘因。",
    },
  ];
}

function buildFallbackSuggestions(context: PatientQuestionContext): SuggestionPayload {
  const suggestions: SuggestionCard[] = [];

  for (const symptom of context.recentSymptoms.slice(0, 3)) {
    suggestions.push(buildSymptomQuestion(symptom));
  }

  if (context.pendingFollowUps[0]) {
    const followUp = context.pendingFollowUps[0];
    suggestions.push({
      id: "follow-up-plan",
      question: `上次交代嘅覆診重點，病人而家跟進成點？${followUp.reason ? `特別係「${sanitizeText(followUp.reason, 50)}」` : ""}`,
      answerType: "trend",
      symptomKey: "follow-up-plan",
      reason: `有待跟進計劃：${followUp.suggestedDate || "未有日期"}`,
      note: "可補問有冇中斷、是否已安排覆診。",
    });
  }

  if (context.activeInstructions[0]) {
    const instruction = context.activeInstructions[0];
    suggestions.push({
      id: "instruction-response",
      question: `最近跟住「${sanitizeText(instruction.title, 40)}」之後，症狀有冇明顯變化？`,
      answerType: "trend",
      symptomKey: "instruction-response",
      reason: "病人目前有生效中護理指引，可直接問執行後反應。",
      note: "若病人無跟，可再問阻礙點。",
    });
  }

  suggestions.push(...constitutionFallbackQuestions(context.careProfile?.constitution));

  const uniqueSuggestions = suggestions.filter(
    (item, index, list) => list.findIndex((candidate) => candidate.question === item.question) === index
  );

  const finalSuggestions = uniqueSuggestions.slice(0, 6);
  const symptomNames = context.recentSymptoms
    .map((symptom) => sanitizeText(symptom.category, 40))
    .filter(Boolean)
    .slice(0, 3);

  const summary =
    symptomNames.length > 0
      ? `建議先跟進 ${symptomNames.join("、")} 嘅變化，再補問分數、誘因同治療反應。`
      : "目前病歷資料較少，建議先確認今次主訴，再補問睡眠、胃口、大便與痛感分數。";

  return {
    summary,
    suggestions: finalSuggestions,
  };
}

function mergeSuggestions(primary: SuggestionCard[], fallback: SuggestionCard[]): SuggestionCard[] {
  const merged: SuggestionCard[] = [];
  const seenQuestions = new Set<string>();

  for (const suggestion of [...primary, ...fallback]) {
    const key = suggestion.question.trim();
    if (!key || seenQuestions.has(key)) continue;
    seenQuestions.add(key);
    merged.push(suggestion);
    if (merged.length >= 6) break;
  }

  return merged;
}

function buildContextPrompt(patientUserId: string, context: PatientQuestionContext): string {
  const symptomsBlock =
    context.recentSymptoms.length > 0
      ? context.recentSymptoms
          .map(
            (symptom, index) =>
              `${index + 1}. 類別：${symptom.category}；狀態：${symptomStatusLabel(symptom.status)}；嚴重度：${symptom.severity ?? "未標示"}/5；開始：${symptom.startedAt}；描述：${symptom.description || "（無）"}`
          )
          .join("\n")
      : "（暫無最近症狀）";

  const instructionsBlock =
    context.activeInstructions.length > 0
      ? context.activeInstructions
          .slice(0, 4)
          .map(
            (instruction, index) =>
              `${index + 1}. ${instruction.title}｜${instruction.instructionType}｜${sanitizeText(instruction.contentMd, 80)}`
          )
          .join("\n")
      : "（暫無生效中護理指引）";

  const followUpsBlock =
    context.pendingFollowUps.length > 0
      ? context.pendingFollowUps
          .slice(0, 3)
          .map(
            (followUp, index) =>
              `${index + 1}. 日期：${followUp.suggestedDate}；原因：${followUp.reason || "（無）"}`
          )
          .join("\n")
      : "（暫無待跟進覆診）";

  const constitutionBlock = context.careProfile
    ? `體質：${context.careProfile.constitution || "unknown"}\n醫師判定：${context.careProfile.doctorAssessmentLevel || "未設定"}\n醫師備註體質：${context.careProfile.doctorAssessmentConstitution || "（無）"}\n備註：${context.careProfile.constitutionNote || "（無）"}`
    : "（暫無體質評估）";

  return [
    "你是中醫門診問診助手。",
    "請按以下病人資料，為醫師產生 3 至 6 張『簡短、可直接口問』的跟進問題卡。",
    "只可根據已知資料提出追問，不要加入新診斷，不要臆測化驗結果。",
    "優先追問：症狀是否仍在、0-10 分、比上次好轉/無變/惡化、頻率、誘因、緩解因素、睡眠/胃口/大便等相關項目。",
    "問題語氣要用香港繁體中文，夠口語、夠直接，例如：『你而家仲有頭痛嗎？如果 10 分最痛，依家幾多分？』",
    "只輸出 JSON，格式如下：",
    "{",
    '  "summary": "string",',
    '  "suggestions": [',
    "    {",
    '      "question": "string",',
    '      "answerType": "yes_no|scale_0_10|trend|frequency|free_text",',
    '      "symptomKey": "string",',
    '      "reason": "string",',
    '      "note": "string"',
    "    }",
    "  ]",
    "}",
    "規則：",
    "1) summary 只需一句，提示醫師先問咩。",
    "2) 每條 question 最多 40 字左右，夠醫師即問。",
    "3) answerType 只可使用指定值。",
    "4) reason 係俾醫師睇，說明點解要問。",
    "5) note 係一句短提示，說明答完可再點追問。",
    "6) 若資料不足，可以問主訴、睡眠、胃口、大便，但仍要貼近病人已知脈絡。",
    `\n【病人 ID】\n${patientUserId}`,
    `\n【病人稱呼】\n${context.patientIdentity.displayName || "未提供"}`,
    `\n【體質】\n${constitutionBlock}`,
    `\n【最近症狀】\n${symptomsBlock}`,
    `\n【護理指引】\n${instructionsBlock}`,
    `\n【待跟進覆診】\n${followUpsBlock}`,
  ].join("\n");
}

function getModelName(): string {
  return process.env.GEMINI_DOCTOR_QUESTION_MODEL || "gemini-flash-latest";
}

async function generateAiSuggestions(
  apiKey: string,
  patientUserId: string,
  context: PatientQuestionContext
): Promise<SuggestionPayload | null> {
  const prompt = buildContextPrompt(patientUserId, context);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: getModelName() });
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  return normalizeSuggestionPayload(result.response.text());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { patientUserId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const { patientUserId } = params;
    await requirePatientAccess(user.id, patientUserId);

    const supabase = createServiceClient();

    const [profileResult, bookingResult, careProfileResult, instructionsResult, followUpsResult, symptomsResult] =
      await Promise.all([
        supabase.from("profiles").select("display_name, phone").eq("id", patientUserId).maybeSingle(),
        supabase
          .from("booking_intake")
          .select("patient_name, phone, created_at")
          .eq("user_id", patientUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("patient_care_profile")
          .select(
            "constitution, constitution_note, doctor_assessment_level, doctor_assessment_constitution"
          )
          .eq("patient_user_id", patientUserId)
          .maybeSingle(),
        supabase
          .from("care_instructions")
          .select("title, instruction_type, content_md")
          .eq("patient_user_id", patientUserId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("follow_up_plans")
          .select("suggested_date, reason")
          .eq("patient_user_id", patientUserId)
          .eq("status", "pending")
          .order("suggested_date", { ascending: true })
          .limit(3),
        supabase
          .from("symptom_logs")
          .select("category, description, severity, status, started_at")
          .eq("patient_user_id", patientUserId)
          .order("started_at", { ascending: false })
          .limit(6),
      ]);

    if (profileResult.error || careProfileResult.error || instructionsResult.error || followUpsResult.error || symptomsResult.error) {
      console.error("[GET patient question suggestions] query error:", {
        profile: profileResult.error?.message,
        careProfile: careProfileResult.error?.message,
        instructions: instructionsResult.error?.message,
        followUps: followUpsResult.error?.message,
        symptoms: symptomsResult.error?.message,
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (bookingResult.error) {
      console.error("[GET patient question suggestions] booking warning:", bookingResult.error.message);
    }

    const context: PatientQuestionContext = {
      patientIdentity: {
        displayName: profileResult.data?.display_name || bookingResult.data?.patient_name || null,
        phone: profileResult.data?.phone || bookingResult.data?.phone || null,
      },
      careProfile: careProfileResult.data
        ? {
            constitution: careProfileResult.data.constitution,
            constitutionNote: careProfileResult.data.constitution_note,
            doctorAssessmentLevel: careProfileResult.data.doctor_assessment_level,
            doctorAssessmentConstitution: careProfileResult.data.doctor_assessment_constitution,
          }
        : null,
      activeInstructions: (instructionsResult.data || []).map((instruction) => ({
        title: instruction.title,
        instructionType: instruction.instruction_type,
        contentMd: instruction.content_md,
      })),
      pendingFollowUps: (followUpsResult.data || []).map((followUp) => ({
        suggestedDate: followUp.suggested_date,
        reason: followUp.reason,
      })),
      recentSymptoms: (symptomsResult.data || []).map((symptom) => ({
        category: symptom.category,
        description: symptom.description,
        severity: symptom.severity,
        status: symptom.status,
        startedAt: symptom.started_at,
      })),
    };

    const fallbackPayload = buildFallbackSuggestions(context);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ...fallbackPayload,
        usedFallback: true,
        model: null,
        generatedAt: new Date().toISOString(),
      });
    }

    try {
      const aiPayload = await generateAiSuggestions(apiKey, patientUserId, context);
      if (!aiPayload) {
        return NextResponse.json({
          ...fallbackPayload,
          usedFallback: true,
          model: getModelName(),
          generatedAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        summary: aiPayload.summary || fallbackPayload.summary,
        suggestions: mergeSuggestions(aiPayload.suggestions, fallbackPayload.suggestions),
        usedFallback: false,
        model: getModelName(),
        generatedAt: new Date().toISOString(),
      });
    } catch (aiError) {
      console.error("[GET patient question suggestions] ai error:", aiError);
      return NextResponse.json({
        ...fallbackPayload,
        usedFallback: true,
        model: getModelName(),
        generatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET patient question suggestions] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
