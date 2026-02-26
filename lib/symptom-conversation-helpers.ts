/**
 * Symptom Conversation Helpers
 *
 * These functions are designed to be called by Gemini AI via Function Calling
 * to enable symptom logging and tracking in the chat interface.
 */

import { createServiceClient } from '@/lib/supabase';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(['active', 'resolved', 'recurring']);
const RESOLUTION_METHOD_MAX = 120;
const RESOLUTION_NOTE_MAX = 500;
const RESOLUTION_DAYS_MIN = 0;
const RESOLUTION_DAYS_MAX = 365;

// ---------------------------------------------------------------------------
// 1. Log Symptom
// ---------------------------------------------------------------------------

export interface LogSymptomRequest {
  category: string;
  description?: string | null;
  severity?: number | null; // 1-5
  startedAt: string; // YYYY-MM-DD
  endedAt?: string | null;  // YYYY-MM-DD
  resolutionMethod?: string | null;
  resolutionNote?: string | null;
  resolutionDays?: number | string | null;
}

/**
 * Log a new symptom for the patient
 */
export async function logSymptom(
  userId: string,
  request: LogSymptomRequest
): Promise<{
  success: boolean;
  symptomId?: string;
  error?: string;
}> {
  try {
    // Validate required fields
    if (!request.category || typeof request.category !== 'string' || !request.category.trim()) {
      return { success: false, error: '症狀類別為必填' };
    }

    if (!request.startedAt || typeof request.startedAt !== 'string') {
      return { success: false, error: '開始日期為必填' };
    }

    // Validate date format
    if (!DATE_REGEX.test(request.startedAt)) {
      return { success: false, error: '開始日期格式無效，請使用 YYYY-MM-DD' };
    }

    const normalizedEndedAt =
      request.endedAt === undefined || request.endedAt === null || request.endedAt === ''
        ? undefined
        : request.endedAt;

    if (normalizedEndedAt !== undefined) {
      if (typeof normalizedEndedAt !== 'string' || !DATE_REGEX.test(normalizedEndedAt)) {
        return { success: false, error: '結束日期格式無效，請使用 YYYY-MM-DD' };
      }
      if (normalizedEndedAt < request.startedAt) {
        return { success: false, error: '結束日期不可早於開始日期' };
      }
    }

    // Validate severity
    if (request.severity !== undefined && request.severity !== null) {
      if (!Number.isInteger(request.severity) || request.severity < 1 || request.severity > 5) {
        return { success: false, error: '嚴重程度必須介於 1-5 之間' };
      }
    }

    if (
      request.description !== undefined &&
      request.description !== null &&
      typeof request.description !== 'string'
    ) {
      return { success: false, error: '症狀描述格式無效' };
    }

    const normalizedResolutionMethod =
      request.resolutionMethod === undefined ||
      request.resolutionMethod === null ||
      request.resolutionMethod === ''
        ? null
        : request.resolutionMethod;

    if (
      normalizedResolutionMethod !== null &&
      (typeof normalizedResolutionMethod !== 'string' ||
        !normalizedResolutionMethod.trim() ||
        normalizedResolutionMethod.trim().length > RESOLUTION_METHOD_MAX)
    ) {
      return { success: false, error: `好返方式長度不可超過 ${RESOLUTION_METHOD_MAX} 字` };
    }

    const normalizedResolutionNote =
      request.resolutionNote === undefined ||
      request.resolutionNote === null ||
      request.resolutionNote === ''
        ? null
        : request.resolutionNote;

    if (
      normalizedResolutionNote !== null &&
      (typeof normalizedResolutionNote !== 'string' ||
        normalizedResolutionNote.trim().length > RESOLUTION_NOTE_MAX)
    ) {
      return { success: false, error: `好返補充長度不可超過 ${RESOLUTION_NOTE_MAX} 字` };
    }

    let normalizedResolutionDays: number | null = null;
    if (request.resolutionDays !== undefined && request.resolutionDays !== null && request.resolutionDays !== '') {
      const parsedDays =
        typeof request.resolutionDays === 'number'
          ? request.resolutionDays
          : Number.parseInt(String(request.resolutionDays), 10);
      if (
        !Number.isInteger(parsedDays) ||
        parsedDays < RESOLUTION_DAYS_MIN ||
        parsedDays > RESOLUTION_DAYS_MAX
      ) {
        return {
          success: false,
          error: `好返天數必須介乎 ${RESOLUTION_DAYS_MIN}-${RESOLUTION_DAYS_MAX}`,
        };
      }
      normalizedResolutionDays = parsedDays;
    }

    const hasResolutionDetails =
      normalizedResolutionMethod !== null ||
      normalizedResolutionNote !== null ||
      normalizedResolutionDays !== null;
    if (hasResolutionDetails && !normalizedEndedAt) {
      return { success: false, error: '提供好返資料時必須同時提供 endedAt' };
    }

    const supabase = createServiceClient();

    // Prepare insert data
    const insertData: Record<string, unknown> = {
      patient_user_id: userId,
      category: request.category.trim(),
      status: 'active',
      started_at: request.startedAt,
      logged_via: 'chat',
    };

    if (typeof request.description === 'string' && request.description.trim()) {
      insertData.description = request.description.trim();
    }

    if (request.severity !== undefined && request.severity !== null) {
      insertData.severity = request.severity;
    }

    if (normalizedEndedAt) {
      insertData.ended_at = normalizedEndedAt;
      insertData.status = 'resolved'; // If ended_at is provided, mark as resolved
      if (normalizedResolutionMethod !== null) {
        insertData.resolution_method = normalizedResolutionMethod.trim();
      }
      if (normalizedResolutionNote !== null) {
        insertData.resolution_note = normalizedResolutionNote.trim() || null;
      }
      if (normalizedResolutionDays !== null) {
        insertData.resolution_days = normalizedResolutionDays;
      }
    }

    // Insert symptom log
    const { data: inserted, error: insertError } = await supabase
      .from('symptom_logs')
      .insert(insertData)
      .select('id, patient_user_id, category, description, severity, status, started_at, ended_at, resolution_method, resolution_note, resolution_days, logged_via, created_at')
      .single();

    if (insertError) {
      console.error('[logSymptom] insert error:', insertError.message);
      return { success: false, error: '記錄症狀時發生錯誤' };
    }

    // Write audit log
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      patient_user_id: userId,
      entity: 'symptom_logs',
      entity_id: inserted.id,
      action: 'insert',
      before_json: null,
      after_json: inserted,
    });

    if (auditError) {
      console.error('[logSymptom] audit log error:', auditError.message);
      // Don't fail the operation if audit log fails
    }

    return {
      success: true,
      symptomId: inserted.id,
    };
  } catch (error) {
    console.error('[logSymptom] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '記錄症狀時發生錯誤',
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Update Symptom
// ---------------------------------------------------------------------------

export interface UpdateSymptomRequest {
  symptomId: string;
  endedAt?: string | null;    // YYYY-MM-DD
  status?: 'resolved' | 'recurring' | 'active';
  severity?: number | null;   // 1-5
  description?: string | null;
  resolutionMethod?: string | null;
  resolutionNote?: string | null;
  resolutionDays?: number | string | null;
}

/**
 * Update an existing symptom (usually to mark it as resolved)
 */
export async function updateSymptom(
  userId: string,
  request: UpdateSymptomRequest
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!request.symptomId || typeof request.symptomId !== 'string') {
      return { success: false, error: '症狀 ID 為必填' };
    }

    const supabase = createServiceClient();

    // Fetch existing symptom
    const { data: existing, error: fetchError } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('id', request.symptomId)
      .eq('patient_user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[updateSymptom] fetch error:', fetchError.message);
      return { success: false, error: '查詢症狀時發生錯誤' };
    }

    if (!existing) {
      return { success: false, error: '找不到此症狀記錄' };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (request.endedAt !== undefined) {
      if (request.endedAt === null || request.endedAt === '') {
        updateData.ended_at = null;
      } else {
        if (typeof request.endedAt !== 'string' || !DATE_REGEX.test(request.endedAt)) {
          return { success: false, error: '結束日期格式無效，請使用 YYYY-MM-DD' };
        }
        if (request.endedAt < existing.started_at) {
          return { success: false, error: '結束日期不可早於開始日期' };
        }
        updateData.ended_at = request.endedAt;
      }

      // If endedAt is provided and status not explicitly set, mark as resolved
      if (request.endedAt && !request.status) {
        updateData.status = 'resolved';
      }
    }

    if (request.status !== undefined) {
      if (typeof request.status !== 'string' || !VALID_STATUSES.has(request.status)) {
        return { success: false, error: '無效的症狀狀態' };
      }
      updateData.status = request.status;
    }

    if (request.severity !== undefined) {
      if (request.severity === null) {
        updateData.severity = null;
      } else if (!Number.isInteger(request.severity) || request.severity < 1 || request.severity > 5) {
        return { success: false, error: '嚴重程度必須介於 1-5 之間' };
      } else {
        updateData.severity = request.severity;
      }
    }

    if (request.description !== undefined) {
      if (request.description !== null && typeof request.description !== 'string') {
        return { success: false, error: '症狀描述格式無效' };
      }
      updateData.description =
        typeof request.description === 'string' ? request.description.trim() || null : null;
    }

    if (request.resolutionMethod !== undefined) {
      if (request.resolutionMethod === null || request.resolutionMethod === '') {
        updateData.resolution_method = null;
      } else if (
        typeof request.resolutionMethod !== 'string' ||
        !request.resolutionMethod.trim() ||
        request.resolutionMethod.trim().length > RESOLUTION_METHOD_MAX
      ) {
        return { success: false, error: `好返方式長度不可超過 ${RESOLUTION_METHOD_MAX} 字` };
      } else {
        updateData.resolution_method = request.resolutionMethod.trim();
      }
    }

    if (request.resolutionNote !== undefined) {
      if (request.resolutionNote === null || request.resolutionNote === '') {
        updateData.resolution_note = null;
      } else if (
        typeof request.resolutionNote !== 'string' ||
        request.resolutionNote.trim().length > RESOLUTION_NOTE_MAX
      ) {
        return { success: false, error: `好返補充長度不可超過 ${RESOLUTION_NOTE_MAX} 字` };
      } else {
        updateData.resolution_note = request.resolutionNote.trim() || null;
      }
    }

    if (request.resolutionDays !== undefined) {
      if (request.resolutionDays === null || request.resolutionDays === '') {
        updateData.resolution_days = null;
      } else {
        const parsedDays =
          typeof request.resolutionDays === 'number'
            ? request.resolutionDays
            : Number.parseInt(String(request.resolutionDays), 10);
        if (
          !Number.isInteger(parsedDays) ||
          parsedDays < RESOLUTION_DAYS_MIN ||
          parsedDays > RESOLUTION_DAYS_MAX
        ) {
          return {
            success: false,
            error: `好返天數必須介乎 ${RESOLUTION_DAYS_MIN}-${RESOLUTION_DAYS_MAX}`,
          };
        }
        updateData.resolution_days = parsedDays;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: '沒有需要更新的資料' };
    }

    const nextStatus = (updateData.status as string | undefined) ?? existing.status;
    const nextEndedAt =
      Object.prototype.hasOwnProperty.call(updateData, 'ended_at')
        ? (updateData.ended_at as string | null)
        : existing.ended_at;
    if (nextStatus === 'active' && nextEndedAt) {
      return { success: false, error: '進行中症狀不能有結束日期，請先將 endedAt 設為 null' };
    }

    const nextResolutionMethod =
      Object.prototype.hasOwnProperty.call(updateData, 'resolution_method')
        ? (updateData.resolution_method as string | null)
        : (existing.resolution_method as string | null);
    const nextResolutionNote =
      Object.prototype.hasOwnProperty.call(updateData, 'resolution_note')
        ? (updateData.resolution_note as string | null)
        : (existing.resolution_note as string | null);
    const nextResolutionDays =
      Object.prototype.hasOwnProperty.call(updateData, 'resolution_days')
        ? (updateData.resolution_days as number | null)
        : (existing.resolution_days as number | null);

    const hasResolutionDetails =
      nextResolutionMethod !== null ||
      nextResolutionNote !== null ||
      (nextResolutionDays !== null && nextResolutionDays !== undefined);

    if (hasResolutionDetails && (nextStatus !== 'resolved' || !nextEndedAt)) {
      return { success: false, error: '好返資料只可用於已結束症狀（status=resolved 且有 endedAt）' };
    }

    // Update symptom log
    const { data: updated, error: updateError } = await supabase
      .from('symptom_logs')
      .update(updateData)
      .eq('id', request.symptomId)
      .eq('patient_user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[updateSymptom] update error:', updateError.message);
      return { success: false, error: '更新症狀時發生錯誤' };
    }

    // Write audit log
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      patient_user_id: userId,
      entity: 'symptom_logs',
      entity_id: request.symptomId,
      action: 'update',
      before_json: existing,
      after_json: updated,
    });

    if (auditError) {
      console.error('[updateSymptom] audit log error:', auditError.message);
    }

    return { success: true };
  } catch (error) {
    console.error('[updateSymptom] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新症狀時發生錯誤',
    };
  }
}

