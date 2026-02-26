import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth-helpers';
import { logSymptom } from '@/lib/symptom-conversation-helpers';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const CONFIRM_SYMPTOM_SCHEMA = z.object({
  draft: z.object({
    category: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(500).optional(),
    severity: z.number().int().min(1).max(5).optional(),
    startedAt: z.string().regex(DATE_REGEX),
    endedAt: z.string().regex(DATE_REGEX).optional(),
    resolutionMethod: z.string().trim().min(1).max(120).optional(),
    resolutionNote: z.string().trim().min(1).max(500).optional(),
    resolutionDays: z.number().int().min(0).max(365).optional(),
  }),
});

const INVALID_JSON_MESSAGE = 'Request body must be valid JSON.';
const INVALID_PAYLOAD_MESSAGE = 'Invalid request payload.';
const INTERNAL_ERROR_MESSAGE = 'Failed to confirm symptom.';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '需要登入才能記錄症狀' }, { status: 401 });
    }

    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: INVALID_JSON_MESSAGE, code: 'CHAT_V2_CONFIRM_SYMPTOM_INVALID_JSON' },
        { status: 400 },
      );
    }

    const parsed = CONFIRM_SYMPTOM_SCHEMA.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: INVALID_PAYLOAD_MESSAGE,
          code: 'CHAT_V2_CONFIRM_SYMPTOM_INVALID_PAYLOAD',
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const draft = parsed.data.draft;
    if (draft.endedAt && draft.endedAt < draft.startedAt) {
      return NextResponse.json(
        {
          error: '結束日期不可早於開始日期',
          code: 'CHAT_V2_CONFIRM_SYMPTOM_INVALID_DATE_RANGE',
        },
        { status: 400 },
      );
    }

    const saveResult = await logSymptom(user.id, draft);
    if (!saveResult.success) {
      return NextResponse.json(
        {
          error: saveResult.error || INTERNAL_ERROR_MESSAGE,
          code: 'CHAT_V2_CONFIRM_SYMPTOM_SAVE_FAILED',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      symptomId: saveResult.symptomId || null,
    });
  } catch (error) {
    console.error('[chat/v2/confirm-symptom] Error:', error);
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE, code: 'CHAT_V2_CONFIRM_SYMPTOM_INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
