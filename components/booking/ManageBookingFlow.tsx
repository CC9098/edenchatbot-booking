'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Ticket,
} from 'lucide-react';

type ManageAction = 'reschedule' | 'cancel';

type VerifiedBooking = {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  patientName: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitType: 'first' | 'followup';
  clinicWhatsappUrl: string | null;
  canSelfManage: boolean;
  message: string;
  manageToken?: string;
};

type ActionResult = {
  message: string;
  booking: {
    bookingId: string;
    doctorId: string;
    doctorNameZh: string;
    clinicId: string;
    clinicNameZh: string;
    appointmentDate: string;
    appointmentTime: string;
    clinicWhatsappUrl: string | null;
  };
};

type ManageBookingFlowProps = {
  action: ManageAction;
  manageAccessToken?: string | null;
};

const HK_DATE_LABEL = new Intl.DateTimeFormat('zh-HK', {
  timeZone: 'Asia/Hong_Kong',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

function getActionLabel(action: ManageAction) {
  return action === 'reschedule' ? '更改預約' : '取消預約';
}

function buildUpcomingDateChoices() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value || '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value || '0');
  const day = Number(parts.find((part) => part.type === 'day')?.value || '0');
  const start = new Date(Date.UTC(year, month - 1, day));

  return Array.from({ length: 14 }, (_, index) => {
    const value = new Date(start);
    value.setUTCDate(start.getUTCDate() + index);
    const dateStr = value.toISOString().slice(0, 10);
    const labelDate = new Date(`${dateStr}T12:00:00+08:00`);

    return {
      dateStr,
      shortDay: ['日', '一', '二', '三', '四', '五', '六'][labelDate.getUTCDay()],
      label: HK_DATE_LABEL.format(labelDate),
      compact: `${value.getUTCMonth() + 1}/${value.getUTCDate()}`,
    };
  });
}

function formatBookingDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00+08:00`);
  const dateLabel = HK_DATE_LABEL.format(value);
  return `${dateLabel} ${time}`;
}

function visitTypeLabel(value: VerifiedBooking['visitType']) {
  return value === 'followup' ? '覆診' : '初診';
}

function FeedbackBanner({
  type,
  text,
}: {
  type: 'error' | 'success' | 'info';
  text: string;
}) {
  const styles =
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-primary/15 bg-primary-light text-primary';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {text}
    </div>
  );
}

function BookingSummaryCard({
  booking,
  selected,
  onSelect,
}: {
  booking: VerifiedBooking;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !booking.canSelfManage;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full overflow-hidden rounded-[24px] border p-4 text-left transition sm:p-5 ${
        disabled
          ? 'cursor-not-allowed border-amber-200 bg-amber-50/90 text-amber-900'
          : selected
            ? 'border-primary bg-white shadow-[0_18px_40px_rgba(53,96,32,0.12)]'
            : 'border-primary/10 bg-white hover:border-primary/30 hover:shadow-[0_16px_32px_rgba(53,96,32,0.08)]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
            {visitTypeLabel(booking.visitType)}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">{booking.doctorNameZh}</h3>
          <p className="mt-1 truncate text-sm text-slate-600">{booking.clinicNameZh}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">病人：{booking.patientName}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            disabled ? 'bg-amber-100 text-amber-800' : 'bg-primary-light text-primary'
          }`}
        >
          {disabled ? '需姑娘協助' : selected ? '已選擇' : '可自助處理'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{formatBookingDateTime(booking.appointmentDate, booking.appointmentTime)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="truncate">預約編號：{booking.bookingId}</span>
        </div>
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${disabled ? 'text-amber-800' : 'text-slate-500'}`}>
        {booking.message}
      </p>
    </button>
  );
}

export function ManageBookingFlow({ action, manageAccessToken }: ManageBookingFlowProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [requestSucceeded, setRequestSucceeded] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [bookings, setBookings] = useState<VerifiedBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState('');
  const [supportWhatsappUrl, setSupportWhatsappUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [dateChoices, setDateChoices] = useState(() => buildUpcomingDateChoices());

  const selectedBooking = bookings.find((booking) => booking.bookingId === selectedBookingId) || null;

  useEffect(() => {
    setDateChoices(buildUpcomingDateChoices());
  }, []);

  // Auto-verify manage access token from WhatsApp link (zero-OTP path)
  useEffect(() => {
    if (!manageAccessToken) return;

    let cancelled = false;
    setTokenVerifying(true);
    setFeedback(null);

    (async () => {
      try {
        const response = await fetch('/api/widget-booking/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: manageAccessToken }),
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setFeedback({ type: 'error', text: data.error || '管理連結已失效，請使用電話驗證。' });
          return;
        }

        const nextBookings = Array.isArray(data.bookings) ? (data.bookings as VerifiedBooking[]) : [];
        setBookings(nextBookings);
        setSelectedBookingId(nextBookings.length === 1 ? nextBookings[0].bookingId : '');
        setMaskedPhone(data.maskedPhone || '');
        setTokenVerified(true);
        setRequestSucceeded(true);
        setFeedback({ type: 'success', text: data.message || '已驗證，請繼續管理你的預約。' });
      } catch {
        if (!cancelled) {
          setFeedback({ type: 'error', text: '驗證管理連結時發生錯誤，請使用電話驗證。' });
        }
      } finally {
        if (!cancelled) {
          setTokenVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manageAccessToken]);

  useEffect(() => {
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotError('');
    setResult(null);
  }, [selectedBookingId, action]);

  async function requestCode() {
    if (!phone.trim()) {
      setFeedback({ type: 'error', text: '請輸入預約時使用的 WhatsApp 電話號碼。' });
      return;
    }

    setRequestingCode(true);
    setRequestSucceeded(false);
    setFeedback(null);
    setSupportWhatsappUrl(null);
    setMaskedPhone('');
    setBookings([]);
    setSelectedBookingId('');
    setResult(null);

    try {
      const response = await fetch('/api/widget-booking/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || '暫時未能發送驗證碼。' });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || null);
        return;
      }

      setMaskedPhone(data.maskedPhone || '');
      setRequestSucceeded(true);
      setFeedback({ type: 'success', text: data.message || '驗證碼已發送。' });
      setCode('');
    } catch {
      setFeedback({ type: 'error', text: '發送驗證碼時發生錯誤，請稍後再試。' });
    } finally {
      setRequestingCode(false);
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestCode();
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setFeedback({ type: 'error', text: '請輸入 6 位數驗證碼。' });
      return;
    }

    setVerifyingCode(true);
    setFeedback(null);
    setSupportWhatsappUrl(null);

    try {
      const response = await fetch('/api/widget-booking/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || '驗證碼不正確，請重新輸入。' });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || null);
        return;
      }

      const nextBookings = Array.isArray(data.bookings) ? (data.bookings as VerifiedBooking[]) : [];
      setBookings(nextBookings);
      setSelectedBookingId(nextBookings.length === 1 ? nextBookings[0].bookingId : '');
      setFeedback({ type: 'success', text: data.message || '已完成驗證。' });
      setMaskedPhone(data.maskedPhone || '');
      setSupportWhatsappUrl(null);
    } catch {
      setFeedback({ type: 'error', text: '驗證時發生錯誤，請稍後再試。' });
    } finally {
      setVerifyingCode(false);
    }
  }

  async function loadSlots(date: string) {
    if (!selectedBooking) return;

    setSelectedDate(date);
    setSelectedTime('');
    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setFeedback(null);

    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedBooking.doctorId,
          clinicId: selectedBooking.clinicId,
          date,
          durationMinutes: selectedBooking.durationMinutes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSlotError(data.error || '暫時未能讀取可預約時段。');
        return;
      }

      if (Array.isArray(data.slots) && data.slots.length > 0) {
        setAvailableSlots(data.slots);
        return;
      }

      if (data.isClosed || data.isHoliday) {
        setSlotError('該日未有門診時段可供更改。');
        return;
      }

      setSlotError('該日暫時未有可更改時段。');
    } catch {
      setSlotError('載入時段時發生錯誤，請稍後再試。');
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!selectedBooking?.manageToken) {
      setFeedback({ type: 'error', text: '管理憑證已失效，請重新驗證。' });
      return;
    }

    if (action === 'reschedule' && (!selectedDate || !selectedTime)) {
      setFeedback({ type: 'error', text: '請先選擇新的日期和時段。' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    setSupportWhatsappUrl(selectedBooking.clinicWhatsappUrl || null);

    try {
      const response = await fetch(
        action === 'reschedule' ? '/api/widget-booking/reschedule' : '/api/widget-booking/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'reschedule'
              ? { manageToken: selectedBooking.manageToken, date: selectedDate, time: selectedTime }
              : { manageToken: selectedBooking.manageToken },
          ),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || `${getActionLabel(action)}失敗，請稍後再試。` });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || selectedBooking.clinicWhatsappUrl || null);
        return;
      }

      setResult(data as ActionResult);
      setFeedback({ type: 'success', text: data.message || `${getActionLabel(action)}成功。` });
      setSupportWhatsappUrl(null);
    } catch {
      setFeedback({ type: 'error', text: `${getActionLabel(action)}時發生錯誤，請稍後再試。` });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="patient-card mx-auto max-w-5xl overflow-hidden p-5 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">
            {getActionLabel(action)}
          </h1>
          <div className="rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
            步驟：
            {tokenVerified ? ' 1. 已驗證' : ' 1. 驗證電話'}
            {bookings.length > 0 || requestSucceeded ? '  2. 選擇預約' : '  2. 預約卡片'}
            {action === 'reschedule' ? '  3. 更改預約' : '  3. 取消預約'}
          </div>
        </div>

        {feedback ? <FeedbackBanner type={feedback.type} text={feedback.text} /> : null}

        {tokenVerifying ? (
          <div className="flex items-center justify-center gap-3 rounded-[24px] border border-primary/10 bg-white p-8 shadow-sm sm:p-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-base text-slate-600">正在驗證管理連結⋯</span>
          </div>
        ) : null}

        <section
          className={`grid gap-5 sm:gap-6 ${tokenVerified ? '' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}
          style={tokenVerifying ? { display: 'none' } : undefined}
        >
          {!tokenVerified ? (
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900">驗證身份</h2>

              <div className="mt-4 space-y-5">
                <form className="space-y-4" onSubmit={handleRequestCode}>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="manage-booking-phone">
                      WhatsApp 電話號碼
                    </label>
                    <input
                      id="manage-booking-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="例如 9123 4567 / +852 9123 4567"
                      className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={requestingCode}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {requestingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : '發送驗證碼'}
                  </button>
                </form>

                <div className="border-t border-slate-200 pt-5">
                  <form className="space-y-4" onSubmit={handleVerifyCode}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">驗證碼</h3>
                      <span className="truncate text-xs text-slate-500">{maskedPhone || '先發送驗證碼'}</span>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700" htmlFor="manage-booking-code">
                        驗證碼
                      </label>
                      <input
                        id="manage-booking-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="輸入 6 位數驗證碼"
                        className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base tracking-[0.3em] text-slate-900 outline-none transition focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        disabled={!requestSucceeded || verifyingCode}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {verifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : '驗證並查看預約'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void requestCode()}
                        disabled={requestingCode}
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        重新發送
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">選擇預約</h2>
                {bookings.length > 0 ? (
                  <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                    {bookings.length} 筆
                  </span>
                ) : null}
              </div>

              {bookings.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {bookings.map((booking) => (
                    <BookingSummaryCard
                      key={booking.bookingId}
                      booking={booking}
                      selected={selectedBookingId === booking.bookingId}
                      onSelect={() => setSelectedBookingId(booking.bookingId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm leading-relaxed text-slate-500">
                  {tokenVerified ? '暫時沒有可處理預約。' : '完成驗證後顯示在這裡。'}
                </div>
              )}
            </div>

            {selectedBooking && !selectedBooking.canSelfManage ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-amber-900">此預約需由姑娘協助</h3>
                    <p className="text-sm leading-relaxed text-amber-800">{selectedBooking.message}</p>
                    {selectedBooking.clinicWhatsappUrl ? (
                      <a
                        href={selectedBooking.clinicWhatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover sm:w-auto"
                      >
                        WhatsApp 聯絡姑娘
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              null
            )}

            {selectedBooking && selectedBooking.canSelfManage && action === 'reschedule' && !result ? (
              <div className="space-y-5 sm:space-y-6">
                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-lg font-semibold text-slate-900">新日期</h3>
                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {dateChoices.map((dateOption) => (
                    <button
                      key={dateOption.dateStr}
                      type="button"
                      onClick={() => void loadSlots(dateOption.dateStr)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        selectedDate === dateOption.dateStr
                          ? 'border-primary bg-primary-light'
                          : 'border-slate-200 bg-slate-50 hover:border-primary/30 hover:bg-white'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/60">
                        星期{dateOption.shortDay}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{dateOption.compact}</p>
                      <p className="mt-1 text-sm text-slate-500">{dateOption.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-slate-900">新時段</h3>
                </div>

                {slotsLoading ? (
                  <div className="mt-6 flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : slotError ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {slotError}
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {availableSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`min-h-11 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          selectedTime === time
                            ? 'border-primary bg-primary text-white'
                            : 'border-primary/15 bg-primary-light text-primary hover:bg-white'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                    選擇日期後，這裡會顯示可更改的時段。
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="text-lg font-semibold text-slate-900">確認</h3>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">目前預約</p>
                    <p className="mt-3 text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                    <p className="mt-3 text-sm text-slate-700">
                      {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/15 bg-primary-light p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">新預約</p>
                    <p className="mt-3 text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                    <p className="mt-3 text-sm text-slate-700">
                      {selectedDate && selectedTime ? formatBookingDateTime(selectedDate, selectedTime) : '請先選擇日期和時段'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConfirmAction()}
                  disabled={actionLoading || !selectedDate || !selectedTime}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認更改預約'}
                </button>
              </div>
              </div>
            ) : null}

            {selectedBooking && selectedBooking.canSelfManage && action === 'cancel' && !result ? (
              <div className="rounded-[24px] border border-red-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900">確認取消預約</h3>
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50/80 p-5">
                  <p className="text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-red-700">
                    取消後，此預約時段會立即釋出。如需重新安排，需要重新預約。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConfirmAction()}
                  disabled={actionLoading}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認取消預約'}
                </button>
              </div>
            ) : null}

            {result ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-emerald-900">
                      {action === 'reschedule' ? '已成功更改預約' : '已成功取消預約'}
                    </h3>
                    <p className="text-sm leading-relaxed text-emerald-800">{result.message}</p>
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{result.booking.doctorNameZh}</p>
                      <p className="mt-1">{result.booking.clinicNameZh}</p>
                      {action === 'reschedule' ? (
                        <p className="mt-3">
                          新時間：{formatBookingDateTime(result.booking.appointmentDate, result.booking.appointmentTime)}
                        </p>
                      ) : (
                        <p className="mt-3">
                          已取消時間：{formatBookingDateTime(selectedBooking!.appointmentDate, selectedBooking!.appointmentTime)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/booking-whatsapp"
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
                      >
                        重新預約
                      </Link>
                      <Link
                        href="/manage-booking"
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
                      >
                        返回預約管理
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {supportWhatsappUrl ? (
              <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">需要人工協助？</h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      如果目前未能自助處理，你可以直接 WhatsApp 聯絡姑娘跟進。
                    </p>
                    <a
                      href={supportWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover sm:w-auto"
                    >
                      WhatsApp 聯絡姑娘
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
