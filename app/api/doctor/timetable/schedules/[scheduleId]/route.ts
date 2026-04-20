import { NextRequest, NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import { invalidateTimetableConsumers } from '@/lib/timetable-cache-invalidation';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const scheduleId = params.scheduleId?.trim();
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('doctor_schedules').delete().eq('id', scheduleId);

    if (error) {
      console.error('[DELETE /api/doctor/timetable/schedules/[scheduleId]] delete error:', error.message);
      return NextResponse.json({ error: 'Failed to delete schedule version' }, { status: 500 });
    }

    invalidateTimetableConsumers();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[DELETE /api/doctor/timetable/schedules/[scheduleId]] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