// ---------------------------------------------------------------------------
// 3. List Symptoms
// ---------------------------------------------------------------------------

export interface ListSymptomsRequest {
  category?: string;
  status?: 'active' | 'resolved' | 'recurring' | 'all';
  limit?: number;
}

export interface SymptomRecord {
  id: string;
  category: string;
  description: string | null;
  severity: number | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  resolutionMethod: string | null;
  resolutionNote: string | null;
  resolutionDays: number | null;
  loggedVia: string;
  createdAt: string;
}

/**
 * List user's symptom history
 */
export async function listSymptoms(
  userId: string,
  request: ListSymptomsRequest = {}
): Promise<{
  success: boolean;
  symptoms?: SymptomRecord[];
  error?: string;
}> {
  try {
    const supabase = createServiceClient();

    let query = supabase
      .from('symptom_logs')
      .select('id, category, description, severity, status, started_at, ended_at, resolution_method, resolution_note, resolution_days, logged_via, created_at')
      .eq('patient_user_id', userId);

    // Apply filters
    if (request.category !== undefined) {
      if (typeof request.category !== 'string') {
        return { success: false, error: 'category 格式無效' };
      }
      const category = request.category.trim();
      if (category) {
        query = query.eq('category', category);
      }
    }

    if (request.status && request.status !== 'all') {
      if (!VALID_STATUSES.has(request.status)) {
        return { success: false, error: 'status 參數無效' };
      }
      query = query.eq('status', request.status);
    }

    // Order by most recent first
    query = query.order('started_at', { ascending: false });

    // Limit results
    let limit = 10;
    if (request.limit !== undefined) {
      const parsedLimit =
        typeof request.limit === 'number'
          ? request.limit
          : Number.parseInt(String(request.limit), 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return { success: false, error: 'limit 必須為正整數' };
      }
      limit = Math.min(Math.floor(parsedLimit), 50);
    }
    query = query.limit(limit);

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error('[listSymptoms] fetch error:', fetchError.message);
      return { success: false, error: '查詢症狀記錄時發生錯誤' };
    }

    // Transform to camelCase for API response
    const symptoms: SymptomRecord[] = (data || []).map((s) => ({
      id: s.id,
      category: s.category,
      description: s.description,
      severity: s.severity,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      resolutionMethod: s.resolution_method,
      resolutionNote: s.resolution_note,
      resolutionDays: s.resolution_days,
      loggedVia: s.logged_via,
      createdAt: s.created_at,
    }));

    // IMPORTANT: Gemini API requires object response, not array
    return {
      success: true,
      symptoms,
    };
  } catch (error) {
    console.error('[listSymptoms] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢症狀記錄時發生錯誤',
    };
  }
}
