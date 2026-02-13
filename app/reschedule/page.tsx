'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, otherwise I'll mock it or use standard className

// Define maps locally (matching ChatWidget)
const DOCTOR_REVERSE_MAP: Record<string, string> = {
                '陳家富醫師': 'chan',
                '李芊霖醫師': 'lee',
                '韓曉恩醫師': 'hon',
                '周德健醫師': 'chau',
};

const CLINIC_REVERSE_MAP: Record<string, string> = {
                '中環': 'central',
                '佐敦': 'jordan',
                '荃灣': 'tsuenwan',
};

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

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
                                                setError('Invalid booking link.');
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

                                                                if (docMatch && DOCTOR_REVERSE_MAP[docMatch[1]]) {
                                                                                setDoctor({ id: DOCTOR_REVERSE_MAP[docMatch[1]], nameZh: docMatch[1] });
                                                                }

                                                                if (clinicMatch && CLINIC_REVERSE_MAP[clinicMatch[1]]) {
                                                                                setClinic({ id: CLINIC_REVERSE_MAP[clinicMatch[1]], nameZh: clinicMatch[1] });
                                                                }

                                                } catch (err) {
                                                                setError('Could not find booking details.');
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
                                                                setSlotError('Clinic is closed on this day.');
                                                } else {
                                                                setSlotError('No available slots.');
                                                }
                                } catch (err) {
                                                setSlotError('Failed to load slots.');
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
                                                                setError(data.error || 'Failed to reschedule.');
                                                }
                                } catch (err) {
                                                setError('An error occurred. Please try again.');
                                } finally {
                                                setSubmitting(false);
                                }
                };

                if (loading) {
                                return (
                                                <div className="flex min-h-[50vh] items-center justify-center">
                                                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                                </div>
                                );
                }

                if (error) {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                                                                <h2 className="mb-2 text-lg font-semibold text-red-700">Error</h2>
                                                                <p className="text-red-600">{error}</p>
                                                </div>
                                );
                }

                if (step === 'success') {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-xl border border-emerald-100 bg-emerald-50 p-8 text-center">
                                                                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
                                                                <h2 className="mb-2 text-2xl font-bold text-emerald-800">Reschedule Successful!</h2>
                                                                <p className="text-emerald-700">Your appointment has been updated.</p>
                                                                <div className="mt-6 rounded-lg bg-white/60 p-4 text-left text-sm text-emerald-900">
                                                                                <p><strong>New Time:</strong> {selectedDate} {selectedTime}</p>
                                                                </div>
                                                                <p className="mt-6 text-sm text-emerald-600">You will receive a confirmation email shortly.</p>
                                                </div>
                                );
                }

                if (!doctor || !clinic) {
                                return (
                                                <div className="mx-auto mt-10 max-w-md rounded-xl border border-amber-100 bg-amber-50 p-6 text-center">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                                                                <p className="text-amber-800">
                                                                                We could not automatically identify your doctor or clinic from the booking details.
                                                                                Please contact us via WhatsApp to reschedule.
                                                                </p>
                                                </div>
                                );
                }

                // Parse current booking time
                const currentStart = new Date(booking.start.dateTime);
                const currentDateStr = currentStart.toLocaleDateString('zh-HK', { month: 'long', day: 'numeric', weekday: 'long' });
                const currentTimeStr = currentStart.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });

                return (
                                <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                                                <h1 className="mb-6 text-center text-2xl font-bold text-[#2d5016]">Reschedule Appointment</h1>

                                                {step === 'summary' && (
                                                                <div className="space-y-6">
                                                                                <div className="rounded-xl bg-slate-50 p-5">
                                                                                                <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">Current Appointment</h3>
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
                                                                                                className="flex w-full items-center justify-center rounded-xl bg-[#2d5016] px-4 py-3 font-semibold text-white transition hover:bg-[#1f3810]"
                                                                                >
                                                                                                Select New Time
                                                                                </button>
                                                                </div>
                                                )}

                                                {step === 'date' && (
                                                                <div>
                                                                                <button onClick={() => setStep('summary')} className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-800">
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> Back
                                                                                </button>
                                                                                <h3 className="mb-4 text-lg font-semibold text-slate-800">Select Date</h3>
                                                                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                                                                {dates.map((d) => (
                                                                                                                <button
                                                                                                                                key={d.dateStr}
                                                                                                                                onClick={() => handleDateSelect(d.dateStr)}
                                                                                                                                className="flex flex-col items-center justify-center rounded-lg border border-slate-200 p-3 transition hover:border-[#2d5016] hover:bg-emerald-50"
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
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> Back to Dates
                                                                                </button>
                                                                                <h3 className="mb-4 text-lg font-semibold text-slate-800">Select Time for {selectedDate}</h3>

                                                                                {checkingSlots ? (
                                                                                                <div className="flex justify-center py-8">
                                                                                                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                                                                                </div>
                                                                                ) : slotError ? (
                                                                                                <div className="rounded-lg bg-amber-50 p-4 text-center text-amber-800">
                                                                                                                {slotError}
                                                                                                </div>
                                                                                ) : availableSlots.length === 0 ? (
                                                                                                <div className="rounded-lg bg-slate-50 p-4 text-center text-slate-600">
                                                                                                                No slots available.
                                                                                                </div>
                                                                                ) : (
                                                                                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                                                                                                                {availableSlots.map(time => (
                                                                                                                                <button
                                                                                                                                                key={time}
                                                                                                                                                onClick={() => { setSelectedTime(time); setStep('confirm'); }}
                                                                                                                                                className="rounded-lg border border-emerald-100 bg-emerald-50 py-2 font-medium text-emerald-800 transition hover:bg-emerald-100 hover:shadow-sm"
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
                                                                                                <ChevronLeft className="mr-1 h-4 w-4" /> Back to Time
                                                                                </button>
                                                                                <h3 className="mb-6 text-xl font-bold text-slate-800">Confirm Reschedule</h3>

                                                                                <div className="space-y-4">
                                                                                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 opacity-70">
                                                                                                                <p className="mb-1 text-xs font-bold uppercase text-slate-500">Old Appointment</p>
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

                                                                                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                                                                                                <p className="mb-1 text-xs font-bold uppercase text-emerald-600">New Appointment</p>
                                                                                                                <div className="flex items-center gap-2 text-lg font-bold text-emerald-800">
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
                                                                                                className="mt-8 flex w-full items-center justify-center rounded-xl bg-[#2d5016] px-4 py-3 font-semibold text-white transition hover:bg-[#1f3810] disabled:opacity-70"
                                                                                >
                                                                                                {submitting ? <Loader2 className="animate-spin" /> : 'Confirm Change'}
                                                                                </button>
                                                                </div>
                                                )}

                                </div>
                );
}

export default function ReschedulePage() {
                return (
                                <main className="min-h-screen bg-slate-50 px-4 py-12 md:py-20">
                                                <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}>
                                                                <RescheduleBookingContent />
                                                </Suspense>
                                </main>
                );
}
