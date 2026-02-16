'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
                                                setError('預約連結無效，請檢查電郵內容。');
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
                                                                setError('找不到預約資料，可能已經取消。');
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
                                                setError('取消預約失敗，請稍後再試或直接聯絡診所。');
                                } finally {
                                                setCancelling(false);
                                }
                };

                if (loading) {
                                return (
                                                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                                                                <Loader2 className="h-8 w-8 animate-spin text-[#2d5016]" />
                                                                <p className="text-slate-600">正在載入預約資料...</p>
                                                </div>
                                );
                }

                if (error) {
                                return (
                                                <div className="mx-auto max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center">
                                                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                                                                <h2 className="mb-2 text-lg font-semibold text-red-700">發生錯誤</h2>
                                                                <p className="text-red-600">{error}</p>
                                                </div>
                                );
                }

                if (cancelled) {
                                return (
                                                <div className="mx-auto max-w-md rounded-xl border border-green-100 bg-green-50 p-8 text-center">
                                                                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
                                                                <h2 className="mb-2 text-2xl font-bold text-green-800">預約已取消</h2>
                                                                <p className="text-green-700">你的預約已成功取消。</p>
                                                                <p className="mt-4 text-sm text-green-600">你現在可以關閉此視窗。</p>
                                                </div>
                                );
                }

                // Parse booking details for display using Hong Kong timezone.
                const summary = booking.summary || '諮詢服務';
                const startRaw = booking?.start?.dateTime || booking?.start?.date;
                const start = startRaw ? new Date(startRaw) : null;
                const dateStr = start ? HK_DATE_FORMATTER.format(start) : '--';
                const timeStr = booking?.start?.dateTime && start
                                ? HK_TIME_FORMATTER.format(start)
                                : '--';

                return (
                                <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                                                <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">取消預約</h1>

                                                <div className="mb-8 space-y-4 rounded-xl bg-slate-50 p-5">
                                                                <div>
                                                                                <p className="text-xs font-semibold tracking-wider text-slate-500">服務</p>
                                                                                <p className="text-lg font-medium text-slate-800">{summary}</p>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                                <div>
                                                                                                <p className="text-xs font-semibold tracking-wider text-slate-500">日期</p>
                                                                                                <p className="font-medium text-slate-800">{dateStr}</p>
                                                                                </div>
                                                                                <div>
                                                                                                <p className="text-xs font-semibold tracking-wider text-slate-500">時間</p>
                                                                                                <p className="font-medium text-slate-800">{timeStr}</p>
                                                                                </div>
                                                                </div>

                                                                <div>
                                                                                <p className="text-xs font-semibold tracking-wider text-slate-500">狀態</p>
                                                                                <p className="inline-flex rounded-full bg-[#e8f5e0] px-2 py-0.5 text-xs font-medium text-[#2d5016]">
                                                                                                已確認
                                                                                </p>
                                                                </div>
                                                </div>

                                                <div className="space-y-3">
                                                                <p className="mb-4 text-center text-sm text-slate-600">
                                                                                你確定要取消此預約嗎？此操作無法還原。
                                                                </p>

                                                                <button
                                                                                onClick={handleCancel}
                                                                                disabled={cancelling}
                                                                                className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                                                >
                                                                                {cancelling ? (
                                                                                                <>
                                                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                                                取消中...
                                                                                                </>
                                                                                ) : (
                                                                                                '確認取消'
                                                                                )}
                                                                </button>

                                                                <button
                                                                                onClick={() => window.close()} // Won't work in all browsers if not opened by script, but good fallback intent
                                                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                                                                >
                                                                                保留預約
                                                                </button>
                                                </div>
                                </div>
                );
}

export default function CancelPage() {
                return (
                                <main className="min-h-screen bg-slate-50 px-4 py-12 md:py-20">
                                                <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#2d5016]" /></div>}>
                                                                <CancelBookingContent />
                                                </Suspense>
                                </main>
                );
}
