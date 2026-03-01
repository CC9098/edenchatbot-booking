import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_FILE_BYTES = 15 * 1024 * 1024;

const TRANSCRIPTION_PROMPT = [
  "你是中醫門診的語音轉錄助手。",
  "請把這段廣東話問診錄音，完整轉成繁體中文逐字稿。",
  "要求：",
  "1) 保留關鍵症狀、時間、嚴重程度、誘因、緩解因素。",
  "2) 不要翻譯成書面普通話；盡量貼近原句意思。",
  "3) 不要自行加診斷。",
  "4) 聽不清楚的位置用 [聽不清] 標示。",
  "5) 只輸出逐字稿文字，不要加說明。",
].join("\n");

const EXTRACTION_PROMPT = [
  "你是中醫病歷整理助手。",
  "你會收到一段問診逐字稿，請只抽取可入病歷的「症狀資訊」，不要輸出診斷，不要加未提及內容。",
  "請只輸出 JSON，格式如下：",
  "{",
  '  "chiefComplaint": "string",',
  '  "presentIllnessSummary": "string",',
  '  "associatedSymptoms": ["string"],',
  '  "negativeSymptoms": ["string"],',
  '  "durationAndCourse": "string",',
  '  "otherRecordableFindings": ["string"],',
  '  "verificationItems": ["string"]',
  "}",
  "規則：",
  "1) 內容用繁體中文（香港用語）。",
  "2) 若逐字稿沒提及，字串填空字串，陣列填空陣列。",
  "3) 請去除寒暄、與症狀無關內容。",
  "4) 只取症狀、病程、加重/緩解因素、否認症狀。",
].join("\n");

interface SymptomExtraction {
  chiefComplaint: string;
  presentIllnessSummary: string;
  associatedSymptoms: string[];
  negativeSymptoms: string[];
  durationAndCourse: string;
  otherRecordableFindings: string[];
  verificationItems: string[];
}

interface PatientContext {
  patientUserId: string;
  patientDisplayName: string;
  patientPhone: string;
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

function sanitizeText(value: unknown, maxLength = 800): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeList(value: unknown, maxItems = 12, maxItemLength = 180): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeFormText(value: FormDataEntryValue | null, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function buildPatientHeader(patient: PatientContext): string[] {
  return [
    `病人ID：${patient.patientUserId || "未提供"}`,
    `病人姓名：${patient.patientDisplayName || "未提供"}`,
    `病人電話：${patient.patientPhone || "未提供"}`,
  ];
}

function normalizeExtraction(data: Record<string, unknown> | null): SymptomExtraction {
  if (!data) {
    return {
      chiefComplaint: "",
      presentIllnessSummary: "",
      associatedSymptoms: [],
      negativeSymptoms: [],
      durationAndCourse: "",
      otherRecordableFindings: [],
      verificationItems: [],
    };
  }

  return {
    chiefComplaint: sanitizeText(data.chiefComplaint, 240),
    presentIllnessSummary: sanitizeText(data.presentIllnessSummary, 1200),
    associatedSymptoms: sanitizeList(data.associatedSymptoms),
    negativeSymptoms: sanitizeList(data.negativeSymptoms),
    durationAndCourse: sanitizeText(data.durationAndCourse, 500),
    otherRecordableFindings: sanitizeList(data.otherRecordableFindings),
    verificationItems: sanitizeList(data.verificationItems),
  };
}

function formatList(items: string[]): string {
  if (items.length === 0) return "未明確提及";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildRecordText(extraction: SymptomExtraction, patient: PatientContext): string {
  const patientHeader = buildPatientHeader(patient);
  return [
    ...patientHeader,
    "",
    `主訴：${extraction.chiefComplaint || "未明確提及"}`,
    "",
    `現病史摘要：${extraction.presentIllnessSummary || "未明確提及"}`,
    "",
    `伴隨症狀：\n${formatList(extraction.associatedSymptoms)}`,
    "",
    `否認症狀：\n${formatList(extraction.negativeSymptoms)}`,
    "",
    `病程/時長：${extraction.durationAndCourse || "未明確提及"}`,
    "",
    `其他可記錄觀察：\n${formatList(extraction.otherRecordableFindings)}`,
    "",
    `待醫師確認：\n${formatList(extraction.verificationItems)}`,
  ].join("\n");
}

function getModelName(): string {
  return process.env.GEMINI_DOCTOR_VOICE_MODEL || "gemini-flash-latest";
}

async function transcribeAudio(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  mimeType: string,
  audioBase64: string
): Promise<string> {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIPTION_PROMPT },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
    },
  });

  return result.response.text().trim();
}

async function extractSymptoms(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  transcript: string,
  patient: PatientContext
): Promise<SymptomExtraction> {
  const patientBlock = buildPatientHeader(patient).join("\n");
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${EXTRACTION_PROMPT}\n\n【病人資料】\n${patientBlock}\n【病人資料結束】\n\n【逐字稿開始】\n${transcript}\n【逐字稿結束】`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
    },
  });

  const rawText = result.response.text();
  const parsed = parseJsonObject(rawText);
  return normalizeExtraction(parsed);
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const patientContext: PatientContext = {
      patientUserId: sanitizeFormText(formData.get("patientUserId"), 80),
      patientDisplayName: sanitizeFormText(formData.get("patientDisplayName"), 120),
      patientPhone: sanitizeFormText(formData.get("patientPhone"), 40),
    };

    if (!patientContext.patientUserId) {
      return NextResponse.json({ error: "patientUserId is required" }, { status: 400 });
    }

    const audioInput = formData.get("audio");
    if (!(audioInput instanceof File)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    if (!audioInput.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio files are supported" }, { status: 400 });
    }

    if (audioInput.size <= 0) {
      return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
    }

    if (audioInput.size > MAX_AUDIO_FILE_BYTES) {
      return NextResponse.json(
        { error: "錄音檔太大（上限 15MB），請縮短錄音時間後重試" },
        { status: 413 }
      );
    }

    const audioBuffer = Buffer.from(await audioInput.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");
    const mimeType = audioInput.type;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getModelName() });

    const transcript = await transcribeAudio(model, mimeType, audioBase64);
    if (!transcript) {
      return NextResponse.json({ error: "轉錄結果為空，請重試" }, { status: 502 });
    }

    const extraction = await extractSymptoms(model, transcript, patientContext);
    const recordText = buildRecordText(extraction, patientContext);

    return NextResponse.json({
      patient: patientContext,
      transcript,
      extraction,
      recordText,
      model: getModelName(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/doctor/voice-notes] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
