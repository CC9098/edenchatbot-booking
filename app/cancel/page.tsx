'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

function CancelBookingContent() {
                const searchParams = useSearchParams();
                const eventId = searchParams.get('eventId');
                const calendarId = searchParams.get('calendarId');

                const [loading, setLoading] = useState(true);
                const [error, setError] = useState('');
                const [booking, setBooking] = useState<any>(null);
                const [cancelled, setCancelled] = useState(false);
                const [cancelling, setCancelling] = useState(false);

                useEffect(() => {
                                if (!eventId || !calendarId) {
                                                setError('Invalid booking link. Please check your email.');
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
                                                } catch (err) {
                                                                setError('Could not find booking details. It may have already been cancelled.');
                                                } finally {
                                                                setLoading(false);
                                                }
                                }

                                fetchBooking();
                }, [eventId, calendarId]);

                const handleCancel = async () => {
                                setCancelling(true);
                                try {
                                                const res = await fetch(`/api/booking?eventId=${eventId}&calendarId=${calendarId}`, {
                                                                method: 'DELETE',
                                                });
                                                if (!res.ok) throw new Error('Failed to cancel');
                                                setCancelled(true);
                                } catch (err) {
                                                setError('Failed to cancel booking. Please try again or contact the clinic directly.');
                                } finally {
                                                setCancelling(false);
                                }
                };

                if (loading) {
                                return (
                                                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                                                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                                                <p className="text-slate-600">Loading booking details...</p>
                                                </div>
                                );
                }

                if (error) {
                                return (
                                                <div className="mx-auto max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                                                                <h2 className="mb-2 text-lg font-semibold text-red-700">Error</h2>
                                                                <p className="text-red-600">{error}</p>
                                                </div>
                                );
                }

                if (cancelled) {
                                return (
                                                <div className="mx-auto max-w-md rounded-xl border border-emerald-100 bg-emerald-50 p-8 text-center">
                                                                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
                                                                <h2 className="mb-2 text-2xl font-bold text-emerald-800">Booking Cancelled</h2>
                                                                <p className="text-emerald-700">Your appointment has been successfully cancelled.</p>
                                                                <p className="mt-4 text-sm text-emerald-600">You can close this window now.</p>
                                                </div>
                                );
                }

                // Parse booking details for display
                const summary = booking.summary || 'Consultation';
                const start = new Date(booking.start.dateTime);
                const dateStr = start.toLocaleDateString('zh-HK', { month: 'long', day: 'numeric', weekday: 'long' });
                const timeStr = start.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });

                return (
                                <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                                                <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Cancel Appointment</h1>

                                                <div className="mb-8 space-y-4 rounded-xl bg-slate-50 p-5">
                                                                <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service</p>
                                                                                <p className="text-lg font-medium text-slate-800">{summary}</p>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                                <div>
                                                                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</p>
                                                                                                <p className="font-medium text-slate-800">{dateStr}</p>
                                                                                </div>
                                                                                <div>
                                                                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</p>
                                                                                                <p className="font-medium text-slate-800">{timeStr}</p>
                                                                                </div>
                                                                </div>

                                                                <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                                                                                <p className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                                                                Confirmed
                                                                                </p>
                                                                </div>
                                                </div>

                                                <div className="space-y-3">
                                                                <p className="mb-4 text-center text-sm text-slate-600">
                                                                                Are you sure you want to cancel this appointment? This action cannot be undone.
                                                                </p>

                                                                <button
                                                                                onClick={handleCancel}
                                                                                disabled={cancelling}
                                                                                className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                                                >
                                                                                {cancelling ? (
                                                                                                <>
                                                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                                                Cancelling...
                                                                                                </>
                                                                                ) : (
                                                                                                'Confirm Cancellation'
                                                                                )}
                                                                </button>

                                                                <button
                                                                                onClick={() => window.close()} // Won't work in all browsers if not opened by script, but good fallback intent
                                                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                                                                >
                                                                                Keep Appointment
                                                                </button>
                                                </div>
                                </div>
                );
}

export default function CancelPage() {
                return (
                                <main className="min-h-screen bg-slate-50 px-4 py-12 md:py-20">
                                                <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}>
                                                                <CancelBookingContent />
                                                </Suspense>
                                </main>
                );
}
