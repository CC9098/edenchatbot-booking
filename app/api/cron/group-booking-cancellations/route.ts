import { NextRequest, NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

import {
  listConfirmedGroupBookingCandidates,
  markBookingIntakeCancelledByEvent,
} from "@/lib/booking-intake-storage";
import { sendBookingCancellationWhatsapp, sendBookingConfirmationWhatsapp } from "@/lib/chatwoot-whatsapp";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import { deleteEvent, getEvent, patchEventPrivateMetadata } from "@/lib/google-calendar";
import {
  DR_WONG_GROUP_BOOKING_CONFIRMED_NOTICE,
  GROUP_BOOKING_POLICIES,
  getGroupSessionCancelAt,
  getGroupSessionStartUtc,
} from "@/lib/group-booking-policy";
import { createManageAccessToken } from "@/lib/widget-booking-management";
import { getClinicWhatsappPhone } from "@/lib/whatsapp-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const GROUP_CONFIRMATION_SENT_KEY = "eden_group_booking_confirmed_whatsapp_sent_at";
const GENERAL_REMINDER_SENT_KEY = "eden_reminder_24h_whatsapp_sent_at";

function buildCandidateDates(now: Date): string[] {
  const dates = new Set<string>();
  for (let offset = 0; offset <= 2; offset += 1) {
    dates.add(
      formatInTimeZone(
        new Date(now.getTime() + offset * 24 * 60 * 60 * 1000),
        HONG_KONG_TIMEZONE,
        "yyyy-MM-dd",
      ),
    );
  }
  return Array.from(dates);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const now = new Date();
  const dates = request.nextUrl.searchParams.get("targetDate")
    ? [request.nextUrl.searchParams.get("targetDate") as string]
    : buildCandidateDates(now);

  const summary = {
    now: now.toISOString(),
    dryRun,
    checkedGroups: 0,
    skippedBeforeCutoff: 0,
    skippedPastSession: 0,
    groupRows: 0,
    groupsMetMinimum: 0,
    groupConfirmationsAlreadySent: 0,
    groupConfirmationsWouldSend: 0,
    groupConfirmationsSent: 0,
    groupConfirmationsFailed: 0,
    groupConfirmationMarked: 0,
    groupConfirmationMarkFailed: 0,
    groupsCancelled: 0,
    calendarDeleted: 0,
    calendarDeleteFailed: 0,
    intakeMarkedCancelled: 0,
    intakeMarkFailed: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    errors: [] as string[],
  };

  for (const policy of GROUP_BOOKING_POLICIES) {
    for (const date of dates) {
      for (const session of policy.sessions) {
        const sessionStartUtc = getGroupSessionStartUtc(date, session.start);
        if (sessionStartUtc <= now) {
          summary.skippedPastSession += 1;
          continue;
        }

        const cancelAt = getGroupSessionCancelAt({
          date,
          sessionStart: session.start,
          cancelHoursBeforeStart: policy.cancelHoursBeforeStart,
        });
        if (cancelAt > now) {
          summary.skippedBeforeCutoff += 1;
          continue;
        }

        summary.checkedGroups += 1;
        const listResult = await listConfirmedGroupBookingCandidates({
          doctorId: policy.doctorId,
          clinicId: policy.clinicId,
          appointmentDate: date,
          startTime: session.start,
          endTime: session.end,
        });

        if (!listResult.success) {
          summary.errors.push(
            `${policy.doctorId}/${policy.clinicId}/${date}/${session.start}: ${listResult.error || "unknown error"}`,
          );
          continue;
        }

        summary.groupRows += listResult.items.length;
        if (listResult.items.length === 0) {
          continue;
        }

        if (listResult.items.length >= policy.minPatients) {
          summary.groupsMetMinimum += 1;
          for (const item of listResult.items) {
            if (dryRun) {
              summary.groupConfirmationsWouldSend += 1;
              continue;
            }

            const eventResult = await getEvent(item.calendarId, item.googleEventId);
            if (!eventResult.success || !eventResult.event) {
              summary.groupConfirmationsFailed += 1;
              summary.errors.push(
                `${item.calendarId}/${item.googleEventId}: ${eventResult.error || "event missing for group confirmation"}`,
              );
              continue;
            }

            if (eventResult.event?.status === "cancelled") {
              summary.groupConfirmationsFailed += 1;
              summary.errors.push(`${item.calendarId}/${item.googleEventId}: event already cancelled`);
              continue;
            }

            if (eventResult.event?.extendedProperties?.private?.[GROUP_CONFIRMATION_SENT_KEY]) {
              summary.groupConfirmationsAlreadySent += 1;
              continue;
            }

            const phoneDigits = normalizePhoneForSearch(item.patientPhone);
            const whatsappResult = await sendBookingConfirmationWhatsapp({
              bookingId: item.googleEventId,
              patientName: item.patientName,
              phone: item.patientPhone,
              email: item.patientEmail,
              doctorNameZh: item.doctorNameZh,
              clinicNameZh: item.clinicNameZh,
              appointmentDate: item.appointmentDate,
              appointmentTime: item.appointmentTime,
              visitType: item.visitType,
              clinicWhatsappPhone: getClinicWhatsappPhone(item.clinicId),
              manageAccessToken: phoneDigits ? createManageAccessToken(phoneDigits) : undefined,
              groupBookingNotice: DR_WONG_GROUP_BOOKING_CONFIRMED_NOTICE,
            });

            if (!whatsappResult.success) {
              summary.groupConfirmationsFailed += 1;
              summary.errors.push(
                `${item.intakeId}: ${whatsappResult.error || "group confirmation whatsapp failed"}`,
              );
              continue;
            }

            summary.groupConfirmationsSent += 1;
            const markResult = await patchEventPrivateMetadata(item.calendarId, item.googleEventId, {
              [GROUP_CONFIRMATION_SENT_KEY]: now.toISOString(),
              [GENERAL_REMINDER_SENT_KEY]: now.toISOString(),
            });
            if (markResult.success) {
              summary.groupConfirmationMarked += 1;
            } else {
              summary.groupConfirmationMarkFailed += 1;
              summary.errors.push(
                `${item.calendarId}/${item.googleEventId}: ${markResult.error || "group confirmation mark failed"}`,
              );
            }
          }
          continue;
        }

        summary.groupsCancelled += 1;
        for (const item of listResult.items) {
          if (!dryRun) {
            const deleteResult = await deleteEvent(item.calendarId, item.googleEventId);
            if (deleteResult.success) {
              summary.calendarDeleted += 1;
            } else {
              summary.calendarDeleteFailed += 1;
              summary.errors.push(
                `${item.calendarId}/${item.googleEventId}: ${deleteResult.error || "calendar delete failed"}`,
              );
            }

            const cancelSync = await markBookingIntakeCancelledByEvent({
              googleEventId: item.googleEventId,
              calendarId: item.calendarId,
            });
            if (cancelSync.success) {
              summary.intakeMarkedCancelled += 1;
            } else {
              summary.intakeMarkFailed += 1;
              summary.errors.push(
                `${item.intakeId}: ${cancelSync.error || "intake cancel mark failed"}`,
              );
            }

            const phoneDigits = normalizePhoneForSearch(item.patientPhone);
            const whatsappResult = await sendBookingCancellationWhatsapp({
              bookingId: item.googleEventId,
              patientName: item.patientName,
              phone: item.patientPhone,
              email: item.patientEmail,
              doctorNameZh: item.doctorNameZh,
              clinicNameZh: item.clinicNameZh,
              appointmentDate: item.appointmentDate,
              appointmentTime: item.appointmentTime,
              cancellationReason: "診所未能安排此節預約，系統已自動取消預約。",
              clinicWhatsappPhone: getClinicWhatsappPhone(item.clinicId),
              manageAccessToken: phoneDigits ? createManageAccessToken(phoneDigits) : undefined,
            });
            if (whatsappResult.success) {
              summary.whatsappSent += 1;
            } else {
              summary.whatsappFailed += 1;
              summary.errors.push(
                `${item.intakeId}: ${whatsappResult.error || "whatsapp cancellation failed"}`,
              );
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, summary });
}
