"use client";

import { useEffect, useState } from "react";

type ClaimableBooking = {
  id: string;
  appointmentDate: string;
  appointmentTime?: string;
  doctorNameZh?: string;
  serviceLabel?: string;
  status?: string;
};

type ClaimResponse = {
  claimable: ClaimableBooking[];
};

type PostResponse = {
  claimed: string[];
  skipped: string[];
};

type Props = {
  /** Called after bookings are successfully linked. Optional. */
  onClaimed?: () => void;
  /** Called when user clicks "唔係我，跳過". Optional. */
  onDismiss?: () => void;
};

function formatDateCanton(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[1]}年${match[2]}月${match[3]}日`;
}

/**
 * ClaimHistoricalBookingsCard
 *
 * Shown to authenticated users when they have orphan booking_intake rows
 * (phone matches but user_id IS NULL). Lets them click "加入紀錄" to link
 * those bookings to their account, or "唔係我，跳過" to dismiss.
 *
 * - Renders null until data is confirmed to be non-empty (no flash).
 * - Uses service-role-backed API route for the UPDATE.
 */
export function ClaimHistoricalBookingsCard({ onClaimed, onDismiss }: Props) {
  const [bookings, setBookings] = useState<ClaimableBooking[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/claim")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as ClaimResponse;
        if (!cancelled && data.claimable && data.claimable.length > 0) {
          setBookings(data.claimable);
        }
      })
      .catch(() => {
        // Silently ignore — this card is non-critical
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bookings || bookings.length === 0 || dismissed) return null;

  const VISIBLE_COUNT = 5;
  const visibleBookings = expanded ? bookings : bookings.slice(0, VISIBLE_COUNT);
  const hasMore = bookings.length > VISIBLE_COUNT;

  async function handleClaim() {
    if (!bookings) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds: bookings.map((b) => b.id) }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "加入失敗，請稍後再試");
      }

      const data = (await res.json()) as PostResponse;
      if (data.claimed.length === 0) {
        setError("未能加入紀錄，可能已被其他帳號連結。");
        return;
      }

      setSuccessMsg("✓ 已加入！您的完整就診紀錄喺下方。");

      setTimeout(() => {
        setDismissed(true);
        onClaimed?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失敗，請稍後再試");
    } finally {
      setClaiming(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <section className="animate-eden-enter rounded-[24px] border border-amber-200 bg-amber-50/60 p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg leading-none" aria-hidden>📋</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            我們找到您以前的預約紀錄
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            以下預約與您的電話號碼吻合，可加入您的帳號紀錄：
          </p>
        </div>
      </div>

      {/* Booking list */}
      <ul className="mt-4 space-y-2">
        {visibleBookings.map((booking) => (
          <li
            key={booking.id}
            className="rounded-xl border border-amber-100 bg-white/80 px-4 py-3"
          >
            <p className="text-sm font-semibold text-slate-800">
              {formatDateCanton(booking.appointmentDate)}
              {booking.appointmentTime ? ` ${booking.appointmentTime}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[booking.doctorNameZh, booking.serviceLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      {/* Expand / collapse */}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900 transition"
        >
          查看更多 ({bookings.length - VISIBLE_COUNT} 個)
        </button>
      )}

      {/* Success state */}
      {successMsg && (
        <p className="mt-4 text-sm font-semibold text-emerald-700">{successMsg}</p>
      )}

      {/* Error state */}
      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}

      {/* Action buttons */}
      {!successMsg && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20] disabled:opacity-60"
          >
            {claiming ? "正在加入..." : "加入紀錄"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={claiming}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            唔係我，跳過
          </button>
        </div>
      )}
    </section>
  );
}
