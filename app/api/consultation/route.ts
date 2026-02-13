import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendConsultationNotificationEmail } from '@/lib/gmail';

const consultationSchema = z.object({
  reason: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = consultationSchema.parse(body);

    const result = await sendConsultationNotificationEmail({
      patientName: data.name.trim(),
      patientEmail: data.email.trim(),
      patientPhone: data.phone.trim(),
      reason: data.reason.trim(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to submit consultation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    console.error('Consultation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
