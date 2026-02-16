/**
 * Symptom Conversation Helpers
 *
 * These functions are designed to be called by Gemini AI via Function Calling
 * to enable symptom logging and tracking in the chat interface.
 */

import { createServiceClient } from '@/lib/supabase';
import { fromZonedTime } from 'date-fns-tz';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

// ---------------------------------------------------------------------------
// 1. Log Symptom
// ---------------------------------------------------------------------------

export interface LogSymptomRequest {
  category: string;
  description?: string;
  severity?: number; // 1-5
  startedAt: string; // YYYY-MM-DD
  endedAt?: string;  // YYYY-MM-DD
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
    if (!request.category || typeof request.category !== 'string') {
      return { success: false, error: '症狀類別為必填' };
    }

    if (!request.startedAt || typeof request.startedAt !== 'string') {
      return { success: false, error: '開始日期為必填' };
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request.startedAt)) {
      return { success: false, error: '開始日期格式無效，請使用 YYYY-MM-DD' };
    }

    if (request.endedAt && !dateRegex.test(request.endedAt)) {
      return { success: false, error: '結束日期格式無效，請使用 YYYY-MM-DD' };
    }

    // Validate severity
    if (request.severity !== undefined) {
      if (typeof request.severity !== 'number' || request.severity < 1 || request.severity > 5) {
        return { success: false, error: '嚴重程度必須介於 1-5 之間' };
      }
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

    if (request.description) {
      insertData.description = request.description.trim();
    }

    if (request.severity) {
      insertData.severity = request.severity;
    }

    if (request.endedAt) {
      insertData.ended_at = request.endedAt;
      insertData.status = 'resolved'; // If ended_at is provided, mark as resolved
    }

    // Insert symptom log
    const { data: inserted, error: insertError } = await supabase
      .from('symptom_logs')
      .insert(insertData)
      .select('id, patient_user_id, category, description, severity, status, started_at, ended_at, logged_via, created_at')
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
  endedAt?: string;    // YYYY-MM-DD
  status?: 'resolved' | 'recurring' | 'active';
  severity?: number;   // 1-5
  description?: string;
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
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (request.endedAt && !dateRegex.test(request.endedAt)) {
        return { success: false, error: '結束日期格式無效，請使用 YYYY-MM-DD' };
      }
      updateData.ended_at = request.endedAt || null;

      // If endedAt is provided and status not explicitly set, mark as resolved
      if (request.endedAt && !request.status) {
        updateData.status = 'resolved';
      }
    }

    if (request.status !== undefined) {
      updateData.status = request.status;
    }

    if (request.severity !== undefined) {
      if (typeof request.severity !== 'number' || request.severity < 1 || request.severity > 5) {
        return { success: false, error: '嚴重程度必須介於 1-5 之間' };
      }
      updateData.severity = request.severity;
    }

    if (request.description !== undefined) {
      updateData.description = request.description ? request.description.trim() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: '沒有需要更新的資料' };
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
  status?: 'active' | 'resolved' | 'all';
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
      .select('id, category, description, severity, status, started_at, ended_at, logged_via, created_at')
      .eq('patient_user_id', userId);

    // Apply filters
    if (request.category) {
      query = query.eq('category', request.category);
    }

    if (request.status && request.status !== 'all') {
      query = query.eq('status', request.status);
    }

    // Order by most recent first
    query = query.order('started_at', { ascending: false });

    // Limit results
    const limit = request.limit && request.limit > 0 ? Math.min(request.limit, 50) : 10;
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
