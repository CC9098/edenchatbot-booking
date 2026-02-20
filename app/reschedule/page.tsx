'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { CLINIC_ID_BY_NAME_ZH, DOCTOR_ID_BY_NAME_ZH } from '@/shared/clinic-data';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const DISPLAY_TIMEZONE = 'Asia/Hong_Kong';
const HK_DATE_FORMATTER = new Intl.DateTimeFormat('zh-HK', {
                timeZone: DISPLAY_TIMEZONE,
                month: 'long',
                day: 'numeric',
                weekday: 'long',
});
const HK_TIME_FORMATTER = new Intl.DateTimeFormat('zh-HK', {
                timeZone: DISPLAY_TIMEZONE,
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
});

function RescheduleBookingContent() {
                const searchParams = useSearchParams();
                const eventId = searchParams.get('eventId');
                const calendarId = searchParams.get('calendarId');

                const [loading, setLoading] = useState(true);
                const [error, setError] = useState('');
                const [booking, setBooking] = useState<any>(null);

                // Reschedule State
                const [step, setStep] = useState<'summary' | 'date' | 'time' | 'confirm' | 'success'>('summary');
                const [doctor, setDoctor] = useState<{ id: string, nameZh: string } | null>(null);
                const [clinic, setClinic] = useState<{ id: string, nameZh: string } | null>(null);

                const [selectedDate, setSelectedDate] = useState<string>('');
                const [selectedTime, setSelectedTime] = useState<string>('');

                const [checkingSlots, setCheckingSlots] = useState(false);
                const [availableSlots, setAvailableSlots] = useState<string[]>([]);
                const [slotError, setSlotError] = useState('');

                const [submitting, setSubmitting] = useState(false);

                // Computed next 14 days
                const [dates, setDates] = useState<{ dateStr: string, display: string, dayName: string, fullDate: Date }[]>([]);

                useEffect(() => {
                                // Generate dates
                                const d = new Date();
                                const arr = [];
                                for (let i = 1; i <= 14; i++) { // Start from tomorrow to avoid same-day rush, or today? ChatWidget starts i=1 (tomorrow)
                                                const date = new Date(d);
                                                date.setDate(d.getDate() + i);
                                                const month = date.getMonth() + 1;
                                                const day = date.getDate();
                                                const dateStr = `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                arr.push({
                                                                dateStr,
                                                                display: `${month}/${day}`,
                                                                dayName: DAY_NAMES[date.getDay()],
                                                                fullDate: date
                                                });
                                }
                                setDates(arr);
                }, []);

                useEffect(() => {
                                if (!eventId || !calendarId) {
                                                setError('預約連結無效。');
                                                setLoading(false);
                                                return;
                                }

                                async function fetchBooking() {
                                                try {
                                                                const res = await fetch(`/api/booking?eventId=${eventId}&calendarId=${calendarId}`);
                                                                if (!res.ok) {
                                                                                throw new Error('Booking not found');
                                                                }
                                                                const data = await res.json();
                                                                setBooking(data);

                                                                // Parse description
                                                                const desc: string = data.description || '';
                                                                const docMatch = desc.match(/Doctor \/ 醫師: (.+?) \(/);
                                                                const clinicMatch = desc.match(/Clinic \/ 診所: (.+?) \(/);

                                                                if (docMatch && DOCTOR_ID_BY_NAME_ZH[docMatch[1]]) {
                                                                                setDoctor({ id: DOCTOR_ID_BY_NAME_ZH[docMatch[1]], nameZh: docMatch[1] });
                                                                }

                                                                if (clinicMatch && CLINIC_ID_BY_NAME_ZH[clinicMatch[1]]) {
                                                                                setClinic({ id: CLINIC_ID_BY_NAME_ZH[clinicMatch[1]], nameZh: clinicMatch[1] });
                                                                }

                                                } catch (err) {
                                                                setError('找不到預約資料。');
                                                } finally {
                                                                setLoading(false);
                                                }
                                }

                                fetchBooking();
                }, [eventId, calendarId]);

                const fetchSlots = async (dateStr: string) => {
                                if (!doctor || !clinic) return;
                                setCheckingSlots(true);
                                setSlotError('');
                                setAvailableSlots([]);

                                try {
                                                const res = await fetch('/api/availability', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                                doctorId: doctor.id,
                                                                                clinicId: clinic.id,
                                                                                date: dateStr,
                                                                                durationMinutes: 15
                                                                })
                                                });
                                                const data = await res.json();
                                                if (data.slots) {
                                                                setAvailableSlots(data.slots);
                                                } else if (data.isClosed || data.isHoliday) {
                                                                setSlotError('診所當日休診。');
                                                } else if (data.errorCode === 'CALENDAR_UNAVAILABLE') {
                                                                setSlotError('暫時未能讀取預約日曆，請稍後再試或聯絡診所。');
                                                } else {
                                                                setSlotError('當日暫無可預約時段。');
                                                }
                                } catch (err) {
                                                setSlotError('載入時段失敗。');
                                } finally {
                                                setCheckingSlots(false);
                                }
                };

                const handleDateSelect = (dateStr: string) => {
                                setSelectedDate(dateStr);
                                setSelectedTime('');
                                setStep('time');
                                fetchSlots(dateStr);
                };

                const handleRescheduleConfirm = async () => {
                                setSubmitting(true);
                                try {
                                                const res = await fetch('/api/booking', {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                                eventId,
                                                                                calendarId,
                                                                                date: selectedDate,
                                                                                time: selectedTime,
                                                                                durationMinutes: 15
                                                                })
                                                });

                                                const data = await res.json();
                                                if (data.success) {
                                                                setStep('success');
                                                } else {
                                                                setError(data.error || '改期失敗。');
                                                }
                                } catch (err) {
                                                setError('發生錯誤，請稍後再試。');
                                } finally {
                                                setSubmitting(false);
                                }
                };

                if (loading) {
                                return (
                                                <div className="flex min-h-[50vh] items-center justify-center">
                                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                );
                }

                if (error) {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center shadow-sm">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                                                                <h2 className="mb-2 text-lg font-semibold text-red-700">發生錯誤</h2>
                                                                <p className="text-red-600">{error}</p>
                                                </div>
                                );
                }

                if (step === 'success') {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-green-100 bg-green-50 p-8 text-center shadow-sm">
                                                                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
                                                                <h2 className="mb-2 text-2xl font-bold text-green-800">改期成功！</h2>
                                                                <p className="text-green-700">你的預約已更新。</p>
                                                                <div className="mt-6 rounded-lg bg-white/60 p-4 text-left text-sm text-green-900">
                                                                                <p><strong>新預約時間：</strong> {selectedDate} {selectedTime}</p>
                                                                </div>
                                                                <p className="mt-6 text-sm text-primary">你將於稍後收到確認電郵。</p>
                                                </div>
                                );
                }

                if (!doctor || !clinic) {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-amber-100 bg-amber-50 p-6 text-center shadow-sm">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                                                                <p className="text-amber-800">
                                                                                無法從預約資料自動識別你的醫師或診所。
                                                                                請透過 WhatsApp 聯絡我們辦理改期。
                                                                </p>
                                                </div>
                                );
                }

                // Parse current booking time using Hong Kong timezone.
                const currentStartRaw = booking?.start?.dateTime || booking?.start?.date;
                const currentStart = currentStartRaw ? new Date(currentStartRaw) : null;
                const currentDateStr = currentStart ? HK_DATE_FORMATTER.format(currentStart) : '--';
                const currentTimeStr = booking?.start?.dateTime && currentStart
                                ? HK_TIME_FORMATTER.format(currentStart)
                                : '--';

                return (
                                <div className="patient-card mx-auto max-w-xl p-6 md:p-8">
                                                <h1 className="mb-6 text-center text-2xl font-bold text-primary">更改預約</h1>

                                                {step === 'summary' && (
                                                                <div className="space-y-6">
                                                                                <div className="rounded-2xl bg-slate-50 p-5">
                                                                                                <h3 className="mb-3 text-sm font-semibold text-slate-500">目前預約</h3>
                                                                                                <p className="text-lg font-semibold text-slate-800">{doctor.nameZh} @ {clinic.nameZh}</p>
                                                                                                <div className="mt-2 flex items-center gap-2 text-slate-600">
                                                                                                                <Calendar className="h-4 w-4" />
                                                                                                                <span>{currentDateStr}</span>
                                                                                                </div>
                                                                                                <div className="mt-1 flex items-center gap-2 text-slate-600">
                                                                                                                <Clock className="h-4 w-4" />
                                                                                                                <span>{currentTimeStr}</span>
                                                                                                </div>
                                                                                </div>

                                                                                <button
                                                                                                onClick={() => setStep('date')}
                                                                                                className="flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover"
                                                                                >
                                                                                                選擇新時段
                                                                                </button>
                                                                </div>
                                                )}

                                                {step === 'date' && (
                                                                <div>
                                                                                <button onClick={() => setStep('summary')} className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-800">
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> 返回
                                                                                </button>
                                                                                <h3 className="mb-4 text-lg font-semibold text-slate-800">選擇日期</h3>
                                                                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                                                                {dates.map((d) => (
                                                                                                                <button
                                                                                                                                key={d.dateStr}
                                                                                                                                onClick={() => handleDateSelect(d.dateStr)}
                                                                                                                                className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-3 transition hover:border-primary hover:bg-primary-light"
                                                                                                                >
                                                                                                                                <span className="text-xs font-medium text-slate-500">{d.dayName}</span>
                                                                                                                                <span className="text-lg font-bold text-slate-800">{d.display}</span>
                                                                                                                </button>
                                                                                                ))}
                                                                                </div>
                                                                </div>
                                                )}

                                                {step === 'time' && (
                                                                <div>
                                                                                <button onClick={() => setStep('date')} className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-800">
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> 返回日期列表
                                                                                </button>
                                                                                <h3 className="mb-4 text-lg font-semibold text-slate-800">選擇 {selectedDate} 的時段</h3>

                                                                                {checkingSlots ? (
                                                                                                <div className="flex justify-center py-8">
                                                                                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                                                                </div>
                                                                                ) : slotError ? (
                                                                                                <div className="rounded-lg bg-amber-50 p-4 text-center text-amber-800">
                                                                                                                {slotError}
                                                                                                </div>
                                                                                ) : availableSlots.length === 0 ? (
                                                                                                <div className="rounded-lg bg-slate-50 p-4 text-center text-slate-600">
                                                                                                                暫無可預約時段。
                                                                                                </div>
                                                                                ) : (
                                                                                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                                                                                                                {availableSlots.map(time => (
                                                                                                                                <button
                                                                                                                                                key={time}
                                                                                                                                                onClick={() => { setSelectedTime(time); setStep('confirm'); }}
                                                                                                                                                className="rounded-xl border border-green-100 bg-green-50 py-2 font-medium text-green-800 transition hover:bg-[#d1ead1] hover:shadow-sm"
                                                                                                                                >
                                                                                                                                                {time}
                                                                                                                                </button>
                                                                                                                ))}
                                                                                                </div>
                                                                                )}
                                                                </div>
                                                )}

                                                {step === 'confirm' && (
                                                                <div>
                                                                                <button onClick={() => setStep('time')} className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-800">
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> 返回時段列表
                                                                                </button>
                                                                                <h3 className="mb-6 text-xl font-bold text-slate-800">確認更改預約</h3>

                                                                                <div className="space-y-4">
                                                                                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 opacity-70">
                                                                                                                <p className="mb-1 text-xs font-bold text-slate-500">原預約</p>
                                                                                                                <div className="flex items-center gap-2 text-slate-600 line-through">
                                                                                                                                <Calendar className="h-4 w-4" />
                                                                                                                                <span>{currentDateStr}</span>
                                                                                                                                <Clock className="h-4 w-4" />
                                                                                                                                <span>{currentTimeStr}</span>
                                                                                                                </div>
                                                                                                </div>

                                                                                                <div className="flex justify-center">
                                                                                                                <ChevronRight className="h-6 w-6 rotate-90 text-slate-400 sm:rotate-0" />
                                                                                                </div>

                                                                                                <div className="rounded-2xl border border-green-200 bg-primary-light p-4 shadow-sm">
                                                                                                                <p className="mb-1 text-xs font-bold text-primary">新預約</p>
                                                                                                                <div className="flex items-center gap-2 text-lg font-bold text-green-800">
                                                                                                                                <Calendar className="h-5 w-5" />
                                                                                                                                <span>{selectedDate}</span>
                                                                                                                                <Clock className="h-5 w-5" />
                                                                                                                                <span>{selectedTime}</span>
                                                                                                                </div>
                                                                                                </div>
                                                                                </div>

                                                                                <button
                                                                                                onClick={handleRescheduleConfirm}
                                                                                                disabled={submitting}
                                                                                                className="mt-8 flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-70"
                                                                                >
                                                                                                {submitting ? <Loader2 className="animate-spin" /> : '確認更改'}
                                                                                </button>
                                                                </div>
                                                )}

                                </div>
                );
}

export default function ReschedulePage() {
                return (
                                <main className="patient-pane px-4 py-12 md:py-20">
                                                <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                                                                <RescheduleBookingContent />
                                                </Suspense>
                                </main>
                );
}
